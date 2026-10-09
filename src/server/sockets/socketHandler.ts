import { Server, Socket } from 'socket.io';
import { RoomManager } from '../models/RoomManager';
import { extractYouTubeId } from '../utils/youtube';
import { RequestType, UserRole } from '../../shared/types';

export function setupSocketHandlers(io: Server, roomManager: RoomManager): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // 1. Join Room
    socket.on('join_room', ({ roomId, username, userId }: { roomId: string; username: string; userId?: string }) => {
      if (!roomId || !username) {
        socket.emit('error_message', { message: 'Room ID and Username are required' });
        return;
      }

      const effectiveUserId = userId || `user_${Math.random().toString(36).substring(2, 9)}`;
      const { room, participant } = roomManager.joinRoom(roomId, effectiveUserId, socket.id, username);

      socket.join(room.id);

      // Send initial state to the joined user
      socket.emit('sync_state', room.toState());
      socket.emit('user_info', { userId: participant.id, role: participant.role });

      // Broadcast to room
      io.to(room.id).emit('user_joined', {
        username: participant.username,
        userId: participant.id,
        role: participant.role,
        participants: room.toState().participants,
      });

      // Broadcast full sync to keep everyone in sync
      io.to(room.id).emit('sync_state', room.toState());
    });

    // 2. Leave Room
    socket.on('leave_room', ({ roomId }: { roomId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (participant) {
        roomManager.removeParticipantFromRoom(room.id, participant.id);
        socket.leave(room.id);

        io.to(room.id).emit('user_left', {
          username: participant.username,
          userId: participant.id,
          participants: room.toState().participants,
        });

        io.to(room.id).emit('sync_state', room.toState());
      }
    });

    // 3. Playback Controls - Play
    socket.on('play', ({ roomId }: { roomId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) return;

      const result = room.updatePlaybackState({ playState: 'playing' }, participant.id);
      if (!result.success) {
        socket.emit('error_message', { message: result.reason || 'Permission denied' });
        return;
      }

      roomManager.saveRoomState(room);
      io.to(room.id).emit('play', { currentTime: room.currentTime, updatedBy: participant.username });
      io.to(room.id).emit('sync_state', room.toState());
    });

    // 4. Playback Controls - Pause
    socket.on('pause', ({ roomId }: { roomId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) return;

      const result = room.updatePlaybackState({ playState: 'paused' }, participant.id);
      if (!result.success) {
        socket.emit('error_message', { message: result.reason || 'Permission denied' });
        return;
      }

      roomManager.saveRoomState(room);
      io.to(room.id).emit('pause', { currentTime: room.currentTime, updatedBy: participant.username });
      io.to(room.id).emit('sync_state', room.toState());
    });

    // 5. Playback Controls - Seek
    socket.on('seek', ({ roomId, time }: { roomId: string; time: number }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) return;

      const result = room.updatePlaybackState({ currentTime: time }, participant.id);
      if (!result.success) {
        socket.emit('error_message', { message: result.reason || 'Permission denied' });
        return;
      }

      roomManager.saveRoomState(room);
      io.to(room.id).emit('seek', { currentTime: time, updatedBy: participant.username });
      io.to(room.id).emit('sync_state', room.toState());
    });

    // 6. Playback Controls - Change Video
    socket.on(
      'change_video',
      ({ roomId, videoId, videoTitle }: { roomId: string; videoId: string; videoTitle?: string }) => {
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        const participant = room.getParticipantBySocket(socket.id);
        if (!participant) return;

        const cleanId = extractYouTubeId(videoId);
        if (!cleanId) {
          socket.emit('error_message', { message: 'Invalid YouTube URL or Video ID' });
          return;
        }

        const result = room.updatePlaybackState(
          { videoId: cleanId, videoTitle: videoTitle || 'YouTube Video' },
          participant.id
        );

        if (!result.success) {
          socket.emit('error_message', { message: result.reason || 'Permission denied' });
          return;
        }

        roomManager.saveRoomState(room);
        io.to(room.id).emit('change_video', { videoId: cleanId, videoTitle: room.videoTitle });
        io.to(room.id).emit('sync_state', room.toState());
      }
    );

    // 7. Role Management - Assign Role
    socket.on(
      'assign_role',
      ({ roomId, targetUserId, role }: { roomId: string; targetUserId: string; role: UserRole }) => {
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        const requester = room.getParticipantBySocket(socket.id);
        if (!requester) return;

        const success = room.assignRole(targetUserId, role, requester.id);
        if (!success) {
          socket.emit('error_message', { message: 'Failed to assign role. Host permission required.' });
          return;
        }

        const target = room.getParticipant(targetUserId);
        roomManager.saveRoomState(room);

        io.to(room.id).emit('role_assigned', {
          userId: targetUserId,
          username: target?.username || 'User',
          role,
          participants: room.toState().participants,
        });

        io.to(room.id).emit('sync_state', room.toState());
      }
    );

    // 8. Role Management - Remove Participant (Kick)
    socket.on('remove_participant', ({ roomId, targetUserId }: { roomId: string; targetUserId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const requester = room.getParticipantBySocket(socket.id);
      if (!requester || requester.role !== 'host') {
        socket.emit('error_message', { message: 'Only Host can remove participants' });
        return;
      }

      const target = room.getParticipant(targetUserId);
      if (!target) return;

      const targetSocketId = target.socketId;
      roomManager.removeParticipantFromRoom(room.id, targetUserId);

      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('kicked', { message: 'You were removed from the room by Host' });
          targetSocket.leave(room.id);
        }
      }

      io.to(room.id).emit('participant_removed', {
        userId: targetUserId,
        participants: room.toState().participants,
      });

      io.to(room.id).emit('sync_state', room.toState());
    });

    // 9. Role Management - Transfer Host
    socket.on('transfer_host', ({ roomId, targetUserId }: { roomId: string; targetUserId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const requester = room.getParticipantBySocket(socket.id);
      if (!requester) return;

      const success = room.setHost(targetUserId, requester.id);
      if (!success) {
        socket.emit('error_message', { message: 'Only current Host can transfer host status' });
        return;
      }

      roomManager.saveRoomState(room);
      io.to(room.id).emit('sync_state', room.toState());
    });

    // 10. Participant Request Flow
    socket.on(
      'request_change',
      ({
        roomId,
        type,
        payload,
      }: {
        roomId: string;
        type: RequestType;
        payload: { videoId?: string; videoTitle?: string; time?: number; role?: UserRole };
      }) => {
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        const requester = room.getParticipantBySocket(socket.id);
        if (!requester) return;

        // If video change request, validate YouTube URL/ID
        if (type === 'change_video' && payload.videoId) {
          const cleanId = extractYouTubeId(payload.videoId);
          if (!cleanId) {
            socket.emit('error_message', { message: 'Invalid YouTube URL/ID in request' });
            return;
          }
          payload.videoId = cleanId;
        }

        const changeReq = room.createChangeRequest(requester.id, type, payload);
        if (!changeReq) return;

        roomManager.saveRoomState(room);
        io.to(room.id).emit('change_requested', changeReq.toJSON());
        io.to(room.id).emit('sync_state', room.toState());
      }
    );

    // 11. Host/Moderator Approval / Rejection of Request
    socket.on(
      'respond_request',
      ({ roomId, requestId, approved }: { roomId: string; requestId: string; approved: boolean }) => {
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        const resolver = room.getParticipantBySocket(socket.id);
        if (!resolver) return;

        const result = room.resolveChangeRequest(requestId, approved, resolver.id);
        if (!result.success) {
          socket.emit('error_message', { message: result.reason || 'Failed to process request' });
          return;
        }

        roomManager.saveRoomState(room);
        io.to(room.id).emit('request_resolved', { requestId, approved, resolvedBy: resolver.username });
        io.to(room.id).emit('sync_state', room.toState());
      }
    );

    // 12. Chat Messages
    socket.on('send_message', ({ roomId, text }: { roomId: string; text: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room || !text || text.trim() === '') return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) return;

      const msg = room.addChatMessage(participant.id, text.trim(), 'chat');
      roomManager.saveRoomState(room);

      io.to(room.id).emit('chat_message', msg);
    });

    // 13. Emoji Reactions
    socket.on('send_reaction', ({ roomId, emoji }: { roomId: string; emoji: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) return;

      io.to(room.id).emit('reaction', {
        id: `react_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: participant.id,
        username: participant.username,
        emoji,
        timestamp: Date.now(),
      });
    });

    // 14. Disconnect Handling
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      const result = roomManager.handleDisconnect(socket.id);
      if (result && result.room) {
        io.to(result.room.id).emit('user_left', {
          username: result.participant?.username || 'User',
          userId: result.participant?.id,
          participants: result.room.toState().participants,
        });
        io.to(result.room.id).emit('sync_state', result.room.toState());
      }
    });
  });
}
