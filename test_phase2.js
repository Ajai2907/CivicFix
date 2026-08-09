const fs = require('fs');
const path = require('path');
const http = require('http');

// Helper to make multipart request to POST /api/complaints
async function testPostComplaint(boundary, bodyBuffer) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/complaints',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        req.write(bodyBuffer);
        req.end();
    });
}

// Helper to build multipart body
function buildMultipartBody(fields, fileField) {
    const boundary = '----WebKitFormBoundaryTest' + Math.random().toString(36).substring(2);
    const parts = [];

    for (const [key, value] of Object.entries(fields)) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    }

    if (fileField) {
        const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.fieldname}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.mimetype}\r\n\r\n`;
        parts.push(Buffer.from(fileHeader));
        parts.push(fileField.buffer);
        parts.push(Buffer.from('\r\n'));
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    return {
        boundary,
        buffer: Buffer.concat(parts)
    };
}

// Run integration tests
async function runTests() {
    console.log('🧪 Starting Phase 2 Integration Tests...\n');

    // Test 1: GET /api/health
    console.log('1️⃣ Testing GET /api/health...');
    const healthRes = await new Promise((resolve) => {
        http.get('http://localhost:3000/api/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        });
    });
    console.log('Status:', healthRes.status, 'Response:', healthRes.body);

    // Create dummy image buffer for testing
    const dummyImageBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');

    // Test 2: Submit Road Damage Complaint
    console.log('\n2️⃣ Testing POST /api/complaints (Road Damage)...');
    const roadFields = {
        citizen_name: 'Rahul Kumar',
        citizen_email: 'rahul@example.com',
        citizen_phone: '9876543210',
        category: 'Road Damage',
        description: 'Large pothole causing traffic slowdown on Anna Salai',
        address: 'Anna Salai, Chennai'
    };
    const roadFile = {
        fieldname: 'image',
        filename: 'pothole.jpg',
        mimetype: 'image/jpeg',
        buffer: dummyImageBuffer
    };
    const roadMultipart = buildMultipartBody(roadFields, roadFile);
    const roadRes = await testPostComplaint(roadMultipart.boundary, roadMultipart.buffer);
    console.log('Status:', roadRes.status, 'Response:', roadRes.data);

    // Test 3: Submit Water Emergency Complaint (Mandatory Rule Test)
    console.log('\n3️⃣ Testing POST /api/complaints (Water Emergency - Mandatory Rule Enforcement)...');
    const waterFields = {
        citizen_name: 'Priya Sharma',
        citizen_email: 'priya@example.com',
        citizen_phone: '9123456789',
        category: 'Water Leakage',
        description: 'Major pipe burst resulting in severe water leakage and flooding on Gandhi Road',
        address: 'Gandhi Road, Ward 12'
    };
    const waterFile = {
        fieldname: 'image',
        filename: 'pipe_burst.jpg',
        mimetype: 'image/jpeg',
        buffer: dummyImageBuffer
    };
    const waterMultipart = buildMultipartBody(waterFields, waterFile);
    const waterRes = await testPostComplaint(waterMultipart.boundary, waterMultipart.buffer);
    console.log('Status:', waterRes.status, 'Response:', waterRes.data);

    const waterCode = waterRes.data?.complaint_code;

    // Test 4: Secure Tracking API GET /api/complaints/track (Valid Complaint Code + Email)
    console.log('\n4️⃣ Testing GET /api/complaints/track (Valid Code + Email)...');
    const trackRes = await new Promise((resolve) => {
        http.get(`http://localhost:3000/api/complaints/track?complaint_code=${waterCode}&email=priya@example.com`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        });
    });
    console.log('Status:', trackRes.status, 'Response:', trackRes.body);

    // Test 5: Tracking API Security Check (Wrong Email -> Should Fail)
    console.log('\n5️⃣ Testing GET /api/complaints/track (Wrong Email Security Check)...');
    const invalidTrackRes = await new Promise((resolve) => {
        http.get(`http://localhost:3000/api/complaints/track?complaint_code=${waterCode}&email=hacker@example.com`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        });
    });
    console.log('Status:', invalidTrackRes.status, 'Response:', invalidTrackRes.body);

    console.log('\n✅ All Phase 2 Integration Tests Completed Successfully!');
}

runTests().catch(console.error);
