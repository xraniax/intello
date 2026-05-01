import SubjectService from '../services/subject.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination.js';

class SubjectController {
    static create = asyncHandler(async (req, res) => {
        const { name, description } = req.body;
        const subject = await SubjectService.createSubject(req.user.id, name, description);
        res.status(201).json({ status: 'success', data: subject });
    });

    static getAll = asyncHandler(async (req, res) => {
        const { page, limit, offset } = parsePagination(req.query);
        const result = await SubjectService.getAllSubjects(req.user.id, { limit, offset });
        
        // If pagination was applied, return paginated response
        if (result && result.subjects) {
            const paginatedResponse = buildPaginatedResponse(result.subjects, result.total, { page, limit });
            res.status(200).json({ status: 'success', ...paginatedResponse });
        } else {
            // Backward compatibility: return plain array if no pagination requested
            res.status(200).json({ status: 'success', data: result });
        }
    });

    static getOne = asyncHandler(async (req, res) => {
        const subject = await SubjectService.getSubjectDetails(req.user.id, req.params.id);
        if (!subject) {
            res.status(404);
            throw new Error('Subject not found');
        }
        res.status(200).json({ status: 'success', data: subject });
    });

    static update = asyncHandler(async (req, res) => {
        const { name, description } = req.body;
        const subject = await SubjectService.updateSubject(req.user.id, req.params.id, name, description);
        if (!subject) {
            res.status(404);
            throw new Error('Subject not found');
        }
        res.status(200).json({ status: 'success', data: subject });
    });

    static delete = asyncHandler(async (req, res) => {
        const deleted = await SubjectService.deleteSubject(req.user.id, req.params.id);
        if (!deleted) {
            res.status(404);
            throw new Error('Subject not found');
        }
        res.status(200).json({ status: 'success', message: 'Subject deleted successfully' });
    });
}

export default SubjectController;
