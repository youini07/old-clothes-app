import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// 왜: index.ts에서 라우터/prisma 모듈을 import할 때 prisma.ts가 먼저 평가되므로,
// DATABASE_URL을 읽기 전에 반드시 dotenv.config()를 먼저 실행해야 커넥션 풀 제한이 누락되지 않음
dotenv.config();

// 왜: Railway 컨테이너 환경에서 DB 커넥션 풀이 과도하게 생성되어 RAM을 점유하는 것을 방지하기 위해
// DATABASE_URL에 connection_limit 설정이 없는 경우 기본 5개로 제한함
export function getOptimizedDatabaseUrl(rawUrl = process.env.DATABASE_URL): string | undefined {
  if (!rawUrl) return undefined;
  if (rawUrl.includes('connection_limit=')) return rawUrl;
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}connection_limit=5&pool_timeout=20`;
}

// PrismaClient 싱글톤 패턴
// 왜: 각 라우트 파일에서 new PrismaClient()를 호출하면 DB 커넥션 풀이 분리되어
// Railway 플랜의 연결 수 제한 및 메모리 한도에 빠르게 도달할 수 있음
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const optimizedUrl = getOptimizedDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(
    optimizedUrl
      ? { datasources: { db: { url: optimizedUrl } } }
      : undefined
  );

globalForPrisma.prisma = prisma;

// 왜: 목록/통계/배차 조회 시 수백 KB~수 MB에 달하는 Base64 이미지 컬럼(itemPhotoUrl, scalePhotoUrl, extraPhotoUrl, customerPackedPhotoUrl)이
// 메모리(RAM)와 네트워크 송신 트래픽(Egress)을 폭발시키는 것을 원천 차단하기 위한 경량 select 정의
export const REQUEST_LIGHT_SELECT = {
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
} as const;

// 왜: CollectionItem 조회 시에도 Base64 증빙 사진(photoUrl)을 제외하여 목록 응답 크기를 최소화함
export const COLLECTION_ITEM_LIGHT_SELECT = {
  id: true,
  requestId: true,
  category: true,
  categoryLabel: true,
  quantity: true,
  unitType: true,
  unitPrice: true,
  subtotal: true,
  createdAt: true,
} as const;

// 왜: Base64 본문을 메모리에 적재하지 않고도 DB에서 ID만 조회하여 사진 존재 여부 플래그(hasCustomerPackedPhoto, hasPhotos)를 부여함
// 특히 PostgreSQL에서 대용량 TEXT 컬럼에 notIn: [''] 비교를 수행하면 외장 TOAST 스토리지 접근이 발생하므로,
// 저장 시 빈 문자열을 null로 정규화하고 조회 시에는 NULL 비트맵만 확인하는 { not: null }을 사용하여 TOAST I/O를 차단함
export async function attachPhotoFlags<T extends { id: string }>(requests: T[]): Promise<(T & { hasCustomerPackedPhoto: boolean; hasPhotos: boolean })[]> {
  if (!requests || requests.length === 0) return [];
  const ids = requests.map((r) => r.id);

  const [packedPhotoRows, completionPhotoRows] = await Promise.all([
    prisma.request.findMany({
      where: {
        id: { in: ids },
        customerPackedPhotoUrl: { not: null },
      },
      select: { id: true },
    }),
    prisma.request.findMany({
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
    return {
      ...r,
      hasCustomerPackedPhoto,
      hasPhotos: hasCustomerPackedPhoto || completionPhotoSet.has(r.id),
    };
  });
}

