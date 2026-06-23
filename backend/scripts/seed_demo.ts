import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const citiesData = [
  { city: "수원시", guList: ["장안구", "권선구", "팔달구", "영통구"], dongList: ["정자동", "권선동", "인계동", "영통동", "매탄동", "이의동", "호매실동"] },
  { city: "용인시", guList: ["처인구", "기흥구", "수지구"], dongList: ["역북동", "구갈동", "풍덕천동", "상현동", "보라동", "신갈동"] },
  { city: "성남시", guList: ["수정구", "중원구", "분당구"], dongList: ["태평동", "성남동", "정자동", "서현동", "백현동", "판교동"] },
  { city: "고양시", guList: ["덕양구", "일산동구", "일산서구"], dongList: ["화정동", "마두동", "일산동", "대화동", "정발산동", "행신동"] },
  { city: "안양시", guList: ["만안구", "동안구"], dongList: ["안양동", "석수동", "비산동", "평촌동", "호계동", "관양동"] },
  { city: "안산시", guList: ["상록구", "단원구"], dongList: ["본오동", "사동", "고잔동", "초지동", "선부동", "월피동"] },
  { city: "부천시", guList: ["원미구", "소사구", "오정구"], dongList: ["중동", "상동", "송내동", "오정동", "심곡본동", "역곡동"] },
  { city: "광명시", guList: [""], dongList: ["광명동", "철산동", "하안동", "소하동", "일직동"] }
];

const names = ['김민준', '이서연', '박도윤', '최서윤', '정하준', '강지우', '조서진', '윤하은', '장지호', '임지아', 
               '한은우', '오민서', '서윤우', '신채원', '권우진', '황수아', '안건우', '송지율', '유연우', '홍다은'];

function randomVolume() {
  const volumes = ['헌옷 15kg', '헌옷 25kg, 신발 3켤레', '30kg 이상 (마대자루 2개)', '소량 (10kg 내외)', '옷 20kg, 가방 5개'];
  return volumes[Math.floor(Math.random() * volumes.length)];
}

function randomPhone() {
  const mid = Math.floor(1000 + Math.random() * 9000);
  const end = Math.floor(1000 + Math.random() * 9000);
  return `010-${mid}-${end}`;
}

async function main() {
  console.log('Deleting existing requests...');
  await prisma.request.deleteMany({});
  
  console.log('Seeding demo data for 8 cities...');
  
  let count = 0;

  for (const c of citiesData) {
    let region = await prisma.region.findFirst({
      where: { province: '경기도', city: c.city, town: null }
    });
    if (!region) {
      region = await prisma.region.create({
        data: { province: '경기도', city: c.city, town: null }
      });
    }

    for (let i = 0; i < 10; i++) {
      const gu = c.guList[Math.floor(Math.random() * c.guList.length)];
      const dong = c.dongList[Math.floor(Math.random() * c.dongList.length)];
      const jibun = Math.floor(Math.random() * 1000) + '-' + Math.floor(Math.random() * 10);
      
      const address = gu ? `경기도 ${c.city} ${gu} ${dong} ${jibun}` : `경기도 ${c.city} ${dong} ${jibun}`;
      const sigungu = gu ? `${c.city} ${gu}` : c.city;
      
      await prisma.request.create({
        data: {
          userName: names[Math.floor(Math.random() * names.length)],
          phone: randomPhone(),
          address: address,
          detailAddress: Math.floor(Math.random() * 20 + 1) + '층',
          zipCode: '1' + Math.floor(1000 + Math.random() * 9000),
          sigungu: sigungu,
          bname: dong,
          desiredDate: new Date(),
          estimatedVolume: randomVolume(),
          status: 'PENDING',
          partnerId: null, // 미배정 상태 (수락 대기)
          regionId: region.id,
        }
      });
      count++;
    }
  }

  console.log(`Successfully created ${count} mock requests.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  });
