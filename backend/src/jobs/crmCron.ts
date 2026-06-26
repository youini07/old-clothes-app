import cron from 'node-cron';
import prisma from '../lib/prisma';
import { sendCrmNotification } from '../services/notificationService';

// 매일 오전 10시에 실행
// 0 10 * * *
export const initCrmCron = () => {
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRM Automation] 3개월 리텐션 알림톡 스케줄러 실행...');
    try {
      // 90일 전의 날짜 계산 (자정 기준)
      const targetDateStart = new Date();
      targetDateStart.setDate(targetDateStart.getDate() - 90);
      targetDateStart.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date(targetDateStart);
      targetDateEnd.setDate(targetDateEnd.getDate() + 1);

      // 대상 Request 검색: 완료된 지 90일 지남, 아직 CRM 안 보냄, 파트너가 CRM 자동화 사용 중
      const targetRequests = await prisma.request.findMany({
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
        if (!req.partner) continue;

        // 알림톡 발송
        // TODO: 실제 프론트엔드 도메인으로 변경 (환경변수 사용)
        const appLink = process.env.FRONTEND_URL || 'https://all-cle.com'; 
        
        const success = await sendCrmNotification(
          req.phone,
          req.userName,
          req.partner.businessName || req.partner.name,
          appLink
        );

        if (success) {
          // 중복 발송 방지를 위해 crmSent 업데이트
          await prisma.request.update({
            where: { id: req.id },
            data: { crmSent: true }
          });
          successCount++;
        }
      }

      console.log(`[CRM Automation] 발송 완료: 총 ${successCount}건 성공`);
    } catch (error) {
      console.error('[CRM Automation] 실행 중 오류 발생:', error);
    }
  });
};
