import fs from 'fs';
import FormData from 'form-data';
import engineClient from './engine.client.js';
import Material from '../models/material.model.js';
import Subject from '../models/subject.model.js';
import File from '../models/file.model.js';
import User from '../models/user.model.js';
import SubjectService from './subject.service.js';
import SettingsService from './settings.service.js';
import QuotaService from './quota.service.js';
import FallbackGenerationService from './fallback_generation.service.js';
import AlertService from './alert.service.js';
import { query, withTransaction } from '../utils/config/db.js';
import { enforceGenerationConstraintsForPersistence } from '../utils/generationConstraints.js';
import {
  COMPLETED,
  FAILED,
  FAILURE,
  PENDING_JOB,
  PROCESSING,
  RECEIVED,
  STARTED,
  SUCCESS,
  TERMINAL_STATUSES,
  normalizeStatus,
} from '../constants/status.enum.js';

const generationConstraintByMaterialId = new Map();

const TASK_TYPE_TO_MATERIAL_TYPE = {
  summary: 'summary',
  quiz: 'quiz',
  flashcards: 'flashcards',
  mock_exam: 'exam',
};

const normalizeExamPayload = (aiGeneratedContent) => {
  if (!aiGeneratedContent || typeof aiGeneratedContent !== 'object') return aiGeneratedContent;
  if (aiGeneratedContent.type !== 'exam') return aiGeneratedContent;

  const content = aiGeneratedContent.content;
  if (!content || typeof content !== 'object' || !Array.isArray(content.questions)) {
    return aiGeneratedContent;
  }

  const questions = content.questions.map((q, idx) => ({
    ...q,
    id: idx + 1,
  }));

  const answerSheet = Array.isArray(content.answer_sheet)
    ? content.answer_sheet.map((item, idx) => ({
        ...item,
        question_id: idx + 1,
      }))
    : content.answer_sheet;

  return {
    ...aiGeneratedContent,
    content: {
      ...content,
      questions,
      answer_sheet: answerSheet,
    },
  };
};

