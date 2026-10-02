import { retrieveRelevantChunks } from '../services/vectorDbService.js';
import { callGeminiWithFallback } from '../services/geminiService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const transcriptsDir = path.join(__dirname, '../../data/transcripts');

if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
}

const SYSTEM_PROMPT = `
You are a voice voice agent for Acme Finance. You handle business-loan qualification.
Your goal is to have a natural, conversational voice interaction. Keep responses short and spoken-style.

Conversation Flow:
1. Greet and state purpose: "Hi, I'm calling from Acme Finance about your recent business loan inquiry. Do you have a few minutes?"
2. Ask for business age (Must be > 1 year).
3. Ask for monthly revenue (Must be > $10,000).
4. If qualified, tell them you will create a lead summary and a human will follow up. End call.
5. If unqualified, politely inform them and end call.

Rules:
- If the user asks a factual/policy question, YOU MUST output {"requires_rag": true, "rag_query": "their question"}. Do not answer it directly from your training data.
- If the user objects or doesn't want to share info, politely explain it's needed for preliminary qualification.
- If the user asks for a human, or asks a completely out-of-scope question that cannot be answered, set "escalate": true.
- If you have RAG Context provided in this turn, use it to answer. If the context says insufficient information, say EXACTLY: "I don't have enough information to confirm that. I can arrange for a representative to assist you." and set escalate: true.

Output your response STRICTLY in JSON format:
{
  "requires_rag": boolean,
  "rag_query": "string or null",
  "response_to_user": "string (leave empty if requires_rag is true)",
  "escalate": boolean,
  "lead_qualified": boolean or null,
  "end_call": boolean
}
`;

export async function chatWithVoiceAgent(req, res) {
    try {
        const { history, userMessage } = req.body;

        const cleanHistory = (history || [])
            .filter(msg => msg && msg.content && msg.content.trim() !== '')
            .map(msg => ({
                role: msg.role === 'agent' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

        const chatHistory = [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "model", parts: [{ text: '{"requires_rag":false,"rag_query":null,"response_to_user":"Understood.","escalate":false,"lead_qualified":null,"end_call":false}' }] },
            ...cleanHistory
        ];

        // First pass with fallback model logic
        let aiState = await callGeminiWithFallback(async (model) => {
            const chat = model.startChat({ history: chatHistory });
            const result = await chat.sendMessage(userMessage);
            return JSON.parse(result.response.text());
        }, { jsonMode: true });

        // Second pass: If LLM needs RAG, fetch and ask again
        let sources = [];
        if (aiState.requires_rag && aiState.rag_query) {
            const chunks = await retrieveRelevantChunks(aiState.rag_query, 3);
            let context = chunks.length > 0 ? chunks.map(c => c.content).join('\n') : "NO INFORMATION FOUND.";
            sources = chunks.map(c => ({ document: c.title }));

            const ragPrompt = `RAG Context: ${context}\nNow provide the JSON response. If no info found, use the strict safe fallback and escalate.`;
            
            aiState = await callGeminiWithFallback(async (model) => {
                const chat = model.startChat({ history: chatHistory });
                await chat.sendMessage(userMessage); // rebuild context
                const result = await chat.sendMessage(ragPrompt);
                return JSON.parse(result.response.text());
            }, { jsonMode: true });
        }

        return res.status(200).json({
            answer: aiState.response_to_user,
            sources: sources,
            escalate: aiState.escalate,
            lead_qualified: aiState.lead_qualified,
            end_call: aiState.end_call
        });

    } catch (error) {
        console.error('Voice Agent Error:', error);
        res.status(500).json({ error: 'Failed to process voice agent turn', details: error.message });
    }
}

export async function saveTranscript(req, res) {
    try {
        const { transcript, status, qualification_result, region } = req.body;
        const filename = `call_${region || 'us'}_${Date.now()}.json`;
        
        const data = {
            timestamp: new Date().toISOString(),
            status,
            qualification_result,
            region: region || 'US',
            transcript
        };

        fs.writeFileSync(path.join(transcriptsDir, filename), JSON.stringify(data, null, 2));
        
        return res.status(200).json({ message: 'Transcript saved successfully', filename });
    } catch (error) {
        console.error('Error saving transcript:', error);
        res.status(500).json({ error: 'Failed to save transcript' });
    }
}

// ==========================================
// QUESTION 3 - LOCALIZED BOTS
// ==========================================

const PH_SYSTEM_PROMPT = `
You are a voice agent for Acme Life Insurance in the Philippines.
Your goal is to remind the customer about their premium payment naturally using conversational Taglish (Tagalog and English).
Tone: Polite, respectful (use "po" and "opo"), culturally appropriate.

Flow:
1. Greet: "Hello po, good morning! Ako po ay tumatawag mula sa Acme Life Insurance. May few minutes po ba kayo?"
2. Remind: "Gusto ko lang po i-remind na due na ang inyong premium payment next week para sa inyong life policy."
3. If they object (e.g. no money): Reassure them about the grace period before the policy will 'lapse'. Use terms like 'coverage', 'beneficiary', 'rider' if asked.
4. If they ask complex questions (e.g. bank referral): Escalate to a human agent.

Strict Output JSON:
{
  "response_to_user": "Your Taglish response here",
  "escalate": boolean,
  "end_call": boolean
}
`;

const ID_SYSTEM_PROMPT = `
You are a voice agent for Acme Finance in Indonesia.
Your goal is to remind the customer about their installment (cicilan) naturally. You should understand colloquial Bahasa Indonesia (slang/regional accents) and English finance terms.
Tone: Polite but natural, use Bapak/Ibu, allow conversational shifting.

Flow:
1. Greet: "Halo, selamat siang. Saya dari Acme Finance. Apakah benar ini dengan Bapak/Ibu?"
2. Remind: "Ingin mengingatkan bahwa cicilan untuk pembiayaan Anda jatuh tempo pada tanggal 15 bulan ini."
3. If they object (e.g. no money, "belum gajian"): Explain late fees ("denda") and payment terms ("angsuran", "tenor", "DP") politely.
4. If they ask complex questions or get frustrated: Escalate to a human agent.

Strict Output JSON:
{
  "response_to_user": "Your Bahasa Indonesia response here",
  "escalate": boolean,
  "end_call": boolean
}
`;

export async function chatWithLocalizedBot(req, res) {
    try {
        const { history, userMessage, region } = req.body;
        
        let prompt = region === 'PH' ? PH_SYSTEM_PROMPT : ID_SYSTEM_PROMPT;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.8-flash",
            generationConfig: { responseMimeType: "application/json" } 
        });

        const cleanHistory2 = (history || [])
            .filter(msg => msg && msg.content && msg.content.trim() !== '')
            .map(msg => ({
                role: msg.role === 'agent' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: prompt }] },
                { role: "model", parts: [{ text: '{"response_to_user":"Understood.","escalate":false,"end_call":false}' }] },
                ...cleanHistory2
            ]
        });

        const result = await chat.sendMessage(userMessage);
        const aiState = JSON.parse(result.response.text());

        return res.status(200).json({
            answer: aiState.response_to_user,
            escalate: aiState.escalate,
            end_call: aiState.end_call
        });

    } catch (error) {
        console.error('Localized Voice Agent Error:', error);
        res.status(500).json({ error: 'Failed to process localized voice turn' });
    }
}
