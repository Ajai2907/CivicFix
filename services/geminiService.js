const fs = require('fs');
const path = require('path');

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

/**
 * Analyzes a civic issue using Gemini 2.5 Flash and enforces mandatory priority business rules.
 * @param {string} imagePath - Path to the locally stored image file.
 * @param {string} userCategory - Category selected by the citizen.
 * @param {string} description - Citizen's issue description.
 * @returns {Promise<Object>} Structured analysis { category, priority, severity, reason }
 */
async function analyzeCivicIssue(imagePath, userCategory = '', description = '') {
    const apiKey = process.env.GEMINI_API_KEY;
    let aiResult = null;

    // 1. Attempt Gemini 2.5 Flash API call if API key is provided and valid
    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY' && apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
        try {
            let base64Image = '';
            if (imagePath && fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                base64Image = imageBuffer.toString('base64');
            }

            const promptText = `You are an AI Civic Issue Analyzer for a municipal government platform.
Analyze the provided image and description: "${description}" (Category: "${userCategory}").

Return ONLY valid JSON matching this exact structure:
{
  "category": "Road Damage | Water Leakage | Garbage | Street Light | Drainage | Others",
  "priority": "Critical | High | Medium | Low",
  "severity": 8,
  "reason": "Concise 1-2 sentence rationale explaining the civic hazard"
}

Civic Priority Rules:
1. Water leakage / pipe burst / flooding / water supply emergency = Critical
2. Road damage / pothole / dangerous asphalt = High
3. Garbage overflow / uncollected waste = Medium
4. Street light failure / dark street = Low
5. Severity MUST be an integer between 1 and 10.`;

            const contentsPart = [];
            contentsPart.push({ text: promptText });
            if (base64Image) {
                const ext = path.extname(imagePath).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                contentsPart.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Image
                    }
                });
            }

            // Call Gemini 2.5 Flash REST API endpoint directly
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{ parts: contentsPart }]
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                
                // Clean markdown block tags if present
                const cleanedJson = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
                aiResult = JSON.parse(cleanedJson);
            } else {
                console.warn(`[Gemini API Warning] Response status ${response.status}. Using fallback heuristic analysis.`);
            }
        } catch (err) {
            console.error('[Gemini API Error] Failed to process image with Gemini:', err.message);
        }
    }

    // 2. Fallback Heuristic Analysis if Gemini is unreachable or key not set
    if (!aiResult || typeof aiResult !== 'object') {
        const catLower = (userCategory || '').toLowerCase();
        const descLower = (description || '').toLowerCase();

        let fallbackPriority = 'Medium';
        let fallbackSeverity = 5;
        let fallbackCategory = userCategory || 'General Issue';

        if (catLower.includes('water') || descLower.includes('water') || descLower.includes('pipe') || descLower.includes('flood')) {
            fallbackCategory = 'Water Leakage';
            fallbackPriority = 'Critical';
            fallbackSeverity = 9;
        } else if (catLower.includes('road') || descLower.includes('road') || descLower.includes('pothole')) {
            fallbackCategory = 'Road Damage';
            fallbackPriority = 'High';
            fallbackSeverity = 8;
        } else if (catLower.includes('garbage') || descLower.includes('trash') || descLower.includes('waste')) {
            fallbackCategory = 'Garbage';
            fallbackPriority = 'Medium';
            fallbackSeverity = 5;
        } else if (catLower.includes('light') || descLower.includes('dark')) {
            fallbackCategory = 'Street Light';
            fallbackPriority = 'Low';
            fallbackSeverity = 3;
        }

        aiResult = {
            category: fallbackCategory,
            priority: fallbackPriority,
            severity: fallbackSeverity,
            reason: `Issue classified as ${fallbackPriority} priority based on ${fallbackCategory} criteria.`
        };
    }

    // 3. MANDATORY CIVICFIX WATER EMERGENCY PRIORITY RULE ENFORCEMENT
    // This rule MUST override Gemini if a water-related emergency is present!
    const textToScan = `${userCategory} ${description} ${aiResult.category || ''} ${aiResult.reason || ''}`.toLowerCase();
    const waterEmergencyKeywords = [
        'water leakage', 'water leak', 'pipe burst', 'flooding', 'flood',
        'water supply', 'water overflow', 'broken pipe', 'water logging',
        'burst pipe', 'drainage overflow', 'water main'
    ];

    const isWaterEmergency = waterEmergencyKeywords.some(keyword => textToScan.includes(keyword)) ||
                            (userCategory && userCategory.toLowerCase().includes('water'));

    if (isWaterEmergency) {
        aiResult.priority = 'Critical';
        aiResult.severity = Math.max(parseInt(aiResult.severity, 10) || 9, 9);
        aiResult.reason = `[MANDATORY CIVIC RULE] Water emergency detected: ${aiResult.reason || 'Water leakage / pipe burst prioritized to Critical.'}`;
    }

    // Ensure severity is an integer between 1 and 10
    aiResult.severity = Math.min(Math.max(parseInt(aiResult.severity, 10) || 5, 1), 10);

    return aiResult;
}

module.exports = {
    analyzeCivicIssue
};
