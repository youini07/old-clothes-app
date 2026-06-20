import { addRequestToSheet } from './src/services/googleSheets';

async function main() {
  try {
    await addRequestToSheet({
      id: 'test-id-123',
      userName: 'test',
      phone: '010-1234-5678',
      address: '경북 김천시 무실7길 38',
      detailAddress: '106동 1502호',
      desiredDate: '2026-06-19T00:00:00.000Z',
      estimatedVolume: '신발 20개',
      status: 'PENDING'
    });
    console.log('done calling addRequestToSheet');
  } catch (e) {
    console.error('error', e);
  }
}
main();