class MaterialService {
  /**
   * processDocument passes the entire upload payload (PDF + text) to the Python AI engine.
   */
  static async processDocument(userId, file, title, content, type, subjectId = null, options = {}) {
    const { skipDuplicateCheck, conflictResolution } = options;

    const baseTitle = title || (file ? file.originalname : 'Untitled Material');
    let workingTitle = baseTitle.trim();
    const opContext = {
      userId,
      subjectId,
      title: workingTitle,
      operation: 'processDocument',
      conflictResolution,
    };

    let finalSubjectId = subjectId;
    if (!finalSubjectId) {
      const importedSubject = await SubjectService.getOrCreateImportedSubject(userId);
      finalSubjectId = importedSubject.id;
      opContext.subjectId = finalSubjectId;
    }

    // ── CONFLICT RESOLUTION: restore ────────────────────────────────────────
    if (conflictResolution === 'restore') {
      const trashed = await Material.findTrashedByTitle(userId, finalSubjectId, workingTitle, type);
      if (!trashed) {
        const error = new Error('No trashed document found with this title.');
        error.statusCode = 404;
        error.code = 'NO_TRASHED_MATERIAL';
        throw error;
      }
      const restored = await Material.restore(trashed.id, userId);
      if (!restored) {
        const error = new Error('Failed to restore document.');
        error.statusCode = 500;
        error.code = 'RESTORE_FAILED';
        throw error;
      }
      await Subject.touch(finalSubjectId, userId);
      const resultDoc = await Material.findById(trashed.id, userId);
      resultDoc._conflictResolution = 'restore';
      return resultDoc;
    }

    // ── QUOTA CHECK ─────────────────────────────────────────────────────────
    const incomingSizeBytes = file ? file.size : Buffer.byteLength(content || '', 'utf8');
    const allowance = await QuotaService.checkUploadAllowance(userId, incomingSizeBytes);

    // ── CONFLICT RESOLUTION: duplicate ──────────────────────────────────────
    if (conflictResolution === 'duplicate') {
      workingTitle = await this._resolveUniqueTitle(userId, finalSubjectId, workingTitle);
    }

    // ── STANDARD DUPLICATE CHECK ───────────────────────────────────────────
    if (!skipDuplicateCheck) {
      const existing = await Material.findActiveByTitle(userId, finalSubjectId, workingTitle, type);
      if (existing) {
        const error = new Error('A document with this title already exists in this subject.');
        error.statusCode = 409;
        error.code = 'ACTIVE_DUPLICATE_MATERIAL';
        error.data = { materialId: existing.id, title: existing.title, type: existing.type };
        throw error;
      }

      const trashed = await Material.findTrashedByTitle(userId, finalSubjectId, workingTitle, type);
      if (trashed) {
        const error = new Error('This document exists in your trash.');
        error.statusCode = 409;
        error.code = 'TRASH_DUPLICATE_MATERIAL';
        error.data = { materialId: trashed.id, title: trashed.title, type: trashed.type };
        throw error;
      }
    }

    const documentRecord = await Material.create(
      userId,
      finalSubjectId,
      workingTitle,
      content || '',
      type,
      PENDING_JOB
    );

    let fileData = null;
    if (file) {
      const fileName = file.filename || file.originalname;
      const filePath = file.path;

      const fileRecord = await File.create(
        userId,
        finalSubjectId,
        documentRecord.id,
        fileName,
        file.originalname,
        file.mimetype,
        file.size,
        filePath
      );
      fileData = {
        name: file.originalname,
        mimetype: file.mimetype,
        path: filePath,
        id: fileRecord.id,
      };
    }

    await Subject.touch(finalSubjectId, userId);

    console.info(`[MaterialService] Starting async processing: ${JSON.stringify(opContext)}`);

    try {
      const formData = new FormData();
      formData.append('document_id', documentRecord.id);
      formData.append('subject_id', finalSubjectId);
      formData.append('user_id', userId);

      if (fileData) {
        formData.append('file_path', fileData.path);
        formData.append('file', fs.createReadStream(fileData.path), {
          filename: fileData.name,
          contentType: fileData.mimetype,
        });
      } else {
        formData.append('content', content || '');
      }

      const aiResponse = await engineClient.post('/process-document', formData, {
        headers: { ...formData.getHeaders() },
        timeout: 300000,
      });

      const { job_id, drive_file_id } = aiResponse.data;
      // Persist Drive file ID if upload went to Drive
      if (drive_file_id && fileData?.id) {
        await File.updateDriveFileId(fileData.id, drive_file_id);
      }
      await Material.updateStatus(documentRecord.id, userId, PROCESSING, job_id);

      const resultDoc = await Material.findById(documentRecord.id, userId);
      if (resultDoc) resultDoc.quota_warning = allowance.warning;
      return resultDoc;
    } catch (error) {
      console.error(`[MaterialService] Failed to trigger AI job: ${error.message}`, {
        ...opContext,
        materialId: documentRecord?.id,
      });
      if (documentRecord) {
        await Material.updateStatus(documentRecord.id, userId, FAILED);
        // Trigger Admin Alert
        await AlertService.triggerGenerationFailure(userId, documentRecord.id, error.message);
      }
      return documentRecord ? await Material.findById(documentRecord.id, userId) : null;
    }
  }

  static async getMaterialById(userId, materialId) {
    return await Material.findById(materialId, userId);
  }

