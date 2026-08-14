import { useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';

// Hardcoded ICE servers - TURN is required for production NAT traversal
// These are free public TURN servers (openrelay.metered.ca)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export const useWebRTC = (meetingCode: string, peerId: string, displayName: string) => {
  const { isConnected, sendMessage, messages } = useSocket(meetingCode, peerId, displayName);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [roomParticipants, setRoomParticipants] = useState<{ [key: string]: string }>({});

  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});

  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[WebRTC] Got local stream with tracks:', stream.getTracks().map(t => t.kind));
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (e) {
      console.warn('[WebRTC] Camera/mic unavailable, using empty stream', e);
      const empty = new MediaStream();
      setLocalStream(empty);
      localStreamRef.current = empty;
      return empty;
    }
  };

  const createPeerConnection = (targetPeerId: string) => {
    if (peersRef.current[targetPeerId]) return peersRef.current[targetPeerId];

    console.log('[WebRTC] Creating peer connection to', targetPeerId);
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add all local tracks BEFORE offer/answer
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log('[WebRTC] Adding local track:', track.kind, 'to peer', targetPeerId);
        peer.addTrack(track, stream);
      });
    } else {
      console.warn('[WebRTC] No local stream when creating peer connection for', targetPeerId);
    }

    // Diagnostic: connection state
    peer.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state (${targetPeerId}):`, peer.connectionState);
    };

    // Diagnostic: ICE state
    peer.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state (${targetPeerId}):`, peer.iceConnectionState);
      if (peer.iceConnectionState === 'failed') {
        console.error('[WebRTC] ICE failed! This usually means TURN is needed or firewall is blocking.');
        peer.restartIce();
      }
    };

    // Diagnostic: ICE gathering
    peer.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering (${targetPeerId}):`, peer.iceGatheringState);
    };

    // Diagnostic: signaling state
    peer.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state (${targetPeerId}):`, peer.signalingState);
    };

    // Send ICE candidates to remote peer via WebSocket
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] ICE candidate for ${targetPeerId}:`, event.candidate.type, event.candidate.protocol);
        sendMessage({
          type: 'ice_candidate',
          sender_id: peerId,
          target_id: targetPeerId,
          candidate: event.candidate,
        });
      } else {
        console.log(`[WebRTC] ICE gathering complete for ${targetPeerId}`);
      }
    };

    // Receive remote media track
    peer.ontrack = (event) => {
      console.log(`[WebRTC] REMOTE TRACK RECEIVED from ${targetPeerId}:`, event.track.kind, event.streams);
      if (event.streams?.[0]) {
        setRemoteStreams((prev) => ({ ...prev, [targetPeerId]: event.streams[0] }));
      }
    };

    peersRef.current[targetPeerId] = peer;
    return peer;
  };

  // ONLY the existing user calls this when a new peer joins — they send the offer
  const sendOffer = async (targetPeerId: string) => {
    const peer = createPeerConnection(targetPeerId);
    try {
      console.log('[WebRTC] Creating offer for', targetPeerId);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log('[WebRTC] Offer set, sending to', targetPeerId);
      sendMessage({ type: 'offer', sender_id: peerId, target_id: targetPeerId, sdp: offer });
    } catch (e) {
      console.error('[WebRTC] sendOffer error', e);
    }
  };

  useEffect(() => {
    if (!messages.length) return;

    const processMessage = async () => {
      const msg = messages[messages.length - 1];
      console.log('[WebRTC] Processing message:', msg.type, msg);

      // NEW JOINER: receives list of existing peers — pre-create connections, wait for offers
      if (msg.type === 'room_users' && msg.existing_peers) {
        console.log('[WebRTC] room_users received, existing peers:', msg.existing_peers);
        const peers: { [key: string]: string } = {};
        msg.existing_peers.forEach((p: any) => {
          if (p.peer_id !== peerId) {
            peers[p.peer_id] = p.display_name || 'Participant';
            createPeerConnection(p.peer_id); // pre-create with tracks ready
          }
        });
        setRoomParticipants((prev) => ({ ...prev, ...peers }));
      }

      // EXISTING USER: a new peer joined — send them an offer
      if (msg.type === 'user_joined' && msg.peer_id !== peerId) {
        console.log('[WebRTC] user_joined:', msg.peer_id, '— sending offer');
        setRoomParticipants((prev) => ({ ...prev, [msg.peer_id]: msg.display_name || 'Participant' }));
        await sendOffer(msg.peer_id);
      }

      // NEW JOINER: receives offer from existing user — answer it
      if (msg.type === 'offer' && msg.target_id === peerId) {
        console.log('[WebRTC] Received offer from', msg.sender_id);
        let peer = peersRef.current[msg.sender_id];
        if (!peer) peer = createPeerConnection(msg.sender_id);
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          console.log('[WebRTC] Sending answer to', msg.sender_id);
          sendMessage({ type: 'answer', sender_id: peerId, target_id: msg.sender_id, sdp: answer });
        } catch (e) {
          console.error('[WebRTC] Error handling offer:', e);
        }
      }

      // EXISTING USER: receives answer from new joiner
      if (msg.type === 'answer' && msg.target_id === peerId) {
        console.log('[WebRTC] Received answer from', msg.sender_id, 'signalingState:', peersRef.current[msg.sender_id]?.signalingState);
        const peer = peersRef.current[msg.sender_id];
        if (peer && peer.signalingState === 'have-local-offer') {
          try {
            await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            console.log('[WebRTC] Remote description set from answer');
          } catch (e) {
            console.error('[WebRTC] Error setting remote answer:', e);
          }
        } else {
          console.warn('[WebRTC] Ignoring answer — unexpected signalingState:', peer?.signalingState);
        }
      }

      // BOTH SIDES: apply ICE candidates
      if (msg.type === 'ice_candidate' && msg.target_id === peerId) {
        const peer = peersRef.current[msg.sender_id];
        if (peer) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(msg.candidate));
            console.log('[WebRTC] ICE candidate added from', msg.sender_id);
          } catch (e) {
            console.error('[WebRTC] Error adding ICE candidate:', e);
          }
        } else {
          console.warn('[WebRTC] No peer connection for ICE candidate from', msg.sender_id);
        }
      }

      // Peer left
      if (msg.type === 'user_left') {
        console.log('[WebRTC] user_left:', msg.peer_id);
        setRoomParticipants((prev) => { const s = { ...prev }; delete s[msg.peer_id]; return s; });
        peersRef.current[msg.peer_id]?.close();
        delete peersRef.current[msg.peer_id];
        setRemoteStreams((prev) => { const s = { ...prev }; delete s[msg.peer_id]; return s; });
      }
    };

    processMessage();
  }, [messages]);

  const toggleAudio = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
  };

  return { localStream, remoteStreams, roomParticipants, initLocalStream, toggleAudio, toggleVideo, isConnected };
};
