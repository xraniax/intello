import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
let token = '';
let subjectId = '';

async function runTests() {
    try {
        console.log('--- Starting Verification ---');

        // 1. Login/Register
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${API_BASE}/auth/login`, {
            email: 'test@example.com',
            password: 'password123'
        }).catch(async () => {
            return await axios.post(`${API_BASE}/auth/register`, {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            });
        });
        token = loginRes.data.data.token;
        const authHeader = { headers: { Authorization: `Bearer ${token}` } };

        // 2. Create Subject
        console.log('2. Creating subject...');
        const createSubRes = await axios.post(`${API_BASE}/subjects`, {
            name: 'Operating Systems',
            description: 'Core CS subject'
        }, authHeader);
        subjectId = createSubRes.data.data.id;
        console.log(`✅ Subject created: ${subjectId}`);

        // 3. Upload Material to Subject
        console.log('3. Uploading material to subject...');
        const uploadRes = await axios.post(`${API_BASE}/materials/upload`, {
            title: 'Lecture 1',
            content: 'Process scheduling is important...',
            type: 'summary',
            subjectId: subjectId
        }, authHeader);
        console.log(`✅ Material uploaded to subject: ${uploadRes.data.data.id}`);

        // 4. Upload Material without Subject (Auto-creation)
        console.log('4. Uploading material without subject...');
        const quickUploadRes = await axios.post(`${API_BASE}/materials/upload`, {
            title: 'Quick Note',
            content: 'Remember to study memory management.',
            type: 'summary'
        }, authHeader);
        console.log(`✅ Quick material uploaded: ${quickUploadRes.data.data.id}`);
        console.log(`   Assigned to: ${quickUploadRes.data.data.subject.name}`);

        // 5. Get History
        console.log('5. Fetching history...');
        const historyRes = await axios.get(`${API_BASE}/materials/history`, authHeader);
        console.log(`✅ History fetched, count: ${historyRes.data.data.length}`);
        console.log('   Sample entry subject:', historyRes.data.data[0].subject.name);

        // 6. Rename Subject
        console.log('6. Renaming subject...');
        await axios.patch(`${API_BASE}/subjects/${subjectId}`, { name: 'OS Advanced' }, authHeader);
        const renamedSub = await axios.get(`${API_BASE}/subjects/${subjectId}`, authHeader);
        console.log(`✅ Subject renamed to: ${renamedSub.data.data.name}`);

        // 7. Delete Subject
        console.log('7. Deleting subject...');
        await axios.delete(`${API_BASE}/subjects/${subjectId}`, authHeader);
        console.log('✅ Subject deleted');

        // 8. Test Invalid Token (Security Check)
        console.log('8. Testing invalid token (Should not crash)...');
        try {
            await axios.get(`${API_BASE}/subjects`, { headers: { Authorization: 'Bearer invalid-token' } });
            console.log('❌ Error: Expected 401 for invalid token but got success');
        } catch (error) {
            console.log(`✅ Correctly rejected invalid token: ${error.response?.status}`);
        }

        // 9. Test Missing Token (Security Check)
        console.log('9. Testing missing token (Should not crash)...');
        try {
            await axios.get(`${API_BASE}/subjects`);
            console.log('❌ Error: Expected 401 for missing token but got success');
        } catch (error) {
            console.log(`✅ Correctly rejected missing token: ${error.response?.status}`);
        }

        console.log('--- Verification Complete ---');
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

runTests();
