import { Room } from './Room';
import { Participant } from './Participant';
import { DatabaseService } from '../db/database';
import { UserRole } from '../../shared/types';

export class RoomManager {
  private rooms: Map<string, Room>;
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.rooms = new Map();
    this.db = db;
    this.loadPersistedRooms();
  }

  private loadPersistedRooms(): void {
    try {
      const persisted = this.db.loadAllRooms();
      for (const item of persisted) {
        const room = new Room(item.room.id, item.room.hostId, item.room.videoId);
        room.name = item.room.name;
        room.videoTitle = item.room.videoTitle || 'YouTube Video';
        room.playState = item.room.playState;
        room.currentTime = item.room.currentTime;
        room.lastUpdated = item.room.lastUpdated;
        room.chatMessages = item.messages || [];

        for (const pData of item.participants) {
          const p = new Participant(pData.id, pData.socketId || '', pData.username, pData.role);
          p.isOnline = false; // Initially offline until socket connects
          room.participants.set(p.id, p);
        }

        this.rooms.set(room.id, room);
      }
      console.log(`[RoomManager] Loaded ${this.rooms.size} rooms from SQLite database.`);
    } catch (err) {
      console.error('[RoomManager] Failed to load persisted rooms:', err);
    }
  }

  public createRoom(hostUserId: string, hostUsername: string, initialVideoId?: string): Room {
    // Generate readable 6-character room code like "PARTY1" or "XYZ123"
    const roomId = this.generateRoomCode();
    const room = new Room(roomId, hostUserId, initialVideoId);

    const hostParticipant = new Participant(hostUserId, '', hostUsername, 'host');
    room.addParticipant(hostParticipant);

    this.rooms.set(roomId, room);
    this.db.saveRoom(room.toState());
    return room;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  public getOrCreateRoom(roomId: string, userId: string, username: string): Room {
    const formattedId = roomId.trim().toUpperCase();
    let room = this.rooms.get(formattedId);
    if (!room) {
      room = new Room(formattedId, userId);
      const host = new Participant(userId, '', username, 'host');
      room.addParticipant(host);
      this.rooms.set(formattedId, room);
      this.db.saveRoom(room.toState());
    }
    return room;
  }

  public joinRoom(
    roomId: string,
    userId: string,
    socketId: string,
    username: string
  ): { room: Room; participant: Participant; isNew: boolean } {
    const formattedId = roomId.trim().toUpperCase();
    let room = this.rooms.get(formattedId);

    if (!room) {
      // Room does not exist yet -> create with this user as host
      room = this.createRoom(userId, username);
      const host = room.getParticipant(userId)!;
      host.setSocketId(socketId);
      return { room, participant: host, isNew: true };
    }

    let participant = room.getParticipant(userId);
    let isNew = false;

    if (participant) {
      // User rejoining room
      participant.setSocketId(socketId);
      participant.username = username; // update username if changed
    } else {
      // New joiner gets 'participant' role by default unless room has no host
      const defaultRole: UserRole = room.participants.size === 0 ? 'host' : 'participant';
      participant = new Participant(userId, socketId, username, defaultRole);
      room.addParticipant(participant);
      isNew = true;
      room.addChatMessage('system', `${username} joined the Watch Party!`, 'system');
    }

    this.db.saveRoom(room.toState());
    return { room, participant, isNew };
  }

  public handleDisconnect(socketId: string): { room?: Room; participant?: Participant } | null {
    for (const room of this.rooms.values()) {
      const participant = room.getParticipantBySocket(socketId);
      if (participant) {
        participant.setOffline();
        room.addChatMessage('system', `${participant.username} went offline`, 'system');
        this.db.saveRoom(room.toState());
        return { room, participant };
      }
    }
    return null;
  }

  public saveRoomState(room: Room): void {
    this.db.saveRoom(room.toState());
  }

  public removeParticipantFromRoom(roomId: string, userId: string): Room | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const removed = room.removeParticipant(userId);
    if (removed) {
      this.db.removeParticipant(roomId, userId);
      this.db.saveRoom(room.toState());
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
