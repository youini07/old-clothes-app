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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// 사용자가 속한 채팅방 목록 조회 (관리자는 모든 방, 고객은 본인 방)
router.get('/rooms', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, role } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    try {
        const rooms = yield prisma_1.prisma.chatRoom.findMany({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
}));
// 특정 방의 과거 메시지 불러오기
router.get('/rooms/:roomId/messages', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { roomId } = req.params;
    try {
        const messages = yield prisma_1.prisma.chatMessage.findMany({
            where: { roomId },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: { select: { name: true, role: true } }
            }
        });
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
}));
// 고객이 특정 파트너(혹은 대표번호)와의 채팅방 생성/조회
router.post('/rooms/init', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { customerId } = req.body;
    let { partnerId } = req.body;
    try {
        if (!partnerId) {
            let defaultAdmin = yield prisma_1.prisma.user.findFirst({
                where: { role: { in: ['SUPER_ADMIN', 'PARTNER'] } }
            });
            if (!defaultAdmin) {
                defaultAdmin = yield prisma_1.prisma.user.create({
                    data: {
                        name: '고객센터',
                        email: 'admin@all-cle.com',
                        role: 'SUPER_ADMIN'
                    }
                });
            }
            partnerId = defaultAdmin.id;
        }
        let room = yield prisma_1.prisma.chatRoom.findFirst({
            where: { customerId, partnerId }
        });
        if (!room) {
            room = yield prisma_1.prisma.chatRoom.create({
                data: { customerId, partnerId }
            });
        }
        res.json(room);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to init room' });
    }
}));
exports.default = router;
