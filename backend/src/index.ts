import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth';
import requestsRouter from './routes/requests';
import adminRouter from './routes/admin';
import driverRouter from './routes/driver';
import { globalErrorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// CORS 설정 강화
app.use(cors({
  origin: true, // 임시로 모든 도메인 허용 (배포된 프론트엔드 도메인에서 접속 가능하도록)
  credentials: true
}));

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running!' });
});

import { initCrmCron } from './jobs/crmCron';

// 글로벌 에러 핸들러 (반드시 모든 라우트 아래에 위치)
app.use(globalErrorHandler);

// 스케줄러 초기화
initCrmCron();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
