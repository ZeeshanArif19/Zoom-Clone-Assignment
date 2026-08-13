import { useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';

export const useWebRTC = (meetingCode: string, peerId: string, displayName: string) => {
  const { isConnected, sendMessage, messages, setMessages } = useSocket(meetingCode, peerId, displayName);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [roomParticipants, setRoomParticipants] = useState<{ [key: string]: string }>({});

  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});

  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (e) {
      console.warn('Camera/mic failed, trying audio only', e);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(audioStream);
        localStreamRef.current = audioStream;
        return audioStream;
      } catch (err) {
        console.warn('No media devices, creating empty stream', err);
        const empty = new MediaStream();
        setLocalStream(empty);
        localStreamRef.current = empty;
        return empty;
      }
    }
  };

  const createPeerConnection = (targetPeerId: string) => {
    if (peersRef.current[targetPeerId]) {
      return peersRef.current[targetPeerId];
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    // Add local tracks to this peer connection
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    }

    peer.ontrack = (event) => {
      if (event.streams?.[0]) {
        setRemoteStreams((prev) => ({ ...prev, [targetPeerId]: event.streams[0] }));
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'ice_candidate',
          sender_id: peerId,
          target_id: targetPeerId,
          candidate: event.candidate,
        });
      }
    };

    peersRef.current[targetPeerId] = peer;
    return peer;
  };

  // Called by the EXISTING user when a new peer joins (they send the offer)
  const sendOffer = async (targetPeerId: string) => {
    const peer = createPeerConnection(targetPeerId);
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendMessage({ type: 'offer', sender_id: peerId, target_id: targetPeerId, sdp: offer });
    } catch (e) {
      console.error('sendOffer error', e);
    }
  };

  useEffect(() => {
    if (!messages.length) return;

    const processMessage = async () => {
      const msg = messages[messages.length - 1];

      // room_users: I am the new joiner — just track existing peers, do NOT send offers
      // The existing peers will send offers to me when they receive "user_joined"
      if (msg.type === 'room_users' && msg.existing_peers) {
        const newParticipants: { [key: string]: string } = {};
        msg.existing_peers.forEach((p: any) => {
          if (p.peer_id !== peerId) {
            newParticipants[p.peer_id] = p.display_name || 'Participant';
            // Pre-create the peer connection so it is ready to receive an offer
            createPeerConnection(p.peer_id);
          }
        });
        setRoomParticipants((prev) => ({ ...prev, ...newParticipants }));
      }

      // user_joined: I am an existing user — I send the offer to the newcomer
      if (msg.type === 'user_joined' && msg.peer_id !== peerId) {
        setRoomParticipants((prev) => ({ ...prev, [msg.peer_id]: msg.display_name || 'Participant' }));
        await sendOffer(msg.peer_id);
      }

      // offer: I am the new joiner receiving an offer from an existing peer
      if (msg.type === 'offer' && msg.target_id === peerId) {
        let peer = peersRef.current[msg.sender_id];
        if (!peer) peer = createPeerConnection(msg.sender_id);

        try {
          await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendMessage({ type: 'answer', sender_id: peerId, target_id: msg.sender_id, sdp: answer });
        } catch (e) {
          console.error('Error handling offer', e);
        }
      }

      // answer: existing peer receives answer from new joiner
      if (msg.type === 'answer' && msg.target_id === peerId) {
        const peer = peersRef.current[msg.sender_id];
        if (peer && peer.signalingState === 'have-local-offer') {
          try {
            await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          } catch (e) {
            console.error('Error setting remote answer', e);
          }
        }
      }

      if (msg.type === 'ice_candidate' && msg.target_id === peerId) {
        const peer = peersRef.current[msg.sender_id];
        if (peer) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.error('Error adding ICE candidate', e);
          }
        }
      }

      if (msg.type === 'user_left') {
        setRoomParticipants((prev) => {
          const s = { ...prev };
          delete s[msg.peer_id];
          return s;
        });
        const peer = peersRef.current[msg.peer_id];
        if (peer) {
          peer.close();
          delete peersRef.current[msg.peer_id];
        }
        setRemoteStreams((prev) => {
          const s = { ...prev };
          delete s[msg.peer_id];
          return s;
        });
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
