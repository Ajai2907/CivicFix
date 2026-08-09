const path = require('path');
const fs = require('fs');

const { db } = require('../db/database');
const uploadMiddleware = require('../middleware/upload');
const { analyzeCivicIssue } = require('../services/geminiService');

/**
 * Generate a unique human-readable complaint code e.g. CF-2026-8941
 */
function generateUniqueComplaintCode() {
    const year = new Date().getFullYear();
    let isUnique = false;
    let code = '';

    while (!isUnique) {
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        code = `CF-${year}-${randomDigits}`;

        const stmt = db.prepare('SELECT id FROM complaints WHERE complaint_code = ?');
        const existing = stmt.get ? stmt.get(code) : null;
        if (!existing) {
            isUnique = true;
        }
    }

    return code;
}

/**
 * Helper to delete an uploaded file if validation or database insert fails
 */
function cleanupFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            console.error('Failed to cleanup file:', err.message);
        }
    }
}

/**
 * Core Business Logic: Submit Complaint
 */
async function processPostComplaint(body, file) {
    const {
        citizen_name,
        citizen_email,
        citizen_phone,
        category,
        description,
        latitude,
        longitude,
        address
    } = body || {};

    // 1. Validation
    if (!citizen_name || citizen_name.trim() === '') {
        if (file) cleanupFile(file.path);
        return { status: 400, data: { success: false, message: 'Citizen full name is required.' } };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!citizen_email || !emailRegex.test(citizen_email.trim())) {
        if (file) cleanupFile(file.path);
        return { status: 400, data: { success: false, message: 'A valid email address is required.' } };
    }

    if (!citizen_phone || citizen_phone.trim() === '') {
        if (file) cleanupFile(file.path);
        return { status: 400, data: { success: false, message: 'Phone number is required.' } };
    }

    if (!category || category.trim() === '' || category === 'Select Category') {
        if (file) cleanupFile(file.path);
        return { status: 400, data: { success: false, message: 'Please select a valid issue category.' } };
    }

    if (!description || description.trim() === '') {
        if (file) cleanupFile(file.path);
        return { status: 400, data: { success: false, message: 'Issue description is required.' } };
    }

    if (!file) {
        return { status: 400, data: { success: false, message: 'An issue photo is required.' } };
    }

    // 2. Image Path & URL
    const imagePath = file.path;
    const imageUrl = `/uploads/${file.filename}`;

    // 3. AI Analysis & Mandatory Water Priority Enforcement
    const aiAnalysis = await analyzeCivicIssue(imagePath, category, description);

    // 4. Generate Unique Complaint Code
    const complaintCode = generateUniqueComplaintCode();

    // 5. Save to SQLite Database
    const latVal = latitude ? parseFloat(latitude) : null;
    const lngVal = longitude ? parseFloat(longitude) : null;

    const insertStmt = db.prepare(`
        INSERT INTO complaints (
            complaint_code, citizen_name, citizen_email, citizen_phone,
            category, description, image_url, latitude, longitude, address,
            status, ai_category, ai_severity, ai_priority, ai_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
        complaintCode,
        citizen_name.trim(),
        citizen_email.trim().toLowerCase(),
        citizen_phone.trim(),
        category.trim(),
        description.trim(),
        imageUrl,
        latVal,
        lngVal,
        address ? address.trim() : null,
        'Pending',
        aiAnalysis.category || category,
        aiAnalysis.severity || 5,
        aiAnalysis.priority || 'Medium',
        aiAnalysis.reason || 'Issue received and pending review.'
    );

    console.log(`[Complaints API] ✅ Complaint saved: ${complaintCode} (${aiAnalysis.priority} Priority)`);

    return {
        status: 201,
        data: {
            success: true,
            complaint_code: complaintCode,
            message: 'Complaint submitted successfully',
            analysis: {
                category: aiAnalysis.category,
                priority: aiAnalysis.priority,
                severity: aiAnalysis.severity,
                reason: aiAnalysis.reason
            }
        }
    };
}

/**
 * Core Business Logic: Secure Complaint Tracking
 */
function processGetTrack(query) {
    const { complaint_code, email, phone } = query || {};

    if (!complaint_code || (!email && !phone)) {
        return {
            status: 400,
            data: {
                success: false,
                message: 'Verification Error: Both Complaint Code AND your Email or Phone number are required to track a complaint.'
            }
        };
    }

    const codeVal = complaint_code.trim().toUpperCase();
    const emailVal = email ? email.trim().toLowerCase() : '';
    const phoneVal = phone ? phone.trim() : '';

    const stmt = db.prepare(`
        SELECT * FROM complaints 
        WHERE UPPER(complaint_code) = ? 
          AND (
            (? != '' AND LOWER(citizen_email) = ?) 
            OR (? != '' AND citizen_phone = ?)
          )
    `);

    const complaint = stmt.get ? stmt.get(codeVal, emailVal, emailVal, phoneVal, phoneVal) : null;

    if (!complaint) {
        return {
            status: 404,
            data: {
                success: false,
                message: 'No matching complaint found. Please double-check your Complaint Code and verification details.'
            }
        };
    }

    return {
        status: 200,
        data: {
            success: true,
            complaint: {
                complaint_code: complaint.complaint_code,
                citizen_name: complaint.citizen_name,
                category: complaint.category,
                description: complaint.description,
                status: complaint.status,
                ai_category: complaint.ai_category,
                ai_priority: complaint.ai_priority,
                ai_severity: complaint.ai_severity,
                ai_reason: complaint.ai_reason,
                image_url: complaint.image_url,
                latitude: complaint.latitude,
                longitude: complaint.longitude,
                address: complaint.address,
                created_at: complaint.created_at,
                updated_at: complaint.updated_at
            }
        }
    };
}

/**
 * Core Business Logic: Authority Status Update (Preparation for Phase 4)
 */
function processPatchStatus(params, body) {
    const { id } = params || {};
    const { status } = body || {};

    const validStatuses = ['Pending', 'In Progress', 'Resolved'];
    if (!status || !validStatuses.includes(status)) {
        return {
            status: 400,
            data: {
                success: false,
                message: 'Invalid status. Must be one of: Pending, In Progress, Resolved'
            }
        };
    }

    const updateStmt = db.prepare(`
        UPDATE complaints 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? OR complaint_code = ?
    `);

    const result = updateStmt.run(status, id, id);

    if (result.changes === 0) {
        return {
            status: 404,
            data: {
                success: false,
                message: 'Complaint record not found.'
            }
        };
    }

    return {
        status: 200,
        data: {
            success: true,
            message: `Complaint status updated to ${status}`
        }
    };
}

// Express Router export if express is available
let router;
try {
    const express = require('express');
    router = express.Router();

    router.post('/complaints', uploadMiddleware, async (req, res) => {
        try {
            const result = await processPostComplaint(req.body, req.file);
            res.status(result.status).json(result.data);
        } catch (err) {
            console.error('[Express Router POST /complaints Error]', err);
            res.status(500).json({ success: false, message: 'Server error processing complaint.' });
        }
    });

    router.get('/complaints/track', (req, res) => {
        const result = processGetTrack(req.query);
        res.status(result.status).json(result.data);
    });

    router.patch('/authority/complaints/:id/status', (req, res) => {
        const result = processPatchStatus(req.params, req.body);
        res.status(result.status).json(result.data);
    });
} catch (e) {
    router = null;
}

module.exports = {
    router,
    processPostComplaint,
    processGetTrack,
    processPatchStatus,
    uploadMiddleware
};
