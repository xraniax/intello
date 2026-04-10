import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSubjectStore } from '@/store/useSubjectStore';
import { useMaterialStore } from '@/store/useMaterialStore';
import { useUIStore } from '@/store/useUIStore';
import { useAuthStore } from '@/store/useAuthStore';
import { subjectService } from '@/features/subjects/services/SubjectService';
import { useSpeech } from '@/hooks/useSpeech';
import { setFlashcardsExpectedCount } from '@/features/subjects/components/FlashcardsView';
import toast from 'react-hot-toast';

export const useSubjectWorkspace = (subjectId) => {
    const normalizedId = String(subjectId);
    const subjects = useSubjectStore((state) => state.data.subjects);
    const fetchSubjects = useSubjectStore((state) => state.actions.fetchSubjects);
    const materials = useMaterialStore((state) => state.data.materials);
    const materialsLoadingState = useUIStore(state => state.data.loadingStates['materials']);
    const subjectsLoadingState = useUIStore(state => state.data.loadingStates['subjects']);
    const isPublic = useSubjectStore((state) => state.data.isPublic);
    const user = useAuthStore((state) => state.data.user);
    const fetchMaterials = useMaterialStore((state) => state.actions.fetchMaterials);
    const clearAllPolling = useMaterialStore((state) => state.actions.clearAllPolling);
    const setWorkspacePanel = useUIStore(state => state.actions.setWorkspacePanel);
    const jobProgress = useMaterialStore((state) => state.data.jobProgress);

    const loading = materialsLoadingState?.loading || subjectsLoadingState?.loading;
    const isAnyBlocking = materialsLoadingState?.blocking || subjectsLoadingState?.blocking;

    const subject = subjects.find((s) => String(s.id) === normalizedId);

    const uploads = useMemo(() => {
        return (materials || []).filter((m) => {
            const mid = m.subject_id || (m.subject && m.subject.id);
            return String(mid) === String(normalizedId);
        });
    }, [materials, normalizedId]);

    // Modal & Selection state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({});
    const [selectedUploads, setSelectedUploads] = useState([]);
    const [showUploadModal, setShowUploadModal] = useState(false);

    // Chat state
    const [chatError, setChatError] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [filePanelCollapsed, setFilePanelCollapsed] = useState(false);

    // Generation state
    const [genError, setGenError] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genResult, setGenResult] = useState('');
    const [genType, setGenType] = useState('summary');

    // Tabs State
    const savedTabsKey = `cognify_tabs_${subjectId}`;
    const savedActiveTabKey = `cognify_active_tab_${subjectId}`;

    const [tabs, setTabs] = useState(() => {
        const saved = localStorage.getItem(savedTabsKey);
        const base = { id: 'generator', title: 'Study Intelligence', type: 'generator', pinned: true };
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const otherTabs = parsed.filter(t => t.id !== 'generator');
                return [base, ...otherTabs];
            } catch {
                return [base];
            }
        }
        return [base];
    });

    const [activeTabId, setActiveTabId] = useState(() => {
        return localStorage.getItem(savedActiveTabKey) || 'generator';
    });

    const chatEndRef = useRef(null);
    const { speak, listen, isListening, cancel } = useSpeech();
    const currentSubjectIdRef = useRef(normalizedId);

    useEffect(() => {
        currentSubjectIdRef.current = normalizedId;
    }, [normalizedId]);

    // --- Initial data fetch on workspace mount ---
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return; // public mode, skip

        // Fetch subjects if not yet loaded (e.g. direct navigation to workspace URL)
        if (subjects.length === 0) {
            fetchSubjects().catch(() => {});
        }
        // Always fetch materials to ensure workspace is up-to-date
        fetchMaterials().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [normalizedId]); // run once per subject ID

    useEffect(() => {
        localStorage.setItem(savedTabsKey, JSON.stringify(tabs));
    }, [tabs, savedTabsKey]);

    useEffect(() => {
        if (activeTabId) {
            localStorage.setItem(savedActiveTabKey, activeTabId);
        }
    }, [activeTabId, savedActiveTabKey]);

    const enhancedTabs = useMemo(() => {
        return tabs.map(tab => {
            if (tab.id === 'generator') return { ...tab, isDeleted: false };
            const exists = (materials || []).some(m => String(m.id) === String(tab.id));
            return { ...tab, isDeleted: !exists };
        });
    }, [tabs, materials]);

    const handleUploadSuccess = useCallback(async () => {
        await fetchMaterials();
        setShowUploadModal(false);
    }, [fetchMaterials]);

    const handleDeleteUpload = useCallback((materialId, materialName) => {
        setModalConfig({
            title: 'Delete document?',
            message: `Are you sure you want to delete "${materialName || 'this file'}"? This cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete permanently',
            onConfirm: async () => {
                try {
                    await subjectService.deleteMaterial(materialId);
                    await fetchMaterials();
                    setSelectedUploads(prev => prev.filter(id => id !== materialId));
                    toast.success('Document removed');
                } catch {
                    toast.error('Failed to delete material');
                } finally {
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    }, [fetchMaterials]);

    const handleChat = useCallback(async (e) => {
        if (e) e.preventDefault();
        if (!currentQuestion.trim() || isThinking) return;
        setChatError('');
        const userMsg = { role: 'user', content: currentQuestion };
        setChatMessages(prev => [...prev, userMsg]);
        setCurrentQuestion('');
        setIsThinking(true);
        try {
            const contextIds = selectedUploads.length > 0 ? selectedUploads : uploads.map(m => m.id);
            const res = await subjectService.chat(contextIds, userMsg.content);
            setChatMessages(prev => [...prev, { role: 'ai', content: res.data.data.result }]);
        } catch (err) {
            setChatError(err.message || 'AI engine is unreachable. Please try again.');
            setChatMessages(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
        } finally {
            setIsThinking(false);
        }
    }, [currentQuestion, isThinking, selectedUploads, uploads]);

    const handleGenerate = useCallback(async (idOrOptionsOrEvent = null) => {
        setGenError('');
        let singleId = null;
        let genOptions = undefined;

        if (typeof idOrOptionsOrEvent === 'string') {
            singleId = idOrOptionsOrEvent;
        } else if (idOrOptionsOrEvent && typeof idOrOptionsOrEvent === 'object' && !idOrOptionsOrEvent.nativeEvent) {
            genOptions = idOrOptionsOrEvent;
        }

        const rawTargets = singleId ? [singleId] : selectedUploads;
        const targets = rawTargets
            .filter(t => t && typeof t === 'string' && t !== '[object Object]')
            .map(t => String(t));

        if (genType !== 'mock_exam' && targets.length === 0) {
            setGenError('Select at least one document from the Source Files panel first.');
            return;
        }
        setIsGenerating(true);
        setGenResult('');

        if (genType === 'flashcards' && genOptions?.count) {
            setFlashcardsExpectedCount(genOptions.count);
        }

        try {
            if (genType === 'mock_exam') {
                const topics = (genOptions?.topics || subject?.name || '').split(',').map(i => i.trim()).filter(Boolean);
                const selectedTypes = Array.isArray(genOptions?.examTypes) && genOptions.examTypes.length > 0
                    ? genOptions.examTypes
                    : ['single_choice', 'multiple_select', 'short_answer', 'problem', 'fill_blank', 'matching', 'scenario'];

                const payload = {
                    subject_id: normalizedId,
                    numberOfQuestions: genOptions?.count || 10,
                    difficulty: genOptions?.difficulty || 'Inter',
                    topics: topics.length > 0 ? topics : [subject?.name || 'General'],
                    types: selectedTypes,
                    title: `${subject?.name || 'General'} Mock Exam`,
                    timeLimit: genOptions?.timeLimit || 30,
                };

                const examRes = await subjectService.generateExam(payload);
                const exam = examRes?.data?.data;
                const tabId = `exam-${exam.id}`;
                setTabs(prev => {
                    const withoutOldSession = prev.filter((t) => t.type !== 'exam_session');
                    return [...withoutOldSession, {
                        id: tabId,
                        title: exam.title || 'Mock Exam',
                        type: 'exam_session',
                        material: { id: tabId, type: 'exam_session', ai_generated_content: exam },
                        pinned: false,
                    }];
                });
                setActiveTabId(tabId);
                setIsGenerating(false);
                return;
            }

            const res = await subjectService.generate(targets, genType, subjectId, genOptions);
            const { material_id } = res.data.data;

            if (material_id) {
                const safeMid = String(material_id);
                fetchMaterials();
                setActiveTabId('generator');

                subjectService.streamMaterial(
                    material_id,
                    (chunk) => {
                        setGenResult(prev => (prev || '') + chunk);
                        setIsGenerating(true);
                    },
                    () => {
                        setIsGenerating(false);
                        subjectService.sync(material_id).then(() => {
                            if (String(currentSubjectIdRef.current) !== String(normalizedId)) return;
                            fetchMaterials().then(() => {
                                const currentMaterials = useMaterialStore.getState().data.materials;
                                const newMat = currentMaterials.find(m => String(m.id) === String(material_id));
                                if (newMat) {
                                    setTabs(prev => {
                                        if (!prev.find(t => String(t.id) === String(newMat.id))) {
                                            return [...prev, {
                                                id: newMat.id,
                                                title: newMat.title || newMat.type,
                                                type: newMat.type,
                                                material: newMat,
                                                pinned: false
                                            }];
                                        }
                                        return prev;
                                    });
                                    setActiveTabId(newMat.id);
                                    setGenResult('');
                                }
                            });
                        });
                    },
                    (err) => {
                        useMaterialStore.getState().actions.startPolling(safeMid);
                    }
                );
            } else {
                const fallbackResult = res.data.data.result || res.data.data.content || '';
                setGenResult(typeof fallbackResult === 'object' ? JSON.stringify(fallbackResult, null, 2) : String(fallbackResult));
                setIsGenerating(false);
            }
        } catch (err) {
            setGenError(err.message || 'Generation failed.');
            setIsGenerating(false);
        }
    }, [genType, selectedUploads, subjectId, normalizedId, subject, fetchMaterials, genResult, tabs]);

    const toggleSelection = useCallback((mid) => {
        setSelectedUploads(prev => {
            const isAdding = !prev.includes(mid);
            if (isAdding) setActiveTabId('generator');
            return isAdding ? [...prev, mid] : prev.filter(id => id !== mid);
        });
    }, []);

    return {
        subject,
        uploads,
        loading,
        isAnyBlocking,
        isPublic,
        user,
        tabs: enhancedTabs,
        setTabs,
        activeTabId,
        setActiveTabId,
        selectedUploads,
        setSelectedUploads,
        toggleSelection,
        showUploadModal,
        setShowUploadModal,
        handleUploadSuccess,
        handleDeleteUpload,
        chatMessages,
        currentQuestion,
        setCurrentQuestion,
        handleChat,
        isThinking,
        chatError,
        setChatMessages,
        setChatError,
        chatEndRef,
        chatCollapsed,
        setChatCollapsed,
        filePanelCollapsed,
        setFilePanelCollapsed,
        genType,
        setGenType,
        handleGenerate,
        isGenerating,
        genResult,
        setGenResult,
        genError,
        jobProgress,
        isListening,
        listen,
        speak,
        cancel,
        isModalOpen,
        setIsModalOpen,
        modalConfig
    };
};
