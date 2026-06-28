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
const googleSheets_1 = require("../services/googleSheets");
const kakaoRoute_1 = require("../services/kakaoRoute");
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validateMiddleware_1 = require("../middleware/validateMiddleware");
const notificationService_1 = require("../services/notificationService");
const router = express_1.default.Router();
// 새로운 수거 신청 생성 (입력값 검증 포함)
router.post('/', validateMiddleware_1.validateRequest, authMiddleware_1.optionalAuthenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const requestData = req.body;
    try {
        // 1. 주소에서 시/도, 시/군/구 파싱 (통계용 regionId 기록)
        let province = '';
        let city = '';
        if (requestData.regionInfo && requestData.regionInfo.province) {
            province = requestData.regionInfo.province;
            city = requestData.regionInfo.city;
        }
        else {
            const addressParts = (requestData.address || '').split(' ');
            province = addressParts[0] || '';
            if (province === '경기')
                province = '경기도'; // DB 포맷 일치
            city = addressParts[1] || '';
        }
        // 통계용 regionId 조회 및 해당 권역 사장님 찾기
        let regionId = null;
        let partnerToNotify = null;
        if (province && city) {
            const region = yield prisma_1.prisma.region.findFirst({
                where: { province, city },
                include: { coverages: { include: { partner: true } } }
            });
            if (region) {
                regionId = region.id;
                if (region.coverages.length > 0) {
                    partnerToNotify = region.coverages[0].partner;
                }
            }
        }
        // 2. DB에 수거 신청 데이터 저장
        // 파트너 자동 배정하지 않음 — 사장님이 직접 수락하는 선착순 방식
        const newRequest = yield prisma_1.prisma.request.create({
            data: {
                userName: requestData.userName || '비회원',
                phone: requestData.phone || '010-0000-0000',
                address: requestData.address,
                detailAddress: requestData.detailAddress,
                zipCode: requestData.zipCode,
                sigungu: ((_a = requestData.regionInfo) === null || _a === void 0 ? void 0 : _a.city) || null,
                bname: ((_b = requestData.regionInfo) === null || _b === void 0 ? void 0 : _b.town) || null,
                desiredDate: new Date(requestData.desiredDate),
                isMustPickupDate: !!requestData.isMustPickupDate,
                estimatedVolume: requestData.estimatedVolume,
                status: 'PENDING', // 항상 미배정(PENDING)으로 시작
                partnerId: null, // 사장님이 수락할 때까지 null
                regionId,
                customerId: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId) || null,
            }
        });
        // 3. 구글 스프레드시트에 연동 (이중 백업, 비동기 처리 - 응답 지연 방지)
        (0, googleSheets_1.addRequestToSheet)({
            id: newRequest.id,
            userName: newRequest.userName,
            phone: newRequest.phone,
            address: newRequest.address,
            detailAddress: newRequest.detailAddress,
            desiredDate: newRequest.desiredDate.toISOString(),
            estimatedVolume: newRequest.estimatedVolume,
            status: newRequest.status,
        }).catch(err => console.error('구글 시트 연동 실패 (비동기):', err));
        // 4. 파트너 사장님께 신규 신청 알림톡 발송 (비동기 처리)
        if (partnerToNotify && partnerToNotify.phone) {
            (0, notificationService_1.sendNewRequestToPartner)(partnerToNotify.phone, newRequest.userName, newRequest.address, partnerToNotify.useBizMessage).catch(err => console.error('신규 신청 알림톡 전송 실패:', err));
        }
        res.status(201).json({
            message: '수거 신청이 완료되었습니다.',
            assignedPartner: '주변 업체 사장님들에게 알림을 보냈습니다. 곧 수락될 예정입니다.',
            request: newRequest
        });
    }
    catch (error) {
        console.error('수거 신청 접수 오류:', error);
        res.status(500).json({ error: '수거 신청을 처리하는 중 문제가 발생했습니다.' });
    }
}));
// 로그인한 고객의 신청 내역 조회
router.get('/me', authMiddleware_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const whereCondition = { customerId: userId };
        const totalCount = yield prisma_1.prisma.request.count({ where: whereCondition });
        const requests = yield prisma_1.prisma.request.findMany({
            where: whereCondition,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                driver: { include: { user: true } },
                partner: { select: { businessName: true, name: true, phone: true } }
            }
        });
        const totalPages = Math.ceil(totalCount / limit);
        res.json({ requests, totalPages, currentPage: page, totalCount });
    }
    catch (error) {
        console.error('고객 신청 내역 조회 오류:', error);
        res.status(500).json({ error: '신청 내역을 불러오는데 실패했습니다.' });
    }
}));
// 관리자용 - 모든 신청 내역 조회 (인증 필수)
router.get('/', authMiddleware_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const totalCount = yield prisma_1.prisma.request.count();
        const requests = yield prisma_1.prisma.request.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });
        const totalPages = Math.ceil(totalCount / limit);
        res.json({ requests, totalPages, currentPage: page, totalCount });
    }
    catch (error) {
        res.status(500).json({ error: '목록 조회 실패' });
    }
}));
// 관리자용 - 기사 배정 API (드래그 앤 드롭 연동용, 인증 필수)
router.patch('/:id/assign', authMiddleware_1.authenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const driverId = typeof req.body.driverId === 'string' ? req.body.driverId : undefined;
    try {
        const updatedRequest = yield prisma_1.prisma.request.update({
            where: { id },
            data: {
                driverId: driverId || null,
                status: driverId ? 'ASSIGNED' : 'PENDING'
            }
        });
        res.json({ message: '배정 상태가 업데이트 되었습니다.', request: updatedRequest });
    }
    catch (error) {
        console.error('배정 업데이트 오류:', error);
        res.status(500).json({ error: '배정 상태 업데이트에 실패했습니다.' });
    }
}));
// 동선 최적화 API
router.post('/optimize', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { originAddress, requestAddresses } = req.body;
        // 출발지 좌표 변환
        const originCoords = yield (0, kakaoRoute_1.getCoordinates)(originAddress);
        if (!originCoords)
            return res.status(400).json({ error: '출발지 주소를 찾을 수 없습니다.' });
        // 목적지 좌표 변환
        const destinationCoords = [];
        for (const reqAddr of requestAddresses) {
            const coords = yield (0, kakaoRoute_1.getCoordinates)(reqAddr.address);
            if (coords) {
                destinationCoords.push({ name: reqAddr.id, x: coords.x, y: coords.y });
            }
        }
        if (destinationCoords.length === 0) {
            return res.status(400).json({ error: '유효한 수거지 주소가 없습니다.' });
        }
        // 최적 경로 계산
        const routeResult = yield (0, kakaoRoute_1.getOptimalRoute)(originCoords, destinationCoords);
        res.json(routeResult);
    }
    catch (error) {
        console.error('동선 최적화 API 에러:', error);
        res.status(500).json({ error: '최적 동선 계산에 실패했습니다.' });
    }
}));
// 고객 포장 사진 업로드 API
router.patch('/:id/customer-photo', authMiddleware_1.optionalAuthenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const { customerPackedPhotoUrl } = req.body;
        const existingRequest = yield prisma_1.prisma.request.findUnique({ where: { id } });
        if (!existingRequest) {
            return res.status(404).json({ error: '수거 신청건을 찾을 수 없습니다.' });
        }
        // 보안 검사 (선택 사항): 로그인한 유저라면 자신의 요청인지 확인 (비회원 신청건은 통과)
        if (req.user && existingRequest.customerId && req.user.userId !== existingRequest.customerId) {
            return res.status(403).json({ error: '권한이 없습니다.' });
        }
        const updatedRequest = yield prisma_1.prisma.request.update({
            where: { id },
            data: { customerPackedPhotoUrl }
        });
        res.json({ message: '포장 사진이 성공적으로 업로드되었습니다.', request: updatedRequest });
    }
    catch (error) {
        console.error('포장 사진 업로드 에러:', error);
        res.status(500).json({ error: '사진 업로드 중 문제가 발생했습니다.' });
    }
}));
// 고객 수거 취소 API (예약접수 상태에서만 가능)
router.patch('/:id/cancel', authMiddleware_1.optionalAuthenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const existingRequest = yield prisma_1.prisma.request.findUnique({ where: { id } });
        if (!existingRequest) {
            return res.status(404).json({ error: '수거 신청건을 찾을 수 없습니다.' });
        }
        // 본인 확인 (로그인 유저인 경우)
        if (req.user && existingRequest.customerId && req.user.userId !== existingRequest.customerId) {
            return res.status(403).json({ error: '권한이 없습니다.' });
        }
        if (existingRequest.status !== 'PENDING') {
            return res.status(400).json({ error: '예약접수 상태인 경우에만 취소가 가능합니다. 이미 접수/배차가 진행된 경우 고객센터(카카오채널)로 문의해 주세요.' });
        }
        const updatedRequest = yield prisma_1.prisma.request.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
        res.json({ message: '수거 신청이 취소되었습니다.', request: updatedRequest });
    }
    catch (error) {
        console.error('고객 취소 에러:', error);
        res.status(500).json({ error: '취소 중 문제가 발생했습니다.' });
    }
}));
// 고객 수거 수정 API (예약접수 상태에서만 가능)
router.patch('/:id', validateMiddleware_1.validateRequest, authMiddleware_1.optionalAuthenticate, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const id = req.params.id;
        const requestData = req.body;
        const existingRequest = yield prisma_1.prisma.request.findUnique({ where: { id } });
        if (!existingRequest) {
            return res.status(404).json({ error: '수거 신청건을 찾을 수 없습니다.' });
        }
        // 본인 확인 (로그인 유저인 경우)
        if (req.user && existingRequest.customerId && req.user.userId !== existingRequest.customerId) {
            return res.status(403).json({ error: '권한이 없습니다.' });
        }
        if (existingRequest.status !== 'PENDING') {
            return res.status(400).json({ error: '예약접수 상태인 경우에만 수정이 가능합니다. 이미 접수/배차가 진행된 경우 고객센터(카카오채널)로 문의해 주세요.' });
        }
        // 1. 주소에서 시/도, 시/군/구 파싱 (통계용 regionId 기록용)
        let province = '';
        let city = '';
        if (requestData.regionInfo && requestData.regionInfo.province) {
            province = requestData.regionInfo.province;
            city = requestData.regionInfo.city;
        }
        else {
            const addressParts = (requestData.address || '').split(' ');
            province = addressParts[0] || '';
            if (province === '경기')
                province = '경기도';
            city = addressParts[1] || '';
        }
        // 통계용 regionId 조회
        let regionId = existingRequest.regionId;
        if (province && city) {
            const region = yield prisma_1.prisma.region.findFirst({
                where: { province, city }
            });
            if (region) {
                regionId = region.id;
            }
        }
        const updatedRequest = yield prisma_1.prisma.request.update({
            where: { id },
            data: {
                userName: requestData.userName || existingRequest.userName,
                phone: requestData.phone || existingRequest.phone,
                address: requestData.address,
                detailAddress: requestData.detailAddress,
                zipCode: requestData.zipCode,
                sigungu: ((_a = requestData.regionInfo) === null || _a === void 0 ? void 0 : _a.city) || null,
                bname: ((_b = requestData.regionInfo) === null || _b === void 0 ? void 0 : _b.town) || null,
                desiredDate: new Date(requestData.desiredDate),
                isMustPickupDate: !!requestData.isMustPickupDate,
                estimatedVolume: requestData.estimatedVolume,
                regionId,
            }
        });
        res.json({ message: '수거 신청이 수정되었습니다.', request: updatedRequest });
    }
    catch (error) {
        console.error('고객 수정 에러:', error);
        res.status(500).json({ error: '수정 중 문제가 발생했습니다.' });
    }
}));
exports.default = router;
