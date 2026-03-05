import axios from 'axios';
import Material from '../models/material.model.js';
import SubjectService from './subject.service.js';

class MaterialService {
    static async processMaterial(userId, title, content, type, subjectId = null) {
        // 1. Resolve subject
        let finalSubjectId = subjectId;
        if (!finalSubjectId) {
            const importedSubject = await SubjectService.getOrCreateImportedSubject(userId);
            finalSubjectId = importedSubject.id;
        }

        // 2. Save original material
        const material = await Material.create(userId, finalSubjectId, title, content, type);

        // 3. Fetch full material details (with subject join) for consistent return
        const fullMaterial = await Material.findById(material.id);

        try {
            // 4. Send to AI Engine
            const aiResponse = await axios.post(`${process.env.ENGINE_URL}/generate`, {
                content: content,
                task_type: type // e.g., 'summary', 'quiz'
            });

            // 5. Update with AI result
            const updatedMaterial = await Material.updateAIResult(material.id, { result: aiResponse.data.result });

            // Return updated with subject info
            return await Material.findById(updatedMaterial.id);
        } catch (error) {
            console.error('AI Processing Error:', error.message);
            // Return the initial material (with subject info) even if AI fails
            return fullMaterial;
        }
    }

    static async getUserHistory(userId) {
        return await Material.findByUserId(userId);
    }
}

export default MaterialService;
