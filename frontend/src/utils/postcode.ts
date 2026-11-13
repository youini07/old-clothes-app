const KAKAO_POSTCODE_SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

export interface PostcodeConstructor {
  new (options: {
    oncomplete: (data: any) => void;
    width?: string | number;
    height?: string | number;
  }): {
    open: () => void;
    embed: (element: HTMLElement) => void;
  };
}

let postcodeLoadPromise: Promise<PostcodeConstructor> | null = null;

/**
 * 왜 별도 헬퍼로 분리했는가:
 * 1) 카카오 우편번호 서비스 도메인이 t1.daumcdn.net -> t1.kakaocdn.net으로 변경됨에 따라
 *    kakao.Postcode / daum.Postcode 양쪽 네임스페이스를 일관되게 조회하기 위함입니다.
 * 2) index.html 스크립트가 지연 로드되었거나 초기 오프라인 등으로 누락된 상황에서도 동적 재로드를 보장합니다.
 */
function getLoadedPostcodeConstructor(): PostcodeConstructor | null {
  const win = window as any;
  return win?.kakao?.Postcode || win?.daum?.Postcode || null;
}

export function loadPostcodeConstructor(): Promise<PostcodeConstructor> {
  const loaded = getLoadedPostcodeConstructor();
  if (loaded) {
    return Promise.resolve(loaded);
  }

  if (postcodeLoadPromise) {
    return postcodeLoadPromise;
  }

  postcodeLoadPromise = new Promise<PostcodeConstructor>((resolve, reject) => {
    const resolveIfReady = () => {
      const ctor = getLoadedPostcodeConstructor();
      if (ctor) {
        resolve(ctor);
        return true;
      }
      return false;
    };

    const existingScript = Array.from(document.getElementsByTagName('script')).find(
      (script) => script.src.includes('postcode.v2.js') && script.dataset.postcodeState === 'loading'
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (!resolveIfReady()) {
          postcodeLoadPromise = null;
          reject(new Error('카카오 주소검색 스크립트 초기화에 실패했습니다.'));
        }
      }, { once: true });
      existingScript.addEventListener('error', () => {
        postcodeLoadPromise = null;
        reject(new Error('카카오 주소검색 스크립트를 불러오지 못했습니다.'));
      }, { once: true });
      return;
    }

    // 초기 head 스크립트가 오프라인 등으로 실패한 경우에도 다시 시도할 수 있도록 새 script 태그로 로드
    const script = document.createElement('script');
    script.src = KAKAO_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.dataset.postcodeState = 'loading';
    script.onload = () => {
      script.dataset.postcodeState = 'loaded';
      if (!resolveIfReady()) {
        postcodeLoadPromise = null;
        reject(new Error('카카오 주소검색 스크립트 초기화에 실패했습니다.'));
      }
    };
    script.onerror = () => {
      script.dataset.postcodeState = 'error';
      postcodeLoadPromise = null;
      reject(new Error('카카오 주소검색 스크립트를 불러오지 못했습니다.'));
    };
    document.head.appendChild(script);
  });

  return postcodeLoadPromise;
}
