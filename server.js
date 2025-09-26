const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// --- START OF CORS DEBUGGING FIX ---
// Middleware
// Using the simplest CORS configuration to allow all origins for debugging purposes.
// This will help confirm if the new code is being deployed correctly.
app.use(cors());
// --- END OF CORS DEBUGGING FIX ---

app.use(express.json());

// Simple check to see if the server is alive - WITH VERSION CHECK
app.get('/', (req, res) => {
  res.send('Veritas Lens AI Server is running! - v2 CORS FIX');
});


// The main analysis endpoint
app.post('/analyze', async (req, res) => {
    const { claim } = req.body;

    if (!claim) {
        return res.status(400).json({ error: 'Claim is required in the request body.' });
    }

    try {
        // Phase 4 (Simulated): Evidence Retrieval
        const evidence = findEvidence(claim);

        // Phase 5: Verification with Gemini
        const verificationResult = await verifyWithGemini(claim, evidence);

        // Combine results and send back to frontend
        const finalResponse = {
            ...verificationResult,
            supporting_evidence: evidence.supports,
            contradicting_evidence: evidence.contradicts
        };

        res.json(finalResponse);

    } catch (error) {
        console.error('Error during analysis:', error);
        res.status(500).json({ error: 'An internal server error occurred during analysis.' });
    }
});

app.listen(port, () => {
    console.log(`Veritas Lens AI Server is running at http://localhost:${port}`);
});


// --- Helper Functions ---

/**
 * Phase 4 (Simulated): Finds mock evidence related to a claim.
 * In a real-world scenario, this would involve searching databases, news APIs, etc.
 * @param {string} claim - The user's claim.
 * @returns {object} An object with supporting and contradicting evidence.
 */
function findEvidence(claim) {
    // This is a simple simulation. A real implementation would use a search API.
    const lowerCaseClaim = claim.toLowerCase();
    if (lowerCaseClaim.includes('siriraj') || lowerCaseClaim.includes('ศิริราช')) {
        return {
            supports: [],
            contradicts: [
                { source: 'https://www.si.mahidol.ac.th/', text: 'Siriraj Hospital is a hospital in Bangkok, Thailand, on the west bank of the Chao Phraya River.' },
                { source: 'https://en.wikipedia.org/wiki/Siriraj_Hospital', text: 'Faculty of Medicine Siriraj Hospital, Mahidol University is the oldest and largest hospital in Thailand.' }
            ]
        };
    }
    // Default evidence for other claims
    return {
        supports: [{ source: 'https://example.com', text: 'This is a generic piece of supporting evidence as no specific keywords were matched.' }],
        contradicts: [{ source: 'https://example.com', text: 'This is a generic piece of contradicting evidence.' }]
    };
}


/**
 * Phase 5: Uses Google Gemini to verify the claim against the evidence.
 * @param {string} claim - The user's claim.
 * @param {object} evidence - The evidence found.
 * @returns {Promise<object>} A promise that resolves to the verification result from Gemini.
 */
async function verifyWithGemini(claim, evidence) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
        Act as an expert fact-checker. Analyze the relationship between the 'claim' and the provided 'evidence'.
        Determine if the evidence supports, contradicts, or is partially related to the claim.

        Your response MUST be in a strict JSON format, with no extra text or markdown.
        The JSON object must have these exact keys:
        - "verdict": A string which can be "True", "False", or "Partially True".
        - "confidence": A number between 0 and 100.
        - "summary": A single, concise sentence in the same language as the claim, explaining your reasoning.

        ---
        Claim: "${claim}"

        Evidence: ${JSON.stringify(evidence)}
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean up the text to ensure it's valid JSON
        const jsonString = text.replace(/```json/g, '').replace(/```g, '').trim();
        
        return JSON.parse(jsonString);

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw new Error('Failed to get a valid response from the verification model.');
    }
}

