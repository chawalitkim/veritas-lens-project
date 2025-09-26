// 1. Import libraries
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 2. Initialize Express app and Gemini AI
const app = express();
// UPDATED FOR DEPLOYMENT: Use port from environment variable or default to 3000
const port = process.env.PORT || 3000; 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

// 3. Middlewares
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable the server to read JSON from requests

// --- (SIMULATED PHASE 4: EVIDENCE RETRIEVAL) ---
/**
 * This is a simulation of Phase 4: Evidence Retrieval.
 * In a real-world application, this function would use a search API (like Google Search)
 * to find real, up-to-date evidence from the web related to the claim.
 * For this example, we'll return hard-coded evidence to demonstrate the flow.
 * @param {string} claim - The user's claim.
 * @returns {Promise<string[]>} - A promise that resolves to an array of evidence snippets.
 */
async function findEvidence(claim) {
    console.log(`[Phase 4 Simulated] Searching for evidence for claim: "${claim}"`);
    // In a real app, you would analyze the claim's keywords.
    if (claim.includes("ศิริราช") || claim.toLowerCase().includes("siriraj")) {
        return [
            "โรงพยาบาลศิริราช เป็นโรงพยาบาลของรัฐ สังกัดคณะแพทยศาสตร์ศิริราชพยาบาล มหาวิทยาลัยมหิดล ตั้งอยู่เลขที่ 2 ถนนวังหลัง แขวงศิริราช เขตบางกอกน้อย กรุงเทพมหานคร",
            "Siriraj Hospital is a major public hospital in Bangkok, Thailand, located on the west bank of the Chao Phraya River."
        ];
    } else if (claim.toLowerCase().includes("eiffel")) {
        return [
            "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.",
            "La tour Eiffel est une tour de fer puddlé de 330 mètres de hauteur (avec antennes) située à Paris, à l’extrémité nord-ouest du parc du Champ-de-Mars en bordure de la Seine dans le 7e arrondissement."
        ];
    }
    // Default if no specific evidence is found
    console.log("[Phase 4 Simulated] No specific evidence found in mock database. A real app would search the web.");
    return []; // Return empty array if no evidence is found
}


// --- (PHASE 5: VERIFICATION VIA GEMINI) ---
/**
 * Builds a structured prompt and sends it to the Gemini API for verification.
 * @param {string} claim - The user's claim.
 * @param {string[]} evidence - The array of evidence snippets.
 * @returns {Promise<object>} - A promise that resolves to the parsed JSON response from Gemini.
 */
async function verifyWithGemini(claim, evidence) {
    console.log("[Phase 5] Sending to Gemini for verification...");

    const prompt = `
        Act as an expert fact-checker. Your task is to analyze the relationship between a 'claim' and the provided 'evidence'.
        Determine if the evidence supports, contradicts, or is partially related to the claim.
        The user may provide the claim in either English or Thai. Please provide your summary in the same language as the claim.

        Your response MUST be ONLY a single, valid JSON object. Do not add any text before or after the JSON object. Do not use markdown like \`\`\`json.

        The JSON object must have the following structure:
        {
          "verdict": "True", "False", or "Partially True",
          "confidence": A number between 0 and 100 representing your certainty,
          "summary": "A single, concise sentence explaining your reasoning in the same language as the claim."
        }

        ---
        Here is the data to analyze:

        Claim: "${claim}"

        Evidence: ${JSON.stringify(evidence)}
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log("[Phase 5] Received from Gemini:", text);

        // Clean the text to ensure it's a valid JSON string
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get a valid response from the AI model.");
    }
}


// 4. Main API Endpoint
app.post('/analyze', async (req, res) => {
    const { claim } = req.body;

    if (!claim) {
        return res.status(400).json({ error: 'Claim is required.' });
    }

    console.log(`\n--- New Request Received ---\nClaim: "${claim}"`);

    try {
        // Step 1: (Simulated) Retrieve Evidence
        const evidence = await findEvidence(claim);

        // Step 2: Verify with Gemini
        // We only call Gemini if there is evidence, otherwise we can't verify.
        let analysisResult;
        if (evidence && evidence.length > 0) {
            analysisResult = await verifyWithGemini(claim, evidence);
        } else {
            // If no evidence is found, we can't make a judgment.
             analysisResult = {
                verdict: 'Unverifiable',
                confidence: 50,
                summary: 'Could not find enough relevant information to verify this claim.'
             };
        }

        // Step 3: Structure the final response for the frontend
        const finalResponse = {
            verdict: analysisResult.verdict,
            confidence: analysisResult.confidence,
            summary: analysisResult.summary,
            supporting: [],
            contradicting: []
        };
        
        // Simple logic to categorize evidence based on verdict
        if (analysisResult.verdict === 'False') {
            finalResponse.contradicting = evidence.map(e => ({ snippet: e, source: "Web Search", url: "#" }));
        } else if (analysisResult.verdict === 'True') {
            finalResponse.supporting = evidence.map(e => ({ snippet: e, source: "Web Search", url: "#" }));
        } else { // Partially True or Unverifiable
            finalResponse.supporting = evidence.map(e => ({ snippet: e, source: "Web Search", url: "#" }));
        }

        // Step 4: Send the response back to the frontend
        res.json(finalResponse);

    } catch (error) {
        console.error("Error in /analyze endpoint:", error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// 5. Start the server
app.listen(port, () => {
    console.log(`Veritas Lens AI Server is running at http://localhost:${port}`);
});

