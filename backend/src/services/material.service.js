import axios from 'axios';
import Material from '../models/material.model.js';

class MaterialService {
    static async processMaterial(userId, title, content, type) {
        // 1. Save original material
        const material = await Material.create(userId, title, content, type);

        try {
            // 2. Send to AI Engine
            const aiResponse = await axios.post(`${process.env.ENGINE_URL}/generate`, {
                content: content,
                task_type: type // e.g., 'summary', 'quiz'
            });

            // 3. Update with AI result
            const updatedMaterial = await Material.updateAIResult(material.id, { result: aiResponse.data.result });
            return updatedMaterial;
        } catch (error) {
            console.error('AI Processing Error:', error.message);
            // In a real app, we might mark the material as 'failed' in DB
            throw new Error('Failed to process material with AI engine');
        }
    }

    static async getUserHistory(userId) {
        return await Material.findByUserId(userId);
    }
}

export default MaterialService;
