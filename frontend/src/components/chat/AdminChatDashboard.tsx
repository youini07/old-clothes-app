import React, { useEffect, useState, useRef } from 'react';
import { Send, User, Clock, Search } from 'lucide-react';
import { useChat } from '../../hooks/useChat';

interface AdminChatDashboardProps {
  adminId: string;
}

export const AdminChatDashboard: React.FC<AdminChatDashboardProps> = ({ adminId }) => {
  const { rooms, messages, activeRoomId, fetchRooms, joinRoom, fetchMessages, sendMessage } = useChat(adminId);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ADMIN 권한으로 모든 방 조회
    fetchRooms('ADMIN');
  }, [adminId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRoomClick = (roomId: string) => {
    joinRoom(roomId);
    fetchMessages(roomId);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeRoomId) return;
    sendMessage(activeRoomId, input);
    setInput('');
  };

  const filteredRooms = rooms.filter(r => 
    r.customer?.name.includes(search) || r.customer?.phone.includes(search)
  );

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* 왼쪽: 채팅방 리스트 */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-bold text-gray-800 mb-3">고객 문의 관리</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="고객명 또는 연락처 검색..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">채팅 내역이 없습니다.</div>
          ) : (
            filteredRooms.map(room => (
              <div 
                key={room.id}
                onClick={() => handleRoomClick(room.id)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition hover:bg-blue-50 ${
                  activeRoomId === room.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                    <User size={16} className="text-gray-500" />
                    {room.customer?.name || '알 수 없음'} 
                    <span className="text-xs text-gray-400 font-normal">{room.customer?.phone}</span>
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(room.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {room.messages && room.messages.length > 0 
                    ? room.messages[0].content 
                    : '대화 내역이 없습니다.'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽: 채팅 화면 */}
      <div className="flex-1 flex flex-col bg-white">
        {activeRoomId ? (
          <>
            {/* 채팅창 헤더 */}
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm z-10">
              <div className="font-bold text-gray-800 flex items-center gap-2">
                <User size={20} className="text-blue-600" />
                {rooms.find(r => r.id === activeRoomId)?.customer?.name} 고객님
              </div>
            </div>

            {/* 채팅 메시지 영역 */}
            <div className="flex-1 p-6 overflow-y-auto bg-[#F4F5F7] flex flex-col gap-4">
              {messages.map((msg) => {
                const isAdmin = msg.senderId === adminId;
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        isAdmin 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-[10px] mt-1 text-right ${isAdmin ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="고객에게 메시지 보내기..."
                  className="flex-1 bg-gray-100 border-none rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim()}
                  className="bg-blue-600 text-white p-3 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <MessageCircle size={64} className="mb-4 text-gray-300" />
            <p className="text-lg">왼쪽에서 채팅방을 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 상단 아이콘용 (MessageCircle이 없다고 할까봐 추가 임포트 대신 인라인 구현)
function MessageCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
    </svg>
  )
}
