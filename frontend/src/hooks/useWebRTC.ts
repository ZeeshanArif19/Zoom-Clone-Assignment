import { useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';

export const useWebRTC = (meetingCode: string, peerId: string, displayName: string) => {
  const { isConnected, sendMessage, messages, setMessages } = useSocket(meetingCode, peerId, displayName);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  
  const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  
  // Initialize local media
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (e) {
      console.error("Failed to get local stream", e);
      return null;
    }
  };

  const createPeerConnection = (targetPeerId: string, stream: MediaStream) => {
    if (peersRef.current[targetPeerId]) {
      return peersRef.current[targetPeerId];
    }

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    if (stream) {
      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
      });
    }

    peer.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => ({
          ...prev,
          [targetPeerId]: event.streams[0]
        }));
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'ice_candidate',
          sender_id: peerId,
          target_id: targetPeerId,
          candidate: event.candidate
        });
      }
    };

    peersRef.current[targetPeerId] = peer;
    return peer;
  };

  const handleUserJoined = async (newPeerId: string) => {
    const activeStream = localStreamRef.current;
    if (!activeStream) return;
    
    const peer = createPeerConnection(newPeerId, activeStream);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    
    sendMessage({
      type: 'offer',
      sender_id: peerId,
      target_id: newPeerId,
      sdp: offer
    });
  };

  // Process incoming signaling messages
  useEffect(() => {
    if (!messages.length) return;
    
    const processMessage = async () => {
      const msg = messages[messages.length - 1];
      const activeStream = localStreamRef.current;

      if (msg.type === 'room_users' && msg.existing_peers) {
        msg.existing_peers.forEach((p: any) => {
          if (p.peer_id !== peerId) {
            handleUserJoined(p.peer_id);
          }
        });
      }
      
      if (msg.type === 'user_joined' && msg.peer_id !== peerId) {
        handleUserJoined(msg.peer_id);
      }
      
      if (msg.type === 'offer' && msg.target_id === peerId) {
        if (!activeStream) return;
        const peer = createPeerConnection(msg.sender_id, activeStream);
        await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        
        sendMessage({
          type: 'answer',
          sender_id: peerId,
          target_id: msg.sender_id,
          sdp: answer
        });
      }
      
      if (msg.type === 'answer' && msg.target_id === peerId) {
        const peer = peersRef.current[msg.sender_id];
        if (peer) {
          await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
      }
      
      if (msg.type === 'ice_candidate' && msg.target_id === peerId) {
        const peer = peersRef.current[msg.sender_id];
        if (peer) {
          await peer.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(e => console.error("Error adding ice candidate", e));
        }
      }
      
      if (msg.type === 'user_left') {
        const peer = peersRef.current[msg.peer_id];
        if (peer) {
          peer.close();
          delete peersRef.current[msg.peer_id];
          setRemoteStreams(prev => {
            const newState = { ...prev };
            delete newState[msg.peer_id];
            return newState;
          });
        }
      }
    };
    
    processMessage();
  }, [messages]);

  const toggleAudio = () => {
    const activeStream = localStreamRef.current;
    if (activeStream) {
      activeStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  };

  const toggleVideo = () => {
    const activeStream = localStreamRef.current;
    if (activeStream) {
      activeStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  };

  return {
    localStream,
    remoteStreams,
    initLocalStream,
    toggleAudio,
    toggleVideo,
    isConnected
  };
};
