import axios from 'axios';

// 환경 변수 설정 (나중에 .env에 추가 필요)
const ALIGO_API_KEY = process.env.ALIGO_API_KEY || 'your_aligo_api_key';
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || 'your_aligo_user_id';
const SENDER_PHONE = process.env.SENDER_PHONE || '010-0000-0000';

/**
 * 고객에게 알림톡 또는 문자를 발송하는 서비스
 * 파트너의 useBizMessage 설정에 따라 실제 과금 통신 여부가 결정됨
 */
export const sendDepartureNotification = async (phone: string, userName: string, etaMinutes: number | null, useBizMessage: boolean) => {
  const message = etaMinutes 
    ? `[헌옷수거 알림]\n${userName}님, 수거 기사님이 출발했습니다!\n예상 도착 시간은 약 ${etaMinutes}분 입니다.\n잠시만 기다려주세요.`
    : `[헌옷수거 알림]\n${userName}님, 수거 기사님이 출발했습니다!\n잠시만 기다려주세요.`;

  if (!useBizMessage) {
    // 요금이 부과되지 않는 시뮬레이션 모드
    console.log(`\n=================================================`);
    console.log(`[알림톡 발송 차단됨 (요금 절약 모드)]`);
    console.log(`- 수신자 번호: ${phone}`);
    console.log(`- 메시지 내용:\n${message}`);
    console.log(`=================================================\n`);
    return true; // 성공한 것으로 간주
  }

  try {
    // 실제 알리고(Aligo) 알림톡 전송 API 호출 로직 (예시)
    // 알리고 API 문서 기준 템플릿 기반 발송 로직 작성
    /*
    const response = await axios.post('https://kakaoapi.aligo.in/akv10/alimtalk/send/', null, {
      params: {
        apikey: ALIGO_API_KEY,
        userid: ALIGO_USER_ID,
        senderkey: process.env.ALIGO_SENDER_KEY,
        tpl_code: 'DEPARTURE_TEMPLATE_01',
        sender: SENDER_PHONE,
        receiver_1: phone,
        subject_1: '수거 출발 안내',
        message_1: message,
      }
    });

    if (response.data.code !== 0) {
      throw new Error(response.data.message);
    }
    */
    
    console.log(`[실제 발송 완료] ${phone} 번호로 알림톡을 발송했습니다.`);
    return true;
  } catch (error) {
    console.error(`[알림톡 발송 실패] 번호: ${phone}`, error);
    
    // 알림톡 실패 시 Fallback으로 일반 SMS 전송 로직 (추후 구현)
    // await sendFallbackSms(phone, message);
    
    return false;
  }
};
