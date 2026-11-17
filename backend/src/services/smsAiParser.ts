import axios from 'axios';

/**
 * 010 대표번호로 수신된 문자에서 AI(또는 내장 정규식 폴백)가 추출한 구조화 데이터 타입
 */
export interface ParsedSmsPickupData {
  isPickupRequest: boolean; // 실제 수거 신청(주소가 포함된 접수 문자)인지 여부
  hasPickupIntentWithoutAddress: boolean; // 수거 문의는 맞지만 주소가 빠져있는 문자인지 여부
  rawAddress: string; // 도로명/지번/동/건물명 등 검색용 기본 주소
  detailAddress: string; // 동·호수, 층수, 공동현관 비밀번호 등 상세 주소
  customerName: string | null; // 문자에 고객 이름이 적혀 있는 경우 추출
  desiredDateISO: string | null; // 희망 수거일이 언급된 경우 YYYY-MM-DD 형식
  itemsSummary: string | null; // 품목이나 예상 수거량 요약 (예: "헌옷 3봉투, 신발")
  analyzerUsed: 'GEMINI' | 'OPENAI' | 'REGEX_FALLBACK'; // 어떤 엔진으로 분석되었는지 기록
}

/**
 * 카카오 로컬 API로 검증·보정된 대한민국 표준 주소 정보
 */
export interface NormalizedKoreanAddress {
  standardAddress: string;
  zipCode: string;
  province: string;
  city: string;
  town: string;
  isVerified: boolean;
}

/**
 * 왜 1차 스팸·시스템 문자 필터를 AI 호출 앞단에 배치하는가:
 * 010 업무용 공기계에는 통신사 광고, 카드 승인 문자, 인증번호, 택배 배달 알림 등이 수시로 들어오므로
 * 외부 AI API를 호출하기 전에 명백한 스팸을 차단해 API 과금 낭비와 오접수를 원천 방지합니다.
 */
export function isObviousSpamOrSystemSms(messageContent: string): { isSpam: boolean; reason?: string } {
  const trimmed = (messageContent || '').trim();
  if (trimmed.length < 4) {
    return { isSpam: true, reason: '문자 길이가 너무 짧음 (4자 미만)' };
  }

  // 고객이 실제로 헌옷 수거 단어를 함께 적은 경우(예: "택배 박스에 헌옷 담아뒀어요")는 차단하지 않도록 예외 처리
  const hasStrongPickupKeyword =
    /(올클|올클리어|헌옷|옷수거|방문수거|옷장정리|의류수거|수거신청|수거부탁|수거요청)/.test(trimmed);

  const hardSpamPatterns = [
    /\(광고\)/i,
    /무료수신거부/,
    /수신거부\s*080/,
    /인증번호.*\[\d{4,6}\]/,
    /\[\d{4,6}\].*인증번호/,
  ];

  if (hardSpamPatterns.some((pattern) => pattern.test(trimmed))) {
    return { isSpam: true, reason: '광고 또는 인증번호 스팸 문자' };
  }

  if (!hasStrongPickupKeyword) {
    const systemAlertPatterns = [
      /(일시불|할부|승인|출금|입금|잔액).*원/,
      /(CJ대한통운|로젠택배|우체국택배|한진택배|롯데택배|쿠팡).*배달/,
      /부재중\s*전화/,
      /국제발신/,
      /국외발신/,
    ];
    if (systemAlertPatterns.some((pattern) => pattern.test(trimmed))) {
      return { isSpam: true, reason: '금융/택배/통신사 자동 알림 문자' };
    }
  }

  return { isSpam: false };
}

// 왜 AI에게 오늘 날짜(KST)를 함께 전달하는가:
// "내일", "모레", "이번 주 토요일" 같은 상대적 날짜 표현을 정확한 YYYY-MM-DD 날짜로 계산하기 위함입니다.
function getTodayKstDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

