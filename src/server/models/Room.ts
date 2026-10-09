import { PlayState, UserRole, RoomState, ChatMessage, RequestType } from '../../shared/types';
import { Participant } from './Participant';
import { ChangeRequest } from './ChangeRequest';

export class Room {
  public id: string;
  public name: string;
  public hostId: string;
  public videoId: string;
  public videoTitle: string;
  public playState: PlayState;
  public currentTime: number; // in seconds
  public lastUpdated: number; // timestamp in ms
  public participants: Map<string, Participant>;
  public socketToUser: Map<string, string>;
  public requests: Map<string, ChangeRequest>;
  public chatMessages: ChatMessage[];

  constructor(id: string, hostId: string, initialVideoId: string = 'L_LUpnjgPso') {
    this.id = id;
    this.name = `Room ${id}`;
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
  }

  /**
   * Calculates the current live playback time in seconds
   */
  public getCalculatedCurrentTime(): number {
    if (this.playState === 'playing') {
      const elapsedSeconds = (Date.now() - this.lastUpdated) / 1000;
      return this.currentTime + elapsedSeconds;
    }
    return this.currentTime;
  }

  public addParticipant(participant: Participant): void {
    // If room has no active host or host left, first joiner becomes host
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

    // If host was removed, auto-transfer host role to another participant if available
    if (this.hostId === userId && this.participants.size > 0) {
      const nextParticipant = Array.from(this.participants.values())[0];
      this.hostId = nextParticipant.id;
      nextParticipant.updateRole('host');
      this.addChatMessage(
        'system',
        `Host role automatically transferred to ${nextParticipant.username}`,
        'system'
      );
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

  public setHost(newHostUserId: string, requesterUserId?: string): boolean {
    const target = this.participants.get(newHostUserId);
    if (!target) return false;

    // Check requester permission (only current host or system can transfer host)
    if (requesterUserId && this.hostId !== requesterUserId) {
      return false;
    }

    // Demote current host to moderator or participant
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
    // Only Host can assign roles
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

    // RBAC Validation: Host and Moderator can control playback directly
    if (!requester.canControlPlayback()) {
      return { success: false, reason: 'Permission denied. Host or Moderator role required.' };
    }

    const now = Date.now();

    // If playState or video changes, save calculated current time before updating
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
      // Execute the requested change!
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
    // Keep last 100 messages
    if (this.chatMessages.length > 100) {
      this.chatMessages.shift();
    }

    return msg;
  }

  public toState(): RoomState {
    return {
      id: this.id,
      name: this.name,
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
    };
  }
}
