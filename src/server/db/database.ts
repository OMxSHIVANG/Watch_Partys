import { RoomModel } from './models/Room';
import { PlayState, ParticipantData, ChangeRequestData, ChatMessage, RoomState } from '../../shared/types';
export type StoredRoom = RoomState & { passwordHash?: string };

export class DatabaseService {
  constructor() {
    // MongoDB connection is handled in index.ts via connectDB()
  }

  public async saveRoom(roomState: StoredRoom): Promise<void> {
    try {
      const { id, ...rest } = roomState;
      
      if (rest.status === 'live') {
        await RoomModel.findOneAndUpdate(
          { roomId: id, isDeleted: { $ne: true } },
          { roomId: id, ...rest },
          { upsert: true, new: true }
        );
      } else {
        await RoomModel.findOneAndUpdate(
          { roomId: id, isDeleted: { $ne: true } },
          { roomId: id, ...rest },
          { new: true }
        );
      }
    } catch (err) {
      console.error('[DatabaseService] Error saving room:', err);
    }
  }

  public async removeParticipant(roomId: string, userId: string): Promise<void> {
    try {
      await RoomModel.findOneAndUpdate(
        { roomId },
        { $pull: { participants: { id: userId } } }
      );
    } catch (err) {
      console.error('[DatabaseService] Error removing participant:', err);
    }
  }

  public async saveMessage(roomId: string, msg: ChatMessage): Promise<void> {
    try {
      // Add message and keep only last 100
      await RoomModel.findOneAndUpdate(
        { roomId },
        { 
          $push: { 
            chatMessages: {
              $each: [msg],
              $slice: -100
            }
          }
        }
      );
    } catch (err) {
      console.error('[DatabaseService] Error saving message:', err);
    }
  }

  public async markAllStaleRoomsAsEnded(): Promise<void> {
    try {
      await RoomModel.updateMany({ status: 'live' }, { $set: { status: 'ended', endedAt: Date.now() } });
    } catch (err) {
      console.error('[DatabaseService] Error cleaning up stale rooms:', err);
    }
  }

  public async loadAllRooms(): Promise<any[]> {
    try {
      const rooms = await RoomModel.find({ status: 'live', isDeleted: { $ne: true } }).lean();
      return rooms.map((r: any) => {
        const { roomId, ...rest } = r;
        return {
          room: { id: roomId, ...rest },
          participants: r.participants || [],
          messages: r.chatMessages || []
        };
      });
    } catch (err) {
      console.error('[DatabaseService] Error loading all rooms:', err);
      return [];
    }
  }
}
