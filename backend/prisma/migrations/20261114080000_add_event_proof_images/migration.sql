-- 홈페이지 치킨 이벤트 지난달 당첨자 기프티콘 전송 인증 스샷 및 제목 컬럼 추가 (nullable -> 기존 데이터 영향 없음)
ALTER TABLE "GlobalSettings"
ADD COLUMN IF NOT EXISTS "eventProofTitle" TEXT,
ADD COLUMN IF NOT EXISTS "eventProofImages" JSONB;
