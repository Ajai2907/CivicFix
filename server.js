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

const PORT = process.env.PORT || 3000;

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

    // Serve static frontend files (Citizen Portal, styles, scripts, pages)
    app.use(express.static(path.join(__dirname)));

    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.status(200).json({
            success: true,
            message: "CivicFix backend is running"
        });
    });

    app.listen(PORT, () => {
        console.log(`==========================================`);
        console.log(`🚀 CivicFix Server (Express) running on port ${PORT}`);
        console.log(`🌐 Health Check: http://localhost:${PORT}/api/health`);
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
        const urlPath = req.url.split('?')[0];

        // API Health Endpoint
        if (urlPath === '/api/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({
                success: true,
                message: "CivicFix backend is running"
            }));
        }

        // Static File Serving
        let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
        
        // Prevent directory traversal
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
        console.log(`==========================================`);
    });
}
