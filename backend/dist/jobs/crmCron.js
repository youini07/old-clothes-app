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
exports.initCrmCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../lib/prisma");
const notificationService_1 = require("../services/notificationService");
// 매일 오전 10시에 실행
// 0 10 * * *
const initCrmCron = () => {
    node_cron_1.default.schedule('0 10 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log('[CRM Automation] 3개월 리텐션 알림톡 스케줄러 실행...');
        try {
            // 90일 전의 날짜 계산 (자정 기준)
            const targetDateStart = new Date();
            targetDateStart.setDate(targetDateStart.getDate() - 90);
            targetDateStart.setHours(0, 0, 0, 0);
            const targetDateEnd = new Date(targetDateStart);
            targetDateEnd.setDate(targetDateEnd.getDate() + 1);
            // 대상 Request 검색: 완료된 지 90일 지남, 아직 CRM 안 보냄, 파트너가 CRM 자동화 사용 중
            const targetRequests = yield prisma_1.prisma.request.findMany({
                where: {
                    status: 'COMPLETED',
                    crmSent: false,
                    completedDate: {
                        gte: targetDateStart,
                        lt: targetDateEnd
                    },
                    partner: {
                        useCrmAutomation: true
                    }
                },
                include: {
                    partner: true
                }
            });
            console.log(`[CRM Automation] 발송 대상 수: ${targetRequests.length}건`);
            let successCount = 0;
            for (const req of targetRequests) {
                if (!req.partner)
                    continue;
                // 알림톡 발송
                // TODO: 실제 프론트엔드 도메인으로 변경 (환경변수 사용)
                const appLink = process.env.FRONTEND_URL || 'https://all-cle.com';
                const success = yield (0, notificationService_1.sendCrmNotification)(req.phone, req.userName, req.partner.businessName || req.partner.name, appLink);
                if (success) {
                    // 중복 발송 방지를 위해 crmSent 업데이트
                    yield prisma_1.prisma.request.update({
                        where: { id: req.id },
                        data: { crmSent: true }
                    });
                    successCount++;
                }
            }
            console.log(`[CRM Automation] 발송 완료: 총 ${successCount}건 성공`);
        }
        catch (error) {
            console.error('[CRM Automation] 실행 중 오류 발생:', error);
        }
    }));
};
exports.initCrmCron = initCrmCron;
