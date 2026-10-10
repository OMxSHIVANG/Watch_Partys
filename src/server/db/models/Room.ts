import mongoose, { Schema, Document } from 'mongoose';
import { PlayState, ParticipantData, ChangeRequestData, ChatMessage, PlaylistItem } from '../../../shared/types';

export interface IRoomDocument extends Document {
  roomId: string;
  name: string;
  description: string;
  isPublic: boolean;
  participantLimit: number;
  hostId: string;
  videoId: string;
  videoTitle?: string;
  status: 'live' | 'ended';
  isDeleted?: boolean;
  thumbnail?: string;
  segments?: Array<{start: number, end: number}>;
  durationWatched?: number;
  purpose?: string;
  initialVideoPosition?: number;
  finalVideoPosition?: number;
  startedAt: number;
  endedAt?: number;
  currentParticipantCount: number;
  likes: string[];
  playState: PlayState;
  currentTime: number;
  lastUpdated: number;
  passwordHash?: string;
  hasPassword?: boolean;
  participants: ParticipantData[];
  requests: ChangeRequestData[];
  chatMessages: ChatMessage[];
  playlist: PlaylistItem[];
}

const ParticipantSchema = new Schema<ParticipantData>({
  id: { type: String, required: true },
  socketId: { type: String, default: '' },
  username: { type: String, required: true },
  role: { type: String, enum: ['host', 'moderator', 'participant', 'viewer'], required: true },
  joinedAt: { type: Number, required: true },
  isOnline: { type: Boolean, required: true }
}, { _id: false });

const RequestSchema = new Schema<ChangeRequestData>({
  id: { type: String, required: true },
  roomId: { type: String, required: true },
  requestedBy: {
    userId: { type: String, required: true },
    username: { type: String, required: true }
  },
  type: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
  createdAt: { type: Number, required: true }
}, { _id: false });

const ChatMessageSchema = new Schema<ChatMessage>({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  userRole: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, required: true },
  type: { type: String, enum: ['chat', 'system'], required: true }
}, { _id: false });


const PlaylistItemSchema = new Schema<PlaylistItem>({
  id: { type: String, required: true },
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  addedBy: {
    userId: { type: String, required: true },
    username: { type: String, required: true }
  },
  votes: [{ type: String }],
  createdAt: { type: Number, required: true }
}, { _id: false });

const RoomSchema: Schema = new Schema({
  roomId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  hostId: { type: String, required: true },
  videoId: { type: String, required: true },
  videoTitle: { type: String },
  status: { type: String, enum: ['live', 'ended'], default: 'live' },
  isDeleted: { type: Boolean, default: false },
  thumbnail: { type: String },
  segments: { type: [{ start: Number, end: Number }], default: [] },
  durationWatched: { type: Number },
  purpose: { type: String },
  initialVideoPosition: { type: Number },
  finalVideoPosition: { type: Number },
  startedAt: { type: Number, default: () => Date.now() },
  endedAt: { type: Number },
  currentParticipantCount: { type: Number, default: 0 },
  likes: { type: [String], default: [] },
  playState: { type: String, enum: ['playing', 'paused', 'buffering'], required: true },
  currentTime: { type: Number, required: true },
  lastUpdated: { type: Number, required: true },
  passwordHash: { type: String },
  hasPassword: { type: Boolean },
  participants: [ParticipantSchema],
  requests: [RequestSchema],
  chatMessages: [ChatMessageSchema],
  playlist: { type: [PlaylistItemSchema], default: [] },
  recentVideos: { type: [PlaylistItemSchema], default: [] }
});

export const RoomModel = mongoose.model<IRoomDocument>('Room', RoomSchema);
