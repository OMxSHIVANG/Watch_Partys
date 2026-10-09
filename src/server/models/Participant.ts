import { UserRole, ParticipantData } from '../../shared/types';

export class Participant {
  public id: string;
  public socketId: string;
  public username: string;
  public role: UserRole;
  public joinedAt: number;
  public isOnline: boolean;

  constructor(id: string, socketId: string, username: string, role: UserRole = 'participant') {
    this.id = id;
    this.socketId = socketId;
    this.username = username;
    this.role = role;
    this.joinedAt = Date.now();
    this.isOnline = true;
  }

  public updateRole(newRole: UserRole): void {
    this.role = newRole;
  }

  public setSocketId(socketId: string): void {
    this.socketId = socketId;
    this.isOnline = true;
  }

  public setOffline(): void {
    this.isOnline = false;
  }

  /**
   * Check if participant can directly execute host/mod playback actions
   */
  public canControlPlayback(): boolean {
    return this.role === 'host' || this.role === 'moderator';
  }

  /**
   * Check if participant can manage roles and kick participants
   */
  public isHost(): boolean {
    return this.role === 'host';
  }

  public toJSON(): ParticipantData {
    return {
      id: this.id,
      socketId: this.socketId,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt,
      isOnline: this.isOnline,
    };
  }
}
