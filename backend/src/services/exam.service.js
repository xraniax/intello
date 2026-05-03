import { randomUUID } from 'crypto';
import engineClient from './engine.client.js';
import Material from '../models/material.model.js';
import { COMPLETED } from '../constants/status.enum.js';
import { query } from '../utils/config/db.js';

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://ollama:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_GENERATION_MODEL || 'qwen2.5:7b-instruct';
const OLLAMA_GENERATE_URL = `${OLLAMA_BASE_URL}/api/generate`;
const ENGINE_URL = (process.env.ENGINE_URL || 'http://engine:8000').replace(/\/$/, '');

const EXAM_CACHE_TTL_MS = 1000 * 60 * 60 * 2;
const EXAM_CACHE_LIMIT = 500;
const FORBIDDEN_TOKENS = /\b(almost|correct|incorrect)\b/i;
const MAX_GENERATION_ATTEMPTS = 10;
const MAX_REGEN_ROUNDS = 5;
const SUPPORTED_TYPES = [
    'single_choice',
    'multiple_select',
    'short_answer',
    'problem',
    'fill_blank',
    'matching',
    'scenario',
];
const PLACEHOLDER_PATTERN = /^(string|option\s*[a-d]|choice\s*[a-d]|answer|n\/a|none)$/i;
const attemptCache = new Map();

const examCache = new Map();

const normalizeDifficulty = (difficulty) => {
    if (difficulty === 'mixed') return 'medium';
    return difficulty || 'medium';
};

const cleanupCache = () => {
    const now = Date.now();
    for (const [examId, value] of examCache.entries()) {
        if (now - value.createdAtMs > EXAM_CACHE_TTL_MS) examCache.delete(examId);
    }
    if (examCache.size <= EXAM_CACHE_LIMIT) return;
    const ordered = [...examCache.entries()].sort((a, b) => a[1].createdAtMs - b[1].createdAtMs);
    const overLimit = examCache.size - EXAM_CACHE_LIMIT;
    for (let i = 0; i < overLimit; i += 1) examCache.delete(ordered[i][0]);
};

const stripCodeFences = (value) => String(value || '').replace(/```json|```/gi, '').trim();

const extractJsonPayload = (raw) => {
    const cleaned = stripCodeFences(raw);
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    if (objectStart >= 0 && objectEnd > objectStart) return cleaned.slice(objectStart, objectEnd + 1);
    if (arrayStart >= 0 && arrayEnd > arrayStart) return cleaned.slice(arrayStart, arrayEnd + 1);
    return cleaned;
};

const safeParseJSON = (raw) => {
    try {
        const extracted = extractJsonPayload(raw);
        return JSON.parse(extracted);
    } catch (e) {
        console.error('[ExamService] safeParseJSON failed. Extracted payload:', extractJsonPayload(raw));
        return null;
    }
};

const sanitizeString = (value) => String(value ?? '').trim();
const normalizeText = (value) => sanitizeString(value).toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
const isPlaceholderText = (value) => PLACEHOLDER_PATTERN.test(sanitizeString(value));
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const cleanupAttemptCache = () => {
    const now = Date.now();
    for (const [key, value] of attemptCache.entries()) {
        if (now - value.updatedAtMs > EXAM_CACHE_TTL_MS) attemptCache.delete(key);
    }
    if (attemptCache.size <= EXAM_CACHE_LIMIT) return;
    const ordered = [...attemptCache.entries()].sort((a, b) => a[1].updatedAtMs - b[1].updatedAtMs);
    const overLimit = attemptCache.size - EXAM_CACHE_LIMIT;
    for (let i = 0; i < overLimit; i += 1) attemptCache.delete(ordered[i][0]);
};

const hasNullOrEmptyFields = (question) => {
    if (!question || typeof question !== 'object') return true;
    if (question.type == null || sanitizeString(question.type) === '') return true;
    if (question.question == null || sanitizeString(question.question) === '') return true;
    const type = sanitizeString(question.type);
    if (['short_answer', 'problem', 'scenario'].includes(type)) {
        // Allow empty acceptedAnswers, we will auto-repair in validateQuestion
    } else if (type === 'fill_blank') {
        // Allow empty blankAnswers, we will auto-repair in validateQuestion
    } else if (type === 'matching') {
        // Allow empty pairs, we will auto-repair
    } else {
        if (!Array.isArray(question.options) || question.options.length < 2) return true;
        // Allow empty correctAnswers, we will auto-repair
    }
    // Difficulty and Topic will be auto-repaired, so we don't return true (fail) here
    return false;
};

