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
  description?: string;
  purpose?: string;
  initialVideoPosition?: number;
  finalVideoPosition?: number;
  durationWatched?: number;
  isDeleted?: boolean;
  segments?: Array<{start: number, end: number}>;
  isPublic: boolean;
  participantLimit: number;
  status?: 'live' | 'ended';
  startedAt?: number;
  endedAt?: number;
  currentParticipantCount?: number;
  likes?: string[];
  hostId: string;
  videoId: string;
  thumbnail?: string;
  videoTitle?: string;
  playState: PlayState;
  currentTime: number;
  lastUpdated: number;
  participants: ParticipantData[];
  requests: ChangeRequestData[];
  chatMessages: ChatMessage[];
  playlist: PlaylistItem[];
  recentVideos: PlaylistItem[];
  hasPassword?: boolean;
}

export interface PlaylistItem {
  id: string;
  videoId: string;
  title: string;
  addedBy: {
    userId: string;
    username: string;
  };
  votes: string[]; // Array of userIds who voted
  createdAt: number;
  playedAt?: number;
}

export interface ReactionPayload {
  id: string;
  userId: string;
  username: string;
  emoji: string;
  timestamp: number;
}

