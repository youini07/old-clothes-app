import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  // 허용할 역할 목록 (예: ['CUSTOMER'], ['PARTNER'], ['SUPER_ADMIN'])
  allowedRoles: string[];
  // 인증 실패 시 리다이렉트할 경로
  redirectTo?: string;
}

/**
 * 왜 필요한가:
 * URL을 직접 입력하면 누구나 관리자 대시보드에 접근할 수 있었음.
 * 이 컴포넌트가 토큰과 역할(role)을 체크하여 비인가 접근을 차단.
 */
export default function ProtectedRoute({ children, allowedRoles, redirectTo = '/' }: ProtectedRouteProps) {
  const token = localStorage.getItem('auth_token');
  const userInfoStr = localStorage.getItem('user_info');

  // 토큰이 없으면 리다이렉트
  if (!token) {
    return <Navigate to={redirectTo} replace />;
  }

  // 역할(role) 체크
  if (userInfoStr) {
    try {
      const userInfo = JSON.parse(userInfoStr);
      if (!allowedRoles.includes(userInfo.role)) {
        return <Navigate to={redirectTo} replace />;
      }
      
      // 역할별 필수 토큰 체크
      if (userInfo.role === 'PARTNER' && !localStorage.getItem('admin_token')) {
        return <Navigate to="/staff-login" replace />;
      }
      if (userInfo.role === 'DRIVER' && !localStorage.getItem('driver_token')) {
        return <Navigate to="/staff-login" replace />;
      }
      if (userInfo.role === 'SUPER_ADMIN' && !localStorage.getItem('superadmin_token')) {
        return <Navigate to="/staff-login" replace />;
      }
    } catch {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
}
