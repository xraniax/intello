import { useState, useRef, useEffect, useCallback } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { MaterialService } from '@/services/MaterialService';

const GENERATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * useMaterialGeneration
 * Owns: standard material streaming, polling fallback, genResult state.
 * Depends on: subject context + panel callbacks to update workspace state.
 */
export const useMaterialGeneration = ({
    subjectId,
    normalizedId,
    selectedUploads,
    tabsRef,
    setTabs,
    setActiveTabId,
}) => {
    const fetchMaterials = useMaterialStore(s => s.actions.fetchMaterials);
    const { startPolling, clearAllPolling, setExpectedFlashcards } = useMaterialStore(s => s.actions);
    const jobProgress = useMaterialStore(s => s.data.jobProgress);

    const openMaterialTab = useCallback((mat) => {
        if (!mat) return;
        if (!tabsRef.current.find(t => String(t.id) === String(mat.id))) {
            setTabs(prev => {
                if (prev.some(t => String(t.id) === String(mat.id))) return prev;
                return [...prev, {
                    id: String(mat.id),
                    title: mat.title || (mat.type ? mat.type.charAt(0).toUpperCase() + mat.type.slice(1) : 'Material'),
                    type: mat.type,
                    material: mat,
                    pinned: false
                }];
            });
        }
        setActiveTabId(String(mat.id));
        setGenResult('');
    }, [setTabs, setActiveTabId, tabsRef]);

    const [materialGenError, setMaterialGenError] = useState('');
    const [isGeneratingMaterial, setIsGeneratingMaterial] = useState(false);
    const [genResult, setGenResult] = useState('');
    const [generationStartTime, setGenerationStartTime] = useState(null);

    // Enhancement Refs
    const hasRenamedRef = useRef(false);
    const activeMaterialIdRef = useRef(null);
    const timeoutRef = useRef(null);
    const lastGenParamsRef = useRef(null);

    const streamControllerRef = useRef(null);
    const currentSubjectIdRef = useRef(normalizedId);
    useEffect(() => { currentSubjectIdRef.current = normalizedId; }, [normalizedId]);

    // Cleanup helper — clears timeout and generating state
    const finishGenerating = useCallback(() => {
        setIsGeneratingMaterial(false);
        setGenerationStartTime(null);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            streamControllerRef.current?.abort();
            clearAllPolling();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerateMaterial = useCallback(async (genType, singleId = null, genOptions = undefined) => {
        setMaterialGenError('');

        // Adaptive quiz: skip bulk generation, open a live AdaptiveQuizView tab
        if (genType === 'quiz' && genOptions?.difficulty === 'adaptive') {
            const tabId = `adaptive-quiz-${subjectId}`;
            setTabs(prev => prev.find(t => t.id === tabId)
                ? prev
                : [...prev, { id: tabId, title: 'Adaptive Quiz', type: 'quiz', quizMode: 'adaptive', material: null, pinned: false }]
            );
            setActiveTabId(tabId);
            return;
        }

        const targets = (singleId ? [singleId] : selectedUploads)
            .filter(t => t && typeof t === 'string' && t !== '[object Object]')
            .map(String);

        if (targets.length === 0) {
            setMaterialGenError('Select at least one document from the Source Files panel first.');
            return;
        }

        setGenResult('');
        setIsGeneratingMaterial(true);
        setGenerationStartTime(Date.now());
        hasRenamedRef.current = false;
        activeMaterialIdRef.current = null;

        // Store params for retry (from HEAD)
        lastGenParamsRef.current = { genType, singleId, genOptions };

        // Set generation timeout (from HEAD)
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            streamControllerRef.current?.abort();
            setMaterialGenError('Generation timed out after 5 minutes. The AI engine may be overloaded — please try again.');
            finishGenerating();
        }, GENERATION_TIMEOUT_MS);

        const isFlashGen = genType === 'flashcards' && genOptions?.count;
        const requestedCount = genOptions?.count;

        try {
            const res = await MaterialService.generate(targets, genType, subjectId, genOptions);
            const { material_id } = res.data.data;
            activeMaterialIdRef.current = material_id;

            if (material_id) {
                // If this was a flashcard generation, associate the metadata with the new ID
                if (isFlashGen) {
                    setExpectedFlashcards(String(material_id), requestedCount);
                }

                fetchMaterials();
                setActiveTabId('generator');

                streamControllerRef.current?.abort();
                const controller = new AbortController();
                streamControllerRef.current = controller;

                // Keep isGeneratingMaterial = true until stream completes
                MaterialService.stream(
                    material_id,
                    controller.signal,
                    chunk => {
                        setGenResult(prev => {
                            const next = (prev || '') + chunk;

                            // Intelligent Title Derivation
                            if (!hasRenamedRef.current && next.includes('#')) {
                                const titleMatch = next.match(/#\s+([^\n#]+)/);
                                if (titleMatch && titleMatch[1]) {
                                    const derivedTitle = titleMatch[1].trim();
                                    if (derivedTitle && derivedTitle.length > 3) {
                                        console.log(`[MaterialGen] Intelligent title detected: "${derivedTitle}". Renaming...`);
                                        MaterialService.rename(material_id, derivedTitle)
                                            .then(() => fetchMaterials())
                                            .catch(err => console.error("Rename failed", err));
                                        hasRenamedRef.current = true;
                                    }
                                }
                            }
                            return next;
                        });
                    },
                    async () => {
                        streamControllerRef.current = null;
                        finishGenerating();
                        if (String(currentSubjectIdRef.current) !== normalizedId) return;

                        try {
                            await MaterialService.sync(material_id, controller.signal);
                            if (String(currentSubjectIdRef.current) !== normalizedId) return;
                            
                            const mats = await fetchMaterials();
                            const mat = mats.find(m => String(m.id) === String(material_id));
                            if (mat) {
                                openMaterialTab(mat);
                            }
                        } catch (err) {
                            console.error("[MaterialGen] Completion sync/fetch error", err);
                            // Fallback to polling if sync fails or material not found
                            startPolling(String(material_id), (mat) => {
                                if (String(currentSubjectIdRef.current) === normalizedId) {
                                    openMaterialTab(mat);
                                }
                            });
                        }
                    },
                    () => {
                        streamControllerRef.current = null;
                        finishGenerating();
                        startPolling(String(material_id), (mat) => {
                            if (String(currentSubjectIdRef.current) === normalizedId) {
                                openMaterialTab(mat);
                            }
                        });
                    }
                );
            } else {
                const fallback = res.data.data.result || res.data.data.content || '';
                setGenResult(typeof fallback === 'object' ? JSON.stringify(fallback, null, 2) : String(fallback));
                finishGenerating();
            }
        } catch (err) {
            setMaterialGenError(err.message || 'Generation failed.');
            finishGenerating();
        }
    }, [selectedUploads, subjectId, normalizedId, fetchMaterials, startPolling, tabsRef, setTabs, setActiveTabId, finishGenerating]);

    // Retry with last-used params
    const retryGeneration = useCallback(() => {
        const params = lastGenParamsRef.current;
        if (params) {
            setMaterialGenError('');
            handleGenerateMaterial(params.genType, params.singleId, params.genOptions);
        }
    }, [handleGenerateMaterial]);

    return {
        materialGenError,
        setMaterialGenError,
        isGeneratingMaterial,
        setIsGeneratingMaterial,
        genResult,
        setGenResult,
        jobProgress,
        handleGenerateMaterial,
        retryGeneration,
        generationStartTime,
    };
};
