const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load environment variables (.env fallback)
try {
    require('dotenv').config();
} catch (e) {
    const envPath = path.join(__dirname, '..', '.env');
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

// Ensure db directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'civicfix.db');

let db;
let dbDriver = '';

try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    dbDriver = 'better-sqlite3';
} catch (e) {
    try {
        const { DatabaseSync } = require('node:sqlite');
        db = new DatabaseSync(dbPath);
        db.exec('PRAGMA journal_mode = WAL;');
        dbDriver = 'node:sqlite (native)';
    } catch (err) {
        console.error('Failed to initialize SQLite database:', err);
        throw err;
    }
}

// Password hashing helper function (SHA-256)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Initialize database schema and indexes
function initDatabase() {
    // 1. Complaints Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_code TEXT UNIQUE NOT NULL,
            citizen_name TEXT NOT NULL,
            citizen_email TEXT NOT NULL,
            citizen_phone TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            image_url TEXT,
            latitude REAL,
            longitude REAL,
            address TEXT,
            status TEXT DEFAULT 'Pending',
            ai_category TEXT,
            ai_severity INTEGER,
            ai_priority TEXT,
            ai_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Authorities Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS authorities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            department TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 3. Indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_complaints_code ON complaints(complaint_code);
        CREATE INDEX IF NOT EXISTS idx_complaints_email_phone ON complaints(citizen_email, citizen_phone);
        CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
        CREATE INDEX IF NOT EXISTS idx_authorities_username ON authorities(username);
    `);

    // 4. Seed Default Authority User from Environment Variables
    const defaultUsername = process.env.AUTHORITY_USERNAME || 'admin';
    const defaultPassword = process.env.AUTHORITY_PASSWORD || 'AdminSecurePass2026!';
    const passwordHash = hashPassword(defaultPassword);

    const existingAuthStmt = db.prepare('SELECT id FROM authorities WHERE username = ?');
    const existingAuth = existingAuthStmt.get ? existingAuthStmt.get(defaultUsername) : null;

    if (!existingAuth) {
        db.prepare(`
            INSERT INTO authorities (username, password_hash, full_name, department)
            VALUES (?, ?, ?, ?)
        `).run(defaultUsername, passwordHash, 'System Administrator', 'Municipal Headquarters');
        console.log(`[DB] ✅ Default authority user initialized: ${defaultUsername}`);
    }

    console.log(`[DB] ✅ SQLite Database initialized at ${dbPath} using engine: ${dbDriver}`);
}

initDatabase();

module.exports = {
    db,
    dbDriver,
    hashPassword
};
