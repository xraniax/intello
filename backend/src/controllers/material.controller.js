import MaterialService from '../services/material.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import fs from 'fs';

class MaterialController {
    static upload = asyncHandler(async (req, res) => {
        const { title, content, type, subjectId } = req.body;
        const file = req.file;

        let finalContent = content || '';

        // If a file is uploaded, parse it
        if (file) {
            if (file.mimetype !== 'application/pdf') {
                fs.unlinkSync(file.path);
                res.status(400);
                throw new Error('Only PDF files are allowed');
            }

            try {
                const dataBuffer = fs.readFileSync(file.path);
                const data = await pdfParse(dataBuffer);
                finalContent += '\n\n' + data.text; // Append parsed text
                fs.unlinkSync(file.path); // Clean up
            } catch (err) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                res.status(500);
                throw new Error('Failed to parse PDF file');
            }
        }

        finalContent = finalContent.trim();

        if (!finalContent || !type) {
            res.status(400);
            throw new Error('Either file or text content is required, along with task type');
        }

        const material = await MaterialService.processMaterial(
            req.user.id,
            title || req.file?.originalname || 'Untitled',
            finalContent,
            type,
            subjectId
        );

        res.status(201).json({
            status: 'success',
            data: material
        });
    });

    static getHistory = asyncHandler(async (req, res) => {
        const history = await MaterialService.getUserHistory(req.user.id);
        res.status(200).json({
            status: 'success',
            data: history
        });
    });

    static chatCombined = asyncHandler(async (req, res) => {
        const { materialIds, question } = req.body;
        if (!materialIds || !question) {
            res.status(400);
            throw new Error('materialIds and question are required');
        }

        const result = await MaterialService.chatWithContext(req.user.id, materialIds, question);
        res.status(200).json({ status: 'success', data: result });
    });

    static generateCombined = asyncHandler(async (req, res) => {
        const { materialIds, taskType } = req.body;
        if (!materialIds || !taskType) {
            res.status(400);
            throw new Error('materialIds and taskType are required');
        }

        const result = await MaterialService.generateWithContext(req.user.id, materialIds, taskType);
        res.status(200).json({ status: 'success', data: result });
    });
}

export default MaterialController;
