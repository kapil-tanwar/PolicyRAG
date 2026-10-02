# AI Engineer Assessment - Question 2

This repository contains the solution for **Question 2 — Production-Ready Knowledge Base**. It is a fully functional, 100% free local RAG system built with Node.js, Express, LanceDB (Vector DB), and the Google Gemini API.

## Architecture

- **Backend**: Node.js + Express
- **Frontend**: React + Vite
- **Vector Database**: **LanceDB** (Embedded, local folder storage). Chosen because it is robust, completely free, requires no Docker, and stores data locally, avoiding API key sharing issues for the evaluator.
- **AI Models**: **Google Gemini API** (`text-embedding-004` and `gemini-1.5-flash`). Chosen for its generous free tier and fast inference.

## Knowledge-Base Schema & Chunking Strategy

- **Chunking Strategy**: Recursive character text splitting. We use chunks of ~800 characters with a 150-character overlap to preserve sentence boundaries.
- **PII Protection**: Regex-based masking replaces emails with `[EMAIL_REDACTED]` and phone numbers with `[PHONE_REDACTED]`.
- **Metadata**:
  ```json
  {
    "id": "uuid_chunk_0",
    "record_id": "uuid",
    "title": "document_name.pdf",
    "content": "extracted text...",
    "category": "insurance_policy",
    "source": "document_name.pdf",
    "version": "1.0",
    "pii": false
  }
  ```

## Setup Instructions

### 1. Environment Setup
1. Open the `backend/` directory.
2. Copy `.env.example` to `.env`.
3. Add your free Google Gemini API Key:
   ```text
   GEMINI_API_KEY=AIzaSy...your...key
   PORT=5000
   ```

### 2. Start Backend
```bash
cd backend
npm install
node src/index.js
```
The RAG API will run on `http://localhost:5000`.

### 3. Start Frontend (Optional UI)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser.

## API Endpoints

### 1. Ingestion (`POST /api/knowledge/upload`)
Uploads a document (PDF or Text), cleans it, removes PII, chunks it, embeds it, and stores it in LanceDB.
*   **Form-Data**: `file` (File), `category` (String)

### 2. Retrieval & Generation (`POST /api/rag/query`)
Embeds a query, retrieves top 3 chunks, and strictly generates a grounded answer citing the source.
*   **Body (JSON)**: `{"question": "..."}`

---

# Question 1: Knowledge-Grounded Voice Agent

We built a browser-based Voice Agent using the **Web Speech API (SpeechRecognition and SpeechSynthesis)**. 

### Why Browser-Based?
As allowed by the prompt, a browser-based voice interface is the most reliable, zero-config, and 100% free method to evaluate a Voice Agent. It requires no telephony setup (Twilio/Ngrok) and runs entirely in your browser using Google Chrome's native STT and TTS engines.
*   **LLM & RAG Integration**: Powered by Google Gemini (`gemini-1.5-flash`), with direct access to the LanceDB Vector database built in Q2.

### How to Test the Voice Agent
1. Ensure both the **Backend** and **Frontend** are running.
2. Open the React frontend (`http://localhost:5173/`).
3. Scroll down to the **Voice Agent** section.
4. Click **Hold to Speak**. (You must use Chrome or Safari and allow Microphone permissions).
5. The agent will speak its response aloud.

### Test Scenarios to try:
*   **Cooperative**: Tell it your business is 5 years old and makes $50,000/month.
*   **FAQ/RAG Integration**: Interrupt the qualification and ask: "Wait, do you cover cosmetic surgery?" (It will dynamically pull from the Q2 RAG).
*   **Objection**: "I don't want to tell you my revenue."
*   **Escalation**: "I want to speak to a human."

### Transcripts
When a call ends (either successfully or escalated), the backend automatically saves the JSON transcript and qualification result into `backend/data/transcripts/`.

---

## Evaluation Testing (Q2)

Run the evaluation script to test the 5 required categories (Product, Policy, Qualification, FAQ, Objection):
```bash
cd backend
node scripts/evaluate.js
```
This generates an `evaluation_results.md` file. **You must manually fill in the `Relevance Explanation` and `Verdict` sections based on the documents you uploaded.**

