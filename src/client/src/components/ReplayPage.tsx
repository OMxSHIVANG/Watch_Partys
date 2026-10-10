import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Calendar, Users, Heart, History } from 'lucide-react';
import ReactPlayer from 'react-player';

interface RoomHistory {
  id: string;
  name: string;
  description: string;
  videoId: string;
  videoTitle?: string;
  startedAt: number;
  endedAt?: number;
  participantCount: number;
  likes: string[];
  hostId: string;
  hostUsername: string;
  hostAvatar?: string;
}

export const ReplayPage: React.FC = () => {
  const { roomId } = useParams();
  const [room, setRoom] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const playerRef = React.useRef<any>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  useEffect(() => {
    const fetchReplay = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/replay`);
        if (res.ok) {
          const data = await res.json();
          setRoom(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    if (roomId) fetchReplay();
  }, [roomId]);

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!room) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white"><h2 className="text-2xl font-bold mb-4">Stream Not Found</h2><Link to="/" className="text-rose-400 hover:underline">Go Home</Link></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl mb-6 flex items-center justify-between">
        <Link to={`/profile/${room.hostId}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <ChevronLeft className="w-4 h-4" /> Back to Profile
        </Link>
      </div>
      
      <div className="w-full max-w-5xl">
        <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 mb-6 pointer-events-none relative group">
          <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 flex flex-col justify-end p-4 pointer-events-auto">
            {/* Overlay to intercept clicks but allow custom controls if needed */}
          </div>
          <ReactPlayer 
            ref={playerRef}
            src={`https://www.youtube.com/watch?v=${room.videoId}`}
            width="100%"
            height="100%"
            playing={true}
            controls={true}
            config={{
              youtube: {
                start: room.segments && room.segments.length > 0 ? Math.floor(room.segments[0].start) : 0,
                
              }
            }}
            onReady={() => {
              if (room.segments && room.segments.length > 0) {
                 playerRef.current?.seekTo(room.segments[0].start, 'seconds');
              }
            }}
            onTimeUpdate={(e: any) => {
              const playedSeconds = e.target.currentTime;
              if (!room.segments || room.segments.length === 0) return;
              const currentSegment = room.segments[currentSegmentIndex];
              if (!currentSegment) return;
              
              if (playedSeconds > currentSegment.end) {
                if (currentSegmentIndex < room.segments.length - 1) {
                  const nextIndex = currentSegmentIndex + 1;
                  setCurrentSegmentIndex(nextIndex);
                  playerRef.current?.seekTo(room.segments[nextIndex].start, 'seconds');
                } else {
                  // End of all segments
                  playerRef.current?.getInternalPlayer()?.pauseVideo();
                }
              } else if (playedSeconds < currentSegment.start - 2) {
                // Prevent seeking backwards outside segment
                playerRef.current?.seekTo(currentSegment.start, 'seconds');
              }
            }}
          />
        </div>
        
        <div className="mb-6 flex flex-col gap-2">
           <div className="flex items-center gap-3">
             <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{room.name}</h1>
             <span className="flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
               <History className="w-3 h-3" /> Replay
             </span>
           </div>
           {room.purpose && <div className="text-rose-400 font-bold text-sm tracking-wide">{room.purpose}</div>}
           <p className="text-slate-400 text-sm">{room.description || room.videoTitle}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-t border-slate-800/50 pt-6">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
               {room.hostAvatar ? (
                 <img src={room.hostAvatar} className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center font-bold text-white bg-slate-700">
                   {room.hostUsername.substring(0,2).toUpperCase()}
                 </div>
               )}
             </div>
             <div>
               <Link to={`/profile/${room.hostId}`} className="font-bold text-white hover:text-rose-400 block leading-tight">{room.hostUsername}</Link>
               <span className="text-xs text-slate-500 font-medium bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Host</span>
             </div>
           </div>
           
           <div className="flex items-center gap-6">
             <div className="text-center">
               <div className="flex items-center justify-center gap-1.5 text-slate-300 font-bold mb-1">
                 <Heart className="w-4 h-4 text-rose-500" /> {room.likes?.length || 0}
               </div>
               <div className="text-[10px] text-slate-500 uppercase tracking-wider">Likes</div>
             </div>
             <div className="text-center">
               <div className="flex items-center justify-center gap-1.5 text-slate-300 font-bold mb-1">
                 <Users className="w-4 h-4 text-blue-400" /> {room.participantCount || 0}
               </div>
               <div className="text-[10px] text-slate-500 uppercase tracking-wider">Peak Viewers</div>
             </div>
             <div className="text-center">
               <div className="flex items-center justify-center gap-1.5 text-slate-300 font-bold mb-1">
                 <Calendar className="w-4 h-4 text-emerald-400" /> {new Date(room.startedAt).toLocaleDateString()}
               </div>
               <div className="text-[10px] text-slate-500 uppercase tracking-wider">Streamed On</div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
