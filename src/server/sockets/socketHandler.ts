import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { RoomManager } from '../models/RoomManager';
import { extractYouTubeId } from '../../shared/youtube';
import { RequestType, UserRole } from '../../shared/types';
import { getJwtSecret } from '../auth/authRouter';

export function setupSocketHandlers(io: Server, roomManager: RoomManager): void {
  // Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; email: string };
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {

    // 1. Join Room
    socket.on('join_room', (data: any) => {
      const { roomId, username, password, name, description, thumbnail, isPublic, participantLimit, videoId } = data;
      if (!roomId || !username) {
        socket.emit('error_message', { message: 'Room ID and Username are required' });
        return;
      }

      const effectiveUserId = socket.data.userId;
      const options = { password, name, description, thumbnail, isPublic, participantLimit, videoId };
      const result = roomManager.joinRoom(roomId, effectiveUserId, socket.id, username, options);
      if (!result.success || !result.room || !result.participant) {
        socket.emit('error_message', { message: result.reason || 'Failed to join room' });
        return;
      }

      const { room, participant } = result;

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
        if (participant.role === 'host') {
          // If the host leaves, the live stream ends and recording is available
          room.status = 'ended';
          room.finalizeSegments();
          room.endedAt = Date.now();
          room.playState = 'paused';
          room.addChatMessage('system', 'Host left. Live stream has ended. Recording is available.', 'system');

          roomManager.saveRoomState(room);
          io.to(room.id).emit('room_ended', {
            message: 'Host left. The live stream has ended. Recording is available.',
            roomId: room.id,
          });
          io.to(room.id).emit('sync_state', room.toState());
          socket.leave(room.id);
          return;
        }

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

    // 2.5 End Room (Explicit host action)
    socket.on('end_room', ({ roomId }: { roomId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant || participant.role !== 'host') {
        socket.emit('error_message', { message: 'Only the host can end the Watch Party' });
        return;
      }

      room.status = 'ended';
      room.finalizeSegments();
      room.endedAt = Date.now();
      room.playState = 'paused';
      room.addChatMessage('system', 'Host ended the live stream. Recording is available.', 'system');

      roomManager.saveRoomState(room);
      io.to(room.id).emit('room_ended', {
        message: 'The host has ended this live stream. Recording is available.',
        roomId: room.id,
      });
      io.to(room.id).emit('sync_state', room.toState());
      socket.leave(room.id);
    });

    // 3. Playback Controls - Play
    socket.on('play', ({ roomId, time }: { roomId: string; time?: number }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) return;

      const updateData: any = { playState: 'playing' };
      if (typeof time === 'number' && !isNaN(time) && time >= 0) {
        updateData.currentTime = time;
      }

      const result = room.updatePlaybackState(updateData, participant.id);
      if (!result.success) {
        socket.emit('error_message', { message: result.reason || 'Permission denied' });
        return;
      }

      roomManager.saveRoomState(room);
      const state = room.toState();
      socket.to(room.id).emit('play', { currentTime: state.currentTime, updatedBy: participant.username, socketId: socket.id });
      io.to(room.id).emit('sync_state', state);
    });

    // 4. Playback Controls - Pause
    socket.on('pause', ({ roomId, time }: { roomId: string; time?: number }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) return;

      const updateData: any = { playState: 'paused' };
      if (typeof time === 'number' && !isNaN(time) && time >= 0) {
        updateData.currentTime = time;
      }

      const result = room.updatePlaybackState(updateData, participant.id);
      if (!result.success) {
        socket.emit('error_message', { message: result.reason || 'Permission denied' });
        return;
      }

      roomManager.saveRoomState(room);
      const state = room.toState();
      socket.to(room.id).emit('pause', { currentTime: state.currentTime, updatedBy: participant.username, socketId: socket.id });
      io.to(room.id).emit('sync_state', state);
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
      const state = room.toState();
      socket.to(room.id).emit('seek', { currentTime: time, updatedBy: participant.username, socketId: socket.id });
      io.to(room.id).emit('sync_state', state);
    });

    // 6. Playback Controls - Change Video
    socket.on(
      'change_video',
      ({ roomId, videoId, videoTitle }: { roomId: string; videoId: string; videoTitle?: string }) => {
        const room = roomManager.getRoom(roomId);
        if (!room) return;

        const participant = room.getParticipantBySocket(socket.id);
        if (!participant) { 
          return; 
        }

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
    
    
    socket.on('add_to_playlist', ({ roomId, videoId, title }: { roomId: string; videoId: string; title: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;
      const participant = room.participants.get(socket.data.userId);
      if (!participant) return;

      const newItem = {
        id: Math.random().toString(36).substring(2, 9),
        videoId,
        title,
        addedBy: { userId: participant.id, username: participant.username },
        votes: [participant.id],
        createdAt: Date.now()
      };
      room.playlist.push(newItem);
      
      // Sort by votes (descending), then time (ascending)
      room.playlist.sort((a, b) => {
        if (b.votes.length !== a.votes.length) return b.votes.length - a.votes.length;
        return a.createdAt - b.createdAt;
      });
      
      io.to(roomId).emit('sync_state', room.toState());
      roomManager.saveRoomState(room);
    });

    socket.on('vote_playlist', ({ roomId, itemId }: { roomId: string; itemId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;
      
      const item = room.playlist.find(i => i.id === itemId);
      if (!item) return;

      const userId = socket.data.userId;
      const voteIndex = item.votes.indexOf(userId);
      if (voteIndex === -1) {
        item.votes.push(userId); // Add vote
      } else {
        item.votes.splice(voteIndex, 1); // Remove vote
      }

      // Resort playlist
      room.playlist.sort((a, b) => {
        if (b.votes.length !== a.votes.length) return b.votes.length - a.votes.length;
        return a.createdAt - b.createdAt;
      });

      io.to(roomId).emit('sync_state', room.toState());
      roomManager.saveRoomState(room);
    });

    socket.on('reorder_playlist', ({ roomId, newPlaylist }: { roomId: string; newPlaylist: any[] }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;
      const p = room.participants.get(socket.data.userId);
      if (!p || p.role !== 'host') return;

      room.playlist = newPlaylist;
      io.to(roomId).emit('sync_state', room.toState());
      roomManager.saveRoomState(room);
    });

    socket.on('remove_from_playlist', ({ roomId, itemId }: { roomId: string; itemId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;
      const p = room.participants.get(socket.data.userId);
      if (!p || (p.role !== 'host' && p.role !== 'moderator')) return;

      room.playlist = room.playlist.filter(i => i.id !== itemId);
      io.to(roomId).emit('sync_state', room.toState());
      roomManager.saveRoomState(room);
    });

    socket.on('play_playlist_item', ({ roomId, itemId }: { roomId: string; itemId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;
      const p = room.participants.get(socket.data.userId);
      if (!p || (p.role !== 'host' && p.role !== 'moderator')) return;

      const itemIndex = room.playlist.findIndex(i => i.id === itemId);
      if (itemIndex === -1) return;

      const item = room.playlist[itemIndex];
      room.videoId = item.videoId;
      room.videoTitle = item.title;
      room.currentTime = 0;
      room.playState = 'playing';
      room.lastUpdated = Date.now();
      
      // Remove from playlist
      room.playlist.splice(itemIndex, 1);

      // Add to recent videos
      const recentItem = { ...item, playedAt: Date.now() };
      room.recentVideos.unshift(recentItem);
      if (room.recentVideos.length > 20) room.recentVideos.pop();

      io.to(roomId).emit('sync_state', room.toState());
      io.to(roomId).emit('change_video', { videoId: item.videoId, videoTitle: item.title });
      roomManager.saveRoomState(room);
    });

    socket.on('play_next', ({ roomId }: { roomId: string }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) return;
      const p = room.participants.get(socket.data.userId);
      if (!p || (p.role !== 'host' && p.role !== 'moderator')) return;

      if (room.playlist.length === 0) return;

      // Since playlist is always sorted by votes, index 0 is the highest voted!
      const item = room.playlist[0];
      
      room.videoId = item.videoId;
      room.videoTitle = item.title;
      room.currentTime = 0;
      room.playState = 'playing';
      room.lastUpdated = Date.now();
      
      // Remove from playlist
      room.playlist.shift();

      // Add to recent videos
      const recentItem = { ...item, playedAt: Date.now() };
      room.recentVideos.unshift(recentItem);
      if (room.recentVideos.length > 20) room.recentVideos.pop();

      io.to(roomId).emit('sync_state', room.toState());
      io.to(roomId).emit('change_video', { videoId: item.videoId, videoTitle: item.title });
      roomManager.saveRoomState(room);
    });

    socket.on('disconnect', () => {
      const result = roomManager.handleDisconnect(socket.id);
      if (result && result.room) {
        const room = result.room;
        const participant = result.participant;
        
        io.to(room.id).emit('user_left', {
          username: participant?.username || 'User',
          userId: participant?.id,
          participants: room.toState().participants,
        });
        io.to(room.id).emit('sync_state', room.toState());
        
        if (participant?.role === 'host') {
          setTimeout(() => {
            const currentRoom = roomManager.getRoom(room.id);
            if (currentRoom && currentRoom.status === 'live') {
               const p = currentRoom.getParticipant(participant.id);
               if (p && !p.isOnline) {
                  currentRoom.status = 'ended';
                  currentRoom.finalizeSegments();
                  if (!currentRoom.endedAt) currentRoom.endedAt = Date.now();
                  currentRoom.addChatMessage('system', 'Host disconnected. Watch Party ended.', 'system');
                  io.to(currentRoom.id).emit('room_ended', {
                    message: 'Host disconnected. Watch Party has ended.',
                    roomId: currentRoom.id,
                  });
                  io.to(currentRoom.id).emit('sync_state', currentRoom.toState());
                  roomManager.saveRoomState(currentRoom);
                  roomManager.evictRoom(currentRoom.id);
               }
            }
          }, 5000);
        }
      }
    });
  });
}
