import bcrypt from 'bcryptjs';
import { Room } from './Room';
import { Participant } from './Participant';
import { DatabaseService } from '../db/database';
import { UserRole } from '../../shared/types';

function formatRoomCode(roomId: string): string {
  return roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export class RoomManager {
  private rooms: Map<string, Room>;
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.rooms = new Map();
    this.db = db;
  }

  public async initialize(): Promise<void> {
    try {
      const persisted = await this.db.loadAllRooms();
      for (const item of persisted) {
        const room = new Room(item.room.id, item.room.hostId, item.room.videoId, item.room.passwordHash);
        room.name = item.room.name;
        room.videoTitle = item.room.videoTitle || 'YouTube Video';
        room.playState = item.room.playState;
        room.currentTime = item.room.currentTime;
        room.lastUpdated = item.room.lastUpdated;
        room.chatMessages = item.messages || [];
        if (item.room.description) room.description = item.room.description;
        if (item.room.thumbnail) room.thumbnail = item.room.thumbnail;
        if (item.room.purpose) room.purpose = item.room.purpose;
        if (item.room.segments) room.segments = item.room.segments;
        if (item.room.initialVideoPosition !== undefined) room.initialVideoPosition = item.room.initialVideoPosition;
        if (item.room.finalVideoPosition !== undefined) room.finalVideoPosition = item.room.finalVideoPosition;
        if (item.room.durationWatched !== undefined) room.durationWatched = item.room.durationWatched;

        for (const pData of item.participants) {
          const p = new Participant(pData.id, pData.socketId || '', pData.username, pData.role);
          p.isOnline = false;
          room.addParticipant(p);
        }

        this.rooms.set(room.id, room);
      }
      console.log(`[RoomManager] Loaded ${this.rooms.size} rooms from MongoDB.`);
    } catch (err) {
      console.error('[RoomManager] Failed to load persisted rooms:', err);
    }
  }

  public createRoom(
    hostUserId: string,
    hostUsername: string,
    options: { roomId?: string; password?: string; videoId?: string; name?: string; description?: string; isPublic?: boolean; participantLimit?: number } = {}
  ): { success: boolean; room?: Room; reason?: string } {
    const requested = options.roomId ? formatRoomCode(options.roomId) : '';
    if (requested && (requested.length < 3 || requested.length > 12)) {
      return { success: false, reason: 'Room code must be 3–12 letters or numbers.' };
    }
    if (requested && this.rooms.has(requested)) {
      return { success: false, reason: 'That room code is already taken. Choose another.' };
    }

    const roomId = requested || this.generateRoomCode();
    const password = options.password?.trim();
    const passwordHash = password ? bcrypt.hashSync(password, 10) : undefined;
    const room = new Room(roomId, hostUserId, options.videoId, passwordHash);
    if (options.name) room.name = options.name;
    if (options.description) room.description = options.description;
    if (options.isPublic !== undefined) room.isPublic = options.isPublic;
    if (options.participantLimit) room.participantLimit = options.participantLimit;

    const hostParticipant = new Participant(hostUserId, '', hostUsername, 'host');
    room.addParticipant(hostParticipant);

    this.rooms.set(roomId, room);
    this.saveRoomState(room);
    return { success: true, room };
  }

  public getAllRooms(): Room[] { return Array.from(this.rooms.values()); }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(formatRoomCode(roomId));
  }

  public joinRoom(
    roomId: string,
    userId: string,
    socketId: string,
    username: string,
    options?: any
  ): { success: boolean; room?: Room; participant?: Participant; isNew?: boolean; reason?: string } {
    const formattedId = formatRoomCode(roomId);
    if (!formattedId) {
      return { success: false, reason: 'Room code is required.' };
    }

    let room = this.rooms.get(formattedId);
    let isNew = false;

    const pwd = typeof options === 'string' ? options : (options?.password || undefined);

    if (!room) {
      if (options && options.isPublic === false && !pwd) {
        return { success: false, reason: 'Password is required for private watch parties.' };
      }

      const createRes = this.createRoom(userId, username, { roomId: formattedId, ...options, password: pwd });
      if (!createRes.success || !createRes.room) {
        return { success: false, reason: createRes.reason || 'Failed to create room' };
      }
      room = createRes.room;
      isNew = true;
    }

    if (!isNew && room.passwordHash) {
      const ok = Boolean(pwd) && bcrypt.compareSync(pwd!.trim(), room.passwordHash);
      if (!ok) {
        return { success: false, reason: 'Room password is incorrect.' };
      }
    }
    
    if (!isNew && room.participants.size >= room.participantLimit && !room.participants.has(userId)) {
      return { success: false, reason: 'Room is full (limit: ' + room.participantLimit + ')' };
    }

    let participant = room.getParticipant(userId);

    if (participant) {
      room.updateParticipantSocket(userId, socketId);
      participant.username = username;
    } else {
      const defaultRole: UserRole = room.status === 'ended' ? 'viewer' : (room.participants.size === 0 ? 'host' : 'participant');
      participant = new Participant(userId, socketId, username, defaultRole);
      room.addParticipant(participant);
      isNew = true;
      room.addChatMessage('system', `${username} joined the Watch Party!`, 'system');
    }

    this.saveRoomState(room);
    return { success: true, room, participant, isNew };
  }

  public handleDisconnect(socketId: string): { room?: Room; participant?: Participant } | null {
    for (const room of this.rooms.values()) {
      const participant = room.getParticipantBySocket(socketId);
      if (participant) {
        participant.setOffline();
        room.addChatMessage('system', `${participant.username} went offline`, 'system');
        
        this.saveRoomState(room);
        return { room, participant };
      }
    }
    return null;
  }

  
  public deleteRoom(roomId: string): boolean {
    const formattedId = formatRoomCode(roomId);
    const room = this.rooms.get(formattedId);
    if (room) {
      room.status = 'ended';
      room.isDeleted = true;
      this.rooms.delete(formattedId);
      return true;
    }
    return false;
  }

  public saveRoomState(room: Room): void {
    this.db.saveRoom({ ...room.toState(), passwordHash: room.passwordHash });
  }

  public evictRoom(roomId: string): void {
    const formattedId = formatRoomCode(roomId);
    if (this.rooms.has(formattedId)) {
      this.rooms.delete(formattedId);
    }
  }

  public removeParticipantFromRoom(roomId: string, userId: string): Room | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const removed = room.removeParticipant(userId);
    if (removed) {
      this.db.removeParticipant(roomId, userId);
      this.saveRoomState(room);
      if (room.status === 'ended') {
         this.rooms.delete(formatRoomCode(roomId));
      }
    }
    return room;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return this.rooms.has(code) ? this.generateRoomCode() : code;
  }
}
