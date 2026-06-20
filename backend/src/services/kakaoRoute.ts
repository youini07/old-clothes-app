import axios from 'axios';

// 주소를 좌표(x: 경도, y: 위도)로 변환
export const getCoordinates = async (address: string) => {
  try {
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
      params: { query: address },
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_CLIENT_ID}` },
    });
    const documents = response.data.documents;
    if (documents.length > 0) {
      return {
        name: address,
        x: documents[0].x, // 경도 (longitude)
        y: documents[0].y, // 위도 (latitude)
      };
    }
    return null;
  } catch (error) {
    console.error(`좌표 변환 실패 (${address}):`, error);
    return null;
  }
};

// 출발지와 여러 경유지를 받아 최적 경로 계산
export const getOptimalRoute = async (origin: {x: string, y: string}, destinations: Array<{name: string, x: string, y: string}>) => {
  try {
    // 경유지 포맷팅 (최대 30개 지원)
    const waypoints = destinations.map(dest => ({
      name: dest.name,
      x: dest.x,
      y: dest.y
    }));

    // 카카오 다중 출발지/경유지/목적지 길찾기 API (경유지가 1개 이상일 때)
    // 여기서는 마지막 경유지를 목적지로 삼거나, 왕복인 경우 출발지를 목적지로 삼습니다.
    const destination = waypoints.pop(); // 마지막 요소를 목적지로 뺌

    if (!destination) {
       throw new Error('목적지가 없습니다.');
    }

    const response = await axios.post(
      'https://apis-navi.kakaomobility.com/v1/waypoints/directions',
      {
        origin: { x: origin.x, y: origin.y },
        destination: { x: destination.x, y: destination.y },
        waypoints: waypoints,
        priority: 'RECOMMEND',
        car_type: 1, // 1: 1종 (승용차/소형승합차)
        car_fuel: 'GASOLINE',
      },
      {
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_CLIENT_ID}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('최적 경로 계산 실패:', error.response?.data || error.message);
    throw error;
  }
};

// 출발지(현재위치)에서 목적지까지의 단순 소요 시간(ETA) 계산
export const getSingleRouteETA = async (originX: string, originY: string, destAddress: string) => {
  try {
    // 목적지 주소를 좌표로 변환
    const destCoords = await getCoordinates(destAddress);
    if (!destCoords) {
      throw new Error('목적지 좌표를 찾을 수 없습니다.');
    }

    // 카카오내비 단건 길찾기 API 호출
    const response = await axios.get(
      'https://apis-navi.kakaomobility.com/v1/directions',
      {
        params: {
          origin: `${originX},${originY}`,
          destination: `${destCoords.x},${destCoords.y}`,
          priority: 'RECOMMEND',
          car_type: 1,
          car_fuel: 'GASOLINE',
        },
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_CLIENT_ID}`,
        },
      }
    );

    // 응답에서 소요 시간(초) 추출하여 분 단위로 변환
    const routes = response.data.routes;
    if (routes && routes.length > 0) {
      const durationSeconds = routes[0].summary.duration;
      return Math.ceil(durationSeconds / 60); // 분 단위 올림
    }
    
    return null;
  } catch (error: any) {
    console.error('ETA 계산 실패:', error.response?.data || error.message);
    throw error;
  }
};
