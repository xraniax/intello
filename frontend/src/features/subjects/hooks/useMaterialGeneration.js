import { useState, useRef, useEffect, useCallback } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { MaterialService } from '@/services/MaterialService';

const GENERATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — MAP+REDUCE for large docs needs headroom

// ── Streaming flush config ──────────────────────────────────────────────────
// Chunks accumulate in a ref and flush to React state at this interval.
// 80 ms ≈ 12 UI updates/sec — smooth enough for streaming text, fast enough
// to avoid visible lag.  Raise to 120 ms if jank persists on low-end hardware.
const STREAM_FLUSH_INTERVAL_MS = 80;

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

    // ── Streaming accumulator refs ──────────────────────────────────────────
    // Raw chunks land here instantly; a timer flushes to React state at a
    // controlled rate so we never exceed ~12 re-renders/sec.
    const streamBufferRef = useRef('');
    const flushTimerRef = useRef(null);

    /** Flush accumulated buffer into React state (single update). */
    const flushStreamBuffer = useCallback(() => {
        const pending = streamBufferRef.current;
        if (pending) {
            streamBufferRef.current = '';
            setGenResult(prev => (prev || '') + pending);
        }
    }, []);

    /** Start the periodic flush timer. */
    const startFlushTimer = useCallback(() => {
        stopFlushTimer();
        flushTimerRef.current = setInterval(flushStreamBuffer, STREAM_FLUSH_INTERVAL_MS);
    }, [flushStreamBuffer]);

    /** Stop the flush timer and do one final flush. */
    const stopFlushTimer = useCallback(() => {
        if (flushTimerRef.current) {
            clearInterval(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        // Final flush to ensure no data is stranded in the buffer.
        flushStreamBuffer();
    }, [flushStreamBuffer]);

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
            // Ensure flush timer is cleaned up on unmount.
            if (flushTimerRef.current) clearInterval(flushTimerRef.current);
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
        streamBufferRef.current = '';
        setIsGeneratingMaterial(true);
        setGenerationStartTime(Date.now());
        hasRenamedRef.current = false;
        activeMaterialIdRef.current = null;

        // Store params for retry (from HEAD)
        lastGenParamsRef.current = { genType, singleId, genOptions };

        // Set generation timeout (from HEAD)
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            console.warn('[TRACE][FE_TIMEOUT] generation timed out after %dms', GENERATION_TIMEOUT_MS);
            streamControllerRef.current?.abort();
            setMaterialGenError('Generation timed out after 10 minutes. The AI engine may be overloaded — please try again.');
            stopFlushTimer();
            finishGenerating();
        }, GENERATION_TIMEOUT_MS);
        const isFlashGen = genType === 'flashcards' && genOptions?.count;
        const requestedCount = genOptions?.count;

        const feStartMs = performance.now();
        let renderCount = 0;
        console.log('[TRACE][FE_GEN_START] type=%s targets=%d timestamp=%d', genType, targets.length, Date.now());

        try {

            streamControllerRef.current?.abort();
            const controller = new AbortController();
            streamControllerRef.current = controller;

            controller.signal.addEventListener('abort', () => {
                const abortMs = Math.round(performance.now() - feStartMs);
                console.warn('[TRACE][FE_ABORT] abort fired at duration_ms=%d', abortMs);
                stopFlushTimer();
            });

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

            // Start the controlled-rate flush timer.
            startFlushTimer();

            while (!streamDone) {
                const { value, done } = await reader.read();
                readCount++;
                if (done) {
                    console.log(
                        '[TRACE][FE_STREAM_EOF]',
                        'readCount=', readCount,
                        'deltaCount=', deltaCount,
                        'buffer_pending=', streamBufferRef.current.length
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
                            // Clear any partial content accumulated before the error
                            // so the user doesn't see a truncated summary.
                            stopFlushTimer();
                            streamBufferRef.current = '';
                            setGenResult('');
                            const err = new Error(parsed.message || 'Streaming error');
                            err.isEngineError = true;
                            throw err;
                        }

                        if (parsed.type === 'delta' && typeof parsed.data === 'string') {
                            deltaCount++;
                            if (deltaCount === 1) {
                                console.log('[TRACE][FE_FIRST_DELTA] time_ms=%d', Math.round(performance.now() - feStartMs));
                            }
                            // Accumulate into the ref — the flush timer pushes to state.
                            streamBufferRef.current += parsed.data;
                        }

                        // Backward compatibility for older payloads.
                        if (parsed.delta) {
                            deltaCount++;
                            streamBufferRef.current += String(parsed.delta);
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

                // No per-read setGenResult — the flush timer handles it.
            }

            // Stop timer and flush any remaining buffered text.
            stopFlushTimer();

            const totalMs = Math.round(performance.now() - feStartMs);
            console.log('[TRACE][FE_STREAM_COMPLETE] deltas=%d final=%s error=%s total_ms=%d close=normal', deltaCount, finalReceived, errorReceived, totalMs);
            streamControllerRef.current = null;
            finishGenerating();
            return;
        } catch (streamErr) {
            stopFlushTimer();
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
    }, [selectedUploads, subjectId, normalizedId, fetchMaterials, startPolling, tabsRef, setTabs, setActiveTabId, finishGenerating, startFlushTimer, stopFlushTimer]);

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
