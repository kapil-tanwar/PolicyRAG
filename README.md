# PolicyRAG — AI Voice Agent & Knowledge Base

An AI-powered system that combines a **RAG Knowledge Base**, **Voice Agent**, **Multi-Language Support**, and a **Real-Time Agent Dashboard** — all running locally with no paid APIs required.

## What This Project Does

### 1. RAG Knowledge Base (Ingestion + Retrieval)
- Upload PDF/text documents → the system cleans, chunks, embeds and stores them in a local vector database (LanceDB).
- Ask questions → the AI retrieves relevant chunks and generates grounded answers with source citations.
- Built-in PII protection (emails and phone numbers are automatically redacted).

### 2. Voice Agent
- Browser-based voice assistant using Web Speech API (Speech-to-Text + Text-to-Speech).
- Powered by Google Gemini with direct access to the RAG knowledge base.
- Handles loan qualification conversations, FAQ lookups, objection handling, and human escalation.
- Automatically saves call transcripts to `backend/data/transcripts/`.

### 3. Multi-Language Voice Bots
- Supports **US English**, **Philippines (Taglish)**, and **Indonesia (Bahasa)**.
- ASR/TTS language tags automatically switch per region.

### 4. Real-Time Agent Dashboard
- Live call monitoring with WebSocket-powered nudges (cross-sell detection, compliance alerts).
- Duplicate nudge suppression with 60-second cooldown.
- Shows real-time latency metrics (LLM latency, E2E, P50, P95).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express |
| Frontend | React, Vite |
| Vector DB | LanceDB (local, no Docker needed) |
| AI Models | Google Gemini API (`text-embedding-004`, `gemini-1.5-flash`) |
| Real-Time | Socket.IO |
| Voice | Web Speech API (browser-native) |

---

## Setup Instructions

### Prerequisites
- **Node.js** (v18 or higher)
- **Google Chrome** (required for voice features)
- **Google Gemini API Key** — free from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd darwix-assignment
```

### 2. Setup Backend
```bash
cd backend
npm install
```

Create a `.env` file by copying the example:
```bash
cp .env.example .env
```

Add your Gemini API key to `.env`:
```
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the backend server:
```bash
node src/index.js
```

The API will be running at **http://localhost:5000**.

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in Google Chrome.

### 4. Run Evaluation Script (Optional)
```bash
cd backend
node scripts/evaluate.js
```

This generates an `evaluation_results.md` file with RAG quality results.

---

## Usage

1. **Upload a document** — Use the Ingestion section to upload a PDF or text file.
2. **Ask questions** — Type a question in the Retrieval section to get AI-generated answers with sources.
3. **Voice Agent** — Click "Hold to Speak" to interact with the voice agent (allow microphone access).
4. **Switch Region** — Use the dropdown to test Taglish (PH) or Bahasa (ID) voice bots.
5. **Real-Time Dashboard** — Scroll to the bottom and click "Start Live Call" to test live nudges.
