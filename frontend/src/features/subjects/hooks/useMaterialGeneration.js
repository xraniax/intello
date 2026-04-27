import { useState, useRef, useEffect, useCallback } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { MaterialService } from '@/services/MaterialService';

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
    const fetchMaterials  = useMaterialStore(s => s.actions.fetchMaterials);
    const startPolling         = useMaterialStore(s => s.actions.startPolling);
    const clearAllPolling      = useMaterialStore(s => s.actions.clearAllPolling);
    const setMaterialMetadata = useMaterialStore(s => s.actions.setMaterialMetadata);
    const setExpectedFlashcards = useMaterialStore(s => s.actions.setExpectedFlashcards);
    const jobProgress     = useMaterialStore(s => s.data.jobProgress);

    const [materialGenError, setMaterialGenError] = useState('');
    const [isGeneratingMaterial, setIsGeneratingMaterial] = useState(false);
    const [genResult, setGenResult] = useState('');
    
    // Enhancement Refs
    const hasRenamedRef = useRef(false);
    const activeMaterialIdRef = useRef(null);

    const streamControllerRef = useRef(null);
    const currentSubjectIdRef = useRef(normalizedId);
    useEffect(() => { currentSubjectIdRef.current = normalizedId; }, [normalizedId]);

    useEffect(() => {
        return () => {
            streamControllerRef.current?.abort();
            clearAllPolling();
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
        hasRenamedRef.current = false;
        activeMaterialIdRef.current = null;

        const isFlashGen = genType === 'flashcards' && genOptions?.count;
        const requestedCount = genOptions?.count;

        try {
            streamControllerRef.current?.abort();
            const controller = new AbortController();
            streamControllerRef.current = controller;

            setIsGeneratingMaterial(true);
            const streamResponse = await MaterialService.generateStream(
                targets,
                genType,
                subjectId,
                genOptions,
                controller.signal
            );

            if (!streamResponse.body) {
                throw new Error('Streaming response body is unavailable.');
            }

            const reader = streamResponse.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';
            let streamDone = false;

            while (!streamDone) {
                const { value, done } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const events = sseBuffer.split('\n\n');
                sseBuffer = events.pop() || '';

                for (const eventBlock of events) {
                    const lines = eventBlock.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) {
                            continue;
                        }

                        const payloadText = trimmed.slice(5).trim();
                        if (!payloadText) {
                            continue;
                        }

                        let parsed;
                        try {
                            parsed = JSON.parse(payloadText);
                        } catch {
                            continue;
                        }

                        if (parsed.type === 'error') {
                            throw new Error(parsed.message || 'Streaming error');
                        }

                        if (parsed.type === 'delta' && typeof parsed.data === 'string') {
                            setGenResult(prev => (prev || '') + parsed.data);
                        }

                        // Backward compatibility for older payloads.
                        if (parsed.delta) {
                            setGenResult(prev => (prev || '') + String(parsed.delta));
                        }

                        if ((parsed.type === 'final' && parsed.done === true) || parsed.done === true) {
                            streamDone = true;
                            break;
                        }
                    }
                    if (streamDone) break;
                }
            }

            streamControllerRef.current = null;
            setIsGeneratingMaterial(false);
            return;
        } catch (streamErr) {
            console.warn('[MaterialGen] Streaming path failed, falling back to async job flow:', streamErr?.message || streamErr);
            streamControllerRef.current = null;
            setIsGeneratingMaterial(false);
        }

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

                setIsGeneratingMaterial(true);
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
                    () => {
                        streamControllerRef.current = null;
                        setIsGeneratingMaterial(false);
                        if (String(currentSubjectIdRef.current) !== normalizedId) return;
                        
                        MaterialService.sync(material_id, controller.signal).then(() => {
                            if (String(currentSubjectIdRef.current) !== normalizedId) return;
                            fetchMaterials().then(() => {
                                const mat = useMaterialStore.getState().data.materials
                                    .find(m => String(m.id) === String(material_id));
                                if (!mat) return;
                                if (!tabsRef.current.find(t => String(t.id) === String(mat.id))) {
                                    setTabs(prev => [...prev, { 
                                        id: mat.id, title: mat.title || mat.type,
                                        type: mat.type, material: mat, pinned: false 
                                    }]);
                                }
                                setActiveTabId(mat.id);
                                setGenResult('');
                            });
                        });
                    },
                    () => { 
                        streamControllerRef.current = null; 
                        setIsGeneratingMaterial(false); 
                        startPolling(String(material_id)); 
                    }
                );
            } else {
                const fallback = res.data.data.result || res.data.data.content || '';
                setGenResult(typeof fallback === 'object' ? JSON.stringify(fallback, null, 2) : String(fallback));
                setIsGeneratingMaterial(false);
            }
        } catch (err) {
            setMaterialGenError(err.message || 'Generation failed.');
            setIsGeneratingMaterial(false);
        }
    }, [selectedUploads, subjectId, normalizedId, fetchMaterials, startPolling, tabsRef, setTabs, setActiveTabId]);

    return { 
        materialGenError, 
        setMaterialGenError, 
        isGeneratingMaterial, 
        setIsGeneratingMaterial, 
        genResult, 
        setGenResult, 
        jobProgress, 
        handleGenerateMaterial 
    };
};
