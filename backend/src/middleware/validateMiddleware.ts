import { Request, Response, NextFunction } from 'express';

/**
 * 왜 필요한가:
 * 프론트엔드의 required 속성만으로는 Postman 등으로 직접 API를 호출하면 우회 가능.
 * 서버에서 반드시 한 번 더 검증해야 데이터 무결성이 보장됨.
 */

// 범용 필드 검증 함수
interface FieldRule {
  field: string;        // req.body에서 가져올 필드명
  label: string;        // 에러 메시지에 표시할 한국어 이름
  required?: boolean;   // 필수 여부 (기본값: true)
  minLength?: number;   // 최소 길이
  maxLength?: number;   // 최대 길이
  pattern?: RegExp;     // 정규식 패턴 (예: 전화번호)
}

export const validateBody = (rules: FieldRule[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];
      const isRequired = rule.required !== false; // 기본값 true

      // 필수 필드 체크
      if (isRequired && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.label}은(는) 필수 입력 항목입니다.`);
        continue;
      }

      // 값이 있을 때만 추가 검증
      if (value !== undefined && value !== null && value !== '') {
        if (rule.minLength && String(value).length < rule.minLength) {
          errors.push(`${rule.label}은(는) 최소 ${rule.minLength}자 이상이어야 합니다.`);
        }
        if (rule.maxLength && String(value).length > rule.maxLength) {
          errors.push(`${rule.label}은(는) 최대 ${rule.maxLength}자까지 입력 가능합니다.`);
        }
        if (rule.pattern && !rule.pattern.test(String(value))) {
          errors.push(`${rule.label} 형식이 올바르지 않습니다.`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    next();
  };
};

// === 미리 정의된 검증 규칙 세트 ===

// 수거 신청 API 검증 규칙
export const validateRequest = validateBody([
  { field: 'userName', label: '이름', minLength: 1, maxLength: 50 },
  { field: 'phone', label: '연락처', pattern: /^[\d\-]{10,15}$/ },
  { field: 'address', label: '방문 주소', minLength: 5 },
  { field: 'detailAddress', label: '상세 주소', minLength: 1 },
  { field: 'zipCode', label: '우편번호', minLength: 4 },
  { field: 'desiredDate', label: '수거 희망일' },
  { field: 'estimatedVolume', label: '예상 수거량', minLength: 1 },
]);

// 프로필 수정 API 검증 규칙
export const validateProfile = validateBody([
  { field: 'name', label: '이름', required: false, minLength: 1, maxLength: 50 },
  { field: 'phone', label: '연락처', required: false, pattern: /^[\d\-]{10,15}$/ },
]);

// 파트너 등록 API 검증 규칙
export const validatePartner = validateBody([
  { field: 'name', label: '대표자명', minLength: 1 },
  { field: 'email', label: '이메일', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  { field: 'phone', label: '연락처', pattern: /^[\d\-]{10,15}$/ },
  { field: 'businessName', label: '상호명', minLength: 1 },
  { field: 'province', label: '시/도' },
  { field: 'city', label: '시/군/구' },
  { field: 'dong', label: '읍/면/동' },
]);

// 기사 등록 API 검증 규칙
export const validateDriver = validateBody([
  { field: 'name', label: '기사님 성함', minLength: 1 },
  { field: 'email', label: '이메일', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  { field: 'phone', label: '연락처', pattern: /^[\d\-]{10,15}$/ },
]);
