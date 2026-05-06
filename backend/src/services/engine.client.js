import axios from 'axios';

const ENGINE_URL = process.env.ENGINE_URL || 'http://engine:8000';

export const engineClient = axios.create({
    baseURL: ENGINE_URL,
    // 300 s default — matches the /generate Celery trigger timeout (material.service.js:432).
    // The /generate/stream route overrides this to 600 s per-request (material.service.js:368).
    timeout: 300000,
});

export default engineClient;