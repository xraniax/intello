import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const testUser = {
    name: "QA Tester",
    email: `qa_${Math.floor(Math.random() * 10000)}@test.com`,
    password: "password123"
};

let authToken = '';

const results = [];

async function logResult(endpoint, testCase, requestData, expectedStatus, actualStatus, response, pass) {
    results.push({
        endpoint,
        testCase,
        requestData: JSON.stringify(requestData),
        expectedStatus,
        actualStatus,
        response: JSON.stringify(response).substring(0, 100) + '...',
        pass: pass ? '✅ PASS' : '❌ FAIL'
    });
    console.log(`${pass ? '✅' : '❌'} ${endpoint} - ${testCase}`);
}

async function runTests() {
    console.log('🚀 Starting Cognify Backend Test Suite...\n');

    // 1. Health Check
    try {
        const res = await axios.get(`${BASE_URL}/health`);
        logResult('/health', 'Connectivity', {}, 200, res.status, res.data, res.status === 200);
    } catch (err) {
        logResult('/health', 'Connectivity', {}, 200, err.response?.status || 'ERR', err.response?.data || err.message, false);
    }

    // 2. Auth: Register
    try {
        const res = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
        authToken = res.data.data.token;
        logResult('/api/auth/register', 'Valid Registration', testUser, 201, res.status, res.data, res.status === 201);
    } catch (err) {
        logResult('/api/auth/register', 'Valid Registration', testUser, 201, err.response?.status || 'ERR', err.response?.data || err.message, false);
    }

    // 3. Auth: Duplicate Register
    try {
        const res = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
        logResult('/api/auth/register', 'Duplicate Email', testUser, 400, res.status, res.data, false);
    } catch (err) {
        logResult('/api/auth/register', 'Duplicate Email', testUser, 400, err.response?.status || 'ERR', err.response?.data || err.message, err.response?.status === 400);
    }

    // 4. Auth: Login
    try {
        const loginData = { email: testUser.email, password: testUser.password };
        const res = await axios.post(`${BASE_URL}/api/auth/login`, loginData);
        logResult('/api/auth/login', 'Valid Login', loginData, 200, res.status, res.data, res.status === 200);
    } catch (err) {
        logResult('/api/auth/login', 'Valid Login', testUser, 200, err.response?.status || 'ERR', err.response?.data || err.message, false);
    }

    // 5. Auth: Protected Route (Me)
    try {
        const res = await axios.get(`${BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        logResult('/api/auth/me', 'Authorized Profile', {}, 200, res.status, res.data, res.status === 200);
    } catch (err) {
        logResult('/api/auth/me', 'Authorized Profile', {}, 200, err.response?.status || 'ERR', err.response?.data || err.message, false);
    }

    // 6. Auth: Protected Route - Invalid Token
    try {
        const res = await axios.get(`${BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer tampered.token.here` }
        });
        logResult('/api/auth/me', 'Tampered Token', {}, 401, res.status, res.data, false);
    } catch (err) {
        logResult('/api/auth/me', 'Tampered Token', {}, 401, err.response?.status || 'ERR', err.response?.data || err.message, err.response?.status === 401);
    }

    // 7. Materials: Upload
    try {
        const uploadData = { title: "Test Doc", content: "This is some test content for AI processing.", type: "summary" };
        const res = await axios.post(`${BASE_URL}/api/materials/upload`, uploadData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        logResult('/api/materials/upload', 'Successful Upload', uploadData, 201, res.status, res.data, res.status === 201);
    } catch (err) {
        logResult('/api/materials/upload', 'Successful Upload', {}, 201, err.response?.status || 'ERR', err.response?.data || err.message, false);
    }

    // 8. Materials: History
    try {
        const res = await axios.get(`${BASE_URL}/api/materials/history`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        logResult('/api/materials/history', 'Retrieve History', {}, 200, res.status, res.data, res.status === 200);
    } catch (err) {
        logResult('/api/materials/history', 'Retrieve History', {}, 200, err.response?.status || 'ERR', err.response?.data || err.message, false);
    }

    console.log('\n📊 TEST RESULTS TABLE:\n');
    console.table(results);
}

runTests();
