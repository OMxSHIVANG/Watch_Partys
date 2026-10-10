import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import { RoomJoin } from './components/RoomJoin';
import { VideoPlayer } from './components/VideoPlayer';
import { Controls } from './components/Controls';
import { LiveHostInfo } from './components/LiveHostInfo';
import { ParticipantList } from './components/ParticipantList';
import { Chat } from './components/Chat';
import { Playlist } from './components/Playlist';
import { RecentVideos } from './components/RecentVideos';
import { RequestApprovalModal } from './components/RequestApprovalModal';
import { EmojiReactions } from './components/EmojiReactions';
import { AlertCircle, X, Loader2, MessageSquare, Users } from 'lucide-react';
import { ProfilePage } from './components/ProfilePage';
import { ReplayPage } from './components/ReplayPage';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

/* ── Inner app (requires auth) ─────────────────────────────────────────── */
const WatchPartyContent: React.FC = () => {
  const { roomId, roomState, errorMessage, clearErrorMessage, userRole } = useSocket();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden relative">
      <Navbar />

      {/* Error Toast */}
      {errorMessage && (
        <div className="fixed top-16 right-4 z-50 bg-rose-950/90 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md max-w-md">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="text-xs font-semibold flex-1">{errorMessage}</span>
          <button onClick={clearErrorMessage} className="p-1 hover:bg-rose-900/50 rounded-lg transition-colors text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {roomId && roomState ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="relative">
                <VideoPlayer />
                <EmojiReactions />
              </div>
              <Controls />
              <LiveHostInfo />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[300px]">
                <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-xl bg-slate-900/50">
                  <Playlist />
                </div>
                <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-xl bg-slate-900/50">
                  <RecentVideos />
                </div>
              </div>

              
              {/* Mobile toggle button - ONLY for participants if user is Host/Mod */}
              {(userRole === 'host' || userRole === 'moderator') && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg transition-all"
                >
                  <Users className="w-5 h-5 text-rose-400" />
                  View Participants
                </button>
              )}
            </div>

            {/* Mobile Drawer ONLY for Participant List (Host/Mod only) */}
            {(userRole === 'host' || userRole === 'moderator') && (
              <>
                {isSidebarOpen && (
                  <div 
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                  />
                )}
                <div className={`
                  fixed inset-y-0 right-0 z-50 w-[85vw] sm:w-[400px] bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl p-4 overflow-y-auto transform transition-transform duration-300 ease-in-out
                  lg:hidden
                  ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
                `}>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-rose-500" />
                      Participants
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-slate-900 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-800">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="h-[calc(100vh-100px)]">
                    <ParticipantList />
                  </div>
                </div>
              </>
            )}

            {/* Right Column (Desktop Participants + Universal Chat) */}
            <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
              {(userRole === 'host' || userRole === 'moderator') && (
                <div className="hidden lg:block h-[300px] shrink-0">
                  <ParticipantList />
                </div>
              )}
              
              {/* Chat is ALWAYS visible inline on both mobile and desktop! */}
              {/* Dynamic height: 90vh for viewers, but subtract 324px (300px list + 24px gap) for hosts so it does not overflow */}
              <div className={`w-full h-[30vh] shrink-0 overflow-hidden ${(userRole === "host" || userRole === "moderator") ? "md:h-[calc(90vh-324px)]" : "md:h-[90vh]"}`}>
                <Chat />
              </div>
            </div>

            <RequestApprovalModal />
          </div>
        ) : (
          <RoomJoin />
        )}
      </main>
    </div>
  );
};

/* ── Auth gate ─────────────────────────────────────────────────────────── */
const AppGate: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg">
            <span className="text-2xl">📺</span>
          </div>
          <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading WatchParty…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WatchPartyContent />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/replay/:roomId" element={<ReplayPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
};

/* ── Root ──────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
