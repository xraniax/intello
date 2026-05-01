import { useState, useCallback, useRef, useEffect } from 'react';
import { useMaterialStore } from '@/store/useMaterialStore';
import { MaterialService } from '@/services/MaterialService';

const EXAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * useExamGeneration
 * Owns: mock exam generation logic and API calls.
 * Depends on: subject context and tab management to insert the new exam session.
 */
export const useExamGeneration = ({
    normalizedId,
    subject,
    setTabs,
    setActiveTabId,
}) => {
    const fetchMaterials = useMaterialStore(s => s.actions.fetchMaterials);
    const [isGeneratingExam, setIsGeneratingExam] = useState(false);
    const [examGenError, setExamGenError] = useState('');
    const timeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleGenerateExam = useCallback(async (genOptions = {}) => {
        setExamGenError('');
        setIsGeneratingExam(true);

        // Set timeout guard
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setExamGenError('Exam generation timed out after 5 minutes. The AI engine may be overloaded — please try again.');
            setIsGeneratingExam(false);
        }, EXAM_TIMEOUT_MS);

        try {
            const topics = (genOptions?.topics || subject?.name || '')
                .split(',')
                .map(i => i.trim())
                .filter(Boolean);

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

            const examRes = await MaterialService.generateExam(payload);
            const exam = examRes?.data?.data;
            
            // Refresh sidebar to show the new material (if persisted)
            fetchMaterials();
            
            if (!exam) {
                throw new Error('Failed to generate exam. Empty response.');
            }

            const tabId = `exam-${exam.id}`;

            setTabs(prev => [
                ...prev.filter(t => t.type !== 'exam_session'),
                { 
                    id: tabId, 
                    title: exam.title || 'Mock Exam', 
                    type: 'exam_session',
                    material: { id: tabId, type: 'exam_session', ai_generated_content: exam }, 
                    pinned: false 
                },
            ]);
            setActiveTabId(tabId);
        } catch (err) {
            setExamGenError(err.message || 'Exam generation failed.');
        } finally {
            setIsGeneratingExam(false);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }
    }, [normalizedId, subject, setTabs, setActiveTabId]);

    return {
        isGeneratingExam,
        examGenError,
        setExamGenError,
        handleGenerateExam,
    };
};
