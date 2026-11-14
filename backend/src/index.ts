import 'dotenv/config';
import express from 'express';
import http from 'http';
import zlib from 'zlib';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initSocket } from './socket';
import authRouter from './routes/auth';
import requestsRouter from './routes/requests';
import adminRouter from './routes/admin';
import driverRouter from './routes/driver';
import chatRouter from './routes/chat';
import boardRouter from './routes/board';
import { globalErrorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { normalizeEventProofImages } from './lib/eventProofUtils';


const app = express();
app.set('trust proxy', 1); // 리버스 프록시(Railway, Vercel 등) 환경에서 클라이언트 IP를 정상적으로 가져오기 위함
const server = http.createServer(app);
const port = process.env.PORT || 5000;

initSocket(server);

// CORS 설정 강화
app.use(cors({
  origin: true, // 임시로 모든 도메인 허용 (배포된 프론트엔드 도메인에서 접속 가능하도록)
  credentials: true
}));

// 왜: 외부 패키지 의존성 없이 대용량 JSON API 응답의 네트워크 송신 트래픽(Egress)을 70~90% 절감하기 위해
// 1KB 이상의 JSON 응답에 대해 Node 내장 zlib으로 gzip 압축을 수행함
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (typeof acceptEncoding === 'string' && acceptEncoding.includes('gzip') && !res.headersSent) {
      try {
        const jsonString = JSON.stringify(body);
        if (jsonString && jsonString.length > 1024) {
          const compressed = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Vary', 'Accept-Encoding');
          res.setHeader('Content-Length', String(compressed.length));
          return res.send(compressed);
        }
      } catch {
        // 압축 실패 시 원본 JSON 응답으로 안전하게 폴백
      }
    }
    return originalJson(body);
  };
  next();
});

// Rate Limiting 설정
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  limit: 200, // 전역 API는 15분에 200회 허용
  message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' }
});

const requestsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5, // 수거 신청은 15분에 5번까지만 허용 (스팸 방지)
  message: { error: '단시간에 수거 신청을 너무 많이 하셨습니다. 15분 후에 다시 시도해주세요.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // 로그인/인증 등은 15분에 10번까지만 허용 (브루트포스 방지)
  message: { error: '인증 시도가 너무 많습니다. 15분 후에 다시 시도해주세요.' }
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// 전역 Rate Limiter 적용
app.use('/api', globalLimiter);

// 엄격한 Rate Limiter 적용 (라우터 등록 전에 미들웨어로 적용)
app.post('/api/requests', requestsLimiter);
app.post('/api/auth/login', authLimiter);
app.post('/api/auth/register', authLimiter);

// 라우터 등록
app.use('/api/auth', authRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/driver', driverRouter);
app.use('/api/chat', chatRouter);
app.use('/api/board', boardRouter);

// 공개(Public) API - 공지사항 등
// 왜 eventProofImages 본문을 제외하는가:
// GlobalNoticeBanner가 모든 페이지에서 이 API를 호출하므로, 여러 장의 Base64 인증샷을 제외하고 개수(eventProofCount)만 내려
// 불필요한 네트워크 Egress 및 서버 메모리 사용을 방지하기 위함입니다. 실제 이미지는 /api/public/event-proof-images로 온디맨드 조회합니다.
app.get('/api/public/global-settings', async (req, res) => {
  try {
    const settings = await prisma.globalSettings.findUnique({ where: { id: 'global' } });
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
        updatedAt: null
      });
    }
    const proofImages = normalizeEventProofImages(settings.eventProofImages);
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
      updatedAt: settings.updatedAt
    });
  } catch (error) {
    res.status(500).json({ message: '서버 오류' });
  }
});

// 공개(Public) API - 치킨 이벤트 지난달 당첨자 기프티콘 발송 인증 스샷 (랜딩 페이지 이벤트 섹션 전용 온디맨드 조회)
app.get('/api/public/event-proof-images', async (req, res) => {
  try {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
      select: { eventProofTitle: true, eventProofImages: true, updatedAt: true }
    });
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    res.json({
      eventProofTitle: settings?.eventProofTitle ?? null,
      eventProofImages: normalizeEventProofImages(settings?.eventProofImages),
      updatedAt: settings?.updatedAt ?? null
    });
  } catch (error) {
    res.status(500).json({ message: '서버 오류' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.1.0-perf', message: 'Backend is running!' });
});

import { initCrmCron } from './jobs/crmCron';

// 글로벌 에러 핸들러 (반드시 모든 라우트 아래에 위치)
app.use(globalErrorHandler);

// 스케줄러 초기화
initCrmCron();

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
