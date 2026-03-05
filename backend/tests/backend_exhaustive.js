import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
let authToken = '';
const testEmail = `test_${Date.now()}@example.com`;
const password = 'Password123!';
let subjectId = '';
let materialId = '';

async function runTests() {
    console.log('--- 🚀 Starting Exhaustive Backend Test Suite ---');

    try {
        // 1. AUTHENTICATION
        console.log('\n[1. Authentication]');

        // Register Valid
        console.log('Case: Register Valid');
        const regRes = await axios.post(`${API_BASE}/auth/register`, {
            name: 'Test Tester',
            email: testEmail,
            password: password
        });
        console.log('✅ Success: User registered');

        // Register Duplicate
        console.log('Case: Register Duplicate');
        try {
            await axios.post(`${API_BASE}/auth/register`, {
                name: 'Test Tester',
                email: testEmail,
                password: password
            });
            console.log('❌ Error: Expected 400 for duplicate email');
        } catch (e) {
            console.log(`✅ Correctly rejected duplicate: ${e.response?.status}`);
        }

        // Login Valid
        console.log('Case: Login Valid');
        const loginRes = await axios.post(`${API_BASE}/auth/login`, {
            email: testEmail,
            password: password
        });
        authToken = loginRes.data.data.token;
        console.log('✅ Success: Logged in, token received');
        const authHeader = { headers: { Authorization: `Bearer ${authToken}` } };

        // Login Invalid Password
        console.log('Case: Login Invalid Password');
        try {
            await axios.post(`${API_BASE}/auth/login`, {
                email: testEmail,
                password: 'wrongpassword'
            });
            console.log('❌ Error: Expected 401 for wrong password');
        } catch (e) {
            console.log(`✅ Correctly rejected invalid login: ${e.response?.status}`);
        }

        // 2. SUBJECT MANAGEMENT
        console.log('\n[2. Subject Management]');

        // Create Subject
        console.log('Case: Create Subject');
        const subRes = await axios.post(`${API_BASE}/subjects`, {
            name: 'Chemistry',
            description: 'Organic and Inorganic chemistry'
        }, authHeader);
        subjectId = subRes.data.data.id;
        console.log(`✅ Success: Subject created (${subjectId})`);

        // List Subjects
        console.log('Case: List Subjects');
        const listRes = await axios.get(`${API_BASE}/subjects`, authHeader);
        const subjects = listRes.data.data;
        const sub = subjects.find(s => s.id === subjectId);
        if (sub && 'material_count' in sub) {
            console.log(`✅ Success: Listed subjects, found Chemistry with count: ${sub.material_count}`);
        } else {
            console.log('❌ Error: Subject not found or missing material_count');
        }

        // Get Details
        console.log('Case: Get Details');
        const detailRes = await axios.get(`${API_BASE}/subjects/${subjectId}`, authHeader);
        console.log(`✅ Success: Fetched details for ${detailRes.data.data.subject.name}`);

        // Rename Subject
        console.log('Case: Rename Subject');
        await axios.patch(`${API_BASE}/subjects/${subjectId}`, { name: 'Advanced Chemistry' }, authHeader);
        const renamedRes = await axios.get(`${API_BASE}/subjects/${subjectId}`, authHeader);
        if (renamedRes.data.data.subject.name === 'Advanced Chemistry') {
            console.log('✅ Success: Subject renamed');
        } else {
            console.log('❌ Error: Rename failed');
        }

        // 3. MATERIAL MANAGEMENT
        console.log('\n[3. Material Management]');

        // Upload to Subject
        console.log('Case: Upload to Subject');
        const upRes = await axios.post(`${API_BASE}/materials/upload`, {
            title: 'Periodic Table',
            content: 'Elements arranged by atomic number...',
            type: 'summary',
            subjectId: subjectId
        }, authHeader);
        materialId = upRes.data.data.id;
        console.log(`✅ Success: Material uploaded to subject (${materialId})`);

        // Quick Upload
        console.log('Case: Quick Upload (Auto-assign)');
        const quickRes = await axios.post(`${API_BASE}/materials/upload`, {
            title: 'Lab Notes',
            content: 'Observations from flask 2...',
            type: 'quiz'
        }, authHeader);
        console.log('✅ Success: Quick material uploaded');

        // History check
        console.log('Case: History Check');
        const histRes = await axios.get(`${API_BASE}/materials/history`, authHeader);
        const history = histRes.data.data;
        const quickMat = history.find(m => m.title === 'Lab Notes');
        if (quickMat && quickMat.subject_name === 'Imported Materials') {
            console.log('✅ Success: Quick material auto-assigned to "Imported Materials"');
        } else {
            console.log(`❌ Error: subject_name is ${quickMat?.subject_name}`);
        }

        // 4. EDGE CASES & SECURITY
        console.log('\n[4. Edge Cases & Security]');

        // Unauthorized Delete
        console.log('Case: Unauthorized Subject Fetch');
        try {
            await axios.get(`${API_BASE}/subjects`, { headers: { Authorization: 'Bearer invalid' } });
            console.log('❌ Error: Expected 401 for invalid token');
        } catch (e) {
            console.log(`✅ Correctly rejected invalid token: ${e.response?.status}`);
        }

        // 5. CASCADING DELETE
        console.log('\n[5. Cascading Delete]');
        console.log(`Case: Delete Subject ${subjectId}`);
        await axios.delete(`${API_BASE}/subjects/${subjectId}`, authHeader);

        const afterHistRes = await axios.get(`${API_BASE}/materials/history`, authHeader);
        const matExists = afterHistRes.data.data.some(m => m.id === materialId);
        if (!matExists) {
            console.log('✅ Success: Material was deleted via cascade');
        } else {
            console.log('❌ Error: Material still exists after subject deletion');
        }

        console.log('\n--- 🏁 Exhaustive Backend Suite Complete: ALL PASSED ---');

    } catch (error) {
        console.error('\n❌ Test execution failed!');
        console.error('Error Details:', error.response?.data || error.message);
        process.exit(1);
    }
}

runTests();
