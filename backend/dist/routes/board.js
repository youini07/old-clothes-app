"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middleware/authMiddleware");
const authMiddleware_2 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// ──────────────────────────────────────────
// 1. 공지사항 (NOTICE) API
// ──────────────────────────────────────────
// 공지사항 목록 조회 (공개) — 특정 파트너의 공지사항만 표시
router.get('/notices/:partnerId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { partnerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const [posts, total] = yield Promise.all([
            prisma_1.prisma.boardPost.findMany({
                where: { type: 'NOTICE', partnerId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true, title: true, content: true, authorName: true,
                    createdAt: true, updatedAt: true,
                },
            }),
            prisma_1.prisma.boardPost.count({ where: { type: 'NOTICE', partnerId } }),
        ]);
        res.json({ posts, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (error) {
        console.error('공지사항 목록 조회 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// 공지사항 작성 (사장님만)
router.post('/notices', authMiddleware_1.authenticate, (0, authMiddleware_2.requireRole)(['PARTNER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
        }
        // 사장님 정보 조회 (이름 가져오기)
        const partner = yield prisma_1.prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!partner)
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        const post = yield prisma_1.prisma.boardPost.create({
            data: {
                type: 'NOTICE',
                authorId: req.user.userId,
                authorName: partner.businessName || partner.name, // 상호명 우선 사용
                partnerId: req.user.userId,
                title,
                content,
            },
        });
        res.status(201).json(post);
    }
    catch (error) {
        console.error('공지사항 작성 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// 공지사항 수정 (작성자만)
router.put('/notices/:id', authMiddleware_1.authenticate, (0, authMiddleware_2.requireRole)(['PARTNER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const post = yield prisma_1.prisma.boardPost.findUnique({ where: { id } });
        if (!post)
            return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        if (post.authorId !== req.user.userId) {
            return res.status(403).json({ error: '본인이 작성한 공지만 수정할 수 있습니다.' });
        }
        const { title, content } = req.body;
        const updated = yield prisma_1.prisma.boardPost.update({
            where: { id },
            data: { title, content },
        });
        res.json(updated);
    }
    catch (error) {
        console.error('공지사항 수정 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// 공지사항 삭제 (작성자만)
router.delete('/notices/:id', authMiddleware_1.authenticate, (0, authMiddleware_2.requireRole)(['PARTNER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const post = yield prisma_1.prisma.boardPost.findUnique({ where: { id } });
        if (!post)
            return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        if (post.authorId !== req.user.userId) {
            return res.status(403).json({ error: '본인이 작성한 공지만 삭제할 수 있습니다.' });
        }
        yield prisma_1.prisma.boardPost.delete({ where: { id } });
        res.json({ message: '삭제되었습니다.' });
    }
    catch (error) {
        console.error('공지사항 삭제 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// ──────────────────────────────────────────
// 2. 고객문의 (INQUIRY) API — 비밀글 방식
// ──────────────────────────────────────────
// 고객문의 목록 조회
// - 고객: 자기가 작성한 문의만 보임
// - 사장님: 자기에게 온 문의만 보임
// - 슈퍼관리자: 전체 문의 조회 가능
router.get('/inquiries', authMiddleware_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, role, partnerId: tokenPartnerId } = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filterPartnerId = req.query.partnerId; // 슈퍼관리자가 특정 파트너 필터링용
        let whereClause = { type: 'INQUIRY' };
        if (role === 'CUSTOMER') {
            // 고객은 본인 문의만 조회
            whereClause.authorId = userId;
        }
        else if (role === 'PARTNER' || (role === 'DRIVER' && req.user.isCoBoss)) {
            // 사장님(또는 공동사장)은 자기에게 온 문의만 조회
            const actualPartnerId = role === 'DRIVER' ? tokenPartnerId : userId;
            whereClause.partnerId = actualPartnerId;
        }
        else if (role === 'SUPER_ADMIN') {
            // 슈퍼관리자는 전체 또는 특정 파트너 필터
            if (filterPartnerId)
                whereClause.partnerId = filterPartnerId;
        }
        else {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        const [posts, total] = yield Promise.all([
            prisma_1.prisma.boardPost.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    comments: {
                        include: { author: { select: { id: true, name: true, role: true, businessName: true } } },
                        orderBy: { createdAt: 'asc' },
                    },
                    author: { select: { id: true, name: true } },
                },
            }),
            prisma_1.prisma.boardPost.count({ where: whereClause }),
        ]);
        res.json({ posts, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (error) {
        console.error('고객문의 목록 조회 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// 미답변 문의 수 조회 (사장님 대시보드 알림 뱃지용)
router.get('/inquiries/unread-count', authMiddleware_1.authenticate, (0, authMiddleware_2.requireRole)(['PARTNER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const partnerId = req.user.role === 'DRIVER' ? req.user.partnerId : req.user.userId;
        const count = yield prisma_1.prisma.boardPost.count({
            where: {
                type: 'INQUIRY',
                partnerId: partnerId,
                isAnswered: false,
            },
        });
        res.json({ count });
    }
    catch (error) {
        console.error('미답변 문의 수 조회 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// 고객문의 작성 (고객만)
router.post('/inquiries', authMiddleware_1.authenticate, (0, authMiddleware_2.requireRole)(['CUSTOMER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, content, partnerId } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
        }
        let targetPartnerId = partnerId;
        if (!targetPartnerId) {
            // 고객의 가장 최근 수거건 담당 사장님을 자동으로 찾음
            const latestRequest = yield prisma_1.prisma.request.findFirst({
                where: { customerId: req.user.userId, partnerId: { not: null } },
                orderBy: { createdAt: 'desc' },
                select: { partnerId: true },
            });
            if (!(latestRequest === null || latestRequest === void 0 ? void 0 : latestRequest.partnerId)) {
                return res.status(400).json({
                    error: '수거 이력이 없어 문의를 등록할 수 없습니다. 수거 신청 후 이용해주세요.',
                });
            }
            targetPartnerId = latestRequest.partnerId;
        }
        const customer = yield prisma_1.prisma.user.findUnique({ where: { id: req.user.userId } });
        const post = yield prisma_1.prisma.boardPost.create({
            data: {
                type: 'INQUIRY',
                authorId: req.user.userId,
                authorName: (customer === null || customer === void 0 ? void 0 : customer.name) || '고객',
                partnerId: targetPartnerId,
                title,
                content,
                isSecret: true, // 고객문의는 항상 비밀글
            },
            include: {
                comments: true,
                author: { select: { id: true, name: true } },
            },
        });
        res.status(201).json(post);
    }
    catch (error) {
        console.error('고객문의 작성 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// 고객문의 상세 조회 (비밀글 권한 체크)
router.get('/inquiries/:id', authMiddleware_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const post = yield prisma_1.prisma.boardPost.findUnique({
            where: { id },
            include: {
                comments: {
                    include: { author: { select: { id: true, name: true, role: true, businessName: true } } },
                    orderBy: { createdAt: 'asc' },
                },
                author: { select: { id: true, name: true } },
            },
        });
        if (!post)
            return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        // 비밀글 접근 권한 체크: 작성자 / 대상 사장님 / 슈퍼관리자만 가능
        const { userId, role, partnerId: tokenPartnerId } = req.user;
        const actualPartnerId = role === 'DRIVER' ? tokenPartnerId : userId;
        const canAccess = post.authorId === userId ||
            post.partnerId === actualPartnerId ||
            role === 'SUPER_ADMIN';
        if (!canAccess) {
            return res.status(403).json({ error: '이 문의에 대한 접근 권한이 없습니다.' });
        }
        res.json(post);
    }
    catch (error) {
        console.error('고객문의 상세 조회 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// 고객문의 댓글 작성 (작성자/사장님/슈퍼관리자만)
router.post('/inquiries/:id/comments', authMiddleware_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const post = yield prisma_1.prisma.boardPost.findUnique({ where: { id } });
        if (!post)
            return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        // 권한 체크: 작성자/대상 사장님/슈퍼관리자만 댓글 가능
        const { userId, role, partnerId: tokenPartnerId } = req.user;
        const actualPartnerId = role === 'DRIVER' ? tokenPartnerId : userId;
        const canComment = post.authorId === userId ||
            post.partnerId === actualPartnerId ||
            role === 'SUPER_ADMIN';
        if (!canComment) {
            return res.status(403).json({ error: '이 문의에 댓글을 작성할 권한이 없습니다.' });
        }
        const { content } = req.body;
        if (!content)
            return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
        const comment = yield prisma_1.prisma.boardComment.create({
            data: {
                postId: id,
                authorId: userId,
                content,
            },
            include: {
                author: { select: { id: true, name: true, role: true, businessName: true } },
            },
        });
        // 사장님이나 슈퍼관리자가 답변하면 isAnswered = true로 업데이트
        if (role === 'PARTNER' || role === 'SUPER_ADMIN' || (role === 'DRIVER' && req.user.isCoBoss)) {
            yield prisma_1.prisma.boardPost.update({
                where: { id },
                data: { isAnswered: true },
            });
        }
        res.status(201).json(comment);
    }
    catch (error) {
        console.error('댓글 작성 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// ──────────────────────────────────────────
// 3. 후기/리뷰 (REVIEW) API
// ──────────────────────────────────────────
// 리뷰 목록 조회 (공개) — 특정 파트너의 리뷰
router.get('/reviews/:partnerId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { partnerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const [posts, total] = yield Promise.all([
            prisma_1.prisma.boardPost.findMany({
                where: { type: 'REVIEW', partnerId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true, title: true, content: true, authorName: true,
                    ratingConvenience: true, ratingKindness: true, ratingSpeed: true,
                    maskedPhone: true, maskedAddress: true, receiptSnapshot: true,
                    createdAt: true,
                },
            }),
            prisma_1.prisma.boardPost.count({ where: { type: 'REVIEW', partnerId } }),
        ]);
        // 평균 별점 계산
        const avgRatings = yield prisma_1.prisma.boardPost.aggregate({
            where: { type: 'REVIEW', partnerId },
            _avg: {
                ratingConvenience: true,
                ratingKindness: true,
                ratingSpeed: true,
            },
            _count: true,
        });
        res.json({
            posts,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            averageRatings: avgRatings._avg,
            totalReviews: avgRatings._count,
        });
    }
    catch (error) {
        console.error('리뷰 목록 조회 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
// 간편리뷰 등록 (영수증 페이지에서 — 공개 API, 인증 불필요)
// 왜 인증 불필요? → 영수증 링크(알림톡)를 받은 고객이 로그인 없이 바로 리뷰를 등록할 수 있도록 하기 위함
router.post('/reviews', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { requestId, // 수거 신청 ID (영수증에서 전달)
        ratingConvenience, ratingKindness, ratingSpeed, content, // 한줄평
         } = req.body;
        // 필수 값 검증
        if (!requestId)
            return res.status(400).json({ error: '수거 신청 ID가 필요합니다.' });
        if (!ratingConvenience || !ratingKindness || !ratingSpeed) {
            return res.status(400).json({ error: '모든 별점 항목을 선택해주세요.' });
        }
        // 별점 범위 검증 (1~5)
        const ratings = [ratingConvenience, ratingKindness, ratingSpeed];
        if (ratings.some((r) => r < 1 || r > 5)) {
            return res.status(400).json({ error: '별점은 1~5 사이의 값이어야 합니다.' });
        }
        // 수거 신청 데이터 조회 (리뷰에 필요한 정보)
        const request = yield prisma_1.prisma.request.findUnique({
            where: { id: requestId },
            include: { collectionItems: true },
        });
        if (!request)
            return res.status(404).json({ error: '수거 신청을 찾을 수 없습니다.' });
        if (!request.partnerId)
            return res.status(400).json({ error: '담당 업체가 없는 수거건입니다.' });
        // 중복 리뷰 방지: 이미 해당 requestId로 리뷰가 등록되었는지 확인
        const existingReview = yield prisma_1.prisma.boardPost.findFirst({
            where: { type: 'REVIEW', requestId },
        });
        if (existingReview) {
            return res.status(409).json({ error: '이미 리뷰가 등록된 수거건입니다.' });
        }
        // 개인정보 마스킹 처리
        // 이름: 앞 2글자만 (예: "홍길동" → "홍길*")
        const maskName = (name) => {
            if (!name || name.length < 2)
                return name || '고객';
            return name.substring(0, 2) + '*'.repeat(Math.max(name.length - 2, 1));
        };
        // 주소: 구까지만 표시 (예: "경기 화성시 동탄구", "서울 강남구", "강원도 원주시")
        const maskAddress = (address) => {
            if (!address)
                return '';
            const parts = address.trim().split(/\s+/);
            const guIndex = parts.findIndex(p => p.endsWith('구'));
            if (guIndex !== -1)
                return parts.slice(0, guIndex + 1).join(' ');
            const siIndex = parts.findIndex(p => p.endsWith('시') || p.endsWith('군'));
            if (siIndex !== -1)
                return parts.slice(0, siIndex + 1).join(' ');
            return parts.slice(0, 2).join(' ');
        };
        // 전화번호: 010-xxxx-1234 형식
        const maskPhone = (phone) => {
            if (!phone)
                return '';
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length >= 11) {
                return `${cleaned.slice(0, 3)}-xxxx-${cleaned.slice(-4)}`;
            }
            if (cleaned.length >= 10) {
                return `${cleaned.slice(0, 3)}-xxxx-${cleaned.slice(-4)}`;
            }
            return 'xxx-xxxx-xxxx';
        };
        // 영수증 스냅샷 데이터 생성 (개인정보 제거된 버전)
        const receiptSnapshot = {
            totalPrice: request.totalPrice,
            actualWeight: request.actualWeight,
            completedDate: request.completedDate,
            collectionItems: request.collectionItems.map(item => ({
                categoryLabel: item.categoryLabel,
                quantity: item.quantity,
                unitType: item.unitType,
                subtotal: item.subtotal,
            })),
        };
        const post = yield prisma_1.prisma.boardPost.create({
            data: {
                type: 'REVIEW',
                authorId: request.customerId, // 로그인 고객이면 연결, 비회원이면 null
                authorName: maskName(request.userName),
                partnerId: request.partnerId,
                title: '간편리뷰', // 리뷰 타입의 기본 제목
                content: content || '', // 한줄평 (없어도 OK)
                requestId,
                ratingConvenience: parseInt(ratingConvenience),
                ratingKindness: parseInt(ratingKindness),
                ratingSpeed: parseInt(ratingSpeed),
                maskedPhone: maskPhone(request.phone),
                maskedAddress: maskAddress(request.address),
                receiptSnapshot,
            },
        });
        res.status(201).json({ message: '리뷰가 등록되었습니다!', post });
    }
    catch (error) {
        console.error('간편리뷰 등록 실패:', error);
        res.status(500).json({ error: '리뷰 등록에 실패했습니다.' });
    }
}));
// 리뷰 삭제 (사장님 또는 슈퍼관리자만)
router.delete('/reviews/:id', authMiddleware_1.authenticate, (0, authMiddleware_2.requireRole)(['PARTNER', 'SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const post = yield prisma_1.prisma.boardPost.findUnique({ where: { id } });
        if (!post)
            return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        // 사장님은 자기 게시판의 리뷰만 삭제 가능
        if (req.user.role === 'PARTNER' && post.partnerId !== req.user.userId) {
            return res.status(403).json({ error: '본인 업체의 리뷰만 삭제할 수 있습니다.' });
        }
        yield prisma_1.prisma.boardPost.delete({ where: { id } });
        res.json({ message: '리뷰가 삭제되었습니다.' });
    }
    catch (error) {
        console.error('리뷰 삭제 실패:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}));
exports.default = router;
