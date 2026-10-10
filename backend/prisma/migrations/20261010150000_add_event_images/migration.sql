-- 이벤트 인증 스샷 이미지 컬럼 추가 (nullable → 기존 리뷰 데이터에 영향 없음)
-- 30c85c9 배포 시 schema.prisma만 수정되고 마이그레이션이 누락되어 운영 DB에 컬럼이 없던 문제를 복구
ALTER TABLE "BoardPost" ADD COLUMN "eventImage1" TEXT, ADD COLUMN "eventImage2" TEXT, ADD COLUMN "eventImage3" TEXT;
