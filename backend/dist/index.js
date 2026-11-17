"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const zlib_1 = __importDefault(require("zlib"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const socket_1 = require("./socket");
const auth_1 = __importDefault(require("./routes/auth"));
const requests_1 = __importDefault(require("./routes/requests"));
const admin_1 = __importDefault(require("./routes/admin"));
const driver_1 = __importDefault(require("./routes/driver"));
const chat_1 = __importDefault(require("./routes/chat"));
const board_1 = __importDefault(require("./routes/board"));
const smsWebhook_1 = __importStar(require("./routes/smsWebhook"));
const errorHandler_1 = require("./middleware/errorHandler");
const prisma_1 = require("./lib/prisma");
const eventProofUtils_1 = require("./lib/eventProofUtils");
const representativePhoneService_1 = require("./services/representativePhoneService");
const app = (0, express_1.default)();
app.set('trust proxy', 1); // 리버스 프록시(Railway, Vercel 등) 환경에서 클라이언트 IP를 정상적으로 가져오기 위함
const server = http_1.default.createServer(app);
const port = process.env.PORT || 5000;
(0, socket_1.initSocket)(server);
// CORS 설정 강화
app.use((0, cors_1.default)({
    origin: true, // 임시로 모든 도메인 허용 (배포된 프론트엔드 도메인에서 접속 가능하도록)
    credentials: true
}));
// 왜: 외부 패키지 의존성 없이 대용량 JSON API 응답의 네트워크 송신 트래픽(Egress)을 70~90% 절감하기 위해
// 1KB 이상의 JSON 응답에 대해 Node 내장 zlib으로 gzip 압축을 수행함
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const acceptEncoding = req.headers['accept-encoding'] || '';
        if (typeof acceptEncoding === 'string' && acceptEncoding.includes('gzip') && !res.headersSent) {
            try {
                const jsonString = JSON.stringify(body);
                if (jsonString && jsonString.length > 1024) {
                    const compressed = zlib_1.default.gzipSync(Buffer.from(jsonString, 'utf-8'));
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.setHeader('Content-Encoding', 'gzip');
                    res.setHeader('Vary', 'Accept-Encoding');
                    res.setHeader('Content-Length', String(compressed.length));
                    return res.send(compressed);
                }
            }
            catch (_a) {
                // 압축 실패 시 원본 JSON 응답으로 안전하게 폴백
            }
        }
        return originalJson(body);
    };
    next();
});
// Rate Limiting 설정
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15분
    limit: 200, // 전역 API는 15분에 200회 허용
    message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' }
});
const requestsLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 5, // 수거 신청은 15분에 5번까지만 허용 (스팸 방지)
    message: { error: '단시간에 수거 신청을 너무 많이 하셨습니다. 15분 후에 다시 시도해주세요.' }
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 10, // 로그인/인증 등은 15분에 10번까지만 허용 (브루트포스 방지)
    message: { error: '인증 시도가 너무 많습니다. 15분 후에 다시 시도해주세요.' }
});
// 왜 문자 웹훅 리미터를 전역 리미터보다 먼저 분리 등록하는가:
// 대시보드 API 클릭량과 무관하게 사무실 010 공기계에서 보내는 문자 자동접수 웹훅이 429 차단으로 유실되지 않도록 격리합니다.
const smsWebhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 1500,
    message: { error: '문자 수신 웹훅 한도를 초과했습니다.' }
});
app.use(express_1.default.json({ limit: '20mb' }));
app.use(express_1.default.urlencoded({ limit: '20mb', extended: true }));
// 사무실 대표번호 SMS 자동접수 및 전용 APK 다운로드 라우터 (전역 리미터보다 앞단에 등록)
app.use('/api/sms', smsWebhookLimiter, smsWebhook_1.default);
// 전역 Rate Limiter 적용
app.use('/api', globalLimiter);
// 엄격한 Rate Limiter 적용 (라우터 등록 전에 미들웨어로 적용)
app.post('/api/requests', requestsLimiter);
app.post('/api/auth/login', authLimiter);
app.post('/api/auth/register', authLimiter);
// 라우터 등록
app.use('/api/auth', auth_1.default);
app.use('/api/requests', requests_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/driver', driver_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/board', board_1.default);
// 공개(Public) API - 공지사항 등
// 왜 eventProofImages 본문을 제외하는가:
// GlobalNoticeBanner가 모든 페이지에서 이 API를 호출하므로, 여러 장의 Base64 인증샷을 제외하고 개수(eventProofCount)만 내려
// 불필요한 네트워크 Egress 및 서버 메모리 사용을 방지하기 위함입니다. 실제 이미지는 /api/public/event-proof-images로 온디맨드 조회합니다.
app.get('/api/public/global-settings', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [settings, representativePhone] = yield Promise.all([
            prisma_1.prisma.globalSettings.findUnique({ where: { id: 'global' } }),
            (0, representativePhoneService_1.getRepresentativePhone)(),
        ]);
        res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
        if (!settings) {
            return res.json({
                globalNotice: null,
                noticeIsActive: false,
                globalNoticeDetail: null,
                popupImageUrl: null,
                popupIsActive: false,
                eventYoutubeUrl: null,
                eventProofTitle: null,
                eventProofCount: 0,
                representativePhone,
                updatedAt: null
            });
        }
        const proofImages = (0, eventProofUtils_1.normalizeEventProofImages)(settings.eventProofImages);
        res.json({
            id: settings.id,
            globalNotice: settings.globalNotice,
            noticeIsActive: settings.noticeIsActive,
            globalNoticeDetail: settings.globalNoticeDetail,
            popupImageUrl: settings.popupImageUrl,
            popupIsActive: settings.popupIsActive,
            eventYoutubeUrl: settings.eventYoutubeUrl,
            eventProofTitle: settings.eventProofTitle,
            eventProofCount: proofImages.length,
            representativePhone,
            updatedAt: settings.updatedAt
        });
    }
    catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
}));
// 공개(Public) API - 치킨 이벤트 지난달 당첨자 기프티콘 발송 인증 스샷 (랜딩 페이지 이벤트 섹션 전용 온디맨드 조회)
app.get('/api/public/event-proof-images', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const settings = yield prisma_1.prisma.globalSettings.findUnique({
            where: { id: 'global' },
            select: { eventProofTitle: true, eventProofImages: true, updatedAt: true }
        });
        res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
        res.json({
            eventProofTitle: (_a = settings === null || settings === void 0 ? void 0 : settings.eventProofTitle) !== null && _a !== void 0 ? _a : null,
            eventProofImages: (0, eventProofUtils_1.normalizeEventProofImages)(settings === null || settings === void 0 ? void 0 : settings.eventProofImages),
            updatedAt: (_b = settings === null || settings === void 0 ? void 0 : settings.updatedAt) !== null && _b !== void 0 ? _b : null
        });
    }
    catch (error) {
        res.status(500).json({ message: '서버 오류' });
    }
}));
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.1.0-perf', message: 'Backend is running!' });
});
const crmCron_1 = require("./jobs/crmCron");
// 글로벌 에러 핸들러 (반드시 모든 라우트 아래에 위치)
app.use(errorHandler_1.globalErrorHandler);
// 스케줄러 초기화
(0, crmCron_1.initCrmCron)();
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    // 서버 시작 시 문자 자동접수 스키마 보장 및 DB에 영구 백업된 Gemini AI 키 복원
    void (0, smsWebhook_1.ensureSmsSchemaColumnsAndGeminiKey)();
});
