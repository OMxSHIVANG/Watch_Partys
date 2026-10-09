import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { RoleBadge } from './RoleBadge';
import { ChatMessage } from '../../../shared/types';
import { MessageSquare, Send, Smile } from 'lucide-react';

const REACTION_EMOJIS = ['🔥', '👍', '👏', '😂', '❤️', '😮', '🎉'];

export const Chat: React.FC = () => {
  const { roomState, sendMessage, sendReaction, userId } = useSocket();
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = roomState?.chatMessages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col h-full min-h-[350px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-slate-200">Room Chat</h3>
        </div>

        {/* Emoji Reactions Toolbar */}
        <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-1">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-xs p-1 hover:bg-slate-800 rounded transition-transform hover:scale-125 active:scale-95"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-xs">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 py-8">No chat messages yet. Say hello! 👋</div>
        ) : (
          messages.map((msg: ChatMessage) => {
            const isMe = msg.userId === userId;
            const isSystem = msg.type === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center py-1">
                  <span className="bg-slate-900/90 text-slate-400 border border-slate-800/80 px-2.5 py-1 rounded-full text-[11px] inline-block">
                    ⚡ {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">{msg.username}</span>
                  <RoleBadge role={msg.userRole} showIcon={false} />
                  <span>{formatTime(msg.timestamp)}</span>
                </div>

                <div
                  className={`px-3 py-2 rounded-2xl max-w-[85%] break-words shadow-sm ${
                    isMe
                      ? 'bg-rose-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSend} className="pt-2 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a chat message..."
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
        />
        <button
          type="submit"
          className="bg-rose-600 hover:bg-rose-500 text-white p-2 rounded-xl transition-all shadow-md shadow-rose-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
