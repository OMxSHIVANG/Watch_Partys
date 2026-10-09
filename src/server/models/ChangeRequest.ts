import { ChangeRequestData, RequestType, UserRole } from '../../shared/types';

export class ChangeRequest {
  public id: string;
  public roomId: string;
  public requestedBy: {
    userId: string;
    username: string;
  };
  public type: RequestType;
  public payload: {
    videoId?: string;
    videoTitle?: string;
    time?: number;
    role?: UserRole;
  };
  public status: 'pending' | 'approved' | 'rejected';
  public createdAt: number;

  constructor(
    id: string,
    roomId: string,
    userId: string,
    username: string,
    type: RequestType,
    payload: { videoId?: string; videoTitle?: string; time?: number; role?: UserRole }
  ) {
    this.id = id;
    this.roomId = roomId;
    this.requestedBy = { userId, username };
    this.type = type;
    this.payload = payload;
    this.status = 'pending';
    this.createdAt = Date.now();
  }

  public approve(): void {
    this.status = 'approved';
  }

  public reject(): void {
    this.status = 'rejected';
  }

  public toJSON(): ChangeRequestData {
    return {
      id: this.id,
      roomId: this.roomId,
      requestedBy: this.requestedBy,
      type: this.type,
      payload: this.payload,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}
