import express from 'express';
import multer from 'multer';
import { uploadToCloudinary } from './utils/cloudinary';

import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[CRITICAL] Uncaught Exception:', error);
});

import { DatabaseService } from './db/database';
import { RoomManager } from './models/RoomManager';
import { setupSocketHandlers } from './sockets/socketHandler';
import { createAuthRouter, getJwtSecret } from './auth/authRouter';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { UserModel } from './db/models/User';
import { RoomModel } from './db/models/Room';
import { FollowModel } from './db/models/Follow';

import { connectDB } from './db/mongoose';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const rawFrontendUrls = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim()) : [];
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
const allowedOrigins = Array.from(new Set([...rawFrontendUrls, ...defaultOrigins]));

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  return true;
};

app.use(cors({
  origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', createAuthRouter());

async function startServer() {
  await connectDB();

  const db = new DatabaseService();
  await db.markAllStaleRoomsAsEnded();
  const roomManager = new RoomManager(db);
  await roomManager.initialize();

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  setupSocketHandlers(io, roomManager);

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
      (req as any).user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now(), service: 'YouTube Watch Party API' });
  });



  app.get('/api/rooms/:roomId', requireAuth, (req, res) => {
    const room = roomManager.getRoom(req.params.roomId as string);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json(room.toState());
  });

  app.post('/api/rooms', requireAuth, (req, res) => {
    const { hostUsername, videoId } = req.body;
    const hostUserId = (req as any).user.userId;
    
    if (!hostUsername) {
      res.status(400).json({ error: 'hostUsername is required' });
      return;
    }

    const result = roomManager.createRoom(hostUserId, hostUsername, { videoId });
    if (!result.success || !result.room) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json(result.room.toState());
  });

  app.get('/api/rooms', async (req, res) => {
    try {
      const activeRooms = Array.from(roomManager.getAllRooms());
      
      const rooms = await Promise.all(activeRooms.map(async (r: any) => {
        const host = await UserModel.findById(r.hostId).lean().catch(() => null);
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          isPublic: r.isPublic,
          hasPassword: !!r.passwordHash,
          participantCount: Array.from(r.participants.values()).filter((p: any) => p.isOnline).length,
          participantLimit: r.participantLimit,
          videoId: r.videoId,
          videoTitle: r.videoTitle,
        thumbnail: r.thumbnail,
          hostId: r.hostId,
          hostUsername: host ? host.displayName : 'Unknown',
          hostAvatar: host ? host.avatar : undefined,
          status: r.status,
          startedAt: r.startedAt
        };
      }));
      
      const filtered = rooms
        .filter(r => r.status === 'live' && r.participantCount > 0)
        .sort((a, b) => b.participantCount - a.participantCount);
        
      res.json(filtered);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });



  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
  
  app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      if (!process.env.CLOUD_NAME || !process.env.CLOUD_API_KEY || !process.env.CLOUD_API_SECRET) {
        return res.status(503).json({ error: 'Cloud storage is not configured. Set CLOUD_NAME, CLOUD_API_KEY, and CLOUD_API_SECRET.' });
      }

      const folder = req.body.type === 'room' ? 'watchparty/rooms' : 'watchparty/profiles';
      
      const imageUrl = await uploadToCloudinary(req.file.buffer, folder);
      res.json({ url: imageUrl });
    } catch (err: any) {
      console.error('[Upload Error]', err);
      res.status(500).json({ error: 'Image upload failed', details: err.message });
    }
  });

  app.get('/api/users/:userId/profile', async (req, res) => {
    try {
      const userId = req.params.userId;
      
      const user = await UserModel.findById(userId).lean();
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      const [followers, following, allRooms] = await Promise.all([
        FollowModel.countDocuments({ followingId: userId }),
        FollowModel.countDocuments({ followerId: userId }),
        RoomModel.find({ hostId: userId, isDeleted: { $ne: true } }).sort({ startedAt: -1 }).lean()
      ]);
      
      const memRoom = Array.from(roomManager.getAllRooms()).find(r => r.hostId === userId && !r.isDeleted && r.status === 'live');
      
      const history = allRooms.map((r: any) => ({
        id: r.roomId,
        name: r.name,
        description: r.description,
        isPublic: r.isPublic,
        hasPassword: !!r.hasPassword,
        participantCount: r.currentParticipantCount || 0,
        videoId: r.videoId,
        videoTitle: r.videoTitle,
        thumbnail: r.thumbnail,
        purpose: r.purpose,
        status: r.status,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        durationWatched: r.durationWatched || (r.segments && r.segments.length > 0 ? r.segments.reduce((acc: number, s: any) => acc + Math.max(0, s.end - s.start), 0) : 0)
      }));
      
      if (memRoom) {
        const idx = history.findIndex((h: any) => h.id === memRoom.id);
        const memData = {
          id: memRoom.id,
          name: memRoom.name,
          description: memRoom.description,
          isPublic: memRoom.isPublic,
          hasPassword: !!memRoom.passwordHash,
          participantCount: Array.from(memRoom.participants.values()).filter((p: any) => p.isOnline).length,
          videoId: memRoom.videoId,
          videoTitle: memRoom.videoTitle,
          thumbnail: memRoom.thumbnail,
          purpose: memRoom.purpose,
          status: 'live' as const,
          startedAt: memRoom.startedAt,
          endedAt: memRoom.endedAt,
          durationWatched: memRoom.durationWatched || (memRoom.segments && memRoom.segments.length > 0 ? memRoom.segments.reduce((acc: number, s: any) => acc + Math.max(0, s.end - s.start), 0) : 0)
        };
        if (idx !== -1) {
          history[idx] = memData;
        } else {
          history.unshift(memData);
        }
      }
      
      const uniqueHistory = [];
      const seen = new Set();
      for (const r of history) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          uniqueHistory.push(r);
        }
      }
      
      const liveCount = uniqueHistory.filter(r => r.status === 'live').length;
      
      res.json({
        profile: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          bio: user.bio,
          createdAt: user.createdAt,
          followers,
          following,
          totalHosted: uniqueHistory.length,
          currentlyLive: liveCount
        },
        history: uniqueHistory
      });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });



  app.get('/api/rooms/recent', async (req, res) => {
    try {
      const recentRooms = await RoomModel.aggregate([
        { $match: { status: 'ended', isDeleted: { $ne: true } } },
        { $sort: { endedAt: -1 } },
        { $group: { _id: "$hostId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { endedAt: -1 } },
        { $limit: 10 }
      ]);
      
      const populated = await Promise.all(recentRooms.map(async (r: any) => {
        const host = await UserModel.findById(r.hostId).lean().catch(() => null);
        return {
          id: r.roomId,
          name: r.name,
          description: r.description,
          isPublic: r.isPublic,
          participantCount: r.currentParticipantCount || 0,
          videoId: r.videoId,
          hostId: r.hostId,
          hostUsername: host ? host.displayName : 'Unknown',
          hostAvatar: host ? host.avatar : undefined,
          endedAt: r.endedAt || Date.now(),
        };
      }));
      res.json(populated);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.get('/api/rooms/:roomId/replay', async (req, res) => {
    try {
      const roomId = req.params.roomId as string;
      
      const room = await RoomModel.findOne({ roomId, isDeleted: { $ne: true }, 'segments.0': { $exists: true } }).sort({ endedAt: -1, startedAt: -1 }).lean()
        || await RoomModel.findOne({ roomId, isDeleted: { $ne: true } }).sort({ endedAt: -1, startedAt: -1 }).lean()
        || await RoomModel.findOne({ roomId }).sort({ endedAt: -1, startedAt: -1 }).lean();
      if (!room) return res.status(404).json({ error: 'Stream not found' });
      
      const host = await UserModel.findById(room.hostId).lean().catch(() => null);
      
      res.json({
         id: room.roomId,
         name: room.name,
         description: room.description,
         videoId: room.videoId,
         videoTitle: room.videoTitle,
         startedAt: room.startedAt,
         endedAt: room.endedAt,
         participantCount: room.currentParticipantCount || 0,
         likes: room.likes || [],
         hostId: room.hostId,
         hostUsername: host ? host.displayName : 'Unknown',
         hostAvatar: host ? host.avatar : undefined,
         segments: room.segments
      });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  
  app.delete('/api/rooms/:roomId', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const roomId = req.params.roomId as string;
      
      const memRoom = roomManager.getRoom(roomId);
      if (memRoom && memRoom.hostId === userId) {
        roomManager.deleteRoom(roomId);
      }
      
      const userRoomsCount = await RoomModel.countDocuments({ roomId, hostId: userId });
      if (userRoomsCount === 0 && (!memRoom || memRoom.hostId !== userId)) {
        return res.status(403).json({ error: 'Not authorized to delete this stream' });
      }
      
      await RoomModel.updateMany({ roomId, hostId: userId }, { $set: { isDeleted: true } });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.put('/api/rooms/:roomId', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const roomId = req.params.roomId as string;
      const { name, purpose, description } = req.body;
      
      const room = await RoomModel.findOne({ roomId });
      if (!room) return res.status(404).json({ error: 'Stream not found' });
      if (room.hostId !== userId) return res.status(403).json({ error: 'Not authorized to edit this stream' });
      
      const updates: any = {};
      if (name) updates.name = name;
      if (purpose !== undefined) updates.purpose = purpose;
      if (description !== undefined) updates.description = description;
      
      await RoomModel.updateOne({ roomId }, { $set: updates });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  
  app.get('/api/search', async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q || q.length < 2) return res.json({ users: [], rooms: [] });
      
      const users = await UserModel.find({
        $or: [
          { displayName: { $regex: q, $options: 'i' } },
          { username: { $regex: q, $options: 'i' } }
        ]
      }).select('displayName username avatar').limit(5).lean();
      
      const rooms = await RoomModel.find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { videoTitle: { $regex: q, $options: 'i' } }
        ],
        isDeleted: { $ne: true }
      }).sort({ startedAt: -1 }).limit(10).lean();
      
      res.json({
         users: users.map((u: any) => ({ id: u._id, displayName: u.displayName, username: u.username, avatar: u.avatar })),
         rooms: rooms.map((r: any) => ({
           id: r.roomId,
           name: r.name,
           videoTitle: r.videoTitle,
        thumbnail: r.thumbnail,
           videoId: r.videoId,
           status: r.status,
           startedAt: r.startedAt,
           hostId: r.hostId
         }))
      });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  
  app.put('/api/users/profile', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const { displayName, username, bio, avatar } = req.body;
      
      if (username) {
        const lowerUsername = username.toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(lowerUsername)) {
          return res.status(400).json({ error: 'Username must be 3-20 characters, letters, numbers, and underscores only.' });
        }
        const existing = await UserModel.findOne({ username: lowerUsername, _id: { $ne: userId } });
        if (existing) {
          return res.status(409).json({ error: 'This username is already taken.' });
        }
      }
      
      const updateData: any = {};
      if (displayName) updateData.displayName = displayName;
      if (username) updateData.username = username.toLowerCase();
      if (bio !== undefined) updateData.bio = bio;
      if (avatar !== undefined) updateData.avatar = avatar;
      
      const updated = await UserModel.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).lean();
      if (!updated) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true, user: { id: updated._id, displayName: updated.displayName, username: updated.username, avatar: updated.avatar, bio: updated.bio } });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  
  app.post('/api/rooms/:roomId/like', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const roomId = req.params.roomId as string;
      
      const memRoom = roomManager.getRoom(roomId);
      if (memRoom) {
         memRoom.likes.add(userId);
         // @ts-ignore
         io.to(memRoom.id).emit('room_liked', { likes: Array.from(memRoom.likes) });
         roomManager.saveRoomState(memRoom);
      } else {
         await RoomModel.findOneAndUpdate({ roomId, status: 'ended' }, { $addToSet: { likes: userId } });
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.delete('/api/rooms/:roomId/like', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.userId;
      const roomId = req.params.roomId as string;
      
      const memRoom = roomManager.getRoom(roomId);
      if (memRoom) {
         memRoom.likes.delete(userId);
         // @ts-ignore
         io.to(memRoom.id).emit('room_liked', { likes: Array.from(memRoom.likes) });
         roomManager.saveRoomState(memRoom);
      } else {
         await RoomModel.findOneAndUpdate({ roomId, status: 'ended' }, { $pull: { likes: userId } });
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.post('/api/users/:userId/follow', requireAuth, async (req, res) => {
    try {
      const followerId = (req as any).user.userId;
      const followingId = req.params.userId;
      if (followerId === followingId) return res.status(400).json({ error: 'Cannot follow yourself' });
      
      await FollowModel.findOneAndUpdate(
        { followerId, followingId },
        { followerId, followingId },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });
  
  app.delete('/api/users/:userId/follow', requireAuth, async (req, res) => {
    try {
      const followerId = (req as any).user.userId;
      const followingId = req.params.userId;
      await FollowModel.deleteOne({ followerId, followingId });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });
  
  app.get('/api/users/:userId/followers', async (req, res) => {
    try {
      const follows = await FollowModel.find({ followingId: req.params.userId }).lean();
      const users = await UserModel.find({ _id: { $in: follows.map((f: any) => f.followerId) } }).select('displayName avatar').lean();
      res.json(users.map((u: any) => ({ id: u._id, displayName: u.displayName, avatar: u.avatar })));
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });
  
  app.get('/api/users/:userId/following', async (req, res) => {
    try {
      const follows = await FollowModel.find({ followerId: req.params.userId }).lean();
      const users = await UserModel.find({ _id: { $in: follows.map((f: any) => f.followingId) } }).select('displayName avatar').lean();
      res.json(users.map((u: any) => ({ id: u._id, displayName: u.displayName, avatar: u.avatar })));
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });


  const clientBuildPath = path.join(__dirname, '../client');
  app.use(express.static(clientBuildPath));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    const indexPath = path.join(clientBuildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
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

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Express Error]', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  });

  server.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 YouTube Watch Party Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`===================================================`);
  });

  // Graceful Shutdown
  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();

