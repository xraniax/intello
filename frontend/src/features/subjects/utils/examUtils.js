/**
 * extractExamData - Normalizes raw material objects into a consistent exam structure.
 * Handles various nesting levels and key names (questions, items, exam, etc.)
 */
export const extractExamData = (data) => {
    if (!data) return null;

    // If it's a string, try to parse it
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return extractExamData(parsed);
        } catch {
            return null;
        }
    }

    // Standard shape: { questions: [...] }
    if (Array.isArray(data.questions)) return data;

    // Handle alternate names
    const alternateArray = data.exam || data.exam_questions || data.items || data.data;
    if (Array.isArray(alternateArray)) return { ...data, questions: alternateArray };

    // Dictionary support: if questions is { "1": {...}, "2": {...} }
    if (data.questions && typeof data.questions === 'object' && !Array.isArray(data.questions)) {
        const values = Object.values(data.questions);
        return { ...data, questions: values };
    }

    // Direct array?
    if (Array.isArray(data)) return { questions: data };

    // Try recursively unpacking wrapper objects
    if (data.content) return extractExamData(data.content);
    if (data.result) return extractExamData(data.result);
    if (data.data) return extractExamData(data.data);
    
    return null;
};