  /**
   * Poll the AI engine for a job status and sync the materials table if done.
   */
  static async checkJobStatus(userId, materialId) {
    let material = await Material.findById(materialId, userId);
    if (!material) return null;

    if (TERMINAL_STATUSES.includes(normalizeStatus(material.status))) {
      return material;
    }

    if (normalizeStatus(material.status) === PROCESSING && material.started_at) {
      const startedAt = new Date(material.started_at);
      const now = new Date();
      const diffMinutes = (now - startedAt) / (1000 * 60);

      if (diffMinutes > 10) {
        console.warn(
          `[MaterialService] Job ${material.job_id} timed out after ${diffMinutes.toFixed(1)} mins.`
        );
        generationConstraintByMaterialId.delete(String(materialId));
        const errorMsg = 'Job timeout / worker failure';
        await Material.recordFailure(materialId, userId, errorMsg);
        await AlertService.triggerGenerationFailure(userId, materialId, errorMsg);
        await MaterialService._garbageCollectFile(materialId);
        return await Material.findById(materialId, userId);
      }
    }

    if (material.job_id) {
      try {
        const response = await engineClient.get(`/job/${material.job_id}`);
        const { status, result, error } = response.data;
        const engineStatus = normalizeStatus(status);

        if (engineStatus === SUCCESS && result) {
          if (result.material_type) {
            const persistedConstraints =
              generationConstraintByMaterialId.get(String(materialId)) || {};

            const contentStr = result.content
              ? typeof result.content === 'object'
                ? JSON.stringify(result.content)
                : result.content
              : result.ai_generated_content &&
                  typeof result.ai_generated_content.content === 'string'
                ? result.ai_generated_content.content
                : '';
            const nowIso = new Date().toISOString();
            const normalizedAiContent = normalizeExamPayload(result.ai_generated_content);
            const finalAiContent = enforceGenerationConstraintsForPersistence(normalizedAiContent, {
              materialType: result.material_type,
              ...persistedConstraints,
            });

            // ── DIAGNOSTIC: compare question counts at each stage ──
            const _rawQ = result.ai_generated_content?.content?.questions?.length;
            const _normQ = normalizedAiContent?.content?.questions?.length;
            const _finalQ = (
              typeof finalAiContent === 'string' ? JSON.parse(finalAiContent) : finalAiContent
            )?.content?.questions?.length;
            console.log(
              '[EXAM_DIAG] materialId=%s | ENGINE_RAW=%d | NORMALIZED=%d | FINAL_PERSISTED=%d | constraints=%j',
              materialId,
              _rawQ,
              _normQ,
              _finalQ,
              persistedConstraints
            );

            await withTransaction(async (client) => {
              // SINGLE SOURCE OF TRUTH UPDATE:
              // This ensures that either all fields are updated correctly via the
              // normalized+constrained payload, or none are.
              await client.query(
                'UPDATE materials SET content = $2, ai_generated_content = $3, processed_at = $4, completed_at = $4, status = $6 WHERE id = $1 AND user_id = $5 AND deleted_at IS NULL',
                [materialId, contentStr, finalAiContent, nowIso, userId, COMPLETED]
              );
            });
            generationConstraintByMaterialId.delete(String(materialId));
          } else {
            const extractedText = result.extracted_text;
            if (
              extractedText !== undefined &&
              typeof extractedText === 'string' &&
              extractedText.trim() === ''
            ) {
              console.log(
                `[MaterialService] Detected empty extraction for material ${materialId}. Marking as EMPTY.`
              );
              await Material.updateStatus(materialId, userId, 'EMPTY');
              return await Material.findById(materialId, userId);
            }

            const textToSave = extractedText || material.content;
            await Material.updateContent(materialId, userId, textToSave);
            await Material.updateAIResult(materialId, userId, {
              chunk_count: result.chunk_count,
              provider: result.provider,
              model: result.model,
              processed_at: new Date().toISOString(),
            });
          }
          return await Material.findById(materialId, userId);
        }

        // ENGINE_STATUS (not DB status) — result.status comes from Celery task payload
        const errorMsg =
          error ||
          result?.error ||
          (result?.status === 'FAILED' ? result?.error : null) ||
          'AI Generation Failed';

        if (engineStatus === FAILURE || result?.status === 'FAILED') {
          generationConstraintByMaterialId.delete(String(materialId));
          await Material.recordFailure(materialId, userId, errorMsg);
          await AlertService.triggerGenerationFailure(userId, materialId, errorMsg);
          await MaterialService._garbageCollectFile(materialId);
          return await Material.findById(materialId, userId);
        }

        if (
          (engineStatus === STARTED || engineStatus === RECEIVED) &&
          normalizeStatus(material.status) !== PROCESSING
        ) {
          await Material.updateStatus(materialId, userId, PROCESSING);
          return await Material.findById(materialId, userId);
        }
      } catch (err) {
        console.error(`[MaterialService] Status sync error for ${materialId}:`, err.message);
      }
    }

    return material;
  }

