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
exports.sendDriverAssignedSystemMessage = exports.getIo = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const prisma_1 = require("./lib/prisma");
let io;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: true,
            credentials: true,
        },
    });
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        // 사용자가 특정 채팅방(1:1방)에 접속
        socket.on('joinRoom', (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, userId }) {
            socket.join(roomId);
            console.log(`User ${userId} joined room ${roomId}`);
        }));
        // 메시지 전송
        socket.on('sendMessage', (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, senderId, content }) {
            try {
                // DB에 메시지 저장
                const message = yield prisma_1.prisma.chatMessage.create({
                    data: {
                        roomId,
                        senderId,
                        content,
                    },
                    include: {
                        sender: {
                            select: { id: true, name: true, role: true }
                        }
                    }
                });
                // 방에 있는 모든 사용자에게 메시지 브로드캐스트
                io.to(roomId).emit('receiveMessage', message);
            }
            catch (error) {
                console.error('Failed to send message:', error);
            }
        }));
        // 방 떠나기
        socket.on('leaveRoom', ({ roomId }) => {
            socket.leave(roomId);
        });
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
};
exports.initSocket = initSocket;
const getIo = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized');
    }
    return io;
};
exports.getIo = getIo;
const sendDriverAssignedSystemMessage = (customerId, partnerId, driverPhone, confirmedDate) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const chatRoom = yield prisma_1.prisma.chatRoom.findUnique({
            where: {
                customerId_partnerId: { customerId, partnerId }
            }
        });
        if (chatRoom) {
            const dateStr = confirmedDate ? new Date(confirmedDate).toLocaleDateString() : '미정';
            const systemMessageContent = `[시스템 안내]\n담당 기사님께 수거가 배정되었습니다.\n\n- 방문 예정일: ${dateStr}\n- 기사님 연락처: ${driverPhone}\n\n수거 물품을 잘 포장하여 사진을 찍어두시면 더욱 원활한 수거가 가능합니다.\n\n담당 기사님이 배정되었으므로, 추가 문의사항이나 일정 조율은 위 기사님 연락처(문자/전화)로 직접 연락 부탁드립니다.\n(이 채팅방을 통한 상담은 여기서 임시 종료됩니다.)`;
            const chatMessage = yield prisma_1.prisma.chatMessage.create({
                data: {
                    roomId: chatRoom.id,
                    senderId: partnerId,
                    content: systemMessageContent
                },
                include: {
                    sender: { select: { id: true, name: true, role: true } }
                }
            });
            if (io) {
                io.to(chatRoom.id).emit('receiveMessage', chatMessage);
            }
        }
    }
    catch (error) {
        console.error('Failed to send system chat message:', error);
    }
});
exports.sendDriverAssignedSystemMessage = sendDriverAssignedSystemMessage;
