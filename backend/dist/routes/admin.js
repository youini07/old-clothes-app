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
const validateMiddleware_1 = require("../middleware/validateMiddleware");
const statusService_1 = require("../services/statusService");
const kakaoRoute_1 = require("../services/kakaoRoute");
const notificationService_1 = require("../services/notificationService");
const router = express_1.default.Router();
// ==========================================
// [SUPER_ADMIN 전용] 플랫폼 관리 기능
// ==========================================
// 1. 전체 지역 파트너(업체 사장님) 목록 및 신청 내역 조회
router.get('/partners', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield prisma_1.prisma.user.findMany({
            where: { role: 'PARTNER' },
            include: {
                coverageRegions: {
                    include: { region: true }
                }
            }
        });
        // UI에 맞는 형식으로 변환
        const partners = users.map(user => ({
            id: user.id,
            businessName: user.businessName || user.name + ' (상호명)', // DB 상호명 우선
            ownerName: user.name,
            phone: user.phone || '연락처 없음',
            isApproved: user.isApproved,
            useBizMessage: user.useBizMessage,
            regions: user.coverageRegions.map((cr) => ({
                regionId: cr.region.id,
                province: cr.region.province,
                city: cr.region.city,
                town: cr.region.town || ''
            }))
        }));
        res.json({ partners });
    }
    catch (error) {
        res.status(500).json({ error: '파트너 목록 조회 실패' });
    }
}));
// 파트너 권역 추가 (시 단위로 통일 — 동(dong) 값은 무시)
router.post('/partners/:id/coverage', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { province, city } = req.body;
    // 동(dong) 값은 무시하고 항상 시(city) 단위로 저장
    const town = null;
    try {
        // 같은 province+city 조합이 이미 있으면 재사용, 없으면 생성
        let region = yield prisma_1.prisma.region.findFirst({
            where: { province, city, town: null }
        });
        if (!region) {
            region = yield prisma_1.prisma.region.create({
                data: { province, city, town: null }
            });
        }
        // 이미 동일한 권역이 할당되어 있는지 확인
        const existingCoverage = yield prisma_1.prisma.coverage.findFirst({
            where: { partnerId: id, regionId: region.id }
        });
        if (existingCoverage) {
            return res.json({ message: '이미 해당 권역이 설정되어 있습니다.', coverage: existingCoverage });
        }
        const coverage = yield prisma_1.prisma.coverage.create({
            data: {
                partnerId: id,
                regionId: region.id
            }
        });
        res.json({ message: `${city} 전역이 권역으로 추가되었습니다.`, coverage });
    }
    catch (error) {
        console.error('권역 추가 에러:', error);
        res.status(500).json({ error: '권역 추가 중 오류가 발생했습니다.' });
    }
}));
// 파트너 권역 삭제 (새로운 라우트)
router.delete('/partners/:id/coverage/:regionId', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, regionId } = req.params;
    try {
        // coverage의 고유 복합키를 찾거나, 직접 삭제
        // Prisma에서 deleteMany를 사용하거나 고유 제약조건을 이용해 삭제합니다.
        yield prisma_1.prisma.coverage.deleteMany({
            where: {
                partnerId: id,
                regionId: regionId
            }
        });
        res.json({ message: '권역이 성공적으로 삭제되었습니다.' });
    }
    catch (error) {
        console.error('권역 삭제 에러:', error);
        res.status(500).json({ error: '권역 삭제 중 오류가 발생했습니다.' });
    }
}));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// 파트너 사장님 수동 등록 (입력값 검증 포함)
router.post('/partners', validateMiddleware_1.validatePartner, authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, phone, email, businessName, province, city } = req.body;
    // 동(dong) 값은 무시하고 항상 시(city) 단위로 저장
    const town = null;
    try {
        // 1. 파트너 계정 찾거나 생성 (초기 비밀번호는 연락처로 설정 후 암호화)
        const initialPassword = phone || '12345678';
        const hashedPassword = yield bcryptjs_1.default.hash(initialPassword, 10);
        // 이미 가입된 이메일이 있다면 역할만 업데이트, 없으면 새로 생성
        const newPartner = yield prisma_1.prisma.user.upsert({
            where: { email },
            update: {
                name,
                phone,
                password: hashedPassword,
                businessName,
                role: 'PARTNER',
                isApproved: true
            },
            create: {
                name,
                phone,
                email,
                password: hashedPassword,
                businessName,
                role: 'PARTNER',
                isApproved: true
            }
        });
        // 2. 권역 찾기 또는 생성 (시 단위로 통일)
        let region = yield prisma_1.prisma.region.findFirst({
            where: { province, city, town: null }
        });
        if (!region) {
            region = yield prisma_1.prisma.region.create({
                data: { province, city, town: null }
            });
        }
        // 3. 파트너에게 권역 할당
        yield prisma_1.prisma.coverage.create({
            data: {
                partnerId: newPartner.id,
                regionId: region.id
            }
        });
        res.json({ message: '파트너가 성공적으로 등록되었습니다.', partner: newPartner });
    }
    catch (error) {
        console.error('파트너 등록 에러:', error);
        res.status(500).json({ error: '파트너 등록 중 오류가 발생했습니다.' });
    }
}));
// 2. 파트너 승인 처리 (새로운 라우트)
router.patch('/partners/:id/approve', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const updatedPartner = yield prisma_1.prisma.user.update({
            where: { id, role: 'PARTNER' },
            data: { isApproved: true }
        });
        res.json({ message: '파트너가 승인되었습니다.', partner: updatedPartner });
    }
    catch (error) {
        res.status(500).json({ error: '파트너 승인 처리 실패' });
    }
}));
// 기존 coverage approve 삭제 또는 유지
// router.post('/coverage/approve', ...) -> 주석 처리 또는 제거
// 3. 파트너 알림톡 사용 여부 토글 (ON/OFF)
router.patch('/partners/:id/biz-message', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { useBizMessage } = req.body;
    try {
        const updatedPartner = yield prisma_1.prisma.user.update({
            where: { id, role: 'PARTNER' },
            data: { useBizMessage }
        });
        res.json({ message: '알림톡 설정이 변경되었습니다.', partner: updatedPartner });
    }
    catch (error) {
        res.status(500).json({ error: '알림톡 설정 변경 실패' });
    }
}));
// ==========================================
// [PARTNER 전용] 파트너 업체 대시보드 기능
// ==========================================
// 1. 본인 권역에 들어온 수거 신청 목록 조회
// - 권역 미설정 사장님 → 전체 미배정 요청 노출
// - 권역 설정된 사장님 → 해당 시(city) 주소의 미배정 요청 노출
router.get('/requests', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER', 'SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const partnerId = req.user.userId;
        // 파트너가 담당하는 권역 정보 가져오기
        const coverages = yield prisma_1.prisma.coverage.findMany({
            where: { partnerId },
            include: { region: true }
        });
        let requests;
        if (coverages.length === 0) {
            // 권역 미설정 → 전체 지역의 미배정 요청 + 본인에게 이미 배정된 요청
            requests = yield prisma_1.prisma.request.findMany({
                where: {
                    OR: [
                        { partnerId: null, status: 'PENDING' }, // 아직 아무도 수락하지 않은 건
                        { partnerId: partnerId } // 이미 본인이 수락한 건
                    ]
                },
                include: {
                    driver: { include: { user: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }
        else {
            // 권역 설정됨 → 해당 시(city)의 주소를 가진 미배정 요청 + 본인 배정 건
            // 권역에서 city 목록 추출 (예: ['평택시', '안성시'])
            const cities = coverages.map((c) => c.region.city);
            // 모든 미배정 요청을 가져온 후, 주소에 해당 city가 포함된 것만 필터링
            const allPending = yield prisma_1.prisma.request.findMany({
                where: { partnerId: null, status: 'PENDING' },
                include: { driver: { include: { user: true } } },
                orderBy: { createdAt: 'desc' }
            });
            // 주소에서 시(city) 매칭 필터링
            const matchedPending = allPending.filter((r) => {
                return cities.some((city) => r.address.includes(city));
            });
            // 본인에게 이미 배정된 건도 포함
            const myRequests = yield prisma_1.prisma.request.findMany({
                where: { partnerId: partnerId },
                include: { driver: { include: { user: true } } },
                orderBy: { createdAt: 'desc' }
            });
            // 중복 제거 후 합치기
            const requestMap = new Map();
            [...matchedPending, ...myRequests].forEach((r) => requestMap.set(r.id, r));
            requests = Array.from(requestMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        res.json({ requests });
    }
    catch (error) {
        console.error('수거 신청 목록 조회 실패:', error);
        res.status(500).json({ error: '수거 신청 목록 조회 실패' });
    }
}));
// 수거 요청 수락 (선착순 방식 — 먼저 수락한 사장님에게 배정)
router.post('/requests/:id/claim', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER', 'SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const partnerId = req.user.userId;
    try {
        // 해당 요청의 현재 상태 확인
        const request = yield prisma_1.prisma.request.findUnique({ where: { id } });
        if (!request) {
            return res.status(404).json({ error: '해당 수거 신청을 찾을 수 없습니다.' });
        }
        // 이미 다른 사장님이 수락한 건인지 확인 (동시성 제어)
        if (request.partnerId !== null) {
            if (request.partnerId === partnerId) {
                return res.status(400).json({ error: '이미 본인이 수락한 건입니다.' });
            }
            return res.status(409).json({ error: '이미 다른 업체에서 수락한 건입니다.' });
        }
        const updated = yield prisma_1.prisma.request.update({
            where: {
                id,
                partnerId: null // 동시성 방어: null인 경우에만 업데이트
            },
            data: {
                partnerId,
                status: 'ASSIGNED'
            },
            include: { partner: true }
        });
        // 업체 배정 안내 알림톡 발송 (비동기)
        if (updated.partner && updated.partner.useBizMessage) {
            (0, notificationService_1.sendAssignmentToCustomer)(updated.phone, updated.userName, updated.partner.businessName || updated.partner.name, updated.partner.useBizMessage).catch(err => console.error('배정 안내 알림톡 전송 실패:', err));
        }
        res.json({
            message: '수거 요청을 수락했습니다! 기사를 배정해주세요.',
            request: updated
        });
    }
    catch (error) {
        // Prisma P2025: Record not found (다른 사장님이 이미 수락)
        if ((error === null || error === void 0 ? void 0 : error.code) === 'P2025') {
            return res.status(409).json({ error: '이미 다른 업체에서 수락한 건입니다.' });
        }
        console.error('수거 요청 수락 오류:', error);
        res.status(500).json({ error: '수거 요청 수락 중 오류가 발생했습니다.' });
    }
}));
// 2. 수거 기사(Driver) 목록 조회
router.get('/drivers', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const partnerId = req.user.userId;
        const drivers = yield prisma_1.prisma.driverProfile.findMany({
            where: { partnerId },
            include: { user: true }
        });
        res.json({ drivers });
    }
    catch (error) {
        res.status(500).json({ error: '기사 목록 조회 실패' });
    }
}));
// 기사(Driver) 신규 등록 (입력값 검증 포함)
router.post('/drivers', validateMiddleware_1.validateDriver, authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const partnerId = req.user.userId;
        const { name, phone, email, vehicleInfo } = req.body;
        // 초기 비밀번호는 연락처로 설정
        const initialPassword = phone || '12345678';
        const hashedPassword = yield bcryptjs_1.default.hash(initialPassword, 10);
        // 1. User 테이블에 기사 계정 생성 (또는 업데이트)
        const newDriverUser = yield prisma_1.prisma.user.upsert({
            where: { email },
            update: {
                name,
                phone,
                password: hashedPassword,
                role: 'DRIVER',
                isApproved: true
            },
            create: {
                name,
                phone,
                email,
                password: hashedPassword,
                role: 'DRIVER',
                isApproved: true
            }
        });
        // 2. DriverProfile 생성 (또는 업데이트)
        const newDriverProfile = yield prisma_1.prisma.driverProfile.upsert({
            where: { userId: newDriverUser.id },
            update: {
                partnerId,
                vehicleInfo
            },
            create: {
                userId: newDriverUser.id,
                partnerId,
                vehicleInfo
            }
        });
        // 응답 시 프론트엔드 형식에 맞게 user 정보 포함
        res.json({ message: '기사님이 성공적으로 등록되었습니다.', driver: Object.assign(Object.assign({}, newDriverProfile), { user: newDriverUser }) });
    }
    catch (error) {
        console.error('기사 등록 에러:', error);
        res.status(500).json({ error: '기사 등록 중 오류가 발생했습니다.' });
    }
}));
// 3. 기사에게 수거 신청건 배정 (일정 및 동선 확정)
router.post('/assign-driver', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { requestId, driverId, confirmedDate } = req.body;
    try {
        const request = yield prisma_1.prisma.request.update({
            where: { id: requestId },
            data: {
                driverId,
                status: statusService_1.getStatusForAction.onDriverAssigned(),
                confirmedDate: new Date(confirmedDate)
            },
            include: { partner: true }
        });
        // 일정 확정 안내 알림톡 발송 (비동기)
        if (request.partner && request.partner.useBizMessage && request.confirmedDate) {
            (0, notificationService_1.sendScheduleConfirmedToCustomer)(request.phone, request.userName, request.confirmedDate, request.partner.useBizMessage).catch(err => console.error('일정 확정 알림톡 전송 실패:', err));
        }
        res.json({ message: '기사 배정이 완료되었습니다.', request });
    }
    catch (error) {
        res.status(500).json({ error: '기사 배정 실패' });
    }
}));
// 4. 기사별 동선 최적화 (카카오 좌표 API 기반 최단거리 정렬)
router.post('/drivers/:driverId/optimize-route', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { driverId } = req.params;
    const partnerId = req.user.userId;
    try {
        // 기사가 이 파트너 소속인지 확인
        const driver = yield prisma_1.prisma.driverProfile.findFirst({
            where: { id: driverId, partnerId }
        });
        if (!driver) {
            return res.status(404).json({ error: '소속 기사를 찾을 수 없습니다.' });
        }
        // 기사에게 배정된 미완료 수거 건 조회
        const requests = yield prisma_1.prisma.request.findMany({
            where: { driverId, status: { not: 'COMPLETED' } }
        });
        if (requests.length <= 1) {
            return res.json({ message: '수거 건수가 적어 동선 최적화가 필요하지 않습니다.', requests });
        }
        // 파트너(본사) 주소 조회 (출발지)
        const partner = yield prisma_1.prisma.user.findUnique({ where: { id: partnerId } });
        const originAddress = (partner === null || partner === void 0 ? void 0 : partner.address) || '경기 평택시 신장로 72-13'; // 기본값
        // 출발지 좌표 변환
        const originCoords = yield (0, kakaoRoute_1.getCoordinates)(originAddress);
        if (!originCoords) {
            return res.status(400).json({ error: '출발지 주소의 좌표를 찾을 수 없습니다.' });
        }
        // 각 수거지의 좌표 변환
        const destinations = [];
        for (const r of requests) {
            const coords = yield (0, kakaoRoute_1.getCoordinates)(r.address);
            if (coords) {
                destinations.push({
                    request: r,
                    x: parseFloat(coords.x),
                    y: parseFloat(coords.y)
                });
            }
            else {
                // 좌표 변환 실패 시 출발지 근처로 임시 매핑
                destinations.push({
                    request: r,
                    x: parseFloat(originCoords.x),
                    y: parseFloat(originCoords.y)
                });
            }
        }
        // Nearest Neighbor 알고리즘을 이용한 최적 경로 탐색 (유클리드 거리 기반)
        const optimizedList = [];
        let currentX = parseFloat(originCoords.x);
        let currentY = parseFloat(originCoords.y);
        const unvisited = [...destinations];
        while (unvisited.length > 0) {
            let minDistance = Infinity;
            let nextIndex = 0;
            for (let i = 0; i < unvisited.length; i++) {
                const dx = unvisited[i].x - currentX;
                const dy = unvisited[i].y - currentY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    minDistance = distance;
                    nextIndex = i;
                }
            }
            const nextTarget = unvisited.splice(nextIndex, 1)[0];
            optimizedList.push(nextTarget.request);
            currentX = nextTarget.x;
            currentY = nextTarget.y;
        }
        // 데이터베이스에 정렬된 orderIndex 일괄 업데이트
        yield prisma_1.prisma.$transaction(optimizedList.map((reqItem, idx) => prisma_1.prisma.request.update({
            where: { id: reqItem.id },
            data: { orderIndex: idx }
        })));
        res.json({
            message: '동선 최적화가 완료되었습니다. 기사님 앱에 최적 경로가 반영됩니다.',
            origin: {
                address: originAddress,
                x: originCoords.x,
                y: originCoords.y
            },
            optimizedRequests: optimizedList.map((r, idx) => {
                const dest = destinations.find(d => d.request.id === r.id);
                return {
                    id: r.id,
                    userName: r.userName,
                    address: r.address,
                    orderIndex: idx,
                    x: dest ? dest.x.toString() : originCoords.x,
                    y: dest ? dest.y.toString() : originCoords.y
                };
            })
        });
    }
    catch (error) {
        console.error('동선 최적화 에러:', error);
        res.status(500).json({ error: '동선 최적화 중 오류가 발생했습니다.' });
    }
}));
// ==========================================
// [PARTNER 전용] 정산 및 통계 기능
// ==========================================
router.get('/stats', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER', 'SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const partnerId = req.user.userId;
        // 파트너가 담당하는 권역 ID 목록
        const coverages = yield prisma_1.prisma.coverage.findMany({ where: { partnerId } });
        const regionIds = coverages.map((c) => c.regionId);
        // 해당 파트너에게 배정된 모든 수거 건 조회
        const allRequests = yield prisma_1.prisma.request.findMany({
            where: {
                OR: [
                    { regionId: { in: regionIds } },
                    { partnerId: partnerId }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });
        // 전체 통계 계산
        const totalRequests = allRequests.length;
        const completedRequests = allRequests.filter((r) => r.status === 'COMPLETED');
        const totalWeight = completedRequests.reduce((sum, r) => sum + (r.actualWeight || 0), 0);
        const completionRate = totalRequests > 0 ? Math.round((completedRequests.length / totalRequests) * 100) : 0;
        // 월별 통계 (최근 6개월)
        const monthlyStats = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const year = date.getFullYear();
            const month = date.getMonth();
            const monthLabel = `${year}.${String(month + 1).padStart(2, '0')}`;
            const monthRequests = allRequests.filter((r) => {
                const d = new Date(r.createdAt);
                return d.getFullYear() === year && d.getMonth() === month;
            });
            const monthCompleted = monthRequests.filter((r) => r.status === 'COMPLETED');
            const monthWeight = monthCompleted.reduce((sum, r) => sum + (r.actualWeight || 0), 0);
            monthlyStats.push({
                month: monthLabel,
                count: monthRequests.length,
                weight: Math.round(monthWeight * 10) / 10,
                completed: monthCompleted.length,
            });
        }
        res.json({
            summary: {
                totalRequests,
                completedCount: completedRequests.length,
                totalWeight: Math.round(totalWeight * 10) / 10,
                completionRate,
                pendingCount: allRequests.filter((r) => r.status === 'PENDING').length,
                inProgressCount: allRequests.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED').length,
            },
            monthlyStats,
        });
    }
    catch (error) {
        console.error('통계 조회 에러:', error);
        res.status(500).json({ error: '통계 데이터 조회 실패' });
    }
}));
// ==========================================
// [SUPER_ADMIN 전용] 전국 통합 모니터링
// ==========================================
router.get('/monitoring', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. 전체 수거 건 통계
        const allRequests = yield prisma_1.prisma.request.findMany({
            include: { partner: true },
            orderBy: { createdAt: 'desc' }
        });
        const total = allRequests.length;
        const completed = allRequests.filter((r) => r.status === 'COMPLETED');
        const totalWeight = completed.reduce((s, r) => s + (r.actualWeight || 0), 0);
        // 2. 파트너별 성과 (수거 건수, 완료율, 총 무게)
        const partners = yield prisma_1.prisma.user.findMany({
            where: { role: 'PARTNER' },
            select: { id: true, name: true, businessName: true }
        });
        const partnerStats = partners.map((p) => {
            const pRequests = allRequests.filter((r) => r.partnerId === p.id);
            const pCompleted = pRequests.filter((r) => r.status === 'COMPLETED');
            const pWeight = pCompleted.reduce((s, r) => s + (r.actualWeight || 0), 0);
            return {
                id: p.id,
                name: p.businessName || p.name,
                totalRequests: pRequests.length,
                completedCount: pCompleted.length,
                completionRate: pRequests.length > 0 ? Math.round((pCompleted.length / pRequests.length) * 100) : 0,
                totalWeight: Math.round(pWeight * 10) / 10,
            };
        }).sort((a, b) => b.totalRequests - a.totalRequests);
        // 3. 권역별 현황
        const regions = yield prisma_1.prisma.region.findMany({
            include: { coverages: { include: { partner: true } } }
        });
        const regionStats = regions.map((r) => {
            var _a, _b, _c, _d;
            const rRequests = allRequests.filter((req) => req.regionId === r.id);
            return {
                id: r.id,
                name: `${r.province} ${r.city}${r.town ? ' ' + r.town : ''}`,
                partner: ((_b = (_a = r.coverages[0]) === null || _a === void 0 ? void 0 : _a.partner) === null || _b === void 0 ? void 0 : _b.businessName) || ((_d = (_c = r.coverages[0]) === null || _c === void 0 ? void 0 : _c.partner) === null || _d === void 0 ? void 0 : _d.name) || '미배정',
                requestCount: rRequests.length,
                completedCount: rRequests.filter((req) => req.status === 'COMPLETED').length,
            };
        });
        // 4. 오늘/이번주/이번달 현황
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const todayRequests = allRequests.filter((r) => new Date(r.createdAt) >= todayStart);
        const weekRequests = allRequests.filter((r) => new Date(r.createdAt) >= weekStart);
        const monthRequests = allRequests.filter((r) => new Date(r.createdAt) >= monthStart);
        // 5. 월별 트렌드 (최근 6개월)
        const monthlyTrend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const yr = d.getFullYear(), mo = d.getMonth();
            const mReqs = allRequests.filter((r) => { const c = new Date(r.createdAt); return c.getFullYear() === yr && c.getMonth() === mo; });
            const mWeight = mReqs.filter((r) => r.status === 'COMPLETED').reduce((s, r) => s + (r.actualWeight || 0), 0);
            monthlyTrend.push({ month: `${yr}.${String(mo + 1).padStart(2, '0')}`, count: mReqs.length, weight: Math.round(mWeight * 10) / 10 });
        }
        res.json({
            overview: {
                totalRequests: total,
                completedCount: completed.length,
                totalWeight: Math.round(totalWeight * 10) / 10,
                completionRate: total > 0 ? Math.round((completed.length / total) * 100) : 0,
                pendingCount: allRequests.filter((r) => r.status === 'PENDING').length,
                inProgressCount: allRequests.filter((r) => ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(r.status)).length,
                partnerCount: partners.length,
            },
            period: {
                today: todayRequests.length,
                thisWeek: weekRequests.length,
                thisMonth: monthRequests.length,
            },
            partnerStats,
            regionStats,
            monthlyTrend,
        });
    }
    catch (error) {
        console.error('모니터링 데이터 조회 에러:', error);
        res.status(500).json({ error: '모니터링 데이터 조회 실패' });
    }
}));
// ==========================================
// [DEBUG] 권역 매칭 디버그 엔드포인트 (임시)
// ==========================================
router.get('/debug/regions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const regions = yield prisma_1.prisma.region.findMany({
            include: { coverages: { include: { partner: { select: { id: true, name: true, businessName: true } } } } }
        });
        const recentRequests = yield prisma_1.prisma.request.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, address: true, partnerId: true, regionId: true, status: true, createdAt: true }
        });
        res.json({ regions, recentRequests });
    }
    catch (error) {
        res.status(500).json({ error: 'debug error', details: String(error) });
    }
}));
// [DEBUG] 동(town) 단위 Region을 시(city) 단위로 통합 마이그레이션
router.post('/debug/migrate-regions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. town이 null이 아닌 (동 단위) Region 목록 조회
        const townRegions = yield prisma_1.prisma.region.findMany({
            where: { town: { not: null } },
            include: { coverages: true }
        });
        let migratedCount = 0;
        for (const oldRegion of townRegions) {
            // 2. 해당 시(city) 단위 Region이 이미 있는지 확인
            let cityRegion = yield prisma_1.prisma.region.findFirst({
                where: { province: oldRegion.province, city: oldRegion.city, town: null }
            });
            // 없으면 생성
            if (!cityRegion) {
                cityRegion = yield prisma_1.prisma.region.create({
                    data: { province: oldRegion.province, city: oldRegion.city, town: null }
                });
            }
            // 3. 기존 Coverage를 새 시 단위 Region으로 이전
            for (const coverage of oldRegion.coverages) {
                // 이미 동일한 Coverage가 있는지 확인
                const existing = yield prisma_1.prisma.coverage.findFirst({
                    where: { partnerId: coverage.partnerId, regionId: cityRegion.id }
                });
                if (!existing) {
                    yield prisma_1.prisma.coverage.create({
                        data: { partnerId: coverage.partnerId, regionId: cityRegion.id }
                    });
                }
                // 기존 동 단위 Coverage 삭제
                yield prisma_1.prisma.coverage.delete({ where: { id: coverage.id } });
            }
            // 4. 기존 Request의 regionId도 시 단위로 업데이트
            yield prisma_1.prisma.request.updateMany({
                where: { regionId: oldRegion.id },
                data: { regionId: cityRegion.id }
            });
            // 5. 기존 동 단위 Region 삭제
            yield prisma_1.prisma.region.delete({ where: { id: oldRegion.id } });
            migratedCount++;
        }
        // 6. 기존 미배정 요청을 PENDING 상태로 리셋 (새 선착순 시스템에 맞게)
        const resetResult = yield prisma_1.prisma.request.updateMany({
            where: { partnerId: null, status: { not: 'COMPLETED' } },
            data: { status: 'PENDING' }
        });
        res.json({
            message: `${migratedCount}개 동 단위 권역을 시 단위로 통합 완료. ${resetResult.count}건 미배정 요청 PENDING 초기화.`,
            migratedRegions: migratedCount,
            resetRequests: resetResult.count
        });
    }
    catch (error) {
        console.error('마이그레이션 오류:', error);
        res.status(500).json({ error: 'migration error', details: String(error) });
    }
}));
exports.default = router;