const hasForbiddenLabels = (question) => {
    if (hasNullOrEmptyFields(question)) return true;
    const q = sanitizeString(question.question);
    // Only strictly block if the question itself is a placeholder or forbidden
    if (!q || isPlaceholderText(q) || FORBIDDEN_TOKENS.test(q)) return true;
    return false;
};

const validateQuestion = (rawQuestion, allowedTypes, fallbackTopic, fallbackDifficulty) => {
    if (!rawQuestion || typeof rawQuestion !== 'object') {
        console.log('[Validator] Dropped because not an object:', rawQuestion);
        return null;
    }
    if (hasForbiddenLabels(rawQuestion)) {
        console.log('[Validator] Dropped because hasForbiddenLabels:', rawQuestion);
        return null;
    }

    const questionText = sanitizeString(rawQuestion.question);
    let options = Array.isArray(rawQuestion.options)
        ? rawQuestion.options.map((opt) => sanitizeString(opt)).filter(Boolean)
        : [];

    if (!questionText) return null;

    const requestedType = sanitizeString(rawQuestion.type);
    const type = allowedTypes.includes(requestedType) ? requestedType : allowedTypes[0];

    if (['short_answer', 'problem', 'scenario'].includes(type)) {
        let acceptedAnswers = Array.isArray(rawQuestion.acceptedAnswers)
            ? [...new Set(rawQuestion.acceptedAnswers.map((a) => sanitizeString(a)).filter(Boolean))]
            : [];
        // Auto-repair
        if (acceptedAnswers.length === 0 || acceptedAnswers.some(isPlaceholderText)) {
            acceptedAnswers = ["Answer provided in context"];
        }
        return {
            id: randomUUID(),
            type,
            question: questionText,
            options: [],
            correctAnswers: [],
            acceptedAnswers,
            explanation: sanitizeString(rawQuestion.explanation) || 'Refer to context.',
            difficulty: ['Introductory', 'Intermediate', 'Advanced', 'easy', 'medium', 'hard'].includes(rawQuestion.difficulty)
                ? rawQuestion.difficulty
                : fallbackDifficulty,
            topic: sanitizeString(rawQuestion.topic) || fallbackTopic,
        };
    }

    if (type === 'fill_blank') {
        let blankAnswers = Array.isArray(rawQuestion.blankAnswers)
            ? rawQuestion.blankAnswers.map((a) => sanitizeString(a)).filter(Boolean)
            : [];
        // Auto-repair
        if (blankAnswers.length === 0 || blankAnswers.some(isPlaceholderText)) {
            blankAnswers = ["(Blank)"];
        }
        return {
            id: randomUUID(),
            type,
            question: questionText,
            options: [],
            correctAnswers: [],
            blankAnswers,
            explanation: sanitizeString(rawQuestion.explanation) || 'Refer to context.',
            difficulty: ['Introductory', 'Intermediate', 'Advanced', 'easy', 'medium', 'hard'].includes(rawQuestion.difficulty)
                ? rawQuestion.difficulty
                : fallbackDifficulty,
            topic: sanitizeString(rawQuestion.topic) || fallbackTopic,
        };
    }

    if (type === 'matching') {
        let pairs = Array.isArray(rawQuestion.pairs)
            ? rawQuestion.pairs
                .map((pair) => ({ left: sanitizeString(pair?.left), right: sanitizeString(pair?.right) }))
                .filter((pair) => pair.left && pair.right)
            : [];
        // Auto-repair
        if (pairs.length < 2 || pairs.some((pair) => isPlaceholderText(pair.left) || isPlaceholderText(pair.right))) {
            pairs = [{ left: "Concept A", right: "Definition A" }, { left: "Concept B", right: "Definition B" }];
        }
        return {
            id: randomUUID(),
            type,
            question: questionText,
            options: [],
            correctAnswers: [],
            pairs,
            rightOptions: shuffle([...new Set(pairs.map((p) => p.right))]),
            explanation: sanitizeString(rawQuestion.explanation) || 'Refer to context.',
            difficulty: ['Introductory', 'Intermediate', 'Advanced', 'easy', 'medium', 'hard'].includes(rawQuestion.difficulty)
                ? rawQuestion.difficulty
                : fallbackDifficulty,
            topic: sanitizeString(rawQuestion.topic) || fallbackTopic,
        };
    }

    // Auto-repair options
    if (options.length < 2 || options.some(isPlaceholderText) || new Set(options.map((opt) => normalizeText(opt))).size < 2) {
        options = ["True", "False"];
    }

    let correctAnswers = Array.isArray(rawQuestion.correctAnswers)
        ? [...new Set(rawQuestion.correctAnswers
            .map((idx) => Number(idx))
            .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < options.length))]
        : [];

    // Auto-repair correctAnswers
    if (correctAnswers.length === 0) correctAnswers = [0];
    if (type === 'single_choice' && correctAnswers.length !== 1) correctAnswers = [0];

    return {
        id: randomUUID(),
        type,
        question: questionText,
        options,
        correctAnswers: correctAnswers.sort((a, b) => a - b),
        explanation: sanitizeString(rawQuestion.explanation) || 'Refer to context.',
        difficulty: ['easy', 'medium', 'hard'].includes(rawQuestion.difficulty)
            ? rawQuestion.difficulty
            : fallbackDifficulty,
        topic: sanitizeString(rawQuestion.topic) || fallbackTopic,
    };
};

