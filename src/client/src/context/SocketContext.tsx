import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { RoomState, UserRole, RequestType, ReactionPayload, ChatMessage, ChangeRequestData, ParticipantData } from '../../../shared/types';

interface SocketContextType {
  socket: Socket | null;
  roomState: RoomState | null;
  userId: string;
  username: string;
  userRole: UserRole;
  roomId: string;
  reactions: ReactionPayload[];
  errorMessage: string | null;
  joinRoom: (roomId: string, username: string) => void;
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
  clearErrorMessage: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('watchparty_userId') || `user_${Math.random().toString(36).substring(2, 9)}`;
  });
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('watchparty_username') || '';
  });
  const [userRole, setUserRole] = useState<UserRole>('participant');
  const [roomId, setRoomId] = useState<string>('');
  const [reactions, setReactions] = useState<ReactionPayload[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('watchparty_userId', userId);
  }, [userId]);

  useEffect(() => {
    // Determine WebSocket host based on current environment
    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', newSocket.id);
    });

    newSocket.on('sync_state', (state: RoomState) => {
      setRoomState(state);
      setRoomId(state.id);

      // Find self role
      const me = state.participants.find((p: ParticipantData) => p.id === userId);
      if (me) {
        setUserRole(me.role);
      }
    });

    newSocket.on('user_info', ({ userId: myId, role }: { userId: string; role: UserRole }) => {
      setUserId(myId);
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
  }, []);

  const joinRoom = (rId: string, name: string) => {
    if (!socket) return;
    const trimmedRoom = rId.trim().toUpperCase();
    const trimmedName = name.trim();
    setUsername(trimmedName);
    localStorage.setItem('watchparty_username', trimmedName);

    socket.emit('join_room', { roomId: trimmedRoom, username: trimmedName, userId });
  };

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

  const sendReaction = (emoji: string) => {
    if (!socket || !roomId) return;
    socket.emit('send_reaction', { roomId, emoji });
  };

  const clearErrorMessage = () => setErrorMessage(null);

  return (
    <SocketContext.Provider
      value={{
        socket,
        roomState,
        userId,
        username,
        userRole,
        roomId,
        reactions,
        errorMessage,
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
        sendReaction,
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
