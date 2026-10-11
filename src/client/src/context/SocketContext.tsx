import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { RoomState, UserRole, RequestType, ReactionPayload, ChatMessage, ChangeRequestData, ParticipantData } from '../../../shared/types';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  roomState: RoomState | null;
  stateReceivedAt: number;
  userId: string;
  username: string;
  userRole: UserRole;
  roomId: string;
  reactions: ReactionPayload[];
  errorMessage: string | null;
  setCustomErrorMessage: (msg: string) => void;
  joinRoom: (roomId: string, username: string, options?: any) => void;
  leaveRoom: () => void;
  endRoom: () => void;
  playVideo: (time?: number) => void;
  pauseVideo: (time?: number) => void;
  seekVideo: (time: number) => void;
  changeVideo: (videoId: string, videoTitle?: string) => void;
  assignRole: (targetUserId: string, role: UserRole) => void;
  removeParticipant: (targetUserId: string) => void;
  transferHost: (targetUserId: string) => void;
  requestChange: (type: RequestType, payload: { videoId?: string; videoTitle?: string; time?: number; role?: UserRole }) => void;
  respondRequest: (requestId: string, approved: boolean) => void;
  sendMessage: (text: string) => void;
  sendReaction: (emoji: string) => void;
  addToPlaylist: (videoId: string, title: string) => void;
  votePlaylist: (itemId: string) => void;
  removeFromPlaylist: (itemId: string) => void;
  playPlaylistItem: (itemId: string) => void;
  playNext: () => void;
  clearErrorMessage: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [stateReceivedAt, setStateReceivedAt] = useState<number>(Date.now());
  
  const userId = user?.id || '';
  const username = user?.displayName || '';

  const [userRole, setUserRole] = useState<UserRole>('participant');
  const [roomId, setRoomId] = useState<string>('');
  const [reactions, setReactions] = useState<ReactionPayload[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    // Determine WebSocket host based on current environment
    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', newSocket.id);
    });

    newSocket.on('sync_state', (state: RoomState) => {
      setRoomState(state);
      setStateReceivedAt(Date.now());
      setRoomId(state.id);

      // Find self role
      const me = state.participants.find((p: ParticipantData) => p.id === userId);
      if (me) {
        setUserRole(me.role);
      } else if (state.status === 'ended') {
        setUserRole('viewer');
      }
    });

    newSocket.on('user_info', ({ userId: myId, role }: { userId: string; role: UserRole }) => {
      setUserRole(role);
    });

    newSocket.on('play', ({ currentTime, socketId }: { currentTime: number; socketId?: string }) => {
      if (socketId && socketId === newSocket.id) return;
      setRoomState((prev: RoomState | null) => {
        if (!prev) return null;
        return {
          ...prev,
          playState: 'playing',
          currentTime,
          lastUpdated: Date.now()
        };
      });
      setStateReceivedAt(Date.now());
    });

    newSocket.on('pause', ({ currentTime, socketId }: { currentTime: number; socketId?: string }) => {
      if (socketId && socketId === newSocket.id) return;
      setRoomState((prev: RoomState | null) => {
        if (!prev) return null;
        return {
          ...prev,
          playState: 'paused',
          currentTime,
          lastUpdated: Date.now()
        };
      });
      setStateReceivedAt(Date.now());
    });

    newSocket.on('seek', ({ currentTime, socketId }: { currentTime: number; socketId?: string }) => {
      if (socketId && socketId === newSocket.id) return;
      setRoomState((prev: RoomState | null) => {
        if (!prev) return null;
        return {
          ...prev,
          currentTime,
          lastUpdated: Date.now()
        };
      });
      setStateReceivedAt(Date.now());
    });

    newSocket.on('chat_message', (msg: ChatMessage) => {
      setRoomState((prev: RoomState | null) => {
        if (!prev) return null;
        return {
          ...prev,
          chatMessages: [...prev.chatMessages, msg],
        };
      });
    });

    newSocket.on('change_requested', (req: ChangeRequestData) => {
      setRoomState((prev: RoomState | null) => {
        if (!prev) return null;
        return {
          ...prev,
          requests: [...prev.requests, req],
        };
      });
    });

    newSocket.on('reaction', (reaction: ReactionPayload) => {
      setReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3000);
    });

    newSocket.on('kicked', ({ message }: { message: string }) => {
      setErrorMessage(message);
      setRoomState(null);
      setRoomId('');
    });

    newSocket.on('room_ended', ({ message }: { message?: string }) => {
      setErrorMessage(message || 'The live stream has ended. The recorded replay is now available.');
      setRoomState(prev => prev ? { ...prev, status: 'ended', playState: 'paused' } : null);
      setUserRole('viewer');
    });

    newSocket.on('error_message', ({ message }: { message: string }) => {
      setErrorMessage(message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token, userId, username]);

  const joinRoom = (rId: string, name: string, options?: any) => {
    if (!socket) return;
    const trimmedRoom = rId.trim().toUpperCase();
    const trimmedName = name.trim();

    socket.emit('join_room', { roomId: trimmedRoom, username: trimmedName, userId, ...options });
  };

  useEffect(() => {
    if (!socket || !roomId || !username) return;

    const onConnect = () => {
      console.log('[Socket] Reconnected, rejoining room:', roomId);
      socket.emit('join_room', { roomId, username, userId });
    };

    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, roomId, username, userId]);

  const leaveRoom = () => {
    if (!socket || !roomId) return;
    socket.emit('leave_room', { roomId });
    setRoomState(null);
    setRoomId('');
  };

  const endRoom = () => {
    if (!socket || !roomId) return;
    socket.emit('end_room', { roomId });
    setRoomState(null);
    setRoomId('');
  };

  const playVideo = (time?: number) => {
    if (!socket || !roomId) return;
    setRoomState(prev => prev ? {
      ...prev,
      playState: 'playing',
      currentTime: time !== undefined ? time : prev.currentTime,
      lastUpdated: Date.now()
    } : null);
    setStateReceivedAt(Date.now());
    socket.emit('play', { roomId, time });
  };

  const pauseVideo = (time?: number) => {
    if (!socket || !roomId) return;
    setRoomState(prev => prev ? {
      ...prev,
      playState: 'paused',
      currentTime: time !== undefined ? time : prev.currentTime,
      lastUpdated: Date.now()
    } : null);
    setStateReceivedAt(Date.now());
    socket.emit('pause', { roomId, time });
  };

  const seekVideo = (time: number) => {
    if (!socket || !roomId) return;
    setRoomState(prev => prev ? {
      ...prev,
      currentTime: time,
      lastUpdated: Date.now()
    } : null);
    setStateReceivedAt(Date.now());
    socket.emit('seek', { roomId, time });
  };

  const changeVideo = (videoId: string, videoTitle?: string) => {
    if (!socket || !roomId) return;
    socket.emit('change_video', { roomId, videoId, videoTitle });
  };

  const assignRole = (targetUserId: string, role: UserRole) => {
    if (!socket || !roomId) return;
    socket.emit('assign_role', { roomId, targetUserId, role });
  };

  const removeParticipant = (targetUserId: string) => {
    if (!socket || !roomId) return;
    socket.emit('remove_participant', { roomId, targetUserId });
  };

  const transferHost = (targetUserId: string) => {
    if (!socket || !roomId) return;
    socket.emit('transfer_host', { roomId, targetUserId });
  };

  const requestChange = (
    type: RequestType,
    payload: { videoId?: string; videoTitle?: string; time?: number; role?: UserRole }
  ) => {
    if (!socket || !roomId) return;
    socket.emit('request_change', { roomId, type, payload });
  };

  const respondRequest = (requestId: string, approved: boolean) => {
    if (!socket || !roomId) return;
    socket.emit('respond_request', { roomId, requestId, approved });
  };

  const sendMessage = (text: string) => {
    if (!socket || !roomId) return;
    socket.emit('send_message', { roomId, text });
  };

  const addToPlaylist = (videoId: string, title: string) => {
    if (socket && roomId) {
      socket.emit('add_to_playlist', { roomId, videoId, title });
    }
  };

  const votePlaylist = (itemId: string) => {
    if (socket && roomId) {
      socket.emit('vote_playlist', { roomId, itemId });
    }
  };

  const removeFromPlaylist = (itemId: string) => {
    if (socket && roomId) {
      socket.emit('remove_from_playlist', { roomId, itemId });
    }
  };

  const playPlaylistItem = (itemId: string) => {
    if (socket && roomId) {
      socket.emit('play_playlist_item', { roomId, itemId });
    }
  };

  const playNext = () => {
    if (socket && roomId) {
      socket.emit('play_next', { roomId });
    }
  };

  const sendReaction = (emoji: string) => {
    if (!socket || !roomId) return;
    socket.emit('send_reaction', { roomId, emoji });
  };

  const clearErrorMessage = () => setErrorMessage(null);
  const setCustomErrorMessage = (msg: string) => setErrorMessage(msg);

  return (
    <SocketContext.Provider
      value={{
        socket,
        roomState,
        stateReceivedAt,
        userId,
        username,
        userRole,
        roomId,
        reactions,
        errorMessage,
        setCustomErrorMessage,
        joinRoom,
        leaveRoom,
        endRoom,
        playVideo,
        pauseVideo,
        seekVideo,
        changeVideo,
        assignRole,
        removeParticipant,
        transferHost,
        requestChange,
        respondRequest,
        sendMessage,
        sendReaction, addToPlaylist, votePlaylist, removeFromPlaylist, playPlaylistItem, playNext,
        clearErrorMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