const normalizeQuestionsFromModel = (parsed) => {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed.items)) return parsed.items;
    
    // Fallback: search for any array value inside the object
    if (typeof parsed === 'object') {
        // e.g. { "exam_questions": [...] }
        for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key])) {
                console.log(`[ExamService] Found questions array under key: ${key}`);
                return parsed[key];
            }
        }
    }
    console.warn(`[ExamService] normalizeQuestionsFromModel failed. Parsed keys:`, parsed ? Object.keys(parsed) : 'null');
    return [];
};

const gatherValidQuestions = (candidates, allowedTypes, fallbackTopic, fallbackDifficulty, seen, limit) => {
    const accepted = [];
    for (const candidate of candidates) {
        const normalized = validateQuestion(candidate, allowedTypes, fallbackTopic, fallbackDifficulty);
        if (!normalized) {
            console.log('[ExamService] Candidate rejected by validation:', candidate?.question || 'Unknown Question');
            continue;
        }
        const dedupeKey = normalized.question.toLowerCase();
        if (seen.has(dedupeKey)) {
            console.log('[ExamService] Candidate rejected (duplicate):', dedupeKey);
            continue;
        }
        seen.add(dedupeKey);
        accepted.push(normalized);
        if (accepted.length >= limit) break;
    }
    return accepted;
};

const requestQuestionBatch = async ({
    numberOfQuestions,
    difficulty,
    topics,
    allowedTypes,
    fallbackTopic,
    fallbackDifficulty,
    seen,
    existingQuestions,
    options = {},
}) => {
    const prompt = buildPrompt({
        numberOfQuestions,
        difficulty,
        topics,
        types: allowedTypes,
        existingQuestions,
        context: options.context,
    });
    const raw = await askModel(prompt.systemInstruction, prompt.userPrompt);
    const parsed = safeParseJSON(raw);
    const candidates = normalizeQuestionsFromModel(parsed);
    console.log(`[ExamService] requestQuestionBatch parsed ${candidates.length} candidates. Raw length: ${raw.length}`);
    const valid = gatherValidQuestions(
        candidates,
        allowedTypes,
        fallbackTopic,
        fallbackDifficulty,
        seen,
        numberOfQuestions
    );
    console.log(`[ExamService] requestQuestionBatch accepted ${valid.length} of ${candidates.length}`);
    return valid;
};

const regenerateQuestions = async ({
    missing,
    difficulty,
    topics,
    allowedTypes,
    fallbackTopic,
    fallbackDifficulty,
    seen,
    existingQuestions,
    context,
}) => {
    const regenerated = [];
    let rounds = 0;
    while (regenerated.length < missing && rounds < MAX_REGEN_ROUNDS) {
        rounds += 1;
        const needed = missing - regenerated.length;
        const extra = await requestQuestionBatch({
            numberOfQuestions: needed,
            difficulty,
            topics,
            allowedTypes,
            fallbackTopic,
            fallbackDifficulty,
            seen,
            existingQuestions: [...existingQuestions, ...regenerated.map((q) => q.question)],
            options: { context },
        });
        regenerated.push(...extra);
    }
    return regenerated.slice(0, missing);
};

