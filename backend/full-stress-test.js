import './src/utils/config/db.js';
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import ExamService from './src/services/exam.service.js';
import { query } from './src/utils/config/db.js';

async function runFullExecutionTest() {
    const concurrentUsers = 10;
    console.log(`Starting FULL EXECUTION stress test with ${concurrentUsers} concurrent jobs...`);
    
    const engineUrl = process.env.ENGINE_URL || 'http://engine:8000';

    const promises = Array.from({ length: concurrentUsers }).map(async (_, i) => {
        const userId = '3dde5e73-f872-403e-917f-fb08919e94fa';
        const payload = {
            subject_id: '97ff567c-27cd-4cd2-8595-ac95a70a1a95',
            numberOfQuestions: 2,
            difficulty: 'Inter',
            topics: ['Cloud'],
            types: ['single_choice'],
            title: `Concurrent Job ${i}`
        };

        const t0 = Date.now();
        let res, job_id, material_id;
        try {
            res = await ExamService.generateExam(userId, payload);
            job_id = res.job_id;
            material_id = res.material_id;
        } catch (e) {
            return { error: 'API_FAIL', ms: Date.now()-t0, msg: e.message };
        }
        
        const tAPI = Date.now();

        return new Promise(async (resolve) => {
            let tFirstChunk = -1;
            const streamUrl = `${engineUrl}/job/${job_id}/stream`;
            
            try {
                const response = await axios({
                    method: 'get',
                    url: streamUrl,
                    responseType: 'stream',
                    timeout: 0 
                });
                
                response.data.on('data', (chunk) => {
                    const text = chunk.toString();
                    if (tFirstChunk === -1 && text.trim().length > 0) {
                        tFirstChunk = Date.now();
                        console.log(`[Job ${job_id}] First chunk received at ${tFirstChunk}`);
                    }
                    if (text.includes('[DONE]')) {
                        console.log(`[Job ${job_id}] Received [DONE] at ${Date.now()}`);
                        const tDone = Date.now();
                        response.data.destroy();
                        
                        // Verify Material JSON directly from DB
                        query('SELECT ai_generated_content FROM materials WHERE id = $1', [material_id])
                            .then(dbRes => {
                                const jsonContent = dbRes.rows[0]?.ai_generated_content;
                                let validJSON = false; let numQs = 0;
                                try {
                                    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
                                    if (parsed && Array.isArray(parsed.questions)) {
                                        numQs = parsed.questions.length;
                                        if (numQs === 2) validJSON = true;
                                    }
                                } catch (e) {}
                                
                                resolve({
                                    job_id,
                                    apiIngestionMs: tAPI - t0,
                                    queueDelayMs: tFirstChunk - tAPI,
                                    generationStreamingMs: tDone - tFirstChunk,
                                    totalE2E: tDone - t0,
                                    validJSON,
                                    numQuestions: numQs
                                });
                            })
                            .catch(e => resolve({ error: 'DB_VERIFY_FAIL', job_id }));
                    }
                });
                
                response.data.on('error', (err) => {
                    resolve({ error: 'SSE_STREAM_ERROR', job_id, msg: err.message });
                });
            } catch (err) {
                resolve({ error: 'AXIOS_STREAM_FAIL', job_id, msg: err.message });
            }
            
            // Safety timeout
            setTimeout(() => {
                resolve({ error: 'TIMEOUT_WAITING_FOR_CELERY', job_id });
            }, 600000); // 10 min
        });
    });

    const results = await Promise.all(promises);

    console.log("=== DETAILED RESULTS ===");
    console.log(JSON.stringify(results, null, 2));
    
    const successful = results.filter(r => r.validJSON);
    console.log("--- SUMMARY ---");
    console.log(`Success Rate: ${ (successful.length / concurrentUsers)*100 }%`);
    
    if (successful.length > 0) {
        let sumQ = 0, sumGen = 0, sumTotal = 0;
        successful.forEach(r => {
            sumQ += r.queueDelayMs;
            sumGen += r.generationStreamingMs;
            sumTotal += r.totalE2E;
        });
        console.log(`Avg Queue Delay: ${sumQ / successful.length} ms`);
        console.log(`Avg Token Streaming: ${sumGen / successful.length} ms`);
        console.log(`Avg Complete E2E Latency: ${sumTotal / successful.length} ms`);
    }

    process.exit(0);
}

runFullExecutionTest().catch(e => {
    console.error(e);
    process.exit(1);
});
