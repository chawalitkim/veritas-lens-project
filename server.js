const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// --- Phase 1 (Simulated): In-Memory Knowledge Base ---
// In a real-world application, this data would come from a dedicated database (e.g., MongoDB, PostgreSQL)
// which would be populated by downloading and parsing datasets from sources like datacommons.org.
const FACT_CHECK_DB = [
    {
        claimReviewed: "The Eiffel Tower is located in Berlin.",
        source: "https://en.wikipedia.org/wiki/Eiffel_Tower",
        text: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.",
        truthRating: "False"
    },
    {
        claimReviewed: "Earth is the third planet from the Sun.",
        source: "https://solarsystem.nasa.gov/planets/earth/overview/",
        text: "Our home planet is the third planet from the Sun, and the only place we know of so far that’s inhabited by living things.",
        truthRating: "True"
    },
    {
        claimReviewed: "Water is composed of two hydrogen atoms and one oxygen atom.",
        source: "https://www.usgs.gov/special-topics/water-science-school/science/water-qa-water-facts",
        text: "A water molecule (H2O) is made of two hydrogen (H) atoms bonded to one oxygen (O) atom.",
        truthRating: "True"
    },
    {
        claimReviewed: "Siriraj Hospital is in Malaysia.",
        source: "https://en.wikipedia.org/wiki/Siriraj_Hospital",
        text: "Faculty of Medicine Siriraj Hospital, Mahidol University is the oldest and largest hospital in Thailand, located in Bangkok.",
        truthRating: "False"
    }
];
// ---------------------------------------------------------


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
        // Phase 4 (Upgraded Simulation): Evidence Retrieval from In-Memory DB
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
 * Phase 4 (Upgraded Simulation): Finds evidence by searching the in-memory database.
 * This is a more realistic simulation of Evidence Retrieval.
 */
function findEvidence(claim) {
    const lowerCaseClaim = claim.toLowerCase();
    const supports = [];
    const contradicts = [];
    
    // Simple keyword matching search logic. A real system would use more advanced NLP techniques.
    FACT_CHECK_DB.forEach(entry => {
        // Check if any word from the claim appears in the database entry's text.
        if (entry.claimReviewed.toLowerCase().includes(lowerCaseClaim) || lowerCaseClaim.includes(entry.claimReviewed.toLowerCase().split(" ")[2])) {
            if (entry.truthRating === "True") {
                supports.push({ source: entry.source, text: entry.text });
            } else if (entry.truthRating === "False") {
                contradicts.push({ source: entry.source, text: entry.text });
            }
        }
    });

    // If no specific evidence is found, return empty arrays.
    // The frontend UI is responsible for checking if these arrays are empty
    // and displaying a "No direct evidence found." message.
    return { supports, contradicts };
}


/**
 * Phase 5: Uses Google Gemini to verify the claim against the evidence.
 */
async function verifyWithGemini(claim, evidence) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // FINAL FIX: Using a model name confirmed to be available from your test script.
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

    // If both evidence arrays are empty, add a note to the prompt to inform Gemini.
    let evidenceForPrompt = evidence;
    if (evidence.supports.length === 0 && evidence.contradicts.length === 0) {
        evidenceForPrompt = { ...evidence, notes: "No specific evidence was found in the local knowledge base. Please base your verdict on general knowledge." };
    }

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

        Evidence: ${JSON.stringify(evidenceForPrompt)}
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

