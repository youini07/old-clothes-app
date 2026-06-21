"use strict";
/**
 * 왜 필요한가:
 * 현재 상태 전이 로직이 requests.ts, admin.ts, driver.ts 등 여러 곳에 흩어져 있어
 * "ASSIGNED인데 기사 배정이야, 파트너 배정이야?" 같은 혼란이 발생.
 * 이 서비스에서 상태 전이 규칙을 한 곳에서 관리하여 일관성을 보장.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusForAction = exports.assertTransition = exports.canTransition = exports.STATUS_LABELS = void 0;
// 상태 전이 규칙: 현재 상태에서 어떤 상태로 이동할 수 있는지 정의
const VALID_TRANSITIONS = {
    PENDING: ['ASSIGNED'],
    ASSIGNED: ['SCHEDULED', 'PENDING'], // 기사 배정 or 배정 취소
    SCHEDULED: ['IN_PROGRESS', 'ASSIGNED'], // 출발 or 일정 재조정
    IN_PROGRESS: ['COMPLETED', 'SCHEDULED'], // 완료 or 복귀
    COMPLETED: [], // 최종 상태, 더 이상 전이 불가
};
// 상태별 한국어 라벨
exports.STATUS_LABELS = {
    PENDING: '예약 접수',
    ASSIGNED: '업체 배정',
    SCHEDULED: '방문 일정 확정',
    IN_PROGRESS: '기사 이동 중',
    COMPLETED: '수거 완료',
};
/**
 * 상태 전이가 유효한지 검증
 * @returns true면 전이 가능, false면 불가
 */
const canTransition = (from, to) => {
    const validTargets = VALID_TRANSITIONS[from];
    if (!validTargets)
        return false;
    return validTargets.includes(to);
};
exports.canTransition = canTransition;
/**
 * 상태 전이 시도 - 유효하지 않으면 에러를 던짐
 * 라우트 핸들러에서 이 함수를 호출하여 상태 변경 전 검증
 */
const assertTransition = (from, to) => {
    if (!(0, exports.canTransition)(from, to)) {
        const fromLabel = exports.STATUS_LABELS[from] || from;
        const toLabel = exports.STATUS_LABELS[to] || to;
        throw new Error(`상태 전이 오류: "${fromLabel}"(${from}) 에서 "${toLabel}"(${to}) 로의 전환은 허용되지 않습니다.`);
    }
};
exports.assertTransition = assertTransition;
/**
 * 특정 액션에 대응하는 상태 결정
 * 라우트 코드에서 하드코딩된 상태 문자열 대신 이 함수를 사용
 */
exports.getStatusForAction = {
    // 수거 신청 접수 시: 파트너 매칭 여부에 따라
    onRequestCreated: (hasPartner) => hasPartner ? 'ASSIGNED' : 'PENDING',
    // 기사 배정 시
    onDriverAssigned: () => 'SCHEDULED',
    // 기사 배정 해제 시
    onDriverUnassigned: () => 'ASSIGNED',
    // 기사 출발 시
    onDriverDeparted: () => 'IN_PROGRESS',
    // 수거 완료 시
    onCompleted: () => 'COMPLETED',
};
