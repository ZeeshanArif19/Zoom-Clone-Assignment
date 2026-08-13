"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { getMeeting } from '@/lib/api';

/* ─── Video tile ─────────────────────────────────────────── */
const VideoTile = ({
  stream,
  label,
  isLocal,
  compact = false,
}: {
  stream: MediaStream | null;
  label: string;
  isLocal?: boolean;
  compact?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      const vt = stream.getVideoTracks();
      setHasVideo(vt.length > 0 && vt[0].enabled);

      const checkVideo = () => {
        const t = stream.getVideoTracks();
        setHasVideo(t.length > 0 && t[0].enabled);
      };
      stream.addEventListener('addtrack', checkVideo);
      stream.addEventListener('removetrack', checkVideo);
      return () => {
        stream.removeEventListener('addtrack', checkVideo);
        stream.removeEventListener('removetrack', checkVideo);
      };
    } else {
      setHasVideo(false);
    }
  }, [stream]);

  const initials = label
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className={compact ? 'tile-compact' : 'tile-main'}>
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: hasVideo ? 'block' : 'none',
            transform: isLocal ? 'scaleX(-1)' : 'none',
            borderRadius: compact ? '8px' : '0',
          }}
        />
      )}
      {(!stream || !hasVideo) && (
        <div className="tile-avatar-wrap">
          <div className={compact ? 'tile-avatar-sm' : 'tile-avatar-lg'}>
            {initials || '?'}
          </div>
        </div>
      )}
      <div className={compact ? 'tile-label-compact' : 'tile-label-main'}>
        {label}
      </div>
    </div>
  );
};

/* ─── Participants panel ─────────────────────────────────── */
const ParticipantsPanel = ({
  participants,
  onClose,
}: {
  participants: { id: string; name: string }[];
  onClose: () => void;
}) => (
  <div className="participants-panel">
    <div className="participants-panel-header">
      <span>Participants ({participants.length})</span>
      <button onClick={onClose} className="panel-close-btn">✕</button>
    </div>
    <ul className="participants-list">
      {participants.map((p) => (
        <li key={p.id} className="participants-list-item">
          <div className="participant-avatar-sm">{p.name[0]?.toUpperCase()}</div>
          <span>{p.name}</span>
        </li>
      ))}
    </ul>
  </div>
);

/* ─── Invite panel ───────────────────────────────────────── */
const InvitePanel = ({ link, onClose }: { link: string; onClose: () => void }) => (
  <div className="participants-panel">
    <div className="participants-panel-header">
      <span>Invite people</span>
      <button onClick={onClose} className="panel-close-btn">✕</button>
    </div>
    <div style={{ padding: '16px' }}>
      <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '10px' }}>Share this link:</p>
      <div style={{ background: '#2a2a2a', borderRadius: '6px', padding: '10px', wordBreak: 'break-all', fontSize: '0.8rem', color: '#ddd' }}>
        {link}
      </div>
      <button
        className="copy-link-btn"
        onClick={() => { navigator.clipboard.writeText(link); }}
      >
        Copy Link
      </button>
    </div>
  </div>
);

