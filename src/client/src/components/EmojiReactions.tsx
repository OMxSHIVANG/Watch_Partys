import React from 'react';
import { useSocket } from '../context/SocketContext';

export const EmojiReactions: React.FC = () => {
  const { reactions } = useSocket();

  if (reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {reactions.map((r, index) => {
        // Randomize horizontal positioning across screen
        const leftPercent = 15 + (index * 23) % 70;

        return (
          <div
            key={r.id}
            style={{ left: `${leftPercent}%` }}
            className="absolute bottom-10 flex flex-col items-center animate-floatUp"
          >
            <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
            <span className="text-[10px] font-bold bg-slate-900/90 text-slate-200 border border-slate-700/80 px-2 py-0.5 rounded-full shadow-md mt-1">
              {r.username}
            </span>
          </div>
        );
      })}
    </div>
  );
};
