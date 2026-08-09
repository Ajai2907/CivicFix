const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

let multerMiddleware;

try {
    const multer = require('multer');

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadsDir);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
            const uniqueName = `CF-IMG-${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`;
            cb(null, uniqueName);
        }
    });

    const fileFilter = (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype.toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP images are allowed.'), false);
        }
    };

    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 10 * 1024 * 1024 // 10 MB limit
        }
    });

    multerMiddleware = upload.single('image');
} catch (e) {
    // Native fallback multipart parser if multer is not installed in node_modules yet
    multerMiddleware = (req, res, next) => {
        if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
            return next();
        }

        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = req.headers['content-type'];
            const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
            
            if (!boundaryMatch) {
                return next(new Error('Invalid multipart boundary'));
            }

            const boundary = boundaryMatch[1] || boundaryMatch[2];
            const parts = buffer.toString('binary').split('--' + boundary);

            req.body = req.body || {};

            for (let part of parts) {
                if (part.trim() === '' || part.trim() === '--') continue;

                const headerEndIndex = part.indexOf('\r\n\r\n');
                if (headerEndIndex === -1) continue;

                const headerText = part.substring(0, headerEndIndex);
                const bodyBinary = part.substring(headerEndIndex + 4, part.length - 2);

                const nameMatch = headerText.match(/name="([^"]+)"/i);
                const filenameMatch = headerText.match(/filename="([^"]+)"/i);
                const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);

                if (nameMatch) {
                    const fieldName = nameMatch[1];
                    if (filenameMatch) {
                        const originalName = filenameMatch[1];
                        const mimeType = typeMatch ? typeMatch[1].trim() : 'image/jpeg';
                        const ext = path.extname(originalName).toLowerCase() || '.jpg';
                        const fileName = `CF-IMG-${Date.now()}-${Math.floor(Math.random() * 100000)}${ext}`;
                        const filePath = path.join(uploadsDir, fileName);

                        fs.writeFileSync(filePath, bodyBinary, 'binary');

                        req.file = {
                            fieldname: fieldName,
                            originalname: originalName,
                            encoding: '7bit',
                            mimetype: mimeType,
                            destination: uploadsDir,
                            filename: fileName,
                            path: filePath,
                            size: bodyBinary.length
                        };
                    } else {
                        req.body[fieldName] = bodyBinary.trim();
                    }
                }
            }
            next();
        });
        req.on('error', (err) => next(err));
    };
}

module.exports = multerMiddleware;