function buildAiSystemPrompt(todayStr: string): string {
  return `당신은 대한민국 헌옷 방문수거 플랫폼 '올클(ALL-CLEAR)'의 문자 접수 AI 분석기입니다.
카카오톡 로그인이 어려운 고객들이 대표번호(010)로 보낸 문자 메시지를 읽고, '주소가 포함된 헌옷/재활용품 수거 신청 문자'인지 판별하여 JSON으로만 응답하세요. (기준일: ${todayStr})

[판별 규칙]
1. 문자 안에 대한민국 주소 단서(시/군/구, 읍/면/동, 도로명+번지, 또는 지역명+아파트/빌라/오피스텔/건물명 등)가 있으면 비록 '헌옷 수거'라는 단어가 생략되어 있어도(예: 주소와 동·호수만 띡 보낸 간편문자) isPickupRequest를 true로 판단하세요.
2. 광고, 스팸, 단순 가격 질문만 있고 주소 단서가 전혀 없는 문자는 isPickupRequest를 false로 판단하세요. 단, 수거 의향이나 문의인데 주소만 빠진 경우에는 hasPickupIntentWithoutAddress를 true로 설정하세요.
3. rawAddress에는 카카오 지도 검색이 잘 되도록 '시/도 + 시/군/구 + 읍/면/동/도로명 + 번지 + 아파트/건물명'까지만 깔끔하게 정리하고, 동·호수·층수·공동현관 비밀번호 등은 반드시 detailAddress로 분리하세요.

[응답 JSON 스키마]
{
  "isPickupRequest": boolean,
  "hasPickupIntentWithoutAddress": boolean,
  "rawAddress": "기본 주소 문자열 (없으면 빈 문자열)",
  "detailAddress": "상세 주소 문자열 (동/호수/층/공동현관 비밀번호 등, 없으면 빈 문자열)",
  "customerName": "고객 이름 (적혀있지 않으면 null)",
  "desiredDateISO": "희망 수거일 YYYY-MM-DD (언급 없으면 null)",
  "itemsSummary": "품목/수량/요청사항 짧은 요약 (없으면 null)"
}`;
}

// 왜 모델 후보 체인과 작동 모델 캐시를 두는가:
// 구버전 모델 종료로 인한 404 장애를 원천 차단하고, 초저비용 최신 모델(gemini-3.5-flash-lite -> gemini-flash-lite-latest -> gemini-flash-latest)로
// 무중단 자동 폴백되도록 설계했습니다.
let cachedWorkingGeminiModel: string | null = null;

function getGeminiCandidateModels(): string[] {
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  const baseList = [
    ...(envModel ? [envModel] : []),
    ...(cachedWorkingGeminiModel ? [cachedWorkingGeminiModel] : []),
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
  ];
  return Array.from(new Set(baseList.filter(Boolean)));
}

function extractCleanJsonText(parts: any[]): string {
  if (!Array.isArray(parts) || parts.length === 0) return '';
  const answerPart =
    parts.find((p) => p && !p.thought && typeof p.text === 'string' && p.text.trim()) || parts[0];
  const raw = String(answerPart?.text || '').trim();
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function callGeminiEndpoint(
  url: string,
  headers: Record<string, string>,
  todayStr: string,
  smsText: string
) {
  return axios.post(
    url,
    {
      systemInstruction: {
        parts: [{ text: buildAiSystemPrompt(todayStr) }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `수신된 고객 문자 원문:\n"""\n${smsText}\n"""` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    },
    { headers, timeout: 8000 }
  );
}

async function analyzeWithGemini(smsText: string, apiKey: string): Promise<ParsedSmsPickupData> {
  const todayStr = getTodayKstDateString();
  const cleanKey = apiKey.replace(/\s+/g, '');
  const candidateModels = getGeminiCandidateModels();
  let lastError: any = null;

  for (const modelName of candidateModels) {
    const aiStudioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName
    )}:generateContent`;

    try {
      let response;
      try {
        response = await callGeminiEndpoint(
          aiStudioUrl,
          {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey,
          },
          todayStr,
          smsText
        );
      } catch (primaryErr: any) {
        const pStatus = primaryErr?.response?.status;
        if (cleanKey.startsWith('AQ.') && (pStatus === 401 || pStatus === 403 || pStatus === 400)) {
          const vertexExpressUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(
            modelName
          )}:generateContent?key=${encodeURIComponent(cleanKey)}`;
          response = await callGeminiEndpoint(
            vertexExpressUrl,
            { 'Content-Type': 'application/json' },
            todayStr,
            smsText
          );
        } else {
          throw primaryErr;
        }
      }

      const parts = response.data?.candidates?.[0]?.content?.parts || [];
      const rawJson = extractCleanJsonText(parts);
      if (!rawJson) {
        throw new Error('Gemini 응답 본문이 비어 있습니다.');
      }

      const parsed = JSON.parse(rawJson);
      cachedWorkingGeminiModel = modelName;

      return {
        isPickupRequest: Boolean(parsed.isPickupRequest && parsed.rawAddress?.trim()),
        hasPickupIntentWithoutAddress: Boolean(parsed.hasPickupIntentWithoutAddress),
        rawAddress: String(parsed.rawAddress || '').trim(),
        detailAddress: String(parsed.detailAddress || '').trim(),
        customerName: parsed.customerName ? String(parsed.customerName).trim() : null,
        desiredDateISO: parsed.desiredDateISO ? String(parsed.desiredDateISO).trim() : null,
        itemsSummary: parsed.itemsSummary ? String(parsed.itemsSummary).trim() : null,
        analyzerUsed: 'GEMINI',
      };
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 429) {
        throw err;
      }
      if (cachedWorkingGeminiModel === modelName) {
        cachedWorkingGeminiModel = null;
      }
      console.warn(
        `[SMS AI] Gemini 모델(${modelName}) 호출 실패(status=${status ?? 'ERR'}), 다음 최신 모델로 자동 재시도합니다.`
      );
    }
  }

  throw lastError || new Error('사용 가능한 Gemini 모델 호출에 실패했습니다.');
}

