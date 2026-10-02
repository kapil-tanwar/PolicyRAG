import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Model priority list - tries in order if one fails with 503/429
const LLM_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash-lite"
];

/**
 * Calls Gemini with automatic fallback if 503 overloaded
 */
export async function callGeminiWithFallback(promptOrFn, opts = {}) {
    const { jsonMode = false } = opts;
    
    for (const modelName of LLM_MODELS) {
        try {
            const config = { model: modelName };
            if (jsonMode) config.generationConfig = { responseMimeType: "application/json" };
            
            const model = genAI.getGenerativeModel(config);
            
            // Support both direct string prompts and a function that receives the model
            if (typeof promptOrFn === 'function') {
                return await promptOrFn(model);
            } else {
                const result = await model.generateContent(promptOrFn);
                return result.response.text();
            }
        } catch (err) {
            const isRetryable = err.status === 503 || err.status === 429 || err.status === 404;
            console.warn(`Model ${modelName} failed (${err.status}), trying next...`);
            if (!isRetryable || modelName === LLM_MODELS[LLM_MODELS.length - 1]) {
                throw err;
            }
            // Small delay before retry
            await new Promise(r => setTimeout(r, 500));
        }
    }
}

/**
 * Gets embeddings for a text string using Gemini
 */
export async function getEmbedding(text) {
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error("GEMINI_API_KEY is not configured.");
    }
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

/**
 * Generates an answer based strictly on the provided context
 */
export async function generateGroundedAnswer(question, context) {
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error("GEMINI_API_KEY is not configured.");
    }

    const prompt = `
You are a helpful AI assistant for a financial/insurance company.
Answer the user's question based strictly on the context provided below.
Do not hallucinate or invent any information. If the context does not contain sufficient information to answer the question, you MUST reply exactly with: "I could not find sufficient information in the knowledge base to answer this question."

Context:
${context}

User Question: ${question}

Answer:`;

    return await callGeminiWithFallback(prompt);
}

export { genAI, LLM_MODELS };
