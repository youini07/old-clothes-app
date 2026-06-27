import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// 사용자가 속한 채팅방 목록 조회 (관리자는 모든 방, 고객은 본인 방)
router.get('/rooms', async (req, res) => {
  const { userId, role } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const rooms = await prisma.chatRoom.findMany({
      where: role === 'ADMIN' ? undefined : {
        OR: [
          { customerId: String(userId) },
          { partnerId: String(userId) }
        ]
      },
      include: {
        customer: { select: { name: true, phone: true } },
        partner: { select: { businessName: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// 특정 방의 과거 메시지 불러오기
router.get('/rooms/:roomId/messages', async (req, res) => {
  const { roomId } = req.params;
  
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { name: true, role: true } }
      }
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 고객이 특정 파트너(혹은 대표번호)와의 채팅방 생성/조회
router.post('/rooms/init', async (req, res) => {
  const { customerId } = req.body;
  let { partnerId } = req.body;
  
  try {
    if (!partnerId) {
      const defaultAdmin = await prisma.user.findFirst({
        where: { role: { in: ['SUPER_ADMIN', 'PARTNER'] } }
      });
      if (defaultAdmin) {
        partnerId = defaultAdmin.id;
      } else {
        return res.status(400).json({ error: 'No admin found to chat with' });
      }
    }

    let room = await prisma.chatRoom.findFirst({
      where: { customerId, partnerId }
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: { customerId, partnerId }
      });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Failed to init room' });
  }
});

export default router;
