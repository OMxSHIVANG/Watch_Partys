import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { RoomState, UserRole, RequestType, ReactionPayload, ChatMessage, ChangeRequestData, ParticipantData } from '../../../shared/types';

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
  playVideo: () => void;
  pauseVideo: () => void;
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

import { useAuth } from './AuthContext';

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
      // If the room has ended (e.g., host left), force leave
      if (state.status === 'ended') {
         setRoomState(null);
         setRoomId('');
         setUserRole('viewer');
         alert('The host has left and the Watch Party has ended.');
         return;
      }
      setRoomState(state);
      setStateReceivedAt(Date.now());
      setRoomId(state.id);

      // Find self role
      const me = state.participants.find((p: ParticipantData) => p.id === userId);
      if (me) {
        setUserRole(me.role);
      }
    });

    newSocket.on('user_info', ({ userId: myId, role }: { userId: string; role: UserRole }) => {
      setUserRole(role);
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

  const playVideo = () => {
    if (!socket || !roomId) return;
    socket.emit('play', { roomId });
  };

  const pauseVideo = () => {
    if (!socket || !roomId) return;
    socket.emit('pause', { roomId });
  };

  const seekVideo = (time: number) => {
    if (!socket || !roomId) return;
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
