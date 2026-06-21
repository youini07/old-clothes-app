import { Request, Response, NextFunction } from 'express';

/**
 * 왜 필요한가:
 * 각 라우트에서 try-catch를 매번 작성하는 것은 반복적이고 실수하기 쉬움.
 * 예상치 못한 에러가 발생하면 서버가 크래시될 수 있음.
 * 이 미들웨어는 모든 에러를 한 곳에서 포착하여 일관된 형식으로 응답.
 */

// 비동기 라우트 핸들러를 감싸서 에러를 자동 포워딩하는 유틸리티
// 사용법: router.get('/path', asyncHandler(async (req, res) => { ... }))
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 글로벌 에러 핸들링 미들웨어 (Express의 4-param 시그니처)
export const globalErrorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('=== 글로벌 에러 핸들러 ===');
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.error('에러 메시지:', err.message);
  console.error('스택 트레이스:', err.stack);
  console.error('========================');

  // Prisma 고유 에러 분류
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      error: '데이터베이스 처리 중 문제가 발생했습니다.',
      code: 'DB_ERROR',
    });
  }

  // JWT 관련 에러
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: '인증 정보가 유효하지 않습니다. 다시 로그인해주세요.',
      code: 'AUTH_ERROR',
    });
  }

  // 기본 서버 에러 응답 (운영 환경에서는 스택 트레이스를 숨김)
  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(500).json({
    error: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    code: 'INTERNAL_ERROR',
    ...(isDev && { detail: err.message }),
  });
};
