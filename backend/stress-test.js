import './src/utils/config/db.js';
import dotenv from 'dotenv';
dotenv.config();
import ExamService from './src/services/exam.service.js';

const userId = '3dde5e73-f872-403e-917f-fb08919e94fa';
const payload = {
    subject_id: '97ff567c-27cd-4cd2-8595-ac95a70a1a95',
    numberOfQuestions: 2,
    difficulty: 'Inter',
    topics: ['Cloud'],
    types: ['single_choice'],
    title: 'Stress Test Exam'
};

async function measureRequest() {
    const start = Date.now();
    try {
        const result = await ExamService.generateExam(userId, payload);
        const ms = Date.now() - start;
        return { success: true, ms, mode: result.mode, result };
    } catch (e) {
        return { success: false, ms: Date.now() - start, error: e.message };
    }
}

async function runPhases() {
    console.log("=== Phase A: Baseline (5 sequential) ===");
    let phaseA_ms = [];
    let phaseA_modes = {};
    for(let i=0; i<5; i++) {
        const res = await measureRequest();
        phaseA_ms.push(res.ms);
        phaseA_modes[res.mode] = (phaseA_modes[res.mode] || 0) + 1;
    }
    console.log(JSON.stringify({
        testPhase: "A", 
        summary: { avgTotalMs: phaseA_ms.reduce((a,b)=>a+b,0)/5 },
        reliability: { fallbackRate: phaseA_modes['sync'] ? (phaseA_modes['sync']/5)*100 + "%" : "0%" }
    }));

    console.log("\n=== Phase B: Concurrent (20 parallel) ===");
    let pB = [];
    for(let i=0; i<20; i++) pB.push(measureRequest());
    let resB = await Promise.all(pB);
    let avgB = resB.reduce((sum, r) => sum + r.ms, 0) / 20;
    let bSync = resB.filter(r => r.mode === 'sync').length;
    console.log(JSON.stringify({
        testPhase: "B",
        summary: { avgTotalMs: avgB },
        reliability: { fallbackRate: (bSync/20)*100 + "%" }
    }));

    console.log("\n=== Phase C: Burst (100 rapid) ===");
    let pC = [];
    for(let i=0; i<100; i++) pC.push(measureRequest());
    let resC = await Promise.all(pC);
    let avgC = resC.reduce((sum, r) => sum + r.ms, 0) / 100;
    let cSync = resC.filter(r => r.mode === 'sync').length;
    let cErr = resC.filter(r => !r.success).length;
    console.log(JSON.stringify({
        testPhase: "C",
        summary: { avgTotalMs: avgC },
        reliability: { fallbackRate: (cSync/100)*100 + "%", errorRate: (cErr/100)*100 + "%" }
    }));
    
    process.exit(0);
}
runPhases();
