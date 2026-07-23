import cron from 'node-cron';
import { prisma } from '../lib/prisma';
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

  // 매일 새벽 3시에 실행 (30일 경과된 휴지통 계정 영구 삭제)
  cron.schedule('0 3 * * *', async () => {
    console.log('[Account Cleanup] 30일 경과 휴지통 계정 영구 삭제 스케줄러 실행...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const targetUsers = await prisma.user.findMany({
        where: {
          deletedAt: {
            lte: thirtyDaysAgo
          }
        }
      });

      console.log(`[Account Cleanup] 삭제 대상 수: ${targetUsers.length}명`);

      for (const user of targetUsers) {
        if (user.role === 'PARTNER') {
          await prisma.coverage.deleteMany({ where: { partnerId: user.id } });
          await prisma.customRegion.deleteMany({ where: { partnerId: user.id } });
          const drivers = await prisma.driverProfile.findMany({ where: { partnerId: user.id } });
          for (const d of drivers) {
            await prisma.driverProfile.delete({ where: { id: d.id } });
            await prisma.user.delete({ where: { id: d.userId } });
          }
          await prisma.request.updateMany({
            where: { partnerId: user.id, status: { not: 'COMPLETED' } },
            data: { partnerId: null, driverId: null, status: 'PENDING' }
          });
          await prisma.request.updateMany({
            where: { partnerId: user.id, status: 'COMPLETED' },
            data: { partnerId: null, driverId: null }
          });
          const rooms = await prisma.chatRoom.findMany({ where: { partnerId: user.id } });
          for (const r of rooms) {
            await prisma.chatMessage.deleteMany({ where: { roomId: r.id } });
            await prisma.chatRoom.delete({ where: { id: r.id } });
          }
          await prisma.chatMessage.deleteMany({ where: { senderId: user.id } });
          
          // 게시판 및 파트너 단가표 삭제
          const boardPosts = await prisma.boardPost.findMany({ where: { partnerId: user.id } });
          const postIds = boardPosts.map((p: any) => p.id);
          if (postIds.length > 0) {
            await prisma.boardComment.deleteMany({ where: { postId: { in: postIds } } });
            await prisma.boardPost.deleteMany({ where: { partnerId: user.id } });
          }
          await prisma.boardComment.deleteMany({ where: { authorId: user.id } });
          
          await prisma.partnerPriceItem.deleteMany({ where: { partnerId: user.id } });
          await prisma.user.delete({ where: { id: user.id } });
        } else if (user.role === 'DRIVER') {
          const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
          if (driverProfile) {
            await prisma.request.updateMany({
              where: { driverId: driverProfile.id, status: { not: 'COMPLETED' } },
              data: { driverId: null, status: 'ASSIGNED', confirmedDate: null, etaMinutes: null }
            });
            await prisma.driverProfile.delete({ where: { id: driverProfile.id } });
          }
          await prisma.user.delete({ where: { id: user.id } });
        } else {
          await prisma.user.delete({ where: { id: user.id } });
        }
      }

      console.log(`[Account Cleanup] 영구 삭제 완료: 총 ${targetUsers.length}명`);
    } catch (error) {
      console.error('[Account Cleanup] 실행 중 오류 발생:', error);
    }
  });
};
