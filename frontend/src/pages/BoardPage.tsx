import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

// ──────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────

interface BoardPost {
  id: string;
  type: string;
  title: string;
  content: string;
  authorName: string;
  isSecret?: boolean;
  isAnswered?: boolean;
  ratingConvenience?: number;
  ratingKindness?: number;
  ratingSpeed?: number;
  maskedPhone?: string;
  maskedAddress?: string;
  receiptSnapshot?: any;
  createdAt: string;
  updatedAt?: string;
  author?: { id: string; name: string };
  comments?: BoardComment[];
}

interface BoardComment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; role: string; businessName?: string };
}

type TabType = 'notices' | 'inquiries' | 'reviews';

// ──────────────────────────────────────────
// 별점 표시 헬퍼
// ──────────────────────────────────────────
const StarDisplay = ({ rating }: { rating: number }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <span key={s} className={`text-sm ${s <= rating ? 'text-amber-400' : 'text-gray-200'}`}>⭐</span>
    ))}
    <span className="text-xs text-gray-500 font-bold ml-1">{rating}점</span>
  </span>
);

// ──────────────────────────────────────────
// 메인 게시판 페이지 컴포넌트
// ──────────────────────────────────────────
export default function BoardPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<TabType>('notices');
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // 고객문의 작성 모달 상태
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ title: '', content: '' });
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  
  // 고객문의 상세 보기 상태
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  // 리뷰 평균 별점
  const [averageRatings, setAverageRatings] = useState<any>(null);
  const [totalReviews, setTotalReviews] = useState(0);

  // 인증 토큰 (고객문의용)
  const authToken = localStorage.getItem('auth_token') || localStorage.getItem('customer_token');

  // 파트너 정보 (상호명)
  const [partnerName] = useState('');

  // ──────────────────────────────────────────
  // 데이터 fetch
  // ──────────────────────────────────────────
  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = '';
      const headers: any = {};

      if (activeTab === 'notices') {
        url = `${import.meta.env.VITE_API_URL}/board/notices/${partnerId}?page=${page}`;
      } else if (activeTab === 'inquiries') {
        // 고객문의는 인증 필요
        if (!authToken) {
          setPosts([]);
          setLoading(false);
          return;
        }
        url = `${import.meta.env.VITE_API_URL}/board/inquiries?page=${page}`;
        headers['Authorization'] = `Bearer ${authToken}`;
      } else if (activeTab === 'reviews') {
        url = `${import.meta.env.VITE_API_URL}/board/reviews/${partnerId}?page=${page}`;
      }

      const res = await axios.get(url, { headers });
      setPosts(res.data.posts);
      setTotalPages(res.data.totalPages || 1);

      // 리뷰 탭이면 평균 별점도 저장
      if (activeTab === 'reviews' && res.data.averageRatings) {
        setAverageRatings(res.data.averageRatings);
        setTotalReviews(res.data.totalReviews || 0);
      }
    } catch (err: any) {
      console.error('게시판 데이터 로드 실패:', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (partnerId) {
      fetchPosts();
    }
  }, [partnerId, activeTab, page]);

  // ──────────────────────────────────────────
  // 고객문의 작성
  // ──────────────────────────────────────────
  const handleSubmitInquiry = async () => {
    if (!inquiryForm.title.trim() || !inquiryForm.content.trim()) return;
    setIsSubmittingInquiry(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/board/inquiries`,
        { ...inquiryForm, partnerId },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setInquiryForm({ title: '', content: '' });
      setIsInquiryModalOpen(false);
      fetchPosts(); // 목록 새로고침
    } catch (err: any) {
      alert(err.response?.data?.error || '문의 등록에 실패했습니다.');
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  // ──────────────────────────────────────────
  // 고객문의 상세 조회
  // ──────────────────────────────────────────
  const openInquiryDetail = async (postId: string) => {
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/board/inquiries/${postId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setSelectedPost(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || '문의 상세 조회에 실패했습니다.');
    }
  };

  // ──────────────────────────────────────────
  // 댓글 작성 (고객문의 답변)
  // ──────────────────────────────────────────
  const handleSubmitComment = async () => {
    if (!selectedPost || !commentContent.trim()) return;
    setIsSubmittingComment(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/board/inquiries/${selectedPost.id}/comments`,
        { content: commentContent },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setCommentContent('');
      // 상세 다시 로드
      await openInquiryDetail(selectedPost.id);
    } catch (err: any) {
      alert(err.response?.data?.error || '댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 날짜 포맷 헬퍼
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // ──────────────────────────────────────────
  // 렌더링
  // ──────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-gray-50 font-sans">
      {/* 상단 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-5 sticky top-0 z-50 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <span className="text-xl">←</span>
          </button>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">📋 게시판</h1>
            {partnerName && <p className="text-xs text-blue-200 font-medium">{partnerName}</p>}
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b border-gray-200 sticky top-[76px] z-40">
        <div className="max-w-lg mx-auto flex">
          {[
            { key: 'notices' as TabType, label: '📢 공지사항', },
            { key: 'inquiries' as TabType, label: '💬 고객문의', },
            { key: 'reviews' as TabType, label: '⭐ 후기', },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); setSelectedPost(null); }}
              className={`flex-1 py-3.5 text-sm font-bold text-center transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ────── 공지사항 탭 ────── */}
        {activeTab === 'notices' && (
          <div>
            {loading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-400">불러오는 중...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">📢</div>
                <p className="text-gray-400 font-medium">등록된 공지사항이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                    <h3 className="font-bold text-gray-900 mb-2">{post.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-medium">{post.authorName}</span>
                      <span>·</span>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────── 고객문의 탭 ────── */}
        {activeTab === 'inquiries' && (
          <div>
            {!authToken ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🔐</div>
                <p className="text-gray-400 font-medium mb-4">로그인 후 이용할 수 있습니다.</p>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                >
                  로그인하기
                </button>
              </div>
            ) : selectedPost ? (
              // 문의 상세 보기
              <div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="mb-4 text-sm text-blue-600 font-bold flex items-center gap-1 hover:underline"
                >
                  ← 목록으로
                </button>
                
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold">🔒 비밀글</span>
                    {selectedPost.isAnswered ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-[10px] font-bold">✅ 답변완료</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold">⏳ 답변대기</span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-gray-900 text-lg mb-3">{selectedPost.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                  <div className="mt-4 text-xs text-gray-400">
                    {formatDate(selectedPost.createdAt)}
                  </div>
                </div>

                {/* 댓글 목록 */}
                {selectedPost.comments && selectedPost.comments.length > 0 && (
                  <div className="space-y-3 mb-4">
                    <h4 className="text-sm font-bold text-gray-700">💬 답변 ({selectedPost.comments.length})</h4>
                    {selectedPost.comments.map((comment) => (
                      <div key={comment.id} className={`rounded-xl p-4 border ${
                        comment.author.role === 'PARTNER' || comment.author.role === 'SUPER_ADMIN'
                          ? 'bg-blue-50 border-blue-100'
                          : 'bg-gray-50 border-gray-100'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-sm text-gray-900">
                            {comment.author.role === 'PARTNER' ? `🏢 ${comment.author.businessName || comment.author.name}` :
                             comment.author.role === 'SUPER_ADMIN' ? '🛡️ 관리자' : comment.author.name}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 댓글 입력 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <textarea
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="답변 또는 추가 문의를 입력하세요..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:outline-none resize-none transition-colors"
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={isSubmittingComment || !commentContent.trim()}
                    className="mt-2 w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
                  >
                    {isSubmittingComment ? '등록 중...' : '댓글 등록'}
                  </button>
                </div>
              </div>
            ) : (
              // 문의 목록
              <div>
                <button
                  onClick={() => setIsInquiryModalOpen(true)}
                  className="w-full mb-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
                >
                  ✏️ 새 문의 작성
                </button>

                {loading ? (
                  <div className="text-center py-16">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm text-gray-400">불러오는 중...</p>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-4">💬</div>
                    <p className="text-gray-400 font-medium">등록된 문의가 없습니다.</p>
                    <p className="text-xs text-gray-300 mt-1">궁금한 점이 있으시면 문의해 주세요!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => openInquiryDetail(post.id)}
                        className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold">🔒 비밀글</span>
                          {post.isAnswered ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-[10px] font-bold">✅ 답변완료</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold">⏳ 답변대기</span>
                          )}
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm">{post.title}</h3>
                        <p className="text-xs text-gray-400 mt-2">{formatDate(post.createdAt)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ────── 후기 탭 ────── */}
        {activeTab === 'reviews' && (
          <div>
            {/* 평균 별점 요약 */}
            {averageRatings && totalReviews > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                <div className="text-center mb-4">
                  <p className="text-3xl font-extrabold text-amber-500">
                    {((
                      (averageRatings.ratingConvenience || 0) +
                      (averageRatings.ratingKindness || 0) +
                      (averageRatings.ratingSpeed || 0)
                    ) / 3).toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-400 font-medium mt-1">총 {totalReviews}건의 리뷰</p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: '📱 신청 편리성', value: averageRatings.ratingConvenience },
                    { label: '🤝 기사님 친절도', value: averageRatings.ratingKindness },
                    { label: '⚡ 수거/정산 신속', value: averageRatings.ratingSpeed },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">{item.label}</span>
                      <StarDisplay rating={Math.round(item.value || 0)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-400">불러오는 중...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">⭐</div>
                <p className="text-gray-400 font-medium">아직 등록된 후기가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                    {/* 별점 표시 */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => {
                          const avg = ((post.ratingConvenience || 0) + (post.ratingKindness || 0) + (post.ratingSpeed || 0)) / 3;
                          return <span key={s} className={`text-base ${s <= Math.round(avg) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>;
                        })}
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(post.createdAt)}</span>
                    </div>
                    
                    {/* 한줄평 */}
                    {post.content && (
                      <p className="text-sm text-gray-800 font-medium mb-3 leading-relaxed">"{post.content}"</p>
                    )}

                    {/* 마스킹된 고객 정보 */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="font-medium">{post.authorName}</span>
                      {post.maskedAddress && (
                        <>
                          <span>·</span>
                          <span>{post.maskedAddress}</span>
                        </>
                      )}
                    </div>

                    {/* 영수증 요약 (있으면) */}
                    {post.receiptSnapshot && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 font-bold mb-1">📋 수거 영수증</p>
                        <p className="text-sm font-extrabold text-blue-600">
                          {(post.receiptSnapshot.totalPrice || 0).toLocaleString()}원
                        </p>
                        {post.receiptSnapshot.collectionItems && post.receiptSnapshot.collectionItems.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {post.receiptSnapshot.collectionItems.map((item: any, idx: number) => (
                              <span key={idx} className="inline-flex px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-500 font-medium">
                                {item.categoryLabel} {item.quantity}{item.unitType === 'KG' ? 'kg' : '대'}
                              </span>
                            ))}
                          </div>
                        ) : post.receiptSnapshot.actualWeight > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="inline-flex px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-500 font-medium">
                              단일 무게 정산 {post.receiptSnapshot.actualWeight}kg
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* 상세 별점 (토글 또는 항상 표시) */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
                      <span>📱 편리성 {post.ratingConvenience}점</span>
                      <span>🤝 친절도 {post.ratingKindness}점</span>
                      <span>⚡ 신속정확 {post.ratingSpeed}점</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              ←
            </button>
            <span className="text-sm font-bold text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* ────── 고객문의 작성 모달 ────── */}
      {isInquiryModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setIsInquiryModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-gray-900 mb-4">✏️ 고객문의 작성</h3>
            <p className="text-xs text-gray-400 mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
              🔒 고객문의는 <b>비밀글</b>로 등록됩니다. 본인과 담당 사장님만 확인할 수 있습니다.
            </p>

            <input
              value={inquiryForm.title}
              onChange={(e) => setInquiryForm(f => ({ ...f, title: e.target.value }))}
              placeholder="문의 제목"
              maxLength={100}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-blue-400 focus:outline-none mb-3 transition-colors"
            />
            <textarea
              value={inquiryForm.content}
              onChange={(e) => setInquiryForm(f => ({ ...f, content: e.target.value }))}
              placeholder="문의 내용을 상세히 작성해 주세요..."
              rows={5}
              maxLength={2000}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:outline-none resize-none transition-colors"
            />
            <p className="text-right text-[11px] text-gray-300 mt-1 mb-4">{inquiryForm.content.length}/2000자</p>

            <div className="flex gap-2">
              <button
                onClick={() => setIsInquiryModalOpen(false)}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmitInquiry}
                disabled={isSubmittingInquiry || !inquiryForm.title.trim() || !inquiryForm.content.trim()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
              >
                {isSubmittingInquiry ? '등록 중...' : '문의 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