async function analyzeWithOpenAi(smsText: string, apiKey: string): Promise<ParsedSmsPickupData> {
  const todayStr = getTodayKstDateString();
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildAiSystemPrompt(todayStr) },
        { role: 'user', content: `수신된 고객 문자 원문:\n"""\n${smsText}\n"""` },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    }
  );

  const rawJson = response.data?.choices?.[0]?.message?.content;
  if (!rawJson) {
    throw new Error('OpenAI 응답 본문이 비어 있습니다.');
  }

  const parsed = JSON.parse(rawJson);
  return {
    isPickupRequest: Boolean(parsed.isPickupRequest && parsed.rawAddress?.trim()),
    hasPickupIntentWithoutAddress: Boolean(parsed.hasPickupIntentWithoutAddress),
    rawAddress: String(parsed.rawAddress || '').trim(),
    detailAddress: String(parsed.detailAddress || '').trim(),
    customerName: parsed.customerName ? String(parsed.customerName).trim() : null,
    desiredDateISO: parsed.desiredDateISO ? String(parsed.desiredDateISO).trim() : null,
    itemsSummary: parsed.itemsSummary ? String(parsed.itemsSummary).trim() : null,
    analyzerUsed: 'OPENAI',
  };
}

// 왜 별도 날짜 추출기를 두는가:
// "동탄 반송동 104-2번지인데 11월 20일에..."처럼 본문에 적힌 날짜 표현이 주소 문자열에 섞이지 않게 분리하고
// 희망 수거일(desiredDateISO)에 정확히 반영하기 위함입니다.
function extractKoreanDesiredDate(text: string): string | null {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYear = kstNow.getUTCFullYear();

  const fullIso = text.match(/(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (fullIso) {
    const y = Number(fullIso[1]);
    const m = String(Number(fullIso[2])).padStart(2, '0');
    const d = String(Number(fullIso[3])).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const monthDay = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDay) {
    const mNum = Number(monthDay[1]);
    const dNum = Number(monthDay[2]);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${currentYear}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    }
  }

  if (/글피/.test(text)) {
    kstNow.setUTCDate(kstNow.getUTCDate() + 3);
    return kstNow.toISOString().split('T')[0];
  }
  if (/모레/.test(text)) {
    kstNow.setUTCDate(kstNow.getUTCDate() + 2);
    return kstNow.toISOString().split('T')[0];
  }
  if (/내일/.test(text)) {
    kstNow.setUTCDate(kstNow.getUTCDate() + 1);
    return kstNow.toISOString().split('T')[0];
  }
  return null;
}

/**
 * 왜 내장 한국어 정규식 파서를 함께 유지하는가:
 * 아직 외부 AI 키(Gemini/OpenAI)를 등록하지 않은 초기 세팅 상태이거나 외부 AI 서버 일시 장애(429 등) 시에도
 * 고객의 수거 신청 문자가 단 1건도 유실되지 않고 즉시 파싱·접수되도록 보장하기 위함입니다.
 */
export function parseSmsWithKoreanRegex(smsText: string): ParsedSmsPickupData {
  const cleaned = smsText
    .replace(/\[Web발신\]/gi, '')
    .replace(/\r\n/g, '\n')
    .trim();

  const nameMatch = cleaned.match(/(?:이름|성함|고객명|신청자)\s*[:：-]?\s*([가-힣]{2,5})/);
  const customerName = nameMatch ? nameMatch[1] : null;

  const desiredDateISO = extractKoreanDesiredDate(cleaned);

  const textWithoutDates = cleaned
    .replace(/20\d{2}\s*[-./년]\s*\d{1,2}\s*[-./월]\s*\d{1,2}\s*일?(?:에|까지|쯤)?/g, ' ')
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일(?:에|까지|쯤|경)?/g, ' ');

  const REGION_PREFIX =
    '(?:(?:서울(?:특별시|시)?|경기(?:도)?|인천(?:광역시|시)?|부산(?:광역시|시)?|대구(?:광역시|시)?|광주(?:광역시|시)?|대전(?:광역시|시)?|울산(?:광역시|시)?|세종(?:특별자치시|시)?|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|강원특별자치도|강원도|강원|제주(?:특별자치도|도)?)(?:\\s+[가-힣]{1,5}(?:시|군|구))?(?:\\s+[가-힣]{1,4}구)?|[가-힣]{2,5}(?:시|군|구)(?:\\s+[가-힣]{1,4}구)?)';

  const BUILDING_BRAND =
    '(?:[가-힣A-Za-z0-9]{1,12}(?:아파트|빌라|오피스텔|타운|마을|맨션|연립|주택|자이|푸르지오|래미안|힐스테이트|더샵|아이파크|롯데캐슬|e편한세상|호반(?:써밋|베르디움)?|우미린|휴먼시아|주공\\d*차?|파라곤|센트럴|더퍼스트|중흥S클래스|한양수자인|센트레빌|코아루|트루엘|위브|스위첸|해모로))';

  const strictFullAddrRegex = new RegExp(
    `(${REGION_PREFIX}\\s+(?:[가-힣0-9]{1,10}(?:읍|면)\\s+)?(?:` +
      `[가-힣0-9]{1,12}(?:로|길|번길)\\s*\\d{1,5}(?:-\\d{1,4})?(?:\\s*번지)?(?:\\s+${BUILDING_BRAND})?|` +
      `[가-힣0-9]{1,10}(?:동|읍|면|리|가)\\s*(?:산\\s*)?\\d{1,5}(?:-\\d{1,4})?(?:\\s*번지)?(?:\\s+${BUILDING_BRAND})?|` +
      `[가-힣0-9]{1,10}(?:동|읍|면)\\s+${BUILDING_BRAND}` +
      `))`
  );

  const strictShortAddrRegex = new RegExp(
    `((?:` +
      `[가-힣0-9]{2,10}(?:로|길|번길)\\s*\\d{1,5}(?:-\\d{1,4})?(?:\\s*번지)?(?:\\s+${BUILDING_BRAND})?|` +
      `[가-힣0-9]{2,8}(?:동|읍|면|리)\\s*(?:산\\s*)?\\d{1,5}(?:-\\d{1,4})?(?:\\s*번지)?(?:\\s+${BUILDING_BRAND})?|` +
      `[가-힣0-9]{2,8}(?:동|읍|면)\\s+${BUILDING_BRAND}` +
      `))`
  );

  let rawAddress = '';
  let matchEndIndex = -1;

  const fullMatch = strictFullAddrRegex.exec(textWithoutDates);
  if (fullMatch && fullMatch[1]) {
    rawAddress = fullMatch[1].trim();
    matchEndIndex = fullMatch.index + fullMatch[0].length;
  } else {
    const shortMatch = strictShortAddrRegex.exec(textWithoutDates);
    if (shortMatch && shortMatch[1]) {
      rawAddress = shortMatch[1].trim();
      matchEndIndex = shortMatch.index + shortMatch[0].length;
    }
  }

  rawAddress = rawAddress
    .replace(/(?:인데(?:요)?|입니다|인데요|이고(?:요)?|이구(?:요)?|거든(?:요)?|에서|으로)$/, '')
    .replace(/(\d)\s*번지$/, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  let detailAddress = '';
  const detailExplicitLabel = textWithoutDates.match(/(?:상세주소|동호수)\s*[:：]\s*([^\n]+)/);
  if (detailExplicitLabel && detailExplicitLabel[1]) {
    detailAddress = detailExplicitLabel[1]
      .replace(/(?:인데(?:요)?|입니다|인데요|헌옷|수거).*$/i, '')
      .trim();
  } else if (matchEndIndex > 0) {
    const tail = textWithoutDates.slice(matchEndIndex, matchEndIndex + 28);
    const dongHoMatch = tail.match(
      /^\s*(?:,\s*)?(\d{1,4}\s*동\s*\d{1,5}\s*호|[가-힣A-Za-z]\s*동\s*\d{1,5}\s*호|\d{2,5}\s*호|\d{1,2}\s*층(?:\s*\d{1,4}\s*호)?)/
    );
    if (dongHoMatch && dongHoMatch[1]) {
      detailAddress = dongHoMatch[1].replace(/\s+/g, ' ').trim();
    }
  }

  // 공동현관 출입번호가 본문에 적혀 있는 경우("공동현관: #1234*", "공동현관 #1234* 이고" 등) 상세주소에 함께 보존
  const pinMatch =
    textWithoutDates.match(/(?:공동현관|현관\s*비번|출입번호)\s*(?:출입번호|비밀번호)?\s*[:：]\s*([^\n]+)/) ||
    textWithoutDates.match(/(?:공동현관|현관\s*비번|출입번호)\s*([#*0-9A-Za-z-]{3,16})/);
  if (pinMatch && pinMatch[1]) {
    const pinStr = pinMatch[1].replace(/(?:이고|이며|입니다|인데).*$/, '').trim();
    if (pinStr && !detailAddress.includes(pinStr)) {
      detailAddress = detailAddress ? `${detailAddress} (공동현관: ${pinStr})` : `공동현관: ${pinStr}`;
    }
  }

  if (!rawAddress) {
    const labeledAddrMatch = textWithoutDates.match(/(?:도로명\s*상세주소|주소)(?:\([^)]*\))?\s*[:：]\s*([^\n]+)/);
    if (labeledAddrMatch && labeledAddrMatch[1]) {
      const candidate = labeledAddrMatch[1]
        .replace(/(?:공동현관|수거품목|예상량|예상물량|수거희망일).*$/i, '')
        .trim();
      if (candidate.length >= 4) {
        const splitDongHo = candidate.match(/^(.+?)[,\s]+(\d{1,4}\s*동\s*\d{1,5}\s*호|\d{2,5}\s*호)$/);
        if (splitDongHo) {
          rawAddress = splitDongHo[1].trim();
          detailAddress = detailAddress || splitDongHo[2].replace(/\s+/g, ' ').trim();
        } else {
          rawAddress = candidate;
        }
      }
    }
  }

  const extractedChunks: string[] = [];
  const explicitItemLineMatch = textWithoutDates.match(
    /(?:수거품목|품목|예상량|예상물량)(?:\([^)]*\))?(?:\s*[·/및]\s*(?:수거품목|예상량))?\s*[:：]\s*([^\n]+)/
  );
  if (explicitItemLineMatch && explicitItemLineMatch[1]) {
    const cleanExplicitItems = explicitItemLineMatch[1]
      .replace(/수거희망일.*$/i, '')
      .trim();
    if (cleanExplicitItems) {
      extractedChunks.push(cleanExplicitItems);
    }
  }

  if (extractedChunks.length === 0) {
    const itemQtyRegex =
      /(?:(?:헌옷|옷|의류|신발|가방|잡화|헌책|책|수건|이불|인형|커튼|고철|비철|스테인리스|후라이팬|프라이팬|냄비|컴퓨터|노트북|모니터|핸드폰|휴대폰|에어컨|투명봉투|비닐봉투|대형봉투|큰봉투|종량제봉투|봉투|봉지|박스|포대|마대|자루)\s*)?\d+(?:\.\d+)?\s*(?:kg|키로|킬로|개|대|봉지|봉투|박스|포대|마대|자루|묶음|벌|켤레)(?:\s*(?:헌옷|옷|의류|신발|가방|헌책|고철))?/gi;
    const qtyMatches = textWithoutDates.match(itemQtyRegex);
    if (qtyMatches) {
      for (const qm of qtyMatches) {
        const trimmedQ = qm.trim();
        if (trimmedQ && !extractedChunks.includes(trimmedQ)) {
          extractedChunks.push(trimmedQ);
        }
      }
    }
    const extraItemsRegex =
      /(헌옷|의류|신발|가방|헌책|이불|커튼|후라이팬|프라이팬|냄비|노트북|컴퓨터|모니터|폐휴대폰|에어컨)/g;
    const extraMatches = textWithoutDates.match(extraItemsRegex);
    if (extraMatches) {
      for (const itemWord of extraMatches) {
        if (!extractedChunks.some((c) => c.includes(itemWord))) {
          extractedChunks.push(itemWord);
        }
      }
    }
  }
  const itemsSummary = extractedChunks.length > 0 ? extractedChunks.join(', ') : null;

  const hasAddress = rawAddress.length >= 4;
  const hasLooseAddressHint =
    hasAddress ||
    /(?:시|군|구|동|읍|면|로|길|번지|아파트|빌라|오피스텔|호)/.test(textWithoutDates);
  const hasPickupIntent =
    /(올클|헌옷|수거|옷장|옷\s*정리|방문|포대|봉투|박스|키로|kg|신발|가방)/i.test(cleaned);

  return {
    isPickupRequest: hasAddress,
    hasPickupIntentWithoutAddress: !hasAddress && (hasPickupIntent || hasLooseAddressHint),
    rawAddress,
    detailAddress,
    customerName,
    desiredDateISO,
    itemsSummary,
    analyzerUsed: 'REGEX_FALLBACK',
  };
}

let lastGeminiRuntimeError: string | null = null;
let lastOpenAiRuntimeError: string | null = null;

export function resetSmsAiRuntimeErrors() {
  lastGeminiRuntimeError = null;
  lastOpenAiRuntimeError = null;
}

export function getSmsAiRuntimeHealth() {
  return {
    lastGeminiRuntimeError,
    lastOpenAiRuntimeError,
  };
}

/**
 * 수신된 문자 내용을 AI(Gemini -> OpenAI)로 우선 분석하고, 키가 없거나 통신 실패 시 내장 한국어 정규식 엔진으로 폴백합니다.
 */
export async function parseSmsContentWithAiOrFallback(smsText: string): Promise<ParsedSmsPickupData> {
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const openAiKey = (process.env.OPENAI_API_KEY || '').trim();

  if (geminiKey && !geminiKey.startsWith('your_')) {
    try {
      const res = await analyzeWithGemini(smsText, geminiKey);
      lastGeminiRuntimeError = null;
      return res;
    } catch (error: any) {
      const status = error?.response?.status;
      lastGeminiRuntimeError =
        status === 429
          ? 'Gemini API 호출 한도 초과(429) — 내장 파서 자동 동작 중'
          : status === 400 || status === 401 || status === 403
          ? 'Gemini API 키가 유효하지 않음 — 내장 파서 자동 동작 중'
          : error?.message || '연결 실패';
      console.warn('[SMS AI] Gemini 분석 실패, 폴백 파서로 전환합니다:', error?.message || error);
    }
  }

  if (openAiKey && !openAiKey.startsWith('your_')) {
    try {
      const res = await analyzeWithOpenAi(smsText, openAiKey);
      lastOpenAiRuntimeError = null;
      return { ...res, analyzerUsed: 'OPENAI' };
    } catch (error: any) {
      const status = error?.response?.status;
      lastOpenAiRuntimeError =
        status === 429
          ? 'OpenAI 크레딧/한도 초과(429) — 내장 파서 자동 동작 중'
          : status === 401
          ? 'OpenAI API 키 인증 실패(401) — 내장 파서 자동 동작 중'
          : 'OpenAI 응답 지연 — 내장 파서 자동 동작 중';
      console.warn('[SMS AI] OpenAI 분석 실패, 폴백 파서로 전환합니다:', error?.message || error);
    }
  }

  return parseSmsWithKoreanRegex(smsText);
}

export function standardizeProvinceName(region1Depth = ''): string {
  const trimmed = region1Depth.trim();
  if (trimmed === '경기') return '경기도';
  if (trimmed === '충남') return '충청남도';
  if (trimmed === '충북') return '충청북도';
  if (trimmed === '경북') return '경상북도';
  if (trimmed === '경남') return '경상남도';
  if (trimmed === '전북' || trimmed === '전북특별자치도') return '전북특별자치도';
  if (trimmed === '전남') return '전라남도';
  if (trimmed === '강원' || trimmed === '강원특별자치도') return '강원특별자치도';
  if (trimmed === '서울') return '서울특별시';
  if (trimmed === '인천') return '인천광역시';
  if (trimmed === '부산') return '부산광역시';
  if (trimmed === '대구') return '대구광역시';
  if (trimmed === '광주') return '광주광역시';
  if (trimmed === '대전') return '대전광역시';
  if (trimmed === '울산') return '울산광역시';
  if (trimmed === '세종' || trimmed === '세종시' || trimmed === '세종특별자치시') return '세종특별자치시';
  return trimmed;
}

/**
 * 왜 2단계 카카오 주소 정규화를 수행하는가:
 * 문자 신청 고객은 도로명 전체 대신 "수원 광교 자연앤자이"처럼 약식 아파트명만 적는 경우가 많으므로
 * 1차로 정식 주소 검색(address.json), 실패 시 2차로 장소/아파트 키워드 검색(keyword.json)을 수행하여
 * 우편번호·시/군/구·법정동 매핑 성공률을 극대화합니다.
 */
export async function normalizeAddressWithKakao(rawAddress: string): Promise<NormalizedKoreanAddress | null> {
  const kakaoKey = (process.env.KAKAO_CLIENT_ID || '').trim();
  if (!rawAddress || !kakaoKey || kakaoKey === '카카오_디벨로퍼스_REST_API_KEY') {
    return null;
  }

  try {
    // 1차: 정식 도로명/지번 주소 검색
    const addrRes = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
      params: { query: rawAddress },
      headers: { Authorization: `KakaoAK ${kakaoKey}` },
      timeout: 5000,
    });

    const firstAddr = addrRes.data?.documents?.[0];
    if (firstAddr) {
      const road = firstAddr.road_address;
      const jibun = firstAddr.address;
      const buildingName = road?.building_name ? ` (${road.building_name})` : '';
      return {
        standardAddress: road?.address_name
          ? `${road.address_name}${buildingName}`
          : jibun?.address_name || rawAddress,
        zipCode: road?.zone_no || '00000',
        province: standardizeProvinceName(jibun?.region_1depth_name || road?.region_1depth_name || ''),
        city: (jibun?.region_2depth_name || road?.region_2depth_name || '').trim(),
        town: (jibun?.region_3depth_name || road?.region_3depth_name || '').trim(),
        isVerified: true,
      };
    }

    // 2차: 아파트명/건물명 키워드 검색 폴백
    const kwRes = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: { query: rawAddress, size: 1 },
      headers: { Authorization: `KakaoAK ${kakaoKey}` },
      timeout: 5000,
    });

    const firstPlace = kwRes.data?.documents?.[0];
    if (firstPlace) {
      const baseAddr = firstPlace.road_address_name || firstPlace.address_name || rawAddress;
      const placeLabel =
        firstPlace.place_name && !baseAddr.includes(firstPlace.place_name)
          ? `${baseAddr} (${firstPlace.place_name})`
          : baseAddr;

      const addrParts = (firstPlace.address_name || baseAddr).split(' ');
      return {
        standardAddress: placeLabel,
        zipCode: '00000',
        province: standardizeProvinceName(addrParts[0] || ''),
        city: (addrParts[1] || '').trim(),
        town: (addrParts[2] || '').trim(),
        isVerified: true,
      };
    }
  } catch (error: any) {
    console.warn('[SMS Kakao Address] 카카오 주소 보정 중 오류 발생 (원문 기반 진행):', error?.message || error);
  }

  return null;
}