  static async getUserHistory(userId, pagination = null) {
    // Trigger background sync when history is requested
    this.syncDriveFiles(userId).catch((err) =>
      console.error('[MaterialService] Silent Drive sync failed:', err.message)
    );
    if (pagination) {
      const [history, total] = await Promise.all([
        Material.findByUserId(userId, pagination),
        Material.getCountByUserId(userId),
      ]);
      return { history, total };
    }
    return await Material.findByUserId(userId);
  }

  /**
   * Synchronize files from Google Drive into the local database.
   * Creates "ghost" materials for files found in Drive that don't exist locally.
   */
  static async syncDriveFiles(userId) {
    try {
      const driveRes = await engineClient.get('/drive/files');
      const driveFiles = driveRes.data.files || [];

      if (driveFiles.length === 0) return;

      // Get existing files with drive_file_id
      const existingFiles = await File.findByUserId(userId);
      const existingDriveFileIds = new Set(
        existingFiles.map((f) => f.drive_file_id).filter(Boolean)
      );

      const importedSubject = await SubjectService.getOrCreateImportedSubject(userId);

      for (const df of driveFiles) {
        if (existingDriveFileIds.has(df.id)) continue;

        console.log(`[MaterialService] Syncing new Google Drive file: ${df.name} (${df.id})`);

        // Create Material ghost record
        const material = await Material.create(
          userId,
          importedSubject.id,
          df.name,
          '', // No content yet
          'document',
          PENDING_JOB
        );

        // Create File link
        await File.create_with_drive(
          userId,
          importedSubject.id,
          material.id,
          df.id, // filename internally for now or we use df.id
          df.name,
          df.mimeType,
          parseInt(df.size) || 0,
          df.webViewLink,
          df.id
        );

        // Note: We don't trigger processing automatically here.
        // The user can trigger it from the UI by clicking "Generate" or similar.
      }
    } catch (error) {
      console.error('[MaterialService] Google Drive sync error:', error.message);
      throw error;
    }
  }

  /**
   * AI Chat grounded in a subject's knowledge base.
   */
  static async chatWithContext(userId, materialIds, question) {
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeIds = (Array.isArray(materialIds) ? materialIds : []).filter(
      (id) => typeof id === 'string' && UUID_PATTERN.test(id)
    );

    const sourceDocuments = await Material.findByIds(safeIds, userId);

    // Validation: Check for failed or empty documents in the selection
    const failedDocs = sourceDocuments.filter((d) => d.status === 'FAILED');
    if (failedDocs.length > 0) {
      throw new Error(
        `Impossible to chat: One or more selected documents (e.g. "${failedDocs[0].title}") failed to process.`
      );
    }

    const emptyDocs = sourceDocuments.filter((d) => d.status === 'EMPTY');
    if (emptyDocs.length > 0 && sourceDocuments.length === emptyDocs.length) {
      throw new Error('Context is not enough to chat. All selected documents are empty.');
    }

    const chunks = sourceDocuments
      .filter((d) => d.status === COMPLETED)
      .map((d) => d.content)
      .filter((c) => c && typeof c === 'string' && c.trim() !== '');

    if (chunks.length === 0) {
      throw new Error('Context is not enough: No readable text found in the selected documents.');
    }

    const subjectId = sourceDocuments.length > 0 ? sourceDocuments[0].subject_id : null;
    if (!subjectId) return { result: 'No source documents selected for context.' };

    try {
      const payload = {
        subject_id: subjectId,
        question: question,
        top_k: 8,
        user_id: userId,
        chunks: chunks,
      };
      const options = { timeout: 300000 };

      const aiResponse = await engineClient.post('/chat', payload, options);
      const result = aiResponse.data;

      await Subject.touch(subjectId, userId);

      query(
        'INSERT INTO chat_history (user_id, subject_id, type, query, response) VALUES ($1, $2, $3, $4, $5)',
        [userId, subjectId, 'text', question, result.result || result.response || 'No response']
      ).catch((err) => console.error('[MaterialService] Failed to log chat:', err.message));

      return result;
    } catch (error) {
      console.error('[MaterialService] Engine Chat Error:', error.message);
      const isTimeout = error.code === 'ECONNABORTED';
      const enhancedError = new Error(
        isTimeout ? 'AI engine timed out.' : 'AI engine is currently unavailable.'
      );
      enhancedError.statusCode = 503;
      throw enhancedError;
    }
  }

