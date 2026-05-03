import { useState, useRef, useEffect, useCallback } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { MaterialService } from '@/services/MaterialService';

const GENERATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — MAP+REDUCE for large docs needs headroom

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
    const startPolling = useMaterialStore(s => s.actions.startPolling);
    const clearAllPolling = useMaterialStore(s => s.actions.clearAllPolling);
    const setMaterialMetadata = useMaterialStore(s => s.actions.setMaterialMetadata);
    const setExpectedFlashcards = useMaterialStore(s => s.actions.setExpectedFlashcards);
    const jobProgress = useMaterialStore(s => s.data.jobProgress);

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

        // targets may be empty — that means "whole subject" (topic-only or no-filter generation).

        setGenResult('');
        setIsGeneratingMaterial(true);
        setGenerationStartTime(Date.now());
        hasRenamedRef.current = false;
        activeMaterialIdRef.current = null;

        // Store params for retry
        lastGenParamsRef.current = { genType, singleId, genOptions };

        // Set generation timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            console.warn('[TRACE][FE_TIMEOUT] generation timed out after %dms', GENERATION_TIMEOUT_MS);
            streamControllerRef.current?.abort();
            setMaterialGenError('Generation timed out after 10 minutes. The AI engine may be overloaded — please try again.');
            finishGenerating();
        }, GENERATION_TIMEOUT_MS);
        const isFlashGen = genType === 'flashcards' && genOptions?.count;
        const requestedCount = genOptions?.count;

        const feStartMs = performance.now();
        console.log('[TRACE][FE_GEN_START] type=%s targets=%d timestamp=%d', genType, targets.length, Date.now());

        try {
            streamControllerRef.current?.abort();
            const controller = new AbortController();
            streamControllerRef.current = controller;

            controller.signal.addEventListener('abort', () => {
                const abortMs = Math.round(performance.now() - feStartMs);
                console.warn('[TRACE][FE_ABORT] abort fired at duration_ms=%d', abortMs);
            });

            setIsGeneratingMaterial(true);
            const fetchStartMs = performance.now();
            console.log('[TRACE][FE_FETCH_START] time_since_gen_start_ms=%d', Math.round(fetchStartMs - feStartMs));
            const streamResponse = await MaterialService.generateStream(
                targets,
                genType,
                subjectId,
                genOptions,
                controller.signal
            );
            const fetchDoneMs = performance.now();
            console.log('[TRACE][FE_FETCH_DONE] status=%d time_ms=%d', streamResponse.status, Math.round(fetchDoneMs - feStartMs));

            if (!streamResponse.body) {
                throw new Error('Streaming response body is unavailable.');
            }

            const reader = streamResponse.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';
            let streamDone = false;
            let firstChunkLogged = false;
            let deltaCount = 0;
            let finalReceived = false;
            let errorReceived = false;
            let readCount = 0;

            while (!streamDone) {
                const { value, done } = await reader.read();
                readCount++;
                if (done) {
                    console.log(
                        '[TRACE][FE_SET_RESULT]',
                        'batch_chars=',
                        batchedText.length,
                        'preview=',
                        batchedText.slice(0, 80)
                    );
                    break;
                }

                if (!firstChunkLogged) {
                    console.log('[TRACE][FE_FIRST_SSE_CHUNK] time_ms=%d bytes=%d', Math.round(performance.now() - feStartMs), value?.length || 0);
                    firstChunkLogged = true;
                }

                sseBuffer += decoder.decode(value, { stream: true });
                const events = sseBuffer.split('\n\n');
                sseBuffer = events.pop() || '';

                // S-10 FIX: Batch all deltas from this read cycle into a single
                // state update to avoid re-rendering on every individual token.
                let batchedText = '';

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
                            errorReceived = true;
                            console.error('[TRACE][FE_SSE_ERROR] message=%s duration_ms=%d', parsed.message, Math.round(performance.now() - feStartMs));
                            const err = new Error(parsed.message || 'Streaming error');
                            err.isEngineError = true;
                            throw err;
                        }

                        if (parsed.type === 'delta' && typeof parsed.data === 'string') {
                            deltaCount++;
                            if (deltaCount === 1) {
                                console.log('[TRACE][FE_FIRST_DELTA] time_ms=%d', Math.round(performance.now() - feStartMs));
                            }
                            batchedText += parsed.data;
                        }

                        // Backward compatibility for older payloads.
                        if (parsed.delta) {
                            deltaCount++;
                            batchedText += String(parsed.delta);
                        }

                        if ((parsed.type === 'final' && parsed.done === true) || parsed.done === true) {
                            finalReceived = true;
                            console.log('[TRACE][FE_SSE_FINAL] deltas=%d duration_ms=%d', deltaCount, Math.round(performance.now() - feStartMs));
                            streamDone = true;
                            break;
                        }
                    }
                    if (streamDone) break;
                }

                // Flush batched deltas as a single React state update
                if (batchedText) {
                    setGenResult(prev => (prev || '') + batchedText);
                }
            }

            const totalMs = Math.round(performance.now() - feStartMs);
            console.log('[TRACE][FE_STREAM_COMPLETE] deltas=%d final=%s error=%s total_ms=%d close=normal', deltaCount, finalReceived, errorReceived, totalMs);
            streamControllerRef.current = null;
            finishGenerating();
            return;
        } catch (streamErr) {
            const totalMs = Math.round(performance.now() - feStartMs);
            console.error('[TRACE][FE_STREAM_THROW] error=%s duration_ms=%d', streamErr?.message || streamErr, totalMs);
            streamControllerRef.current = null;
            if (streamErr?.isEngineError) {
                setMaterialGenError(streamErr.message);
                finishGenerating();
                return;
            }
            console.warn('[MaterialGen] Streaming path failed, falling back to async job flow:', streamErr?.message || streamErr);
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
                    () => {
                        streamControllerRef.current = null;
                        finishGenerating();
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
                        finishGenerating();
                        startPolling(String(material_id));
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
