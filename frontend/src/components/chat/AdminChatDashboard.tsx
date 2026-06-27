import React, { useEffect, useState, useRef } from 'react';
import { Send, User, Clock, Search, MessageCircle, X } from 'lucide-react';
import { useChat } from '../../hooks/useChat';

interface AdminChatDashboardProps {
  adminId: string;
}

export const AdminChatDashboard: React.FC<AdminChatDashboardProps> = ({ adminId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { rooms, messages, activeRoomId, fetchRooms, joinRoom, fetchMessages, sendMessage } = useChat(adminId);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ADMIN 권한으로 모든 방 조회
    if (isOpen) {
      fetchRooms('ADMIN');
    }
  }, [adminId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRoomClick = (roomId: string) => {
    joinRoom(roomId);
    fetchMessages(roomId);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!activeRoomId) {
      alert('채팅방이 선택되지 않았습니다.');
      return;
    }
    sendMessage(activeRoomId, input);
    setInput('');
  };

  const filteredRooms = rooms.filter(r => 
    r.customer?.name.includes(search) || r.customer?.phone.includes(search)
  );

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-800 text-white p-4 rounded-full shadow-lg hover:bg-blue-900 transition transform hover:scale-105 flex items-center gap-2"
        >
          <MessageCircle size={28} />
          <span className="font-bold hidden sm:inline">고객 문의</span>
        </button>
      )}

      {/* 채팅 위젯 창 */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl w-[90vw] sm:w-[800px] h-[600px] max-h-[85vh] flex flex-col overflow-hidden border border-gray-200">
          
          {/* 전체 헤더 */}
          <div className="bg-blue-800 text-white p-3 px-5 flex justify-between items-center shadow-md z-20">
            <div className="font-bold flex items-center gap-2">
              <MessageCircle size={20} /> 
              실시간 고객 문의 관리
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-300 transition">
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-1 h-[calc(100%-52px)] overflow-hidden">
            {/* 왼쪽: 채팅방 리스트 */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
              <div className="p-3 border-b border-gray-200 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="고객 검색..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {filteredRooms.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">문의가 없습니다.</div>
                ) : (
                  filteredRooms.map(room => (
                    <div 
                      key={room.id}
                      onClick={() => handleRoomClick(room.id)}
                      className={`p-3 border-b border-gray-100 cursor-pointer transition hover:bg-blue-50 ${
                        activeRoomId === room.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-semibold text-gray-800 flex items-center gap-1 text-sm">
                          <User size={14} className="text-gray-500" />
                          <span className="truncate max-w-[80px]">{room.customer?.name || '알 수 없음'}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
                          <Clock size={10} />
                          {new Date(room.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-1">
                        {room.messages && room.messages.length > 0 
                          ? room.messages[0].content 
                          : '대화 내역 없음'}
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
                  <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm z-10">
                    <div className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                      <User size={18} className="text-blue-600" />
                      {rooms.find(r => r.id === activeRoomId)?.customer?.name} 고객님
                      <span className="text-xs text-gray-500 font-normal ml-2">
                        {rooms.find(r => r.id === activeRoomId)?.customer?.phone}
                      </span>
                    </div>
                  </div>

                  {/* 채팅 메시지 영역 */}
                  <div className="flex-1 p-4 overflow-y-auto bg-[#F4F5F7] flex flex-col gap-3">
                    {messages.map((msg) => {
                      const isAdmin = msg.senderId === adminId;
                      return (
                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div 
                            className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                              isAdmin 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                            }`}
                          >
                            <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
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
                  <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200">
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 min-w-0 bg-gray-100 border-none rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button 
                        type="submit" 
                        disabled={!input.trim()}
                        className="shrink-0 bg-blue-600 text-white p-2.5 rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition flex items-center justify-center w-10 h-10"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 p-6 text-center">
                  <MessageCircle size={48} className="mb-3 text-gray-300" />
                  <p className="text-sm">왼쪽에서 채팅방을 선택해주세요.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