  /**
   * Streaming generation — proxies engine's SSE directly to the caller.
   */
  static async generateStream(userId, materialIds, taskType, subjectId, genOptions = {}) {
    const startMs = Date.now();
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeIds = (Array.isArray(materialIds) ? materialIds : []).filter(
      (id) => typeof id === 'string' && UUID_PATTERN.test(id)
    );

    const sourceDocuments = await Material.findByIds(safeIds, userId);

    // Validation: Check for failed or empty documents in the selection
    const failedDocs = sourceDocuments.filter((d) => d.status === 'FAILED');
    if (failedDocs.length > 0) {
      throw new Error(
        `Impossible to generate material: One or more selected documents (e.g. "${failedDocs[0].title}") failed to process.`
      );
    }

    const emptyDocs = sourceDocuments.filter((d) => d.status === 'EMPTY');
    if (emptyDocs.length > 0 && sourceDocuments.length === emptyDocs.length) {
      throw new Error(
        'Context is not enough to generate material. All selected documents are empty.'
      );
    }

    const chunks = sourceDocuments
      .filter((d) => d.status === COMPLETED)
      .map((d) => d.content)
      .filter((c) => c && typeof c === 'string' && c.trim() !== '');

    // Extract basenames of stored files so the engine can filter its documents table
    const sourceFilenames = sourceDocuments
      .filter((d) => d.status === COMPLETED && d.file_path)
      .map((d) => d.file_path.split('/').pop())
      .filter((f) => f && f.length > 0);

    if (chunks.length === 0 && sourceFilenames.length === 0) {
      throw new Error(
        'Context is not enough: No readable text or files found in the selected documents.'
      );
    }

    const finalSubjectId =
      subjectId || (sourceDocuments.length > 0 ? sourceDocuments[0].subject_id : null);
    const materialType = TASK_TYPE_TO_MATERIAL_TYPE[taskType] || 'summary';
    const gps = this._buildGPS(taskType, genOptions);
    const displayType = materialType.charAt(0).toUpperCase() + materialType.slice(1);
    const subject = await Subject.findById(finalSubjectId, userId);
    const subjectName = subject ? subject.name : 'Unknown Subject';
    let contextTitle =
      sourceDocuments.length === 1
        ? sourceDocuments[0].title
        : sourceDocuments.length > 1
          ? 'Multiple Sources'
          : subjectName;
    const baseTitle = `${displayType} of ${contextTitle}`;
    const finalTitle = await this._resolveUniqueTitle(userId, finalSubjectId, baseTitle);

    const materialRecord = await Material.create(
      userId,
      finalSubjectId,
      finalTitle,
      '',
      materialType,
      PROCESSING
    );

    const enginePayload = {
      subject_id: finalSubjectId,
      material_type: materialType,
      topic: (genOptions || {}).topic,
      language: (genOptions || {}).language || 'en',
      summary_mode: (genOptions || {}).summary_mode,
      top_k: 20,
      user_id: userId,
      generation_options: gps,
      material_ids: safeIds,
      material_id: materialRecord.id,
      ...(sourceFilenames.length > 0 && { source_filenames: sourceFilenames }),
    };

    console.log(
      '[TRACE][BACKEND_SVC_ENGINE_REQ] type=%s subject=%s material_id=%s elapsed_ms=%d',
      materialType,
      finalSubjectId,
      materialRecord.id,
      Date.now() - startMs
    );

    const resp = await engineClient.post('/generate/stream', enginePayload, {
      responseType: 'stream',
      timeout: 600000, // 10 minutes
    });

    console.log(
      '[TRACE][BACKEND_SVC_ENGINE_RESP] status=%d elapsed_ms=%d',
      resp.status,
      Date.now() - startMs
    );
    return resp;
  }

