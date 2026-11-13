/**
 * 왜 공통 유틸로 분리했는가:
 * 관리자 대시보드와 게시판 화면에서 동일한 전화번호 하이픈 포맷팅 규칙을 재사용하기 위함입니다.
 */
export function formatPhoneNumber(phoneStr: string): string {
  if (!phoneStr) return '';
  const cleaned = String(phoneStr).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3,4})(\d{4})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return phoneStr;
}
