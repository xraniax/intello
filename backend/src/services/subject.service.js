import Subject from '../models/subject.model.js';
import Material from '../models/material.model.js';

class SubjectService {
    /**
     * Get or create "Imported Materials" subject for a user
     */
    static async getOrCreateImportedSubject(userId) {
        let subject = await Subject.findByName(userId, 'Imported Materials');
        if (!subject) {
            subject = await Subject.create(userId, 'Imported Materials', 'Automatically created for non-categorized uploads');
        }
        return subject;
    }

    /**
     * Create a new subject
     */
    static async createSubject(userId, name, description) {
        return await Subject.create(userId, name, description);
    }

    /**
     * Get all subjects for a user
     */
    static async getAllSubjects(userId) {
        return await Subject.findAllByUserId(userId);
    }

    /**
     * Get subject by ID with its materials
     */
    static async getSubjectDetails(userId, subjectId) {
        const subject = await Subject.findById(subjectId, userId);
        if (!subject) return null;

        const materials = await Material.findBySubjectId(subjectId, userId);
        return {
            subject,
            materials
        };
    }

    /**
     * Rename a subject
     */
    static async renameSubject(userId, subjectId, newName) {
        return await Subject.update(subjectId, userId, newName);
    }

    /**
     * Delete a subject
     */
    static async deleteSubject(userId, subjectId) {
        return await Subject.delete(subjectId, userId);
    }
}

export default SubjectService;
