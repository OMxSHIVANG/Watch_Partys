import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize } from 'lucide-react';
import ReactPlayer from 'react-player';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const ReplayPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const playerRef = React.useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playedSeconds, setPlayedSeconds] = useState(0); 
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [muted, setMuted] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  useEffect(() => {
    const fetchReplay = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/replay`);
        if (res.ok) {
          const data = await res.json();
          setRoom(data);
        }
      } catch (err) {}
      setIsLoading(false);
    };
    fetchReplay();
  }, [roomId]);

  const [actualDuration, setActualDuration] = useState<number>(0);

  const hasMultipleVideos = useMemo(() => {
    if (!room?.segments || room.segments.length <= 1) return false;
    const firstId = room.segments[0]?.videoId;
    return room.segments.some((s: any) => s.videoId && s.videoId !== firstId);
  }, [room]);

  const totalDuration = useMemo(() => {
    if (actualDuration > 0) return actualDuration;
    if (!room) return 0;
    if (room.segments && room.segments.length > 0) {
      const sum = room.segments.reduce((acc: number, seg: any) => acc + Math.max(0, (seg.end - seg.start)), 0);
      if (sum > 0) return sum;
    }
    return room.durationWatched || 180;
  }, [room, actualDuration]);

  const currentVideoId = useMemo(() => {
    if (!room) return '';
    if (room.segments && room.segments.length > 0 && room.segments[currentSegmentIndex]?.videoId) {
      return room.segments[currentSegmentIndex].videoId;
    }
    if (room.segments && room.segments.length > 0 && room.segments[0]?.videoId) {
      return room.segments[0].videoId;
    }
    return room.videoId || '';
  }, [room, currentSegmentIndex]);

  const isSeekingRef = React.useRef(false);
  const pendingSeekTime = React.useRef<number | null>(null);

  const seekPlayer = (timeInSeconds: number) => {
    if (!playerRef.current || isNaN(timeInSeconds)) return;
    try {
      const player = playerRef.current;
      if (typeof player.seekTo === 'function') {
        player.seekTo(timeInSeconds, 'seconds');
      } else if ('currentTime' in player) {
        player.currentTime = timeInSeconds;
      }
      const internal = player.getInternalPlayer?.();
      if (internal && typeof internal.seekTo === 'function') {
        internal.seekTo(timeInSeconds, true);
      } else if (internal && 'currentTime' in internal) {
        internal.currentTime = timeInSeconds;
      }
    } catch (err) {
      console.warn('Seek error:', err);
    }
  };

  const seekToTimelineTime = (targetTime: number) => {
    if (isNaN(targetTime)) return;
    const clampedTime = Math.max(0, Math.min(totalDuration, targetTime));
    isSeekingRef.current = true;
    setPlayedSeconds(clampedTime);

    if (!hasMultipleVideos) {
      seekPlayer(clampedTime);
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 800);
      return;
    }

    let accum = 0;
    for (let i = 0; i < room.segments.length; i++) {
      const seg = room.segments[i];
      const dur = Math.max(0, seg.end - seg.start);

      if (accum + dur >= clampedTime || i === room.segments.length - 1) {
        const offsetInSegment = Math.max(0, Math.min(dur, clampedTime - accum));
        const ytTime = seg.start + offsetInSegment;

        const previousSegment = room.segments[currentSegmentIndex];
        const newSegment = seg;

        setCurrentSegmentIndex(i);

        if (previousSegment && newSegment && previousSegment.videoId && newSegment.videoId && previousSegment.videoId !== newSegment.videoId) {
          pendingSeekTime.current = ytTime;
        } else {
          seekPlayer(ytTime);
        }
        break;
      }
      accum += dur;
    }

    setTimeout(() => {
      isSeekingRef.current = false;
    }, 800);
  };

  const handleSeek = (newWatchPartyTime: number) => {
    seekToTimelineTime(newWatchPartyTime);
  };

  const skip = (seconds: number) => {
    seekToTimelineTime(playedSeconds + seconds);
  };

  const handleTimeProgress = (ytTime: number) => {
    if (!room || isSeekingRef.current || isScrubbing) return;
    if (typeof ytTime !== 'number' || isNaN(ytTime) || ytTime < 0) return;

    if (!hasMultipleVideos) {
      setPlayedSeconds(ytTime);
      if (totalDuration > 0 && ytTime >= totalDuration - 0.5) {
        setIsPlaying(false);
      }
      return;
    }

    const currentSegment = room.segments[currentSegmentIndex];
    if (!currentSegment) return;

    if (ytTime >= currentSegment.end) {
      if (currentSegmentIndex < room.segments.length - 1) {
        const nextIndex = currentSegmentIndex + 1;
        const nextSeg = room.segments[nextIndex];
        setCurrentSegmentIndex(nextIndex);

        if (nextSeg.videoId && currentSegment.videoId !== nextSeg.videoId) {
          pendingSeekTime.current = nextSeg.start;
        } else {
          seekPlayer(nextSeg.start);
        }
      } else {
        seekPlayer(currentSegment.end);
        setIsPlaying(false);
        setPlayedSeconds(totalDuration);
        return;
      }
    }

    let accum = 0;
    for (let i = 0; i < currentSegmentIndex; i++) {
      accum += Math.max(0, room.segments[i].end - room.segments[i].start);
    }
    const segmentProgress = Math.max(0, ytTime - currentSegment.start);
    const computedPlayed = Math.min(totalDuration, accum + segmentProgress);
    if (!isNaN(computedPlayed)) {
      setPlayedSeconds(computedPlayed);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          setIsPlaying(p => !p);
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          skip(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          skip(10);
          break;
        case 'm':
          e.preventDefault();
          setMuted(m => !m);
          break;
        case 'f':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            containerRef.current?.requestFullscreen();
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playedSeconds, totalDuration]);

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
        <div ref={containerRef} className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 mb-6 relative group">
          {currentVideoId ? (
            <ReactPlayer 
              ref={playerRef}
              src={`https://www.youtube.com/watch?v=${currentVideoId}`}
              url={`https://www.youtube.com/watch?v=${currentVideoId}`}
              width="100%"
              height="100%"
              playing={isPlaying}
              muted={muted}
              controls={false}
              onDuration={(dur: number) => {
                if (typeof dur === 'number' && dur > 0) {
                  setActualDuration(dur);
                }
              }}
              config={{
                youtube: {
                  start: room.segments && room.segments.length > 0 ? Math.floor(room.segments[0].start) : 0,
                  playerVars: { disablekb: 1, modestbranding: 1, rel: 0 }
                } as any
              }}
              onReady={() => {
                if (pendingSeekTime.current !== null && !isNaN(pendingSeekTime.current)) {
                   isSeekingRef.current = true;
                   seekPlayer(pendingSeekTime.current);
                   setTimeout(() => { isSeekingRef.current = false; }, 800);
                   pendingSeekTime.current = null;
                }
              }}
              onTimeUpdate={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                const target = e.currentTarget;
                const ytTime = target?.currentTime;
                if (typeof ytTime === 'number' && !isNaN(ytTime)) {
                  handleTimeProgress(ytTime);
                }
              }}
              onProgress={(progress: any) => {
                const ytTime = typeof progress?.playedSeconds === 'number' 
                  ? progress.playedSeconds 
                  : (playerRef.current?.currentTime ?? undefined);
                if (typeof ytTime === 'number' && !isNaN(ytTime)) {
                  handleTimeProgress(ytTime);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
              <p className="text-sm font-semibold text-slate-400">No video source available for this replay.</p>
            </div>
          )}

          {/* Replay Finished Overlay */}
          {!isPlaying && playedSeconds >= totalDuration && totalDuration > 0 && (
            <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-3 shadow-xl">
                <RotateCcw className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1.5">Replay Finished</h3>
              <p className="text-xs text-slate-300 max-w-xs mb-5">You have reached the end of this live recording.</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSegmentIndex(0);
                  seekToTimelineTime(0);
                  setIsPlaying(true);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 transform active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Watch Again
              </button>
            </div>
          )}

          <div 
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={() => setIsPlaying(!isPlaying)}
          />

          <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col justify-end transition-opacity duration-300 opacity-100 sm:opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4">
            <div className="flex items-center gap-4 mb-2">
              <input 
                type="range" 
                min={0} 
                max={totalDuration} 
                step="any"
                value={playedSeconds}
                onChange={(e) => {
                   setIsScrubbing(true);
                   setPlayedSeconds(parseFloat(e.target.value));
                }}
                onMouseUp={(e) => {
                   setIsScrubbing(false);
                   handleSeek(parseFloat((e.target as HTMLInputElement).value));
                }}
                onTouchEnd={(e) => {
                   setIsScrubbing(false);
                   handleSeek(parseFloat((e.target as HTMLInputElement).value));
                }}
                className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5 text-white">
                <button 
                  onClick={(e) => { e.stopPropagation(); skip(-10); }} 
                  className="hover:text-rose-400 transition-colors p-1 flex items-center gap-1 text-xs font-bold"
                >
                  <RotateCcw className="w-4 h-4" /> 10s
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} 
                  className="hover:text-rose-400 transition-colors p-1"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); skip(10); }} 
                  className="hover:text-rose-400 transition-colors p-1 flex items-center gap-1 text-xs font-bold"
                >
                  10s <RotateCw className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold tracking-wider ml-2 hidden sm:inline-block">
                  {formatTime(playedSeconds)} <span className="text-slate-400 mx-1">/</span> {formatTime(totalDuration)}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-white">
                <span className="text-xs font-semibold tracking-wider sm:hidden">
                  {formatTime(playedSeconds)} / {formatTime(totalDuration)}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} 
                  className="hover:text-rose-400 transition-colors p-1"
                >
                  {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      containerRef.current?.requestFullscreen();
                    }
                  }} 
                  className="hover:text-rose-400 transition-colors p-1"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
