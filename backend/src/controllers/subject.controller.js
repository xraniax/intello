import SubjectService from '../services/subject.service.js';
import asyncHandler from '../utils/asyncHandler.js';

class SubjectController {
    static create = asyncHandler(async (req, res) => {
        const { name, description } = req.body;
        const subject = await SubjectService.createSubject(req.user.id, name, description);
        res.status(201).json({ status: 'success', data: subject });
    });

    static getAll = asyncHandler(async (req, res) => {
        const subjects = await SubjectService.getAllSubjects(req.user.id);
        res.status(200).json({ status: 'success', data: subjects });
    });

    static getOne = asyncHandler(async (req, res) => {
        const subject = await SubjectService.getSubjectDetails(req.user.id, req.params.id);
        if (!subject) {
            res.status(404);
            throw new Error('Subject not found');
        }
        res.status(200).json({ status: 'success', data: subject });
    });

    static rename = asyncHandler(async (req, res) => {
        const { name } = req.body;
        const subject = await SubjectService.renameSubject(req.user.id, req.params.id, name);
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