  /**
   * AI Generation grounded in a subject's knowledge base.
   */
  static async generateWithContext(userId, subjectId, materialIds, taskType, genOptions = {}) {
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeIds = (Array.isArray(materialIds) ? materialIds : []).filter(
      (id) => typeof id === 'string' && UUID_PATTERN.test(id)
    );

    const sourceDocuments = await Material.findByIds(safeIds, userId);
    if (sourceDocuments.length === 0 && !subjectId)
      return { result: 'No source documents selected for context.' };

    const finalSubjectId =
      subjectId || (sourceDocuments.length > 0 ? sourceDocuments[0].subject_id : null);
    if (!finalSubjectId) return { result: 'No subject context available for generation.' };

    const materialType = TASK_TYPE_TO_MATERIAL_TYPE[taskType] || 'summary';
    const gps = this._buildGPS(taskType, genOptions);

    const chunks = sourceDocuments
      .filter((d) => normalizeStatus(d.status) === 'COMPLETED')
      .map((d) => d.content)
      .filter((c) => c && typeof c === 'string' && c.trim() !== '');

    const displayType = materialType.charAt(0).toUpperCase() + materialType.slice(1);
    const subject = await Subject.findById(finalSubjectId, userId);
    const subjectName = subject ? subject.name : 'Unknown Subject';
    let contextTitle =
      sourceDocuments.length === 1
        ? sourceDocuments[0].title
        : sourceDocuments.length > 1
          ? 'Multiple Sources'
          : subjectName;
    const baseTitle = `${displayType} of ${contextTitle}`;
    const finalTitle = await this._resolveUniqueTitle(userId, finalSubjectId, baseTitle);

    const materialRecord = await Material.create(
      userId,
      finalSubjectId,
      finalTitle,
      '',
      materialType,
      PENDING_JOB
    );

    const sourceFilenames = sourceDocuments
      .filter((d) => d.file_path)
      .map((d) => d.file_path.split('/').pop())
      .filter((f) => f && f.length > 0);

    const enginePayload = {
      subject_id: finalSubjectId,
      material_type: materialType,
      chunks: chunks,
      topic: genOptions.topic,
      language: genOptions.language || 'en',
      summary_mode: (genOptions || {}).summary_mode,
      generation_options: gps,
      user_id: userId,
      material_ids: safeIds,
      ...(sourceFilenames.length > 0 && { source_filenames: sourceFilenames }),
    };

    try {
      console.log(
        `[MaterialService] Routing to Primary Path (Python Engine) for Material ${materialRecord.id}`
      );
      const response = await engineClient.post('/generate', enginePayload, {
        timeout: 300000,
      });
      const result = response.data;

      await Material.updateStatus(materialRecord.id, userId, PROCESSING, result.job_id);
      generationConstraintByMaterialId.set(String(materialRecord.id), { count: genOptions?.count });

      return { status: 'accepted', job_id: result.job_id, material_id: materialRecord.id };
    } catch (error) {
      console.error(
        `[MaterialService] Primary Path Failed: ${error.message}. Triggering Fallback Path.`
      );
      try {
        const context =
          chunks.length > 0
            ? chunks.join('\n\n').substring(0, 8000)
            : sourceDocuments
                .map((d) => d.content || '')
                .filter(Boolean)
                .join('\n\n')
                .substring(0, 8000);
        const fallbackResult = await FallbackGenerationService.generateSync(
          userId,
          materialRecord.id,
          materialType,
          gps,
          context
        );

        return {
          status: 'success',
          material_id: materialRecord.id,
          is_fallback: true,
        };
      } catch (fallbackError) {
        console.error(`[MaterialService] Critical Failure: Both paths failed.`, fallbackError);
        await Material.recordFailure(
          materialRecord.id,
          userId,
          `All paths failed: ${fallbackError.message}`
        );
        await AlertService.triggerGenerationFailure(
          userId,
          materialRecord.id,
          `Critical Failure: Primary and Fallback paths failed. ${fallbackError.message}`
        );
        throw fallbackError;
      }
    }
  }

