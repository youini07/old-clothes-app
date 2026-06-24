import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { prisma } from '../lib/prisma';

dotenv.config();

// Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  // 줄바꿈 문자를 실제 줄바꿈으로 처리
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const addRequestToSheet = async (requestData: {
  id: string;
  userName: string;
  phone: string;
  address: string;
  detailAddress: string;
  desiredDate: string;
  estimatedVolume: string;
  status: string;
}) => {
  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID!, serviceAccountAuth);
    
    await doc.loadInfo(); // 문서 로드
    const sheet = doc.sheetsByIndex[0]; // 첫 번째 시트 선택

    // 시트의 헤더(첫 번째 행)를 자동으로 설정합니다.
    await sheet.setHeaderRow(['ID', '신청인', '연락처', '기본주소', '상세주소', '희망일', '기사배정일시', '수거량', '상태', '신청일시', '실제수거무게(kg)', '정산금액(원)', '고객포장사진', '물품사진', '저울사진', '특이사항사진', '특이사항']);

    await sheet.addRow({
      'ID': requestData.id,
      '신청인': requestData.userName,
      '연락처': requestData.phone,
      '기본주소': requestData.address,
      '상세주소': requestData.detailAddress,
      '희망일': requestData.desiredDate,
      '수거량': requestData.estimatedVolume,
      '상태': requestData.status,
      '신청일시': new Date().toLocaleString('ko-KR')
    });
    
    console.log('✅ 구글 시트 데이터 추가 성공');
  } catch (error: any) {
    console.error('❌ 구글 시트 연동 실패:', error?.response?.data || error.message || error);
  }
};

export const updateRequestStatusInSheet = async (requestId: string, status: string, actualWeight?: number, driverNote?: string) => {
  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID!, serviceAccountAuth);
    
    await doc.loadInfo(); 
    const sheet = doc.sheetsByIndex[0];

    const rows = await sheet.getRows();
    const targetRow = rows.find(row => row.get('ID') === requestId);

    if (targetRow) {
      const existingRequest = await prisma.request.findUnique({ where: { id: requestId } });
      if (existingRequest) {
        targetRow.assign({
          '상태': status,
          '기사배정일시': existingRequest.confirmedDate ? existingRequest.confirmedDate.toLocaleString('ko-KR') : '',
          '실제수거무게(kg)': existingRequest.actualWeight ? existingRequest.actualWeight.toString() : (actualWeight ? actualWeight.toString() : ''),
          '정산금액(원)': existingRequest.totalPrice ? existingRequest.totalPrice.toString() : '',
          '고객포장사진': existingRequest.customerPackedPhotoUrl || '',
          '물품사진': existingRequest.itemPhotoUrl || '',
          '저울사진': existingRequest.scalePhotoUrl || '',
          '특이사항사진': existingRequest.extraPhotoUrl || '',
          '특이사항': driverNote || existingRequest.driverNote || ''
        });
      } else {
        targetRow.assign({
          '상태': status,
        });
        if (actualWeight !== undefined) targetRow.assign({ '실제수거무게(kg)': actualWeight.toString() });
        if (driverNote !== undefined) targetRow.assign({ '특이사항': driverNote });
      }
      
      await targetRow.save();
      console.log(`✅ 구글 시트 데이터 업데이트 성공 (ID: ${requestId})`);
    } else {
      console.warn(`⚠️ 구글 시트 업데이트 실패: ID ${requestId} 를 찾을 수 없습니다.`);
    }
  } catch (error: any) {
    console.error('❌ 구글 시트 연동 실패:', error?.response?.data || error.message || error);
  }
};
