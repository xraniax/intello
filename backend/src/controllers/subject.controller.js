import SubjectService from '../services/subject.service.js';

class SubjectController {
    static async create(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ status: 'error', message: 'User not authenticated' });
            }

            const { name, description } = req.body;
            const userId = req.user.id;

            if (!name) {
                return res.status(400).json({ status: 'error', message: 'Subject name is required' });
            }

            const subject = await SubjectService.createSubject(userId, name, description);
            res.status(201).json({ status: 'success', data: subject });
        } catch (error) {
            next(error);
        }
    }

    static async getAll(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ status: 'error', message: 'User not authenticated' });
            }

            const subjects = await SubjectService.getAllSubjects(req.user.id);
            res.status(200).json({ status: 'success', data: subjects });
        } catch (error) {
            next(error);
        }
    }

    static async getOne(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ status: 'error', message: 'User not authenticated' });
            }

            const subject = await SubjectService.getSubjectDetails(req.user.id, req.params.id);
            if (!subject) {
                return res.status(404).json({ status: 'error', message: 'Subject not found' });
            }
            res.status(200).json({ status: 'success', data: subject });
        } catch (error) {
            next(error);
        }
    }

    static async rename(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ status: 'error', message: 'User not authenticated' });
            }

            const { name } = req.body;
            if (!name) {
                return res.status(400).json({ status: 'error', message: 'New name is required' });
            }

            const subject = await SubjectService.renameSubject(req.user.id, req.params.id, name);
            if (!subject) {
                return res.status(404).json({ status: 'error', message: 'Subject not found' });
            }
            res.status(200).json({ status: 'success', data: subject });
        } catch (error) {
            next(error);
        }
    }

    static async delete(req, res, next) {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ status: 'error', message: 'User not authenticated' });
            }

            const deleted = await SubjectService.deleteSubject(req.user.id, req.params.id);
            if (!deleted) {
                return res.status(404).json({ status: 'error', message: 'Subject not found' });
            }
            res.status(200).json({ status: 'success', message: 'Subject deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
}

export default SubjectController;
