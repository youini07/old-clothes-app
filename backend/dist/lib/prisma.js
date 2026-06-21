"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// PrismaClient 싱글톤 패턴
// 왜: 각 라우트 파일에서 new PrismaClient()를 호출하면 DB 커넥션 풀이 분리되어
// Railway 무료 플랜의 연결 수 제한에 빠르게 도달할 수 있음
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma || new client_1.PrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