/* ─── Main Meeting Room ──────────────────────────────────── */
export default function MeetingRoom() {
  const params = useParams();
  const router = useRouter();
  const meetingCode = params.meeting_code as string;

  const [displayName, setDisplayName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [peerId] = useState(`peer-${Math.random().toString(36).substr(2, 9)}`);
  const [meetingTitle, setMeetingTitle] = useState('Meeting');

  const { localStream, remoteStreams, roomParticipants, initLocalStream, toggleAudio, toggleVideo, isConnected } =
    useWebRTC(hasJoined ? meetingCode : '', peerId, displayName);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomPeerEntries = Object.entries(roomParticipants);
  const totalParticipants = 1 + roomPeerEntries.length;
  const isSolo = totalParticipants === 1;

  useEffect(() => {
    getMeeting(meetingCode)
      .then((m) => setMeetingTitle(m.title ?? 'Meeting'))
      .catch(() => { alert('Meeting not found'); router.push('/'); });
  }, [meetingCode]);

  // Auto-hide controls
  useEffect(() => {
    const resetTimer = () => {
      setShowControls(true);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
    };
    window.addEventListener('mousemove', resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    await initLocalStream();
    setHasJoined(true);
  };

  const handleToggleAudio = () => {
    toggleAudio();
    setIsAudioMuted((p) => !p);
  };

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoOff((p) => !p);
  };

  const handleLeave = () => {
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    router.push('/');
  };

  /* ─── Pre-join screen ─── */
  if (!hasJoined) {
    return (
      <div className="prejoin-bg">
        <div className="prejoin-card">
          <div className="prejoin-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#0b5cff">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            <span>Zoom Clone</span>
          </div>
          <h2 className="prejoin-title">Ready to join?</h2>
          <p className="prejoin-sub">{meetingTitle}</p>
          <form onSubmit={handleJoin} style={{ width: '100%' }}>
            <input
              type="text"
              className="prejoin-input"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoFocus
            />
            <button type="submit" className="prejoin-join-btn">Join Meeting</button>
            <button type="button" className="prejoin-cancel-btn" onClick={() => router.push('/')}>
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ─── Meeting room ─── */
  const participantsList = [
    { id: peerId, name: `${displayName} (You)` },
    ...roomPeerEntries.map(([id, name]) => ({ id, name })),
  ];

  const mainRemotePeerId = roomPeerEntries[0]?.[0];
  const mainRemoteName = roomPeerEntries[0]?.[1] || 'Participant';
  const mainRemoteStream = mainRemotePeerId ? remoteStreams[mainRemotePeerId] : null;

  return (
    <div className="zroom">
      {/* Top bar */}
      <div className={`zroom-topbar ${showControls ? 'visible' : ''}`}>
        <div className="zroom-topbar-left">
          <span className="zroom-meeting-title">{meetingTitle}</span>
        </div>
        <div className="zroom-topbar-right">
          <div className={`zroom-status-dot ${isConnected ? 'green' : 'red'}`} title={isConnected ? 'Connected' : 'Connecting…'} />
        </div>
      </div>

      {/* Video area */}
      <div className="zroom-video-area">
        {isSolo ? (
          /* Solo: full screen */
          <div className="zroom-solo">
            <VideoTile
              stream={localStream}
              label={`${displayName} (You)`}
              isLocal
            />
          </div>
        ) : (
          /* Multi-participant: speaker + strip */
          <div className="zroom-gallery">
            {/* Main/speaker tile */}
            <div className="zroom-main-tile">
              <VideoTile
                stream={mainRemotePeerId ? mainRemoteStream : localStream}
                label={mainRemotePeerId ? mainRemoteName : `${displayName} (You)`}
                isLocal={!mainRemotePeerId}
              />
            </div>
            {/* Side strip */}
            <div className="zroom-strip">
              {/* Local always visible in strip when there are remotes */}
              <VideoTile
                stream={localStream}
                label={`${displayName} (You)`}
                isLocal
                compact
              />
              {/* Additional remotes */}
              {roomPeerEntries.slice(1).map(([id, name]) => (
                <VideoTile key={id} stream={remoteStreams[id] || null} label={name} compact />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Side panels */}
      {showParticipants && (
        <ParticipantsPanel participants={participantsList} onClose={() => setShowParticipants(false)} />
      )}
      {showInvite && (
        <InvitePanel link={window.location.href} onClose={() => setShowInvite(false)} />
      )}

      {/* Bottom controls */}
      <div className={`zroom-controls ${showControls ? 'visible' : ''}`}>
        {/* Left: Mute + Video */}
        <div className="zroom-controls-left">
          <button
            className={`zctrl-btn ${isAudioMuted ? 'zctrl-muted' : ''}`}
            onClick={handleToggleAudio}
          >
            <span className="zctrl-icon">
              {isAudioMuted ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              )}
            </span>
            <span className="zctrl-label">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            className={`zctrl-btn ${isVideoOff ? 'zctrl-muted' : ''}`}
            onClick={handleToggleVideo}
          >
            <span className="zctrl-icon">
              {isVideoOff ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M21 6.5l-4-4-14 14 4 4 14-14zM3.27 2L2 3.27 5.73 7H5c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2zM15 18H6V9l9 9zm4-3.5V7l-4 4 4 3.5z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              )}
            </span>
            <span className="zctrl-label">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
          </button>
        </div>

        {/* Center: Participants + Share */}
        <div className="zroom-controls-center">
          <button
            className={`zctrl-btn ${showParticipants ? 'zctrl-active' : ''}`}
            onClick={() => { setShowParticipants((p) => !p); setShowInvite(false); }}
          >
            <span className="zctrl-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </span>
            <span className="zctrl-label">Participants <span className="zctrl-badge">{totalParticipants}</span></span>
          </button>

          <button
            className={`zctrl-btn ${showInvite ? 'zctrl-active' : ''}`}
            onClick={() => { setShowInvite((p) => !p); setShowParticipants(false); }}
          >
            <span className="zctrl-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
              </svg>
            </span>
            <span className="zctrl-label">Share Invite</span>
          </button>
        </div>

        {/* Right: End */}
        <div className="zroom-controls-right">
          <button className="zctrl-end" onClick={handleLeave}>End</button>
        </div>
      </div>
    </div>
  );
}
