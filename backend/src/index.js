import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import apiRoutes from './routes/api.js';
import { setupNudgeEngine } from './services/nudgeEngine.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('RAG & Voice API is running');
});

// Setup Q4 Nudge Engine WebSocket
setupNudgeEngine(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
