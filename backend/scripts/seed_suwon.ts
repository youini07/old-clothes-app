import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const suwonAddresses = [
  '경기도 수원시 팔달구 권광로 142',
  '경기도 수원시 팔달구 매산로 1',
  '경기도 영통구 센트럴타운로 76', // 수원시 영통구
  '경기도 수원시 장안구 경수대로 927',
  '경기도 수원시 권선구 세권로 243',
  '경기도 수원시 장안구 수성로 303',
  '경기도 수원시 장안구 대평로 90',
  '경기도 수원시 영통구 매영로 345',
  '경기도 수원시 팔달구 동수원로 318',
  '경기도 수원시 권선구 호매실로 104',
  '경기도 수원시 영통구 광교중앙로 140',
  '경기도 수원시 팔달구 우만동 600',
  '경기도 수원시 영통구 원천동 605',
  '경기도 수원시 권선구 금곡로 212',
  '경기도 수원시 장안구 정자동 111-1',
  '경기도 수원시 팔달구 인계동 1122',
  '경기도 수원시 영통구 망포동 651',
  '경기도 수원시 권선구 세류동 1110',
  '경기도 수원시 장안구 파장동 605-1',
  '경기도 수원시 팔달구 행궁동 11',
  '경기도 수원시 권선구 구운동 115',
  '경기도 수원시 영통구 영통동 961-6',
  '경기도 수원시 영통구 매탄동 1267',
  '경기도 수원시 장안구 연무동 257',
  '경기도 수원시 권선구 오목천동 548',
  '경기도 수원시 팔달구 지동 402',
  '경기도 수원시 팔달구 화서동 72-1',
  '경기도 수원시 장안구 조원동 894',
  '경기도 수원시 권선구 탑동 903',
  '경기도 수원시 영통구 이의동 1336'
];

const names = ['김민준', '이서연', '박도윤', '최서윤', '정하준', '강지우', '조서진', '윤하은', '장지호', '임지아', 
               '한은우', '오민서', '서윤우', '신채원', '권우진', '황수아', '안건우', '송지율', '유연우', '홍다은', 
               '전시우', '고하린', '문도현', '손아린', '양유준', '배지유', '백승우', '허소율', '남이준', '심나은'];

function randomVolume() {
  const volumes = ['10kg~20kg', '20kg~30kg', '30kg 이상'];
  return volumes[Math.floor(Math.random() * volumes.length)];
}

function randomPhone() {
  const mid = Math.floor(1000 + Math.random() * 9000);
  const end = Math.floor(1000 + Math.random() * 9000);
  return `010-${mid}-${end}`;
}

async function main() {
  console.log('Seeding Suwon data...');

  // 1. 수원시 Region 찾기 또는 생성
  let suwonRegion = await prisma.region.findFirst({
    where: { province: '경기도', city: '수원시', town: null }
  });

  if (!suwonRegion) {
    suwonRegion = await prisma.region.create({
      data: { province: '경기도', city: '수원시', town: null }
    });
    console.log('Created Suwon Region:', suwonRegion.id);
  }

  // 2. Demo 파트너에게 수원시 권역 추가
  const demoPartner = await prisma.user.findUnique({
    where: { email: 'demo_partner@test.com' }
  });

  if (demoPartner) {
    const coverageExists = await prisma.coverage.findFirst({
      where: { partnerId: demoPartner.id, regionId: suwonRegion.id }
    });
    if (!coverageExists) {
      await prisma.coverage.create({
        data: { partnerId: demoPartner.id, regionId: suwonRegion.id }
      });
      console.log('Added Suwon coverage to Demo Partner.');
    }
  } else {
    console.log('Demo Partner not found. Run demo login first if you want coverage.');
  }

  // 3. 30개의 수거 신청 생성
  let count = 0;
  for (let i = 0; i < 30; i++) {
    await prisma.request.create({
      data: {
        userName: names[i] || '고객님',
        phone: randomPhone(),
        address: suwonAddresses[i],
        detailAddress: Math.floor(Math.random() * 10) + '층',
        zipCode: '16000',
        desiredDate: new Date(),
        estimatedVolume: randomVolume(),
        status: 'PENDING',
        partnerId: null, // 미배정 상태 (선착순 수락 대기)
        regionId: suwonRegion.id,
      }
    });
    count++;
  }

  console.log(`Successfully created ${count} mock requests in Suwon.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    throw e;
  });
