import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { RoleBadge } from './RoleBadge';
import { ChatMessage } from '../../../shared/types';
import { MessageSquare, Send, Smile } from 'lucide-react';

const REACTION_EMOJIS = ['🔥', '👍', '👏', '😂', '❤️', '😮', '🎉'];

export const Chat: React.FC = () => {
  const { roomState, sendMessage, sendReaction, userId } = useSocket();
  const [text, setText] = useState('');
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const messages = roomState?.chatMessages || [];

  // Determine if we should auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If we are more than 50px away from the bottom, pause auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAutoScrollPaused(!isNearBottom);
  };

  const scrollToBottom = (force = false) => {
    if (containerRef.current) {
      if (force || !isAutoScrollPaused) {
        // Use a small timeout to let React render the DOM first
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
          }
        }, 50);
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
    // Force scroll to bottom when user sends a message
    setIsAutoScrollPaused(false);
    scrollToBottom(true);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col h-full ">
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
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-2 space-y-0.5 pr-2">
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
              <div key={msg.id} className="flex items-start gap-2 py-1 px-2 hover:bg-slate-800/50 -mx-2 rounded transition-colors">
                <div className="flex-none pt-0.5">
                  <span className="text-[9px] text-slate-500">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="flex-1 break-words leading-relaxed text-[13px]">
                  <span className={`font-semibold mr-1.5 ${isMe ? 'text-rose-400' : 'text-slate-300'}`}>
                    {msg.username}
                  </span>
                  <span className="inline-block translate-y-[2px] mr-1.5">
                    <RoleBadge role={msg.userRole} showIcon={false} />
                  </span>
                  <span className="text-slate-100">
                    {msg.text}
                  </span>
                </div>
              </div>
            );
          })
        )}
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