const buildPrompt = ({ numberOfQuestions, difficulty, topics, types, existingQuestions, context }) => {
    const contextStr = context ? `Use the following context to generate questions:\n---\n${context}\n---\n` : '';
    const blocked = existingQuestions.length > 0
        ? `Avoid duplicating these already accepted questions:\n${existingQuestions.map((q) => `- ${q}`).join('\n')}\n`
        : '';
        
    const systemInstruction = `You are a strict JSON generator for an exam testing system.
You MUST output ONLY a valid JSON object matching the requested schema. 
Do not output any conversational text, formatting, or markdown code blocks around the JSON.
Your JSON must strictly use double quotes for keys and string values.
If you are unsure of a field, provide a sensible default rather than omitting it.`;

    const userPrompt = `
Generate EXACTLY ${numberOfQuestions} exam questions as strict JSON.

Allowed types: ${types.join(', ')}
Only use the following types EXACTLY: ${types.join(', ')}.
Do NOT generate any other types.
Difficulty: ${difficulty}
Topics: ${topics.join(', ')}

Output format:
{
  "questions": [
    {
      "type": "TYPE_FROM_ALLOWED_TYPES",
      "question": "Detailed question based ONLY on the provided context",

      // For single_choice or multiple_select ONLY:
      "options": ["Option 1", "Option 2"],
      "correctAnswers": [0],

      // For short_answer / problem / scenario ONLY:
      "acceptedAnswers": ["Answer text"],

      // For fill_blank ONLY:
      "blankAnswers": ["Answer for blank"],

      // For matching ONLY:
      "pairs": [{"left": "Concept", "right": "Definition"}],

      "explanation": "Short pedagogic explanation based on context",
      "difficulty": "easy | medium | hard",
      "topic": "Topic name"
    }
  ]
}

Rules:
1) Return ONLY JSON, no markdown.
2) question must be non-empty.
3) if type is short_answer/problem/scenario, provide acceptedAnswers with one or more valid strings.
4) if type is fill_blank, provide blankAnswers as ordered strings for each blank.
5) if type is matching, provide pairs with left/right fields (at least 2 pairs).
6) For each question:
   - Use ONLY the fields relevant to its type
   - Do NOT include unused fields
7) Follow type-specific rules:
   - single_choice / multiple_select → MUST have options + correctAnswers
   - short_answer / problem / scenario → MUST have acceptedAnswers
   - fill_blank → MUST have blankAnswers
   - matching → MUST have pairs (at least 2)
8) NEVER include fields that do not belong to the selected type
9) Match exactly ${numberOfQuestions} items.
10) explanation must be pedagogic: briefly teach the underlying concept and why the answer is right.
${contextStr}
${blocked}`.trim();

    return { systemInstruction, userPrompt };
};

const askModel = async (systemInstruction, userPrompt) => {
    const response = await engineClient.post(
        '/chat',
        {
            // Engine currently validates subject_id on chat requests even when context is provided.
            subject_id: EXAM_ENGINE_SUBJECT_ID,
            context: systemInstruction,
            question: userPrompt,
            top_k: 1,
            language: 'en',
        },
        { timeout: 300000 }
    );
    return response?.data?.result || response?.data?.response || '';
};

const getDifficultyForProgress = (currentCount, targetTotal, curve) => {
    if (curve === 'Progression') {
        if (currentCount < targetTotal * 0.33) return 'Introductory';
        if (currentCount < targetTotal * 0.66) return 'Intermediate';
        return 'Advanced';
    }
    if (curve === 'Balanced') {
        const levels = ['Introductory', 'Intermediate', 'Advanced'];
        return levels[currentCount % 3];
    }
    if (curve === 'Intro') return 'Introductory';
    if (curve === 'Adv') return 'Advanced';
    return 'Intermediate'; // Default/Inter
};

