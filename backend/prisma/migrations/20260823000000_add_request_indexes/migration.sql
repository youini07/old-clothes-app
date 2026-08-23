-- Request 테이블 조회 성능 개선 인덱스 추가
CREATE INDEX IF NOT EXISTS "Request_partnerId_status_idx" ON "Request"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "Request_driverId_status_idx" ON "Request"("driverId", "status");
CREATE INDEX IF NOT EXISTS "Request_customerId_idx" ON "Request"("customerId");
CREATE INDEX IF NOT EXISTS "Request_status_createdAt_idx" ON "Request"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Request_desiredDate_idx" ON "Request"("desiredDate");
CREATE INDEX IF NOT EXISTS "Request_confirmedDate_idx" ON "Request"("confirmedDate");
CREATE INDEX IF NOT EXISTS "Request_completedDate_idx" ON "Request"("completedDate");
