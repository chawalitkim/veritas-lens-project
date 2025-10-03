const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// A predefined list of high-credibility domains for source verification.
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
        // Gemini handles evidence retrieval and the new detailed verification.
        let geminiResponse = await verifyWithGemini(claim);

        // Source Credibility Check now uses source_url
        if (geminiResponse.supporting_evidence) {
            geminiResponse.supporting_evidence.forEach(evidence => {
                evidence.credibility = assessSourceCredibility(evidence.source_url);
            });
        }
        if (geminiResponse.contradicting_evidence) {
            geminiResponse.contradicting_evidence.forEach(evidence => {
                evidence.credibility = assessSourceCredibility(evidence.source_url);
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

function assessSourceCredibility(url) {
    if (!url) return 'Low';
    try {
        const domain = new URL(url).hostname;
        const isTrusted = TRUSTED_DOMAINS.some(trustedDomain => domain.endsWith(trustedDomain));
        return isTrusted ? 'High' : 'Medium';
    } catch (error) {
        return 'Low';
    }
}

/**
 * UPGRADED with more specific reasoning rules and a more detailed evidence structure.
 */
async function verifyWithGemini(claim) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash-preview-05-20',
        tools: [{ "google_search": {} }],
    });

    const prompt = `
        You are a meticulous and expert fact-checker. Your task is to analyze the following claim in detail by searching the web for credible evidence.

        CRITICAL INSTRUCTION: All text-based responses in the final JSON output (specifically "overall_summary" and "reasoning") MUST be in the same language as the original "Claim to verify". For example, if the claim is in Thai, all explanations must be in Thai.

        Follow these steps:
        1. Deconstruct the main "Claim to verify" into individual, verifiable sub-claims.
        2. For each sub-claim, perform a web search to find evidence.
        3. Determine a verdict ("True", "False", or "Unverifiable") for each individual sub-claim based on the evidence.
        4. Determine the "overall_verdict" based on the sub-claim analysis using these strict rules:
            - If ALL sub-claims are "True", the overall_verdict is "True".
            - CRITICALLY: If the main claim contains a mix of "True" and "False" sub-claims (e.g., one part about location is correct, but another part about its type is incorrect), the overall_verdict MUST be "Partially True". An "overall_verdict" of "False" should be reserved for claims that are entirely incorrect in their main assertion.

        Your response MUST be in a strict JSON format, with no extra text or markdown.
        The JSON object must have these exact keys:
        - "overall_verdict": A string ("True", "False", or "Partially True") for the entire claim.
        - "overall_confidence": A number between 0 and 100 representing confidence in the overall verdict.
        - "overall_summary": A single, concise sentence in the same language as the claim, explaining the final reasoning.
        - "sub_claim_analysis": An array of objects. Each object must represent a sub-claim and have three keys: "sub_claim" (string), "verdict" (string), and "reasoning" (string, in the same language as the claim).
        - "supporting_evidence": An array of objects. Each object must have "source_url" (a direct, clickable URL), "source_title" (the title of the source page), and "text" (a relevant quote). If none are found, provide an empty array.
        - "contradicting_evidence": An array of objects. Each object must have "source_url" (a direct, clickable URL), "source_title" (the title of the source page), and "text" (a relevant quote). If none are found, provide an empty array.

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