class ExamService {
    static async generateExam(userId, payload) {
        cleanupCache();
        cleanupAttemptCache();
        const targetCount = payload.numberOfQuestions;
        const allowedTypes = [...new Set(payload.types)].filter((t) => SUPPORTED_TYPES.includes(t));
        if (allowedTypes.length === 0) {
            const err = new Error('No supported question types selected.');
            err.statusCode = 400;
            throw err;
        }
        const fallbackDifficulty = normalizeDifficulty(payload.difficulty);
        const fallbackTopic = payload.topics[0];
        
        // --- NEW: RAG Retrieval Stage ---
        let context = '';
        try {
            const retrieveRes = await engineClient.post('/retrieve', {
                subject_id: payload.subject_id,
                topic: fallbackTopic,
                top_k: 3,
            }, { timeout: 300000 });
            
            if (retrieveRes.data?.chunks) {
                context = retrieveRes.data.chunks.map(c => c.content).join('\n\n').substring(0, 2500);
                console.info(`[ExamService] RAG: Retrieved ${retrieveRes.data.chunks.length} chunks for context. Truncated to 2500 chars.`);
            }
        } catch (err) {
            console.error('[ExamService] RAG retrieval failed, falling back to zero-shot:', err.message);
        }

        const accepted = [];
        const seen = new Set();

        let attempts = 0;
        while (accepted.length < targetCount && attempts < MAX_GENERATION_ATTEMPTS) {
            attempts += 1;
            const missing = targetCount - accepted.length;
            const currentDifficulty = getDifficultyForProgress(accepted.length, targetCount, payload.difficulty);
            
            const batch = await requestQuestionBatch({
                numberOfQuestions: missing,
                difficulty: currentDifficulty,
                topics: payload.topics,
                allowedTypes,
                fallbackTopic,
                fallbackDifficulty: currentDifficulty,
                seen,
                existingQuestions: accepted.map((q) => q.question),
                options: { context },
            });
            accepted.push(...batch);
        }

        let questions = accepted;
        if (questions.length > targetCount) {
            questions = questions.slice(0, targetCount);
        }
        if (questions.length < targetCount) {
            const missing = targetCount - questions.length;
            const regenerated = await regenerateQuestions({
                missing,
                difficulty: payload.difficulty,
                topics: payload.topics,
                allowedTypes,
                fallbackTopic,
                fallbackDifficulty,
                seen,
                existingQuestions: questions.map((q) => q.question),
                context,
            });
            questions = [...questions, ...regenerated];
        }

        if (questions.length < targetCount) {
            throw new Error('Could not generate enough valid questions. Please retry with fewer constraints.');
        }

        const createdAt = new Date();
        const fullQuestions = questions.slice(0, targetCount);
        const examId = randomUUID();
        const exam = {
            id: examId,
            title: payload.title || `Mock Exam - ${payload.topics.join(', ')}`,
            questions: fullQuestions.map((q) => ({
                id: q.id,
                type: q.type,
                question: q.question,
                options: q.options,
                acceptedAnswers: q.acceptedAnswers,
                blankAnswers: q.blankAnswers,
                pairs: q.pairs,
                rightOptions: q.rightOptions,
                explanation: q.explanation,
                difficulty: q.difficulty,
                topic: q.topic,
            })),
            timeLimit: payload.timeLimit,
            createdAt,
        };

        examCache.set(examId, {
            userId,
            subjectId: payload.subject_id,
            createdAtMs: Date.now(),
            startedAt: createdAt.toISOString(),
            exam: {
                ...exam,
                questions: fullQuestions,
            },
        });

        // --- NEW: Persist to Materials table so it appears in history ---
        try {
            await Material.create(
                userId,
                payload.subject_id,
                exam.title,
                '', // No text content for exams
                'exam',
                COMPLETED
            );
            // We need to store the structured exam data
            // Since Material.create doesn't take ai_generated_content, we update it immediately
            // Find the record we just created (simplest way without modifying Material.create)
            const materialRecord = await query(
                'SELECT id FROM materials WHERE user_id = $1 AND title = $2 AND type = $3 ORDER BY created_at DESC LIMIT 1',
                [userId, exam.title, 'exam']
            );
            if (materialRecord.rows[0]) {
                await Material.updateAIResult(materialRecord.rows[0].id, userId, exam, {
                    materialType: 'exam',
                    count: payload.numberOfQuestions,
                });
            }
        } catch (dbErr) {
            console.error('[ExamService] Failed to persist exam to history:', dbErr.message);
            // Non-blocking: we still have the cache for the current session
        }

        cleanupCache();
        return exam;
    }

