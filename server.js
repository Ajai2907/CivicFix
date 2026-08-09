const path = require('path');
const fs = require('fs');
const http = require('http');

// Load environment variables (.env fallback)
try {
    require('dotenv').config();
} catch (e) {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...val] = trimmed.split('=');
                if (key && !process.env[key.trim()]) {
                    process.env[key.trim()] = val.join('=').trim();
                }
            }
        });
    }
}

// Initialize database
const { db, dbDriver } = require('./db/database');
const {
    router: complaintsRouter,
    processPostComplaint,
    processGetTrack,
    processPatchStatus,
    uploadMiddleware
} = require('./routes/complaints');

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

let app;
let isExpress = false;

try {
    const express = require('express');
    const cors = require('cors');

    app = express();
    isExpress = true;

    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Serve uploaded images statically
    app.use('/uploads', express.static(uploadsDir));

    // Serve static frontend files (Citizen Portal, styles, scripts, pages)
    app.use(express.static(path.join(__dirname)));

    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.status(200).json({
            success: true,
            message: "CivicFix backend is running"
        });
    });

    // API Routes
    if (complaintsRouter) {
        app.use('/api', complaintsRouter);
    }

    // Centralized Error Handler
    app.use((err, req, res, next) => {
        console.error('[Express Central Error Handler]', err.stack || err.message || err);
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'An internal server error occurred.'
        });
    });

    app.listen(PORT, () => {
        console.log(`==========================================`);
        console.log(`🚀 CivicFix Server (Express) running on port ${PORT}`);
        console.log(`🌐 Health Check: http://localhost:${PORT}/api/health`);
        console.log(`📁 Uploads Directory: http://localhost:${PORT}/uploads`);
        console.log(`==========================================`);
    });
} catch (expressErr) {
    // Native HTTP server if express module is not installed in node_modules yet
    const MIME_TYPES = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };

    const server = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const urlPath = parsedUrl.pathname;

        // CORS Headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        // API Health Endpoint
        if (urlPath === '/api/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success: true,
                message: "CivicFix backend is running"
            }));
        }

        // POST /api/complaints
        if (urlPath === '/api/complaints' && req.method === 'POST') {
            return uploadMiddleware(req, res, async (err) => {
                if (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: err.message }));
                }
                const result = await processPostComplaint(req.body, req.file);
                res.writeHead(result.status, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(result.data));
            });
        }

        // GET /api/complaints/track
        if (urlPath === '/api/complaints/track' && req.method === 'GET') {
            const queryParams = Object.fromEntries(parsedUrl.searchParams);
            const result = processGetTrack(queryParams);
            res.writeHead(result.status, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(result.data));
        }

        // PATCH /api/authority/complaints/:id/status
        if (urlPath.startsWith('/api/authority/complaints/') && urlPath.endsWith('/status') && req.method === 'PATCH') {
            const parts = urlPath.split('/');
            const id = parts[4];
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                let parsedBody = {};
                try { parsedBody = JSON.parse(body); } catch (e) {}
                const result = processPatchStatus({ id }, parsedBody);
                res.writeHead(result.status, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(result.data));
            });
            return;
        }

        // Static File Serving (Uploads & Frontend)
        let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
        
        if (!filePath.startsWith(__dirname)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            return res.end('Forbidden');
        }

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('Not Found');
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        });
    });

    server.listen(PORT, () => {
        console.log(`==========================================`);
        console.log(`🚀 CivicFix Server (Native HTTP) running on port ${PORT}`);
        console.log(`🌐 Health Check: http://localhost:${PORT}/api/health`);
        console.log(`📁 Uploads Directory: http://localhost:${PORT}/uploads`);
        console.log(`==========================================`);
    });
}
