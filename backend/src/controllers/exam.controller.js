import asyncHandler from '../utils/asyncHandler.js';
import MaterialService from '../services/material.service.js';
import ExamService from '../services/exam.service.js';

class ExamController {
    static generate = asyncHandler(async (req, res) => {
        // Unify with the high-performance async path
        const { subject_id, materialIds, numberOfQuestions, difficulty, types, title, timeLimit } = req.body;
        
        const genOptions = {
            count: numberOfQuestions,
            difficulty,
            examTypes: types,
            title,
            timeLimit
        };

        const result = await MaterialService.generateWithContext(
            req.user.id, 
            subject_id, 
            materialIds || [], 
            'mock_exam', 
            genOptions
        );

        res.status(202).json({
            status: 'success',
            data: result,
        });
    });

    static submit = asyncHandler(async (req, res) => {
        const result = await ExamService.submitExam(req.user.id, req.body);
        res.status(200).json({
            status: 'success',
            data: result,
        });
    });

    static saveAttempt = asyncHandler(async (req, res) => {
        const result = await ExamService.saveAttempt(req.user.id, req.body);
        res.status(200).json({
            status: 'success',
            data: result,
        });
    });

    static getAttempt = asyncHandler(async (req, res) => {
        const attempt = await ExamService.getAttempt(req.user.id, req.params.examId);
        res.status(200).json({
            status: 'success',
            data: attempt,
        });
    });
}

export default ExamController;
