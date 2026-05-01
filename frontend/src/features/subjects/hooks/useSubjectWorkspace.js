import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSubjectStore } from '@/store/useSubjectStore';
import { useMaterialStore } from '@/store/useMaterialStore';
import { useUIStore } from '@/store/useUIStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useWorkspaceChat } from './useWorkspaceChat';
import { useWorkspacePanels } from './useWorkspacePanels';
import { useMaterialGeneration } from './useMaterialGeneration';
import { useExamGeneration } from './useExamGeneration';

/**
 * useSubjectWorkspace — Orchestration layer
 * Composes the separated domains (Panels, Chat, MaterialGen, ExamGen)
 * into a single unified API surface for SubjectDetail.jsx.
 */
export const useSubjectWorkspace = (subjectId) => {
    const normalizedId = String(subjectId);

    // ── Global Context ────────────────────────────────────────────────────────
    const subjects = useSubjectStore(s => s.data.subjects);
    const isPublic = useSubjectStore(s => s.data.isPublic);
    const user = useAuthStore(s => s.data.user);
    const fetchSubjects = useSubjectStore(s => s.actions.fetchSubjects);
    const materials = useMaterialStore(s => s.data.materials);
    const fetchMaterials = useMaterialStore(s => s.actions.fetchMaterials);
    
    const mLoading = useUIStore(s => s.data.loadingStates['materials']);
    const sLoading = useUIStore(s => s.data.loadingStates['subjects']);
    const loading = mLoading?.loading || sLoading?.loading;
    const isAnyBlocking = mLoading?.blocking || sLoading?.blocking;

    const subject = subjects.find(s => String(s.id).toLowerCase() === normalizedId.toLowerCase());

    const uploads = useMemo(() => (materials || []).filter(m => {
        const mid = m.subject_id || m.subject?.id;
        return String(mid) === normalizedId;
    }), [materials, normalizedId]);

    // Initial data fetch
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        if (subjects.length === 0) fetchSubjects().catch(() => {});
        fetchMaterials().catch(() => {});
    }, [normalizedId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Domains ───────────────────────────────────────────────────────────────
    
    // 1. Panels & UI State
    const panels = useWorkspacePanels({ subjectId, materials });

    // 2. Chat
    const chat = useWorkspaceChat({ uploads, selectedUploads: panels.selectedUploads });

    // 3. Generation Control
    // Holds the user's selected generator mode ('summary', 'flashcards', 'mock_exam')
    const [genType, setGenType] = useState('summary');

    const materialGen = useMaterialGeneration({
        subjectId,
        normalizedId,
        selectedUploads: panels.selectedUploads,
        handleRenameMaterial: panels.handleRenameMaterial,
        tabsRef: panels.tabsRef,
        setTabs: panels.setTabs,
        setActiveTabId: panels.setActiveTabId,
    });

    const examGen = useExamGeneration({
        normalizedId,
        subject,
        setTabs: panels.setTabs,
        setActiveTabId: panels.setActiveTabId,
    });

    // Strategy Pattern: Route handleGenerate to the correct domain engine
    const handleGenerate = useCallback(async (idOrOptionsOrEvent = null) => {
        let singleId = null;
        let genOptions = undefined;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (typeof idOrOptionsOrEvent === 'string' && uuidRegex.test(idOrOptionsOrEvent)) {
            singleId = idOrOptionsOrEvent;
        } else if (idOrOptionsOrEvent && typeof idOrOptionsOrEvent === 'object' && !idOrOptionsOrEvent.nativeEvent) {
            genOptions = idOrOptionsOrEvent;
        }

        if (genType === 'mock_exam') {
            // Unify: use the same async parallel pipeline as other materials
            return materialGen.handleGenerateMaterial(genType, singleId, genOptions);
        } else {
            return materialGen.handleGenerateMaterial(genType, singleId, genOptions);
        }
    }, [genType, examGen, materialGen]);

    // Unified Generation State
    const isGenerating = materialGen.isGeneratingMaterial || examGen.isGeneratingExam;
    const genError = materialGen.materialGenError || examGen.examGenError;
    const setGenError = genType === 'mock_exam' ? examGen.setExamGenError : materialGen.setMaterialGenError;
    // genResult applies only to materials (exams open a new tab)
    const genResult = materialGen.genResult;
    const setGenResult = materialGen.setGenResult;
    const jobProgress = materialGen.jobProgress;
    const retryGeneration = materialGen.retryGeneration;
    const generationStartTime = materialGen.generationStartTime;

    // ── Unified API Surface for SubjectDetail.jsx ─────────────────────────────
    return {
        subject, uploads, loading, isAnyBlocking, isPublic, user,
        ...panels,
        ...chat,
        
        genType, setGenType,
        isGenerating,
        genError, setGenError,
        genResult, setGenResult,
        jobProgress,
        handleGenerate,
        retryGeneration,
        generationStartTime,
    };
};
