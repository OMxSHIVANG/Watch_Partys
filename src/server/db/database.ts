import fs from 'fs';
import path from 'path';
import { RoomState, ParticipantData, ChatMessage } from '../../shared/types';

interface DBStructure {
  rooms: Record<string, RoomState>;
  participants: Record<string, ParticipantData[]>;
  messages: Record<string, ChatMessage[]>;
}

export class DatabaseService {
  private filePath: string;
  private data: DBStructure;

  constructor(customPath?: string) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.filePath = customPath || path.join(dataDir, 'watchparty_db.json');
    this.data = this.loadFromFile();
  }

  private loadFromFile(): DBStructure {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[DatabaseService] Error reading database file:', err);
    }
    return { rooms: {}, participants: {}, messages: {} };
  }

  private persist(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DatabaseService] Error saving database file:', err);
    }
  }

  public saveRoom(roomState: RoomState): void {
    this.data.rooms[roomState.id] = roomState;
    this.data.participants[roomState.id] = roomState.participants;
    this.data.messages[roomState.id] = roomState.chatMessages;
    this.persist();
  }

  public removeParticipant(roomId: string, userId: string): void {
    if (this.data.participants[roomId]) {
      this.data.participants[roomId] = this.data.participants[roomId].filter((p) => p.id !== userId);
    }
    if (this.data.rooms[roomId]) {
      this.data.rooms[roomId].participants = this.data.rooms[roomId].participants.filter((p) => p.id !== userId);
    }
    this.persist();
  }

  public saveMessage(roomId: string, msg: ChatMessage): void {
    if (!this.data.messages[roomId]) {
      this.data.messages[roomId] = [];
    }
    this.data.messages[roomId].push(msg);
    // Keep last 100 messages
    if (this.data.messages[roomId].length > 100) {
      this.data.messages[roomId].shift();
    }
    this.persist();
  }

  public loadAllRooms(): Array<{
    room: RoomState;
    participants: ParticipantData[];
    messages: ChatMessage[];
  }> {
    const result = [];
    for (const roomId of Object.keys(this.data.rooms)) {
      const room = this.data.rooms[roomId];
      const participants = this.data.participants[roomId] || room.participants || [];
      const messages = this.data.messages[roomId] || room.chatMessages || [];
      result.push({ room, participants, messages });
    }
    return result;
  }
}
