import { PlayState, UserRole, RoomState, ChatMessage, RequestType, PlaylistItem } from '../../shared/types';
import { Participant } from './Participant';
import { ChangeRequest } from './ChangeRequest';

export class Room {
  public id: string;
  public name: string;
  public description: string;
  public isPublic: boolean;
  public participantLimit: number;
  public hostId: string;
  public videoId: string;
  public videoTitle: string;
  public status: 'live' | 'ended' = 'live';
  public isDeleted: boolean = false;
  public emptySince?: number;
  public startedAt: number = Date.now();
  public endedAt?: number;
  public playState: PlayState;
  public currentTime: number; // in seconds
  public lastUpdated: number; // timestamp in ms
  public participants: Map<string, Participant>;
  public socketToUser: Map<string, string>;
  public requests: Map<string, ChangeRequest>;
  public chatMessages: ChatMessage[];
  public playlist: PlaylistItem[];
  public likes: Set<string>;
  public recentVideos: PlaylistItem[];
  public passwordHash?: string;
  public purpose?: string;
  public segments: Array<{start: number, end: number}>;
  public currentSegmentStart?: number;
  public initialVideoPosition?: number;
  public finalVideoPosition?: number;
  public durationWatched?: number;
  public thumbnail?: string;

  constructor(id: string, hostId: string, initialVideoId: string = 'L_LUpnjgPso', passwordHash?: string) {
    this.id = id;
    this.name = `Room ${id}`;
    this.description = '';
    this.isPublic = true;
    this.participantLimit = 50;
    this.hostId = hostId;
    this.videoId = initialVideoId;
    this.videoTitle = 'Lofi Hip Hop Radio - Beats to Relax/Study to';
    this.playState = 'paused';
    this.currentTime = 0;
    this.lastUpdated = Date.now();
    this.participants = new Map();
    this.socketToUser = new Map();
    this.requests = new Map();
    this.chatMessages = [];
    this.playlist = [];
    this.likes = new Set();
    this.segments = [];
    this.recentVideos = [];
    this.passwordHash = passwordHash;
  }

  public finalizeSegments(): void {
    if (this.currentSegmentStart !== undefined) {
       const elapsed = (Date.now() - this.lastUpdated) / 1000;
       this.segments.push({ start: this.currentSegmentStart, end: this.currentTime + elapsed });
       this.currentSegmentStart = undefined;
    }
  }

  public getCalculatedCurrentTime(): number {
    if (this.playState === 'playing') {
      const elapsedSeconds = (Date.now() - this.lastUpdated) / 1000;
      return this.currentTime + elapsedSeconds;
    }
    return this.currentTime;
  }

  public addParticipant(participant: Participant): void {
    if (this.participants.size === 0 || !this.hostId) {
      this.hostId = participant.id;
      participant.updateRole('host');
    }

    this.participants.set(participant.id, participant);
    this.socketToUser.set(participant.socketId, participant.id);
  }

  public removeParticipant(userId: string): Participant | undefined {
    const participant = this.participants.get(userId);
    if (!participant) return undefined;

    this.socketToUser.delete(participant.socketId);
    this.participants.delete(userId);

    if (this.hostId === userId) {
      this.status = 'ended';
      this.finalizeSegments();
      this.endedAt = Date.now();
      this.addChatMessage('system', 'Host left. Watch Party has ended.', 'system');
    }

    return participant;
  }

  public getParticipant(userId: string): Participant | undefined {
    return this.participants.get(userId);
  }

  public getParticipantBySocket(socketId: string): Participant | undefined {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return undefined;
    return this.participants.get(userId);
  }

  public updateParticipantSocket(userId: string, newSocketId: string): void {
    const participant = this.participants.get(userId);
    if (!participant) return;

    if (participant.socketId) {
      this.socketToUser.delete(participant.socketId);
    }
    
    participant.setSocketId(newSocketId);
    this.socketToUser.set(newSocketId, userId);
  }


  public setHost(newHostUserId: string, requesterUserId?: string): boolean {
    const target = this.participants.get(newHostUserId);
    if (!target) return false;

    if (requesterUserId && this.hostId !== requesterUserId) {
      return false;
    }

    const currentHost = this.participants.get(this.hostId);
    if (currentHost && currentHost.id !== newHostUserId) {
      currentHost.updateRole('moderator');
    }

    this.hostId = newHostUserId;
    target.updateRole('host');
    this.addChatMessage('system', `${target.username} is now the Room Host`, 'system');
    return true;
  }

  public assignRole(targetUserId: string, newRole: UserRole, requesterUserId: string): boolean {
    const requester = this.participants.get(requesterUserId);
    const target = this.participants.get(targetUserId);

    if (!requester || !target) return false;
    if (requester.role !== 'host') return false;

    if (newRole === 'host') {
      return this.setHost(targetUserId, requesterUserId);
    }

    target.updateRole(newRole);
    this.addChatMessage('system', `${target.username}'s role was changed to ${newRole}`, 'system');
    return true;
  }

