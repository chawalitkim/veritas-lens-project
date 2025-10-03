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
    '.gov', '.edu', // High-trust TLDs
    'wikipedia.org', 'nasa.gov', 'who.int', 'cdc.gov', 'kmutnb.ac.th'
];

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Veritas Lens AI Server is running! - v3 Final');
});

app.post('/analyze', async (req, res) => {
    const { claim } = req.body;
    if (!claim) {
        return res.status(400).json({ error: 'Claim is required.' });
    }

    try {
        let geminiResponse = await verifyWithGemini(claim);

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
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.listen(port, () => {
    console.log(`Veritas Lens AI Server is running at http://localhost:${port}`);
});

function assessSourceCredibility(url) {
    if (!url || url.includes('vertexaisearch.cloud.google.com')) return 'Medium';
    try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        const isTrusted = TRUSTED_DOMAINS.some(trustedDomain => {
            if (trustedDomain.startsWith('.')) {
                return domain.endsWith(trustedDomain);
            }
            return domain === trustedDomain;
        });
        return isTrusted ? 'High' : 'Medium';
    } catch (error) {
        return 'Low';
    }
}

async function verifyWithGemini(claim) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash-preview-05-20',
        tools: [{ "google_search": {} }],
    });

    // UPDATED PROMPT: More stringent instructions for source URLs and titles.
    const prompt = `
        You are an expert fact-checker. Your task is to verify the following claim by searching the web for credible, authoritative sources.

        CRITICAL INSTRUCTION: First, break down the main claim into smaller, verifiable sub-claims. For each sub-claim, determine its verdict ('True' or 'False') and provide a brief reasoning. Then, based on the sub-claim analysis, provide an 'overall_verdict'. If any significant sub-claim is 'False', the 'overall_verdict' must be 'Partially True' or 'False'. Only if all sub-claims are 'True' can the 'overall_verdict' be 'True'.

        EVIDENCE REQUIREMENTS: For each piece of evidence you find, you MUST provide:
        1.  "source_url": The final, public, and directly accessible URL of the webpage. DO NOT provide internal redirect URLs (like those from vertexaisearch.cloud.google.com). You must provide the destination URL.
        2.  "source_title": The official title of the webpage from the source URL.
        3.  "text": A direct, relevant quote from the source that serves as evidence.

        RESPONSE FORMAT: Your response MUST be in a strict JSON format, with no extra text or markdown. All textual output (summaries, reasoning) MUST be in the same language as the original claim.

        The JSON object must have these exact keys:
        - "overall_verdict": A string: "True", "False", or "Partially True".
        - "overall_confidence": A number between 0 and 100.
        - "overall_summary": A single, concise sentence explaining your overall reasoning.
        - "sub_claim_analysis": An array of objects, where each object has "sub_claim" (string), "verdict" (string), and "reasoning" (string).
        - "supporting_evidence": An array of evidence objects (with source_url, source_title, text) that support the claim.
        - "contradicting_evidence": An array of evidence objects (with source_url, source_title, text) that contradict the claim.

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

