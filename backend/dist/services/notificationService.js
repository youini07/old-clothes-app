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
exports.sendCompletionToCustomer = exports.sendScheduleConfirmedToCustomer = exports.sendAssignmentToCustomer = exports.sendNewRequestToPartner = exports.sendDepartureNotification = void 0;
// 환경 변수 설정 (나중에 .env에 추가 필요)
const ALIGO_API_KEY = process.env.ALIGO_API_KEY || 'your_aligo_api_key';
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || 'your_aligo_user_id';
const SENDER_PHONE = process.env.SENDER_PHONE || '010-0000-0000';
const sendMockBizMessage = (title, phone, message) => {
    console.log(`\n=================================================`);
    console.log(`[알림톡 발송 테스트 모드]`);
    console.log(`- 제목: ${title}`);
    console.log(`- 수신자: ${phone}`);
    console.log(`- 내용:\n${message}`);
    console.log(`=================================================\n`);
    return true;
};
const sendDepartureNotification = (phone, userName, etaMinutes, useBizMessage) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const message = etaMinutes
        ? `[올클 알림톡]\n${userName}님, 수거 기사님이 출발했습니다!\n예상 도착 시간은 약 ${etaMinutes}분 입니다.\n잠시만 기다려주세요.`
        : `[올클 알림톡]\n${userName}님, 수거 기사님이 출발했습니다!\n잠시만 기다려주세요.`;
    return sendMockBizMessage('수거 출발 안내', phone, message);
});
exports.sendDepartureNotification = sendDepartureNotification;
const sendNewRequestToPartner = (partnerPhone, customerName, address, useBizMessage) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const message = `[올클 파트너 알림]\n새로운 수거 신청이 접수되었습니다!\n- 고객명: ${customerName}\n- 수거지: ${address}\n\n관리자 페이지에서 확인 후 업체를 배정해 주세요.`;
    return sendMockBizMessage('신규 신청 접수', partnerPhone, message);
});
exports.sendNewRequestToPartner = sendNewRequestToPartner;
const sendAssignmentToCustomer = (phone, userName, partnerName, useBizMessage) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const message = `[올클 알림톡]\n${userName}님, 헌옷 수거 업체 배정이 완료되었습니다.\n- 담당 업체: ${partnerName}\n\n곧 담당 기사님이 수거 일정을 확정해 드릴 예정입니다. 조금만 기다려주세요!`;
    return sendMockBizMessage('업체 배정 완료', phone, message);
});
exports.sendAssignmentToCustomer = sendAssignmentToCustomer;
const sendScheduleConfirmedToCustomer = (phone, userName, confirmedDate, useBizMessage) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const formattedDate = new Date(confirmedDate).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    const message = `[올클 알림톡]\n${userName}님, 수거 일정이 확정되었습니다!\n- 방문 예정일: ${formattedDate}\n\n방문 전 기사님이 다시 한번 연락드릴 예정입니다. 감사합니다.`;
    return sendMockBizMessage('수거 일정 확정', phone, message);
});
exports.sendScheduleConfirmedToCustomer = sendScheduleConfirmedToCustomer;
const sendCompletionToCustomer = (phone, userName, actualWeight, totalPrice, useBizMessage) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const message = `[올클 알림톡]\n${userName}님, 헌옷 수거가 완료되었습니다!\n\n[수거 내역]\n- 수거 무게: ${actualWeight}kg\n- 정산 금액: ${totalPrice.toLocaleString()}원\n\n이용해 주셔서 감사합니다. 올클과 함께 깨끗한 하루 보내세요!`;
    return sendMockBizMessage('수거 완료 및 정산', phone, message);
});
exports.sendCompletionToCustomer = sendCompletionToCustomer;