  static _buildGPS(taskType, options) {
    const difficultyMap = { Intro: 'introductory', Inter: 'intermediate', Adv: 'advanced' };

    // Base GPS (Difficulty-based for Quiz/Exam)
    const gps = {
      total_count: Math.max(1, parseInt(options.count) || 5),
      difficulty: difficultyMap[options.difficulty] || 'intermediate',
      distribution: [],
      config_version: 1,
      summary_mode: options.summary_mode, // Also include in generation_options for redundancy
    };

    if (taskType === 'mock_exam') {
      const VALID_EXAM_TYPES = ['single_choice', 'multiple_select', 'short_answer', 'problem', 'fill_blank', 'matching'];
      const rawTypes = options.examTypes || ['single_choice', 'short_answer'];
      const types = [...new Set(
        Array.isArray(rawTypes) && rawTypes.length > 0 ? rawTypes : ['single_choice', 'short_answer']
      )].filter(t => VALID_EXAM_TYPES.includes(t));
      const finalTypes = types.length > 0 ? types : ['single_choice', 'short_answer'];
      const countPerType = Math.floor(gps.total_count / finalTypes.length);
      gps.distribution = finalTypes.map((type, idx) => ({
        type,
        count:
          idx === finalTypes.length - 1
            ? gps.total_count - countPerType * (finalTypes.length - 1)
            : countPerType,
      }));
    } else {
      const typeMapping = { quiz: 'single_choice', flashcards: 'single_choice', mock_exam: 'single_choice', summary: 'single_choice' };
      gps.distribution = [{ type: typeMapping[taskType] || 'single_choice', percentage: 100 }];
    }
    return gps;
  }

  static async _resolveUniqueTitle(userId, subjectId, baseTitle) {
    let uniqueTitle = baseTitle;
    let counter = 1;
    while (await Material.findByTitle(userId, subjectId, uniqueTitle)) {
      uniqueTitle = `${baseTitle} (${counter})`;
      counter++;
    }
    return uniqueTitle;
  }

  static async _garbageCollectFile(materialId) {
    try {
      const existingFile = await File.findByMaterialId(materialId);
      if (existingFile) {
        try {
          await fs.promises.access(existingFile.path);
          fs.unlinkSync(existingFile.path);
        } catch {
          // file already gone — nothing to delete
        }
        // Delete from Google Drive if drive_file_id exists
        if (existingFile.drive_file_id) {
          try {
            await engineClient.post(
              '/drive/delete',
              { file_id: existingFile.drive_file_id },
              { timeout: 10000 }
            );
          } catch (driveErr) {
            console.error(
              `[GC] Failed to delete Drive file for material ${materialId}:`,
              driveErr.message
            );
          }
        }
        await File.delete(existingFile.id);
      }
    } catch (gcErr) {
      console.error(`[GC] Failed to clean up file for material ${materialId}:`, gcErr.message);
    }
  }

  static async cancelJob(userId, materialId) {
    const material = await Material.findById(materialId, userId);
    if (!material || !material.job_id) throw new Error('No active job');
    try {
      await engineClient.post('/job/cancel', { job_id: material.job_id }, { timeout: 5000 });
      generationConstraintByMaterialId.delete(String(materialId));
      await Material.recordFailure(materialId, userId, 'Cancelled by user');
      return true;
    } catch (error) {
      throw new Error('Failed to cancel job');
    }
  }

  static async updateMaterial(userId, materialId, updates) {
    if (!updates?.title?.trim()) throw new Error('Title required');
    const updated = await Material.updateById(materialId, userId, { title: updates.title.trim() });
    return updated;
  }

  static async deleteMaterial(materialId, userId) {
    // 1. If job is active, cancel it before soft-deleting
    try {
      await this.cancelJob(userId, materialId).catch(() => {});
    } catch (e) {
      // Ignore errors if job doesn't exist
    }
    return await Material.delete(materialId, userId);
  }

  static async bulkDelete(ids, userId) {
    if (!ids || ids.length === 0) return 0;

    // 1. Cancel active jobs for all materials
    await Promise.allSettled(
      ids.map((id) => this.cancelJob(userId, id).catch(() => {}))
    );

    // 2. Perform bulk soft delete
    return await Material.deleteByIds(ids, userId);
  }

  static async getTrash(userId, pagination = null) {
    const settings = await SettingsService.getStorageControls();
    const ttlDays = settings.trash_ttl_days || 30;
    if (pagination) {
      const [trash, total] = await Promise.all([
        Material.findDeleted(userId, ttlDays, pagination),
        Material.getDeletedCount(userId),
      ]);
      return { trash, total };
    }
    return await Material.findDeleted(userId, ttlDays);
  }

