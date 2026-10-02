import express from 'express';
import multer from 'multer';
import { uploadDocument } from '../controllers/knowledgeController.js';
import { queryRag } from '../controllers/ragController.js';
import { chatWithVoiceAgent, saveTranscript, chatWithLocalizedBot } from '../controllers/voiceController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Question 2 requirements
router.post('/knowledge/upload', upload.single('file'), uploadDocument);
router.post('/rag/query', queryRag);

// Question 1 requirements
router.post('/voice/chat', chatWithVoiceAgent);
router.post('/voice/transcript', saveTranscript);

// Question 3 requirements
router.post('/voice/localized-chat', chatWithLocalizedBot);

export default router;
