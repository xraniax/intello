import './src/utils/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

import ExamService from './src/services/exam.service.js';

async function run() {
    console.log("Running Telemetry Test...");
    const payload = {
        subject_id: '97ff567c-27cd-4cd2-8595-ac95a70a1a95', // Cloud subject DB ID
        numberOfQuestions: 3,
        difficulty: 'Inter',
        topics: ['Cloud'],
        types: ['single_choice', 'short_answer'],
        title: 'Mock Exam Test'
    };
    
    // User ID for abirrabdellatif@gmail.com
    const userId = '3dde5e73-f872-403e-917f-fb08919e94fa'; 

    try {
        const result = await ExamService.generateExam(userId, payload);
        console.log("RESULT RETURNED TO FRONTEND:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Test failed:", err);
    }
    process.exit(0);
}
run();
