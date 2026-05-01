import axios from 'axios';
import { COMPLETED, FAILED } from '../constants/status.enum.js';
import Material from '../models/material.model.js';

class FallbackGenerationService {
    /**
     * Synchronous generation using local Ollama model directly from Node.js.
     * Used when the Python Engine is unreachable or fails.
     */
    static async generateSync(userId, materialId, taskType, gps, context) {
        console.warn(`[Fallback] Triggering fallback generation for material ${materialId}`);
        const OLLAMA_URL = process.env.OLLAMA_FALLBACK_URL || 'http://ollama_gpu:11434/api/generate';
        const MODEL = process.env.OLLAMA_FALLBACK_MODEL || 'llama3.1:8b';

        try {
            // 1. Build prompt based on GPS
            const prompt = this._buildGPSPrompt(taskType, gps, context);

            // 2. Call Ollama directly
            const response = await axios.post(OLLAMA_URL, {
                model: 'qwen2.5:7b-instruct',
                prompt: prompt,
                stream: false,
                options: { temperature: 0.1 } // Very deterministic for fallback
            }, { timeout: 180000 });

            let resultText = response.data.response;
            
            // 3. Robust JSON repair
            resultText = this._repairJson(resultText);
            const aiGeneratedContent = JSON.parse(resultText);

            // 4. Save to DB
            let finalResult = { telemetry: { path: 'fallback', latency_ms: 0 } };
            
            if (taskType === 'summary') {
                finalResult.type = 'summary';
                finalResult.content = aiGeneratedContent.content || aiGeneratedContent;
                if (!finalResult.content.title) finalResult.content = { title: "Summary", sections: [{heading: "Content", body: "Fallback data generated"}] };
            } else if (taskType === 'flashcards') {
                finalResult.type = 'flashcards';
                finalResult.content = aiGeneratedContent.content || aiGeneratedContent;
                if (!finalResult.content.cards) finalResult.content = { cards: [{"front": "Fallback Card", "back": "Fallback generated"}] };
            } else {
                finalResult.type = taskType === 'mock_exam' ? 'exam' : taskType;
                finalResult.questions = aiGeneratedContent.questions || aiGeneratedContent;
            }

            await Material.updateAIResult(materialId, userId, finalResult);
            console.info(`[Fallback] Successfully generated content for material ${materialId}`);
            
            return { status: 'SUCCESS', material_id: materialId };
        } catch (error) {
            console.error(`[Fallback] Failed: ${error.message}`);
            await Material.recordFailure(materialId, userId, `Fallback also failed: ${error.message}`);
            throw error;
        }
    }

    static _buildGPSPrompt(taskType, gps, context) {
        const difficulty = gps.difficulty || 'intermediate';
        const ctxStr = context.substring(0, 4000);
        
        if (taskType === 'summary') {
            return `Context:\n${ctxStr}\n\nTask: Generate a ${difficulty} summary in JSON format.\nRequirements:\n- Return ONLY a JSON object exactly like {"type": "summary", "content": {"title": "Topic", "sections": [{"heading": "Sec1", "body": "paragraph"}]}}\nGenerate now:`;
        } else if (taskType === 'flashcards') {
            const count = gps.total_count || 10;
            return `Context:\n${ctxStr}\n\nTask: Generate exactly ${count} study flashcards in JSON format.\nRequirements:\n- Return ONLY a JSON object exactly like {"type": "flashcards", "content": {"cards": [{"front": "Question", "back": "Answer"}]}}\nGenerate now:`;
        } else {
            const count = gps.total_count || 5;
            let distribution = '10 mcq';
            if (gps.distribution && gps.distribution.length > 0) {
                distribution = gps.distribution.map(d => `${d.count || ''} ${d.type}`).join(', ');
            }
            return `Context:\n${ctxStr}\n\n
        Task: Generate a ${difficulty} level exam in JSON format.
        Distribution: ${distribution}. 
        Total questions: ${count}.
        
        Requirements:
        - Return ONLY a JSON object with a "questions" array.
        - For multiple_choice: {id, type: 'mcq', question, options: [A, B, C, D], answer}
        - For essay: {id, type: 'essay', question, answer}
        
        Generate now:`;
        }
    }

    static _repairJson(text) {
        let cleaned = text.trim();
        // Remove markdown
        cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
        // Simple C-comment removal
        cleaned = cleaned.replace(/\/\/.*$/gm, '');
        // Trailing commas
        cleaned = cleaned.replace(/,\s*([\]\}])/g, '$1');
        
        // Find first [ or { and last ] or }
        const start = cleaned.indexOf('[');
        const startObj = cleaned.indexOf('{');
        const first = (start !== -1 && (startObj === -1 || start < startObj)) ? start : startObj;
        
        const lastArr = cleaned.lastIndexOf(']');
        const lastObj = cleaned.lastIndexOf('}');
        const last = Math.max(lastArr, lastObj);
        
        if (first !== -1 && last !== -1) {
            return cleaned.substring(first, last + 1);
        }
        return cleaned;
    }
}

export default FallbackGenerationService;
