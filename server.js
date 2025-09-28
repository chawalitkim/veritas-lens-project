const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// NEW: A predefined list of high-credibility domains for source verification.
const TRUSTED_DOMAINS = [
    'reuters.com', 'apnews.com', 'bbc.com', 'nytimes.com', 'washingtonpost.com',
    'wsj.com', 'theguardian.com', 'npr.org', 'pbs.org', 'forbes.com', 'bloomberg.com',
    '.gov', '.edu', '.org', // Generic TLDs that are often credible
    'wikipedia.org', 'nasa.gov', 'who.int', 'cdc.gov'
];

// Use CORS middleware to allow requests from your frontend
app.use(cors({
    origin: '*' // Allows all origins for simplicity in this student project
}));

app.use(express.json());

// A simple endpoint to confirm the server is running
app.get('/', (req, res) => {
  res.send('Veritas Lens AI Server is running!');
});


// The main analysis endpoint
app.post('/analyze', async (req, res) => {
    const { claim } = req.body;

    if (!claim) {
        return res.status(400).json({ error: 'Claim is required in the request body.' });
    }

    try {
        // Gemini handles evidence retrieval and initial verification.
        let geminiResponse = await verifyWithGemini(claim);

        // NEW - Phase 5 Enhancement: Source Credibility Check
        // We assess the credibility of each piece of evidence found by Gemini.
        if (geminiResponse.supporting_evidence) {
            geminiResponse.supporting_evidence.forEach(evidence => {
                evidence.credibility = assessSourceCredibility(evidence.source);
            });
        }
        if (geminiResponse.contradicting_evidence) {
            geminiResponse.contradicting_evidence.forEach(evidence => {
                evidence.credibility = assessSourceCredibility(evidence.source);
            });
        }

        res.json(geminiResponse);

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
 * NEW - Phase 5 Enhancement: Assesses the credibility of a source URL.
 * @param {string} url The URL of the evidence source.
 * @returns {'High' | 'Medium' | 'Low'} A credibility rating.
 */
function assessSourceCredibility(url) {
    if (!url) return 'Low';
    try {
        const domain = new URL(url).hostname;
        const isTrusted = TRUSTED_DOMAINS.some(trustedDomain => domain.endsWith(trustedDomain));
        return isTrusted ? 'High' : 'Medium';
    } catch (error) {
        // If the URL is malformed or cannot be parsed, rate it as low credibility.
        return 'Low';
    }
}


/**
 * NEW & UPGRADED Phase 4, 5 & 6 Combined:
 * Uses Google Gemini's search tool to find live evidence and verify the claim.
 */
async function verifyWithGemini(claim) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash-preview-05-20',
        tools: [{ "google_search": {} }],
    });

    // The prompt is updated to be more stringent about source credibility.
    const prompt = `
        You are an expert fact-checker. Your primary task is to verify the following claim by searching the web. 
        Prioritize authoritative and globally recognized sources (major news outlets, academic institutions, government sites).

        Your response MUST be in a strict JSON format, with no extra text or markdown.
        The JSON object must have these exact keys:
        - "verdict": A string which can be "True", "False", or "Partially True".
        - "confidence": A number between 0 and 100.
        - "summary": A single, concise sentence in the same language as the claim, explaining your reasoning based on the evidence found.
        - "supporting_evidence": An array of objects found from your search that support the claim. Each object must have a "source" (URL) and "text" (a relevant quote). If none are found, provide an empty array.
        - "contradicting_evidence": An array of objects found from your search that contradict the claim. Each object must have a "source" (URL) and "text" (a relevant quote). If none are found, provide an empty array.

        ---
        Claim to verify: "${claim}"
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw new Error('Failed to get a valid response from the verification model.');
    }
}

