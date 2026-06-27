import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useChat } from '../../hooks/useChat';

interface ChatWidgetProps {
  userId: string;
  partnerId: string; // 연결할 사장님 ID
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ userId, partnerId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, activeRoomId, joinRoom, sendMessage, fetchMessages, initRoom } = useChat(userId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !activeRoomId) {
      // 위젯을 열 때, 방이 없으면 생성하거나 기존 방 정보를 가져와서 조인
      initRoom(userId, partnerId).then((room) => {
        if (room) {
          joinRoom(room.id);
          fetchMessages(room.id);
        } else {
          alert('상담원과 연결할 수 없습니다. (관리자 계정이 생성되지 않았을 수 있습니다)');
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    // 새 메시지가 오면 스크롤을 맨 아래로
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!activeRoomId) {
      alert('채팅방 연결 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    sendMessage(activeRoomId, input);
    setInput('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 챗봇 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition transform hover:scale-105"
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* 채팅 창 */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl w-80 sm:w-96 h-[500px] max-h-[80vh] flex flex-col overflow-hidden border border-gray-200">
          {/* 헤더 */}
          <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">1:1 문의하기</h3>
              <p className="text-xs text-blue-200">담당 기사님과 실시간 채팅</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200">
              <X size={24} />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
            <div className="text-center text-xs text-gray-400 my-2">채팅이 시작되었습니다.</div>
            
            {messages.map((msg) => {
              const isMine = msg.senderId === userId;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                      isMine 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {!isMine && <div className="font-bold text-xs mb-1 text-gray-500">{msg.sender?.name || '사장님'}</div>}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 폼 */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200">
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="메시지를 입력하세요..."
                className="flex-1 min-w-0 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                type="submit" 
                disabled={!input.trim()}
                className="shrink-0 bg-blue-600 text-white p-2.5 rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center w-10 h-10"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
