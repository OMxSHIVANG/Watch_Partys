import React from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Navbar } from './components/Navbar';
import { RoomJoin } from './components/RoomJoin';
import { VideoPlayer } from './components/VideoPlayer';
import { Controls } from './components/Controls';
import { ParticipantList } from './components/ParticipantList';
import { Chat } from './components/Chat';
import { RequestApprovalModal } from './components/RequestApprovalModal';
import { EmojiReactions } from './components/EmojiReactions';
import { AlertCircle, X } from 'lucide-react';

const WatchPartyContent: React.FC = () => {
  const { roomId, roomState, errorMessage, clearErrorMessage } = useSocket();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-16 right-4 z-50 bg-rose-950/90 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-fade-in max-w-md">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="text-xs font-semibold flex-1">{errorMessage}</span>
          <button
            onClick={clearErrorMessage}
            className="p-1 hover:bg-rose-900/50 rounded-lg transition-colors text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content Router */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {roomId && roomState ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Video Player & Playback Controls (2 Cols on LG) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="relative">
                <VideoPlayer />
                <EmojiReactions />
              </div>
              <Controls />
            </div>

            {/* Right Column: Participant List & Room Chat (1 Col on LG) */}
            <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
              <div className="h-[300px]">
                <ParticipantList />
              </div>
              <div className="h-[400px]">
                <Chat />
              </div>
            </div>

            {/* Approval Modal Drawer */}
            <RequestApprovalModal />
          </div>
        ) : (
          <RoomJoin />
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <SocketProvider>
      <WatchPartyContent />
    </SocketProvider>
  );
}