---

# Question 3: Native-Language Voice Bots

We expanded the browser-based voice agent to support deep localization for the **Philippines** and **Indonesia** markets.

### How to Test
1. Open the React frontend (`http://localhost:5173/`).
2. Scroll to the Voice Agent Dashboard.
3. Use the **Select Region/Bot** dropdown to switch between US, PH, and ID.
4. Click **Hold to Speak**. The browser's Web Speech API will automatically switch its ASR/TTS language tags (`fil-PH` for Taglish, `id-ID` for Bahasa Indonesia).

### ASR/TTS Quality Report
*   **ASR/TTS Provider**: Browser Native (Google Web Speech API).
*   **Languages Tested**: `fil-PH` (Philippines) and `id-ID` (Indonesia).
*   **Code-switching behavior**: 
    *   **PH (Taglish)**: Excellent. The Gemini LLM understands the mix of Tagalog and English flawlessly and outputs natural Taglish. The Web Speech TTS pronounces Taglish relatively well, though it occasionally applies English phonetics to Tagalog root words.
    *   **ID (Bahasa)**: Excellent understanding of colloquial terms ("gajian", "telat") and formal finance terms ("denda", "jatuh tempo").
*   **Indonesian Accent Observations & Limitations**: The Web Speech API ASR is trained heavily on standard Jakarta/formal Bahasa. Heavy regional accents (e.g., strong Javanese "medok" or Sundanese slang) can cause ASR transcription errors. If the ASR mishears a regional accent, the Gemini LLM is robust enough to often guess the intent from the misspelled transcription, but a dedicated ASR engine (like Google Cloud Speech-to-Text with enhanced regional models) would be recommended for production.
*   **Errors**: Native TTS engines can sometimes sound slightly robotic when shifting suddenly from a local word to an English loanword (e.g., saying "life policy" in a Tagalog sentence). 

---

# Question 4: Live Insights and Nudges

We built a **Real-Time Agent Dashboard** using WebSockets (`socket.io`) and the Google Gemini API to analyze a call as it happens and produce immediate nudges.

### How to Test
1. Make sure your backend and frontend are running.
2. Go to the React App (`http://localhost:5173/`) and scroll to the bottom to find **Q4: Real-Time Agent Dashboard**.
3. Click **Start Live Call**.
4. **Speak into the microphone.** 
    *   *Note: Because this is a single-microphone simulation, the system assumes you are the Customer unless you include the word "agent" in your sentence.*

### Test Scenarios to try:
1.  **True Cross-sell**: Say "I want to get a loan for a second car." -> *A Cross-Sell Nudge will appear!*
2.  **Duplicate Suppression**: Wait a moment, and say "I really need a second car." -> *The system will suppress this duplicate nudge because of the 60-second cooldown (shown at the bottom).*
3.  **Compliance Gap**: Keep talking for a while as the "Agent" without mentioning recording. -> *A Compliance Nudge will fire.*
4.  **Compliance Met**: Say "Agent says this call is recorded." -> *The compliance gap signal will be permanently suppressed for this call.*

### Latency Measurement
The dashboard explicitly shows the true latency for every generated nudge:
*   **LLM Latency**: The exact time `gemini-1.5-flash` took to extract the signal from the transcript buffer. (Typically ~800-1500ms).
*   **E2E Latency**: The total time from when the audio finished speaking to when the nudge appeared on screen.
*   **P50 & P95**: The rolling percentiles for E2E latency.

### False-Positive Analysis & Limitations
*   **Confidence Threshold**: The LLM is instructed to only return signals with > 0.8 confidence.
*   **Limitations at 10x Scale**: 
    *   In a real production environment, sending an LLM request for *every single sentence* is too expensive and hits rate limits. A production system should use a smaller, faster dedicated NLP model (like a fine-tuned BERT/DeBERTa) for basic intent detection, and only invoke the LLM for complex summarization.
    *   Noisy audio causes ASR hallucinations. We mitigate this by requiring high confidence and using a rolling buffer (so the LLM sees context, not just one misheard word), but severe noise will inevitably cause missed signals.


