export type UserRole = 'host' | 'moderator' | 'participant' | 'viewer';

export type PlayState = 'playing' | 'paused' | 'buffering';

export interface ParticipantData {
  id: string;
  socketId: string;
  username: string;
  role: UserRole;
  joinedAt: number;
  isOnline: boolean;
}

export type RequestType = 'change_video' | 'play' | 'pause' | 'seek' | 'request_role';

export interface ChangeRequestData {
  id: string;
  roomId: string;
  requestedBy: {
    userId: string;
    username: string;
  };
  type: RequestType;
  payload: {
    videoId?: string;
    videoTitle?: string;
    time?: number;
    role?: UserRole;
  };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  userRole: UserRole;
  text: string;
  timestamp: number;
  type: 'chat' | 'system';
}

export interface RoomState {
  id: string;
  name: string;
  hostId: string;
  videoId: string;
  videoTitle?: string;
  playState: PlayState;
  currentTime: number;
  lastUpdated: number;
  participants: ParticipantData[];
  requests: ChangeRequestData[];
  chatMessages: ChatMessage[];
}

export interface ReactionPayload {
  id: string;
  userId: string;
  username: string;
  emoji: string;
  timestamp: number;
}
