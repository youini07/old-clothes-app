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
const kakaoRoute_1 = require("../services/kakaoRoute");
const notificationService_1 = require("../services/notificationService");
const googleSheets_1 = require("../services/googleSheets");
const statusService_1 = require("../services/statusService");
const router = express_1.default.Router();
// ==========================================
// [DRIVER 전용] 수거 기사 앱 기능
// ==========================================
// 1. 배정된 오늘의 수거 동선 목록 조회
router.get('/requests', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['DRIVER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.userId;
        // 기사 프로필 찾기
        const driverProfile = yield prisma_1.prisma.driverProfile.findUnique({
            where: { userId }
        });
        if (!driverProfile) {
            return res.status(404).json({ error: '기사 프로필을 찾을 수 없습니다.' });
        }
        const requests = yield prisma_1.prisma.request.findMany({
            where: { driverId: driverProfile.id },
            orderBy: { orderIndex: 'asc' } // 동선 순서대로 정렬
        });
        res.json({ requests });
    }
    catch (error) {
        res.status(500).json({ error: '수거 일정 조회 실패' });
    }
}));
// 2. 동선 순서 수동 변경 (Drag & Drop 결과)
router.put('/reorder', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['DRIVER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { reorderedRequests } = req.body;
    // reorderedRequests: [{ id: 'req_1', orderIndex: 0 }, { id: 'req_2', orderIndex: 1 }, ...]
    try {
        // 트랜잭션으로 일괄 업데이트
        yield prisma_1.prisma.$transaction(reorderedRequests.map((reqItem) => prisma_1.prisma.request.update({
            where: { id: reqItem.id },
            data: { orderIndex: reqItem.orderIndex }
        })));
        res.json({ message: '동선 순서가 업데이트 되었습니다.' });
    }
    catch (error) {
        res.status(500).json({ error: '동선 순서 변경 실패' });
    }
}));
// 3. 수거 완료 처리 (다단계 사진 및 무게 입력)
// 향후 multer & aws-sdk 를 이용한 R2 업로드 연동 필요
router.post('/complete/:id', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['DRIVER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { id } = req.params;
    const { actualWeight, driverNote, itemPhotoUrl, scalePhotoUrl, extraPhotoUrl } = req.body;
    try {
        // 1. 기존 수거 요청 및 배정된 파트너(사장님) 정보 조회
        const existingRequest = yield prisma_1.prisma.request.findUnique({
            where: { id },
            include: { partner: true }
        });
        if (!existingRequest) {
            return res.status(404).json({ error: '수거 요청을 찾을 수 없습니다.' });
        }
        // 2. 단가(pricePerKg) 적용: 파트너 설정값이 없으면 기본값 300원 사용
        const PRICE_PER_KG = (_b = (_a = existingRequest.partner) === null || _a === void 0 ? void 0 : _a.pricePerKg) !== null && _b !== void 0 ? _b : 300;
        const weight = parseFloat(actualWeight);
        const totalPrice = weight * PRICE_PER_KG;
        // 3. 수거 완료 처리 및 무게/금액 업데이트
        const request = yield prisma_1.prisma.request.update({
            where: { id },
            data: {
                actualWeight: weight,
                totalPrice,
                driverNote,
                itemPhotoUrl,
                scalePhotoUrl,
                extraPhotoUrl,
                status: statusService_1.getStatusForAction.onCompleted(),
                completedDate: new Date()
            },
            include: { partner: true }
        });
        // 수거 완료 및 정산 알림톡 발송 (비동기)
        if (request.partner && request.partner.useBizMessage) {
            (0, notificationService_1.sendCompletionToCustomer)(request.phone, request.userName, weight, totalPrice, request.partner.useBizMessage).catch(err => console.error('완료 안내 알림톡 전송 실패:', err));
        }
        // 구글 시트에 완료 상태 및 무게/메모 업데이트
        yield (0, googleSheets_1.updateRequestStatusInSheet)(id, 'COMPLETED', parseFloat(actualWeight), driverNote);
        res.json({ message: '수거가 완료되었습니다!', request });
    }
    catch (error) {
        res.status(500).json({ error: '수거 완료 처리 실패' });
    }
}));
// 4. 수거 출발 처리 및 ETA 계산
router.post('/depart/:id', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['DRIVER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { currentLat, currentLng } = req.body;
    try {
        // 1. 요청 정보 가져오기
        const request = yield prisma_1.prisma.request.findUnique({ where: { id: id } });
        if (!request) {
            return res.status(404).json({ error: '수거 신청 건을 찾을 수 없습니다.' });
        }
        let etaMinutes = null;
        // 2. 카카오 API로 ETA 계산 (현재 위치가 제공된 경우)
        if (currentLat && currentLng && request.address) {
            try {
                etaMinutes = yield (0, kakaoRoute_1.getSingleRouteETA)(currentLng.toString(), currentLat.toString(), request.address);
            }
            catch (etaError) {
                console.error('ETA 계산 실패 (API키 미설정 등), 출발 처리는 계속 진행합니다.', etaError);
                // ETA 계산에 실패해도 출발 처리는 진행해야 하므로 에러를 무시합니다.
            }
        }
        // 3. 상태 업데이트
        const updatedRequest = yield prisma_1.prisma.request.update({
            where: { id: id },
            data: {
                status: statusService_1.getStatusForAction.onDriverDeparted(),
                etaMinutes
            }
        });
        // 4. 파트너(사장님)의 비즈메시지 설정 확인
        let useBizMessage = false;
        if (request.partnerId) {
            const partner = yield prisma_1.prisma.user.findUnique({ where: { id: request.partnerId } });
            if (partner) {
                useBizMessage = partner.useBizMessage;
            }
        }
        // 5. 고객에게 알림톡/문자 발송
        yield (0, notificationService_1.sendDepartureNotification)(request.phone, request.userName, etaMinutes, useBizMessage);
        res.json({ message: '출발 처리가 완료되었습니다.', request: updatedRequest });
    }
    catch (error) {
        console.error('출발 처리 에러:', error);
        res.status(500).json({ error: '출발 처리 중 문제가 발생했습니다.' });
    }
}));
exports.default = router;
