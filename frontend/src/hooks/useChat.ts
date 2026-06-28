import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// 환경 변수 기반으로 API URL 설정 (없으면 기본값)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace(/\/api$/, '');

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender?: {
    name: string;
    role: string;
  };
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  customerId: string;
  partnerId: string;
  customer?: { name: string; phone: string };
  partner?: { businessName: string };
  messages?: ChatMessage[];
  updatedAt: string;
}

export const useChat = (userId: string | null) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    // 소켓 연결
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
    });
    
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Chat socket connected');
    });

    newSocket.on('receiveMessage', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      
      // 방 목록 업데이트 (가장 최신 메시지 반영)
      setRooms((prevRooms) => 
        prevRooms.map(room => 
          room.id === message.roomId 
            ? { ...room, messages: [message], updatedAt: new Date().toISOString() } 
            : room
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
    });

    return () => {
      newSocket.disconnect();
    };
  }, [userId]);

  const joinRoom = (roomId: string) => {
    if (socketRef.current && userId) {
      if (activeRoomId) {
        socketRef.current.emit('leaveRoom', { roomId: activeRoomId });
      }
      socketRef.current.emit('joinRoom', { roomId, userId });
      setActiveRoomId(roomId);
    }
  };

  const sendMessage = (roomId: string, content: string) => {
    if (socketRef.current && userId) {
      socketRef.current.emit('sendMessage', { roomId, senderId: userId, content });
    }
  };

  const fetchRooms = async (role: string) => {
    if (!userId) return;
    try {
      const { data } = await axios.get(`${API_URL}/chat/rooms?userId=${userId}&role=${role}`);
      setRooms(data);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const { data } = await axios.get(`${API_URL}/chat/rooms/${roomId}/messages`);
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const initRoom = async (customerId: string, partnerId: string) => {
    try {
      const { data } = await axios.post(`${API_URL}/chat/rooms/init`, { customerId, partnerId });
      return data;
    } catch (error) {
      console.error('Failed to init room:', error);
      return null;
    }
  };

  return {
    socket,
    rooms,
    messages,
    activeRoomId,
    joinRoom,
    sendMessage,
    fetchRooms,
    fetchMessages,
    initRoom
  };
};
