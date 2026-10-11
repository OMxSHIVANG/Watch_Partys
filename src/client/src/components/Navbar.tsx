import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './RoleBadge';
import { Tv, Users, LogOut, Share2, Check, Info, Search, Radio, History, Square } from 'lucide-react';
import { RoomInfoModal } from './RoomInfoModal';

import { ParticipantData } from '../../../shared/types';

export const Navbar: React.FC = () => {
  const { roomState, roomId, userRole, leaveRoom, endRoom, username } = useSocket();
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{users: any[], rooms: any[]}>({ users: [], rooms: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults({ users: [], rooms: [] });
      setShowSearchDropdown(false);
      return;
    }
    
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowSearchDropdown(true);
        }
      } catch(e) {}
      setIsSearching(false);
    }, 400);
    
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const copyRoomLink = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const participantCount = roomState?.participants.filter((p: ParticipantData) => p.isOnline).length || 0;

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950 border-b border-slate-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-3 gap-x-2">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center shadow-md">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              WatchParty
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">Sync YouTube Video Player</p>
          </div>
        </div>

        {/* Room Info & Controls */}
        {roomId && roomState ? (
          <div className="flex flex-wrap items-center gap-3 order-last sm:order-none w-full lg:w-auto justify-between sm:justify-start mt-2 sm:mt-0">
            {/* Room Code Badge & Share */}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-400 font-medium">ROOM:</span>
              <span className="text-sm font-mono font-bold text-rose-400 tracking-wider">{roomId}</span>
              <button
                onClick={copyRoomLink}
                className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-300 hover:text-white"
                title="Copy Room Link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Active Users */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
              <Users className="w-3.5 h-3.5 text-rose-400" />
              <span>{participantCount} online</span>
            </div>

            {/* Current User & Role */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-300 font-medium max-w-[100px] truncate">{username}</span>
              <RoleBadge role={userRole} />
            </div>

            {/* Room Info Button */}
            <button
              onClick={() => setShowInfo(true)}
              className="p-1.5 bg-slate-900/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Room Information"
            >
              <Info className="w-4 h-4" />
            </button>
            
            {/* End Stream (Host) or Leave Room (Participants) */}
            {userRole === 'host' ? (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to end this live Watch Party for all viewers? It will be saved for replay.')) {
                    endRoom();
                  }
                }}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white border border-rose-500/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-950/40"
                title="End Watch Party"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>End Stream</span>
              </button>
            ) : (
              <button
                onClick={leaveRoom}
                className="flex items-center gap-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                title="Leave Watch Party"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400">Real-time YouTube Synchronization</div>
        )}

        {/* Global Search Bar */}
        <div className="flex flex-1 max-w-md mx-3 sm:mx-6 relative order-3 w-full mt-3 md:mt-0 md:order-none" ref={searchRef}>
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search users or streams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if(searchQuery.length >= 2) setShowSearchDropdown(true); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="w-3 h-3 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          {showSearchDropdown && (searchResults.users.length > 0 || searchResults.rooms.length > 0) && (
            <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[80vh] overflow-y-auto">
              {searchResults.users.length > 0 && (
                <div className="p-2 border-b border-slate-800">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Users</div>
                  {searchResults.users.map(u => (
                    <Link key={u.id} to={`/profile/${u.id}`} onClick={() => setShowSearchDropdown(false)} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-xl transition-colors">
                      {u.avatar ? (
                        <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-700 text-xs flex items-center justify-center font-bold text-white">
                          {u.displayName.substring(0,2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">{u.displayName}</div>
                        {u.username && <div className="text-xs text-slate-400">@{u.username}</div>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              
              {searchResults.rooms.length > 0 && (
                <div className="p-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Streams</div>
                  {searchResults.rooms.map(r => (
                    <Link key={r.id} to={r.status === 'live' ? `/` : `/replay/${r.id}`} onClick={() => {
                        setShowSearchDropdown(false);
                        if (r.status === 'live') {
                           navigator.clipboard.writeText(r.id);
                           alert(`Room Code ${r.id} copied! Paste on Home to join.`);
                        }
                    }} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-xl transition-colors">
                      <div className="w-16 h-10 bg-slate-800 rounded-lg overflow-hidden shrink-0 relative">
                        <img src={`https://img.youtube.com/vi/${r.videoId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-80" />
                        {r.status === 'live' ? (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Radio className="w-4 h-4 text-rose-500 animate-pulse" /></div>
                        ) : (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><History className="w-4 h-4 text-slate-300" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate leading-tight">{r.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{r.videoTitle}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User avatar + sign out — always visible when logged in */}
        {user && (
          <div className="flex items-center gap-2 sm:ml-3 sm:pl-3 sm:border-l border-slate-800 ml-auto">
            <Link 
              to={`/profile/${user.id}`} 
              className="flex items-center gap-2 hover:bg-slate-800/50 p-1.5 rounded-xl transition-colors cursor-pointer"
              title="View Profile"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.displayName} className="w-7 h-7 rounded-full border border-slate-700 object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center text-[11px] font-bold text-white shadow-md">
                  {user.displayName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="hidden md:block text-xs text-slate-300 font-medium max-w-[90px] truncate group-hover:text-white">
                {user.displayName}
              </span>
            </Link>
            <button
              onClick={() => {
                if (roomId) leaveRoom();
                logout();
              }}
              title="Sign out"
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <RoomInfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
    </header>
  );
};

