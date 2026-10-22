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
exports.COLLECTION_ITEM_LIGHT_SELECT = exports.REQUEST_LIGHT_SELECT = exports.prisma = void 0;
exports.getOptimizedDatabaseUrl = getOptimizedDatabaseUrl;
exports.attachPhotoFlags = attachPhotoFlags;
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
// 왜: index.ts에서 라우터/prisma 모듈을 import할 때 prisma.ts가 먼저 평가되므로,
// DATABASE_URL을 읽기 전에 반드시 dotenv.config()를 먼저 실행해야 커넥션 풀 제한이 누락되지 않음
dotenv_1.default.config();
// 왜: Railway 컨테이너 환경에서 DB 커넥션 풀이 과도하게 생성되어 RAM을 점유하는 것을 방지하기 위해
// DATABASE_URL에 connection_limit 설정이 없는 경우 기본 5개로 제한함
function getOptimizedDatabaseUrl(rawUrl = process.env.DATABASE_URL) {
    if (!rawUrl)
        return undefined;
    if (rawUrl.includes('connection_limit='))
        return rawUrl;
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}connection_limit=5&pool_timeout=20`;
}
// PrismaClient 싱글톤 패턴
// 왜: 각 라우트 파일에서 new PrismaClient()를 호출하면 DB 커넥션 풀이 분리되어
// Railway 플랜의 연결 수 제한 및 메모리 한도에 빠르게 도달할 수 있음
const globalForPrisma = globalThis;
const optimizedUrl = getOptimizedDatabaseUrl();
exports.prisma = globalForPrisma.prisma ||
    new client_1.PrismaClient(optimizedUrl
        ? { datasources: { db: { url: optimizedUrl } } }
        : undefined);
globalForPrisma.prisma = exports.prisma;
// 왜: 목록/통계/배차 조회 시 수백 KB~수 MB에 달하는 Base64 이미지 컬럼(itemPhotoUrl, scalePhotoUrl, extraPhotoUrl, customerPackedPhotoUrl)이
// 메모리(RAM)와 네트워크 송신 트래픽(Egress)을 폭발시키는 것을 원천 차단하기 위한 경량 select 정의
exports.REQUEST_LIGHT_SELECT = {
    id: true,
    customerId: true,
    userName: true,
    phone: true,
    regionId: true,
    partnerId: true,
    driverId: true,
    address: true,
    detailAddress: true,
    zipCode: true,
    sigungu: true,
    bname: true,
    desiredDate: true,
    isMustPickupDate: true,
    confirmedDate: true,
    completedDate: true,
    orderIndex: true,
    estimatedVolume: true,
    actualWeight: true,
    totalPrice: true,
    etaMinutes: true,
    estimatedPickupHour: true,
    driverNote: true,
    status: true,
    crmSent: true,
    createdAt: true,
    updatedAt: true,
};
// 왜: CollectionItem 조회 시에도 Base64 증빙 사진(photoUrl)을 제외하여 목록 응답 크기를 최소화함
exports.COLLECTION_ITEM_LIGHT_SELECT = {
    id: true,
    requestId: true,
    category: true,
    categoryLabel: true,
    quantity: true,
    unitType: true,
    unitPrice: true,
    subtotal: true,
    createdAt: true,
};
// 왜: Base64 본문을 메모리에 적재하지 않고도 DB에서 ID만 조회하여 사진 존재 여부 플래그(hasCustomerPackedPhoto, hasPhotos)를 부여함
// 특히 PostgreSQL에서 대용량 TEXT 컬럼에 notIn: [''] 비교를 수행하면 외장 TOAST 스토리지 접근이 발생하므로,
// 저장 시 빈 문자열을 null로 정규화하고 조회 시에는 NULL 비트맵만 확인하는 { not: null }을 사용하여 TOAST I/O를 차단함
function attachPhotoFlags(requests) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!requests || requests.length === 0)
            return [];
        const ids = requests.map((r) => r.id);
        const [packedPhotoRows, completionPhotoRows] = yield Promise.all([
            exports.prisma.request.findMany({
                where: {
                    id: { in: ids },
                    customerPackedPhotoUrl: { not: null },
                },
                select: { id: true },
            }),
            exports.prisma.request.findMany({
                where: {
                    id: { in: ids },
                    OR: [
                        { itemPhotoUrl: { not: null } },
                        { scalePhotoUrl: { not: null } },
                        { extraPhotoUrl: { not: null } },
                        { collectionItems: { some: { photoUrl: { not: null } } } },
                    ],
                },
                select: { id: true },
            }),
        ]);
        const packedSet = new Set(packedPhotoRows.map((r) => r.id));
        const completionPhotoSet = new Set(completionPhotoRows.map((r) => r.id));
        return requests.map((r) => {
            const hasCustomerPackedPhoto = packedSet.has(r.id);
            return Object.assign(Object.assign({}, r), { hasCustomerPackedPhoto, hasPhotos: hasCustomerPackedPhoto || completionPhotoSet.has(r.id) });
        });
    });
}
