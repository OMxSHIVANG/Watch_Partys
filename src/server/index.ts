import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import { DatabaseService } from './db/database';
import { RoomManager } from './models/RoomManager';
import { setupSocketHandlers } from './sockets/socketHandler';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize SQLite database and RoomManager
const db = new DatabaseService();
const roomManager = new RoomManager(db);

// Socket.IO Server Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

setupSocketHandlers(io, roomManager);

// API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), service: 'YouTube Watch Party API' });
});

app.get('/api/rooms', (_req, res) => {
  const rooms = Array.from(db.loadAllRooms()).map((item) => ({
    id: item.room.id,
    name: item.room.name,
    hostId: item.room.hostId,
    videoId: item.room.videoId,
    videoTitle: item.room.videoTitle,
    participantCount: item.participants.length,
  }));
  res.json({ rooms });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(room.toState());
});

app.post('/api/rooms', (req, res) => {
  const { hostUserId, hostUsername, videoId } = req.body;
  if (!hostUserId || !hostUsername) {
    res.status(400).json({ error: 'hostUserId and hostUsername are required' });
    return;
  }

  const room = roomManager.createRoom(hostUserId, hostUsername, videoId);
  res.json(room.toState());
});

// Serve frontend static build in production
const clientBuildPath = path.join(__dirname, '../client');
app.use(express.static(clientBuildPath));

app.get('*', (_req, res) => {
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>YouTube Watch Party</title></head>
        <body style="font-family: sans-serif; background: #0f172a; color: white; text-align: center; padding-top: 100px;">
          <h1>YouTube Watch Party Server Running</h1>
          <p>Frontend is currently building or running in Vite dev mode.</p>
        </body>
      </html>
    `);
  }
});

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 YouTube Watch Party Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`===================================================`);
});
