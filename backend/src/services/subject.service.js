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
        const opContext = { userId, name, operation: 'createSubject' };
        const existing = await Subject.findByName(userId, name);
        if (existing) {
            console.warn(`[SubjectService] Duplicate detected: ${JSON.stringify(opContext)}`);
            throw Object.assign(new Error(`A subject named "${name}" already exists.`), { statusCode: 409, code: 'DUPLICATE_SUBJECT' });
        }
        
        console.info(`[SubjectService] Creating subject: ${JSON.stringify(opContext)}`);
        return await Subject.create(userId, name, description);
    }

    /**
     * Get all subjects for a user (paginated)
     */
    static async getAllSubjects(userId, pagination = null) {
        if (pagination) {
            const [subjects, total] = await Promise.all([
                Subject.findAllByUserId(userId, pagination),
                Subject.getCountByUserId(userId)
            ]);
            return { subjects, total };
        }
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
     * Update a subject (rename and/or update description)
     */
    static async updateSubject(userId, subjectId, newName, newDescription) {
        const existing = await Subject.findByName(userId, newName);
        if (existing && String(existing.id) !== String(subjectId)) {
            throw Object.assign(new Error(`A subject named "${newName}" already exists.`), { statusCode: 409, code: 'DUPLICATE_SUBJECT' });
        }
        return await Subject.update(subjectId, userId, newName, newDescription);
    }

    /**
     * Delete a subject (soft delete) and move its materials to trash.
     */
    static async deleteSubject(userId, subjectId) {
        const deleted = await Subject.delete(subjectId, userId);
        if (!deleted) return false;
        await Material.deleteBySubject(subjectId, userId);
        return true;
    }

    static async getTrash(userId, pagination = null) {
        if (pagination) {
            const [trash, total] = await Promise.all([
                Subject.findDeleted(userId, 30, pagination),
                Subject.getDeletedCount(userId)
            ]);
            return { trash, total };
        }
        return await Subject.findDeleted(userId, 30);
    }

    static async getDeletedCount(userId) {
        return await Subject.getDeletedCount(userId);
    }

    static async restoreSubject(userId, subjectId) {
        const restored = await Subject.restore(subjectId, userId);
        if (!restored) return false;
        await Material.restoreBySubject(subjectId, userId);
        return true;
    }

    static async permanentDeleteSubject(userId, subjectId) {
        await Material.permanentDeleteBySubject(subjectId, userId);
        return await Subject.permanentDelete(subjectId, userId);
    }
}

export default SubjectService;