    static async submitExam(userId, payload) {
        cleanupCache();
        cleanupAttemptCache();
        const record = await this._getExamRecord(userId, payload.examId);
        if (!record || record.userId !== userId) {
            const err = new Error('Exam not found or expired. Generate a new exam and try again.');
            err.statusCode = 404;
            throw err;
        }

        const answerMap = new Map(
            payload.answers.map((item) => [
                item.questionId,
                {
                    selectedAnswers: [...new Set((item.selectedAnswers || []).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b),
                    answerText: sanitizeString(item.answerText || ''),
                    blankAnswers: Array.isArray(item.blankAnswers) ? item.blankAnswers.map((ans) => sanitizeString(ans)) : [],
                    matchAnswers: item.matchAnswers && typeof item.matchAnswers === 'object' ? item.matchAnswers : {},
                },
            ])
        );

        // Process questions: some may require async semantic grading
        const detailsPromises = record.exam.questions.map(async (question) => {
            const answer = answerMap.get(question.id) || { selectedAnswers: [], answerText: '' };
            const selectedAnswers = answer.selectedAnswers;
            const correctAnswers = [...(question.correctAnswers || [])].sort((a, b) => a - b);

            let isCorrect = false;
            let isAlmost = false;
            let aiExplanation = null;

            if (question.type === 'single_choice') {
                isCorrect = selectedAnswers[0] === correctAnswers[0];
            } else if (['short_answer', 'problem', 'scenario'].includes(question.type)) {
                // TRY SEMANTIC GRADING via Engine
                const userInput = answer.answerText;
                const referenceAnswer = (question.acceptedAnswers || [])[0] || 'No reference answer provided.';
                
                if (!userInput) {
                    isCorrect = false;
                } else {
                    try {
                        const engineUrl = process.env.ENGINE_URL || 'http://engine:8000';
                        const evalRes = await axios.post(`${engineUrl}/evaluate-answer`, {
                            question: question.question,
                            correct_answer: referenceAnswer,
                            user_answer: userInput
                        }, { timeout: 300000 });
                        
                        const evalData = evalRes.data;
                        // Use a threshold for correctness if the AI is too conservative with the boolean
                        isCorrect = evalData.is_correct || (evalData.score >= 0.85);
                        isAlmost = evalData.is_almost || (evalData.score >= 0.5 && evalData.score < 0.85);
                        aiExplanation = evalData.explanation;
                    } catch (err) {
                        console.error('[ExamService] Semantic evaluation failed, falling back to string match:', err.message);
                        // FALLBACK: Simple string match
                        const normalizedInput = normalizeText(userInput);
                        const normalizedTargets = (question.acceptedAnswers || []).map(normalizeText);
                        isCorrect = normalizedTargets.includes(normalizedInput);
                        if (!isCorrect && normalizedInput) {
                            isAlmost = normalizedTargets.some((target) =>
                                target.includes(normalizedInput) || normalizedInput.includes(target)
                            );
                        }
                    }
                }
            } else if (question.type === 'fill_blank') {
                const submitted = (answer.blankAnswers || []).map(normalizeText);
                const expected = (question.blankAnswers || []).map(normalizeText);
                const matches = expected.filter((ans, idx) => submitted[idx] === ans).length;
                isCorrect = submitted.length === expected.length && matches === expected.length;
                isAlmost = !isCorrect && matches > 0;
            } else if (question.type === 'matching') {
                const expectedMap = new Map((question.pairs || []).map((pair) => [pair.left, pair.right]));
                const submittedMap = answer.matchAnswers || {};
                const totalPairs = expectedMap.size;
                let matches = 0;
                for (const [left, right] of expectedMap.entries()) {
                    if (normalizeText(submittedMap[left]) === normalizeText(right)) matches += 1;
                }
                isCorrect = totalPairs > 0 && matches === totalPairs;
                isAlmost = !isCorrect && matches > 0;
            } else {
                const selectedSet = new Set(selectedAnswers);
                const correctSet = new Set(correctAnswers);
                const exact = selectedAnswers.length === correctAnswers.length
                    && selectedAnswers.every((v, i) => v === correctAnswers[i]);
                const overlap = [...selectedSet].some((v) => correctSet.has(v));
                isCorrect = exact;
                isAlmost = !exact && overlap;
            }

            return {
                questionId: question.id,
                isCorrect,
                ...(isAlmost ? { isAlmost: true } : {}),
                correctAnswers,
                acceptedAnswers: question.acceptedAnswers,
                blankAnswers: question.blankAnswers,
                pairs: question.pairs,
                explanation: aiExplanation || question.explanation,
            };
        });

        const details = await Promise.all(detailsPromises);
        const score = details.filter((d) => d.isCorrect).length;

        // Persist attempt to analytics — non-blocking so grading is never delayed
        if (record.subjectId) {
            const durationSeconds = Math.floor(
                (Date.now() - new Date(record.startedAt).getTime()) / 1000
            );
            import('./analytics.service.js').then(({ default: AnalyticsService }) =>
                AnalyticsService.recordExamAttempt(userId, {
                    materialId: payload.examId,
                    subjectId: record.subjectId,
                    score,
                    maxScore: record.exam.questions.length,
                    durationSeconds,
                    startedAt: record.startedAt,
                    details,
                    examQuestions: record.exam.questions,
                })
            ).catch((err) => console.error('[ExamService] Analytics recording failed:', err.message));
        }

        return {
            score,
            total: record.exam.questions.length,
            details,
        };
    }

    static async saveAttempt(userId, payload) {
        cleanupCache();
        cleanupAttemptCache();
        const record = await this._getExamRecord(userId, payload.examId);
        if (!record || record.userId !== userId) {
            const err = new Error('Exam not found or expired. Generate a new exam and try again.');
            err.statusCode = 404;
            throw err;
        }

        const key = `${userId}:${payload.examId}`;
        attemptCache.set(key, {
            examId: payload.examId,
            userId,
            currentIndex: Number.isInteger(payload.currentIndex) ? payload.currentIndex : 0,
            answers: Array.isArray(payload.answers) ? payload.answers : [],
            flagged: payload.flagged && typeof payload.flagged === 'object' ? payload.flagged : {},
            startedAt: payload.startedAt || record.startedAt,
            updatedAt: new Date().toISOString(),
            updatedAtMs: Date.now(),
        });
        cleanupAttemptCache();
        return { saved: true, updatedAt: attemptCache.get(key).updatedAt };
    }

    static async getAttempt(userId, examId) {
        cleanupCache();
        cleanupAttemptCache();
        const record = await this._getExamRecord(userId, examId);
        if (!record || record.userId !== userId) {
            const err = new Error('Exam not found or expired. Generate a new exam and try again.');
            err.statusCode = 404;
            throw err;
        }
        const key = `${userId}:${examId}`;
        return attemptCache.get(key) || {
            examId,
            currentIndex: 0,
            answers: [],
            flagged: {},
            startedAt: record.startedAt,
            updatedAt: null,
        };
    }

    static async _getExamRecord(userId, examId) {
        let record = examCache.get(examId);
        if (record && record.userId === userId) return record;

        try {
            const dbRes = await query('SELECT id, subject_id, title, type, ai_generated_content, created_at FROM materials WHERE id = $1 AND user_id = $2', [examId, userId]);
            if (dbRes.rows.length === 0) return null;
            
            const mat = dbRes.rows[0];
            if (mat.type !== 'exam' && mat.type !== 'mock_exam') return null;

            let contentObj;
            try {
                contentObj = typeof mat.ai_generated_content === 'string' ? JSON.parse(mat.ai_generated_content) : mat.ai_generated_content;
            } catch(e) {
                return null;
            }
            
            let questions = contentObj?.questions || contentObj?.items || contentObj || [];
            if (contentObj?.result && contentObj?.result?.questions) questions = contentObj.result.questions;
            if (!Array.isArray(questions)) questions = Object.values(questions);

            record = {
                userId,
                subjectId: mat.subject_id,
                createdAtMs: new Date(mat.created_at).getTime(),
                startedAt: new Date(mat.created_at).toISOString(),
                exam: {
                    id: mat.id,
                    title: mat.title || 'Mock Exam',
                    questions: questions,
                    timeLimit: contentObj?.timeLimit || null
                }
            };
            examCache.set(examId, record);
            return record;
        } catch (dbErr) {
            console.error('[ExamService] DB fetch failed in _getExamRecord', dbErr.message);
            return null;
        }
    }
}

export default ExamService;
