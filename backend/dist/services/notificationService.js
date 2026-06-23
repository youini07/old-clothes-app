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
exports.sendCompletionToCustomer = exports.sendScheduleConfirmedToCustomer = exports.sendAssignmentToCustomer = exports.sendNewRequestToPartner = exports.sendDepartureNotification = void 0;
const axios_1 = __importDefault(require("axios"));
// 환경 변수 설정
const ALIGO_API_KEY = process.env.ALIGO_API_KEY || 'your_aligo_api_key';
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || 'your_aligo_user_id';
const ALIGO_SENDER_KEY = process.env.ALIGO_SENDER_KEY || 'your_sender_key';
const SENDER_PHONE = process.env.SENDER_PHONE || '010-0000-0000';
const sendRealBizMessage = (tplCode, phone, userName, message, title) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const params = new URLSearchParams();
        params.append('apikey', ALIGO_API_KEY);
        params.append('userid', ALIGO_USER_ID);
        params.append('senderkey', ALIGO_SENDER_KEY);
        params.append('tpl_code', tplCode);
        params.append('sender', SENDER_PHONE);
        params.append('receiver_1', phone);
        params.append('recvname_1', userName);
        params.append('subject_1', title);
        params.append('message_1', message);
        params.append('failover', 'Y'); // 카카오톡 실패 시 문자 대체 발송
        params.append('fsubject_1', title);
        params.append('fmessage_1', message);
        const response = yield axios_1.default.post('https://kakaoapi.aligo.in/akv10/alimtalk/send/', params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log(`[알림톡 발송 성공] ${phone}:`, response.data);
        return true;
    }
    catch (error) {
        console.error(`[알림톡 발송 실패] ${phone}:`, error);
        return false;
    }
});
const sendDirectSms = (phone, message, title) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const params = new URLSearchParams();
        params.append('key', ALIGO_API_KEY); // 일반 문자 API는 apikey 대신 key를 사용합니다
        params.append('user_id', ALIGO_USER_ID);
        params.append('sender', SENDER_PHONE);
        params.append('receiver', phone);
        params.append('msg', message);
        params.append('title', title);
        const response = yield axios_1.default.post('https://apis.aligo.in/send/', params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log(`[일반 문자 발송 성공] ${phone}:`, response.data);
        return true;
    }
    catch (error) {
        console.error(`[일반 문자 발송 실패] ${phone}:`, error);
        return false;
    }
});
const sendNotification = (tplCode, phone, userName, message, title) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. API KEY가 없으면 테스트(Mock) 모드로 실행
    if (!ALIGO_API_KEY || ALIGO_API_KEY === 'your_aligo_api_key') {
        return sendMockBizMessage(title, phone, message);
    }
    // 2. 카카오톡 발신프로필 키(사업자 필요)가 없으면 일반 문자(SMS)로 우회 전송
    if (!ALIGO_SENDER_KEY || ALIGO_SENDER_KEY === 'your_sender_key') {
        return sendDirectSms(phone, message, title);
    }
    // 3. 둘 다 설정되어 있으면 카카오 알림톡 전송 (실패 시 내부적으로 문자 대체 전송됨)
    return sendRealBizMessage(tplCode, phone, userName, message, title);
});
const sendMockBizMessage = (title, phone, message) => {
    console.log(`\n=================================================`);
    console.log(`[알림톡 발송 테스트 모드]`);
    console.log(`- 제목: ${title}`);
    console.log(`- 수신자: ${phone}`);
    console.log(`- 내용:\n${message}`);
    console.log(`=================================================\n`);
    return true;
};
const sendDepartureNotification = (phone, userName, etaMinutes, useBizMessage, driverPhone) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    let message = etaMinutes
        ? `[올클 알림톡]\n${userName}님, 수거 기사님이 출발했습니다!\n예상 도착 시간은 약 ${etaMinutes}분 입니다.\n잠시만 기다려주세요.`
        : `[올클 알림톡]\n${userName}님, 수거 기사님이 출발했습니다!\n잠시만 기다려주세요.`;
    if (driverPhone) {
        message += `\n\n- 담당 기사 연락처: ${driverPhone}`;
    }
    const tplCode = process.env.ALIGO_TPL_DEPARTURE || 'TPL_001';
    return sendNotification(tplCode, phone, userName, message, '수거 출발 안내');
});
exports.sendDepartureNotification = sendDepartureNotification;
const sendNewRequestToPartner = (partnerPhone, customerName, address, useBizMessage) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const message = `[올클 파트너 알림]\n새로운 수거 신청이 접수되었습니다!\n- 고객명: ${customerName}\n- 수거지: ${address}\n\n관리자 페이지에서 확인 후 업체를 배정해 주세요.`;
    const tplCode = process.env.ALIGO_TPL_NEW_REQUEST || 'TPL_002';
    return sendNotification(tplCode, partnerPhone, customerName, message, '신규 신청 접수');
});
exports.sendNewRequestToPartner = sendNewRequestToPartner;
const sendAssignmentToCustomer = (phone, userName, partnerName, useBizMessage) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const message = `[올클 알림톡]\n${userName}님, 헌옷 수거 업체 배정이 완료되었습니다.\n- 담당 업체: ${partnerName}\n\n곧 담당 기사님이 수거 일정을 확정해 드릴 예정입니다. 조금만 기다려주세요!`;
    const tplCode = process.env.ALIGO_TPL_ASSIGNED || 'TPL_003';
    return sendNotification(tplCode, phone, userName, message, '업체 배정 완료');
});
exports.sendAssignmentToCustomer = sendAssignmentToCustomer;
const sendScheduleConfirmedToCustomer = (phone, userName, confirmedDate, useBizMessage, driverPhone) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const formattedDate = new Date(confirmedDate).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    let message = `[올클 알림톡]\n${userName}님, 수거 일정이 확정되었습니다!\n- 방문 예정일: ${formattedDate}\n\n방문 전 기사님이 다시 한번 연락드릴 예정입니다. 감사합니다.`;
    if (driverPhone) {
        message += `\n\n- 담당 기사 연락처: ${driverPhone}`;
    }
    const tplCode = process.env.ALIGO_TPL_SCHEDULED || 'TPL_004';
    return sendNotification(tplCode, phone, userName, message, '수거 일정 확정');
});
exports.sendScheduleConfirmedToCustomer = sendScheduleConfirmedToCustomer;
const sendCompletionToCustomer = (phone, userName, actualWeight, totalPrice, useBizMessage) => __awaiter(void 0, void 0, void 0, function* () {
    if (!useBizMessage)
        return false;
    const message = `[올클 알림톡]\n${userName}님, 헌옷 수거가 완료되었습니다!\n\n[수거 내역]\n- 수거 무게: ${actualWeight}kg\n- 정산 금액: ${totalPrice.toLocaleString()}원\n\n이용해 주셔서 감사합니다. 올클과 함께 깨끗한 하루 보내세요!`;
    const tplCode = process.env.ALIGO_TPL_COMPLETED || 'TPL_005';
    return sendNotification(tplCode, phone, userName, message, '수거 완료 및 정산');
});
exports.sendCompletionToCustomer = sendCompletionToCustomer;
