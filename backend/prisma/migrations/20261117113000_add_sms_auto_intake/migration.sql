-- ALL-CLEAR(올클): 010 대표번호 문자 자동 수거신청 컬럼 및 대표번호·AI 키 영구 저장 컬럼 추가
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "requestSource" TEXT NOT NULL DEFAULT 'WEB';
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "rawSmsText" TEXT;

CREATE INDEX IF NOT EXISTS "Request_requestSource_createdAt_idx" ON "Request"("requestSource", "createdAt");

ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "representativePhone" TEXT;
ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT;