  public updatePlaybackState(
    update: { playState?: PlayState; currentTime?: number; videoId?: string; videoTitle?: string },
    requesterUserId: string
  ): { success: boolean; reason?: string } {
    const requester = this.participants.get(requesterUserId);
    if (!requester) return { success: false, reason: 'Participant not found' };

    if (!requester.canControlPlayback()) {
      return { success: false, reason: 'Permission denied. Host or Moderator role required.' };
    }

    const now = Date.now();

    if (update.currentTime !== undefined) {
      this.currentTime = update.currentTime;
      this.lastUpdated = now;
    } else if (update.playState !== undefined) {
      this.currentTime = this.getCalculatedCurrentTime();
      this.lastUpdated = now;
    }

    if (update.playState) {
      this.playState = update.playState;
    }

    if (update.videoId && update.videoId !== this.videoId) {
      this.videoId = update.videoId;
      this.videoTitle = update.videoTitle || 'YouTube Video';
      this.currentTime = 0;
      this.playState = 'playing';
      this.lastUpdated = now;
      this.addChatMessage(
        'system',
        `${requester.username} changed video to: ${this.videoTitle}`,
        'system'
      );
    }

    return { success: true };
  }

  public createChangeRequest(
    requesterUserId: string,
    type: RequestType,
    payload: { videoId?: string; videoTitle?: string; time?: number; role?: UserRole }
  ): ChangeRequest | null {
    const requester = this.participants.get(requesterUserId);
    if (!requester) return null;

    const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const changeReq = new ChangeRequest(reqId, this.id, requesterUserId, requester.username, type, payload);
    this.requests.set(reqId, changeReq);

    this.addChatMessage(
      'system',
      `${requester.username} requested ${type.replace('_', ' ')} approval`,
      'system'
    );

    return changeReq;
  }

  public resolveChangeRequest(
    requestId: string,
    approved: boolean,
    resolverUserId: string
  ): { success: boolean; request?: ChangeRequest; reason?: string } {
    const resolver = this.participants.get(resolverUserId);
    if (!resolver || !resolver.canControlPlayback()) {
      return { success: false, reason: 'Permission denied' };
    }

    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return { success: false, reason: 'Request not found or already processed' };
    }

    if (approved) {
      request.approve();
      if (request.type === 'change_video' && request.payload.videoId) {
        this.updatePlaybackState(
          { videoId: request.payload.videoId, videoTitle: request.payload.videoTitle },
          this.hostId // Execute under host authority
        );
      } else if (request.type === 'play') {
        this.updatePlaybackState({ playState: 'playing' }, this.hostId);
      } else if (request.type === 'pause') {
        this.updatePlaybackState({ playState: 'paused' }, this.hostId);
      } else if (request.type === 'seek' && request.payload.time !== undefined) {
        this.updatePlaybackState({ currentTime: request.payload.time }, this.hostId);
      } else if (request.type === 'request_role' && request.payload.role) {
        this.assignRole(request.requestedBy.userId, request.payload.role, this.hostId);
      }
      this.addChatMessage(
        'system',
        `Request by ${request.requestedBy.username} was APPROVED by ${resolver.username}`,
        'system'
      );
    } else {
      request.reject();
      this.addChatMessage(
        'system',
        `Request by ${request.requestedBy.username} was REJECTED by ${resolver.username}`,
        'system'
      );
    }

    return { success: true, request };
  }

  public addChatMessage(
    userId: string,
    text: string,
    type: 'chat' | 'system' = 'chat'
  ): ChatMessage {
    const participant = this.participants.get(userId);
    const username = participant ? participant.username : 'System';
    const userRole = participant ? participant.role : 'host';

    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      username,
      userRole,
      text,
      timestamp: Date.now(),
      type,
    };

    this.chatMessages.push(msg);
    if (this.chatMessages.length > 100) {
      this.chatMessages.shift();
    }

    return msg;
  }

  public toState(): RoomState {
    return {
      id: this.id,
      status: this.status,
      isDeleted: this.isDeleted,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      currentParticipantCount: this.participants.size,
      likes: Array.from(this.likes),
      name: this.name,
      description: this.description,
      purpose: this.purpose,
      segments: this.segments,
      initialVideoPosition: this.initialVideoPosition,
      finalVideoPosition: this.finalVideoPosition,
      durationWatched: this.durationWatched,
      thumbnail: this.thumbnail,
      isPublic: this.isPublic,
      participantLimit: this.participantLimit,
      hostId: this.hostId,
      videoId: this.videoId,
      videoTitle: this.videoTitle,
      playState: this.playState,
      currentTime: this.getCalculatedCurrentTime(),
      lastUpdated: this.lastUpdated,
      participants: Array.from(this.participants.values()).map((p) => p.toJSON()),
      requests: Array.from(this.requests.values())
        .filter((r) => r.status === 'pending')
        .map((r) => r.toJSON()),
      chatMessages: this.chatMessages,
      playlist: this.playlist,
      recentVideos: this.recentVideos || [],
      hasPassword: Boolean(this.passwordHash),
    };
  }
}