  static async restoreMaterial(materialId, userId) {
    return await Material.restore(materialId, userId);
  }

  static async permanentDeleteMaterial(materialId, userId) {
    // 1. If job is active, cancel it before hard-deleting
    try {
      await this.cancelJob(userId, materialId).catch(() => {});
    } catch (e) {
      // Ignore
    }
    await MaterialService._garbageCollectFile(materialId);
    return await Material.permanentDelete(materialId, userId);
  }

  static async emptyTrash(userId) {
    const trashItems = await Material.findDeleted(userId);
    await Promise.all(trashItems.map((m) => MaterialService._garbageCollectFile(m.id)));
    return await Material.emptyTrash(userId);
  }

  /**
   * Auto-purge materials that have exceeded the trash TTL.
   * Garbage-collects disk files before hard-deleting DB rows so
   * the ON DELETE CASCADE on files doesn't race with disk cleanup.
   */
  static async purgeExpiredTrash() {
    const settings = await SettingsService.getStorageControls();
    const ttlDays = settings.trash_ttl_days || 30;

    const expired = await Material.findExpiredTrash(ttlDays);
    if (expired.length === 0) return 0;

    await Promise.allSettled(expired.map((m) => MaterialService._garbageCollectFile(m.id)));
    const deleted = await Material.deleteExpiredTrash(ttlDays);

    console.info(`[TrashPurge] Purged ${deleted} material(s) expired after ${ttlDays} days`);
    return deleted;
  }

  /**
   * Unified Chat: Validates subject ownership and forwards the request
   * to the Python engine's structured chat endpoint.
   */
  static async chat(userId, subjectId, question, history = [], materialIds = []) {
    // 1. Security: Validate that the subject exists and belongs to the user
    const subject = await Subject.findById(subjectId, userId);
    if (!subject) {
      const error = new Error('Subject not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    // Validate materialIds are valid UUIDs
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validMaterialIds = (Array.isArray(materialIds) ? materialIds : []).filter(
      (id) => typeof id === 'string' && UUID_PATTERN.test(id)
    );

    try {
      // 2. Prepare payload for the Engine's unified /chat endpoint
      const sanitizedHistory = (history || [])
        .filter(
          (msg) =>
            msg &&
            typeof msg === 'object' &&
            (msg.role === 'user' || msg.role === 'assistant') &&
            typeof msg.content === 'string' &&
            msg.content.trim().length > 0
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content.trim(),
        }))
        .slice(-50); // Limit to 50 messages

      const payload = {
        subject_id: subjectId,
        question: question.trim(),
        conversation_history: sanitizedHistory,
        material_ids: validMaterialIds,
        top_k: 8,
        language: 'en',
      };

      console.log(
        '[MaterialService] Sending payload to engine /chat:',
        JSON.stringify(payload, null, 2)
      );

      const options = { timeout: 300000 }; // 5-minute timeout for LLM generation
      const engineResponse = await engineClient.post('/chat', payload, options);
      const result = engineResponse.data;

      // 3. Update subject activity
      await Subject.touch(subjectId, userId);

      // 4. Audit Log (chat_history table)
      // Fire and forget
      query(
        'INSERT INTO chat_history (user_id, subject_id, type, query, response) VALUES ($1, $2, $3, $4, $5)',
        [userId, subjectId, 'unified', question, result.answer || 'No response']
      ).catch((err) => console.error('[MaterialService] Failed to log unified chat:', err.message));

      return result;
    } catch (error) {
      console.error('[MaterialService] Unified Chat Error:', error.message);
      if (error.response) {
        console.error('[MaterialService] Engine response status:', error.response.status);
        console.error(
          '[MaterialService] Engine response data:',
          JSON.stringify(error.response.data, null, 2)
        );
      }
      const isTimeout = error.code === 'ECONNABORTED';
      const enhancedError = new Error(
        isTimeout ? 'AI engine timed out.' : 'AI engine is currently unavailable.'
      );
      enhancedError.statusCode = 503;
      throw enhancedError;
    }
  }
}

export default MaterialService;
