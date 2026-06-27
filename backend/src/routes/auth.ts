import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/authMiddleware';

const router = express.Router();

// 카카오 로그인 요청 (프론트에서 이쪽으로 리다이렉트하거나 직접 카카오 인가코드 URL로 이동)
router.get('/kakao', (req, res) => {
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_CLIENT_ID}&redirect_uri=${process.env.KAKAO_REDIRECT_URI}&response_type=code`;
  res.redirect(kakaoAuthUrl);
});

// 카카오 로그인 콜백 (카카오에서 이쪽으로 리다이렉트 해줌)
router.get('/kakao/callback', async (req, res) => {
  const code = req.query.code as string;
  
  if (!code) {
    return res.status(400).json({ error: '인가 코드가 없습니다.' });
  }

  try {
    // 1. 인가 코드로 액세스 토큰 요청
    const tokenResponse = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. 액세스 토큰으로 카카오 사용자 정보 조회
    const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const kakaoUser = userResponse.data;
    const kakaoId = kakaoUser.id.toString();
    const nickname = kakaoUser.properties?.nickname || '고객';
    const email = kakaoUser.kakao_account?.email || null;
    
    // 3. DB에 사용자 저장/업데이트
    const user = await prisma.user.upsert({
      where: { kakaoId },
      update: {
        name: nickname,
        email: email,
      },
      create: {
        kakaoId,
        name: nickname,
        email: email,
        role: 'CUSTOMER', // 기본 가입 시 고객으로 지정. 관리자가 나중에 DB에서 권한 변경
      },
    });

    // 4. JWT 발급 (DB에 저장된 실제 role 포함)
    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    // 5. 프론트엔드로 리다이렉트
    const frontendUrl = process.env.FRONTEND_URL || 'https://all-cle.com';
      
    res.redirect(`${frontendUrl}/login-success?token=${jwtToken}&name=${encodeURIComponent(user.name)}&role=${user.role}`);

  } catch (error: any) {
    console.error('카카오 로그인 에러:', error.response?.data || error.message);
    res.status(500).json({ 
      error: '로그인 처리 중 오류가 발생했습니다.', 
      details: error.response?.data || error.message 
    });
  }
});

// 데모용 로그인 (테스트 용도)
router.post('/demo', async (req, res) => {
  const { role } = req.body; // 'PARTNER' or 'DRIVER'
  
  try {
    let user;
    
    if (role === 'PARTNER') {
      // 데모 파트너 찾거나 생성
      user = await prisma.user.upsert({
        where: { email: 'demo_partner@test.com' },
        update: {},
        create: {
          name: '데모 파트너(용인시)',
          email: 'demo_partner@test.com',
          role: 'PARTNER',
        }
      });
      
      // 데모 파트너는 권역 제한 없이 모든 미배정 건(80개)을 볼 수 있도록 권역 할당 로직을 제거했습니다.
      
      // 파트너에 소속된 데모 기사 생성
      const driverUser = await prisma.user.upsert({
        where: { email: 'demo_driver@test.com' },
        update: {},
        create: {
          name: '김기사 (데모)',
          email: 'demo_driver@test.com',
          role: 'DRIVER'
        }
      });
      
      await prisma.driverProfile.upsert({
        where: { userId: driverUser.id },
        update: {},
        create: {
          userId: driverUser.id,
          partnerId: user.id,
          vehicleInfo: '1톤 트럭'
        }
      });

    } else if (role === 'DRIVER') {
      user = await prisma.user.findFirst({
        where: { email: 'demo_driver@test.com' }
      });
      if (!user) {
        return res.status(404).json({ error: '기사 계정이 없습니다. 파트너로 먼저 데모 로그인해주세요.' });
      }
    } else if (role === 'SUPER_ADMIN') {
      user = await prisma.user.upsert({
        where: { email: 'demo_superadmin@test.com' },
        update: {},
        create: {
          name: '슈퍼 관리자 (데모)',
          email: 'demo_superadmin@test.com',
          role: 'SUPER_ADMIN'
        }
      });
    } else {
      // CUSTOMER
      user = await prisma.user.upsert({
        where: { email: 'demo_customer@test.com' },
        update: {},
        create: {
          name: '데모 고객',
          email: 'demo_customer@test.com',
          role: 'CUSTOMER'
        }
      });
    }

    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token: jwtToken, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    console.error('데모 로그인 에러:', error);
    res.status(500).json({ error: '데모 로그인 실패' });
  }
});

// 이메일과 비밀번호 기반의 정식 로그인 API
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: '등록되지 않은 이메일이거나 비밀번호가 설정되지 않은 계정입니다.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    const jwtToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token: jwtToken, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    console.error('로그인 에러:', error);
    res.status(500).json({ error: '로그인 처리 중 서버 오류가 발생했습니다.' });
  }
});

// 초기 슈퍼 관리자 생성 API (테스트/초기화 용도 - 실 서비스에서는 삭제 권장)
router.post('/init-superadmin', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: '이메일, 비밀번호, 이름을 모두 입력해주세요.' });
  }

  try {
    const existing = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (existing && existing.email !== email) {
      return res.status(403).json({ error: `이미 다른 이메일(${existing.email})의 슈퍼 관리자 계정이 존재합니다.` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hashedPassword, name, role: 'SUPER_ADMIN' },
      create: {
        email,
        password: hashedPassword,
        name,
        role: 'SUPER_ADMIN'
      }
    });

    res.json({ message: '슈퍼 관리자 계정이 생성/업데이트 되었습니다.', email: user.email });
  } catch (error) {
    console.error('슈퍼관리자 생성 에러:', error);
    res.status(500).json({ error: '슈퍼관리자 계정 생성 실패' });
  }
});

// 비밀번호 변경 API
router.patch('/password', authenticate, async (req: any, res: any) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return res.status(400).json({ error: '사용자를 찾을 수 없거나 비밀번호가 설정되지 않은 계정입니다.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (error) {
    console.error('비밀번호 변경 에러:', error);
    res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

// 내 정보 조회
router.get('/me', authenticate, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, email: true, role: true, address: true, detailAddress: true, zipCode: true }
    });
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ user });
  } catch (error) {
    console.error('내 정보 조회 에러:', error);
    res.status(500).json({ error: '내 정보를 불러오는데 실패했습니다.' });
  }
});

// 내 정보 수정
router.patch('/profile', authenticate, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const { name, phone, address, detailAddress, zipCode } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '이름은 필수 항목입니다.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, phone, address, detailAddress, zipCode },
      select: { id: true, name: true, phone: true, email: true, role: true, address: true, detailAddress: true, zipCode: true }
    });

    res.json({ message: '정보가 성공적으로 업데이트 되었습니다.', user: updatedUser });
  } catch (error) {
    console.error('내 정보 수정 에러:', error);
    res.status(500).json({ error: '정보 수정에 실패했습니다.' });
  }
});

export default router;
