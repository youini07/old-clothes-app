import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminMapDispatch from '../components/AdminMapDispatch';
import Spinner from '../components/Spinner';
import { AdminChatDashboard } from '../components/chat/AdminChatDashboard';
import AddressSearchModal from '../components/AddressSearchModal';
import CalendarView from '../components/CalendarView';

interface RequestItem {
  id: string;
  userName: string;
  phone: string;
  address: string;
  detailAddress: string;
  estimatedVolume: string;
  status: string;
  partnerId: string | null;
  driverId: string | null;
  etaMinutes?: number;
  orderIndex?: number;
  actualWeight?: number;
  driverNote?: string | null;
  itemPhotoUrl?: string | null;
  scalePhotoUrl?: string | null;
  extraPhotoUrl?: string | null;
  customerPackedPhotoUrl?: string | null;
  completedDate?: string | Date | null;
  desiredDate?: string | Date; // 고객 수거 희망일
  confirmedDate?: string | Date | null; // 사장님 확정 방문일
  isMustPickupDate?: boolean;
  createdAt?: string | Date;
  displayId?: number;
  sigungu?: string | null;
  bname?: string | null;
  totalPrice?: number;
  collectionItems?: Array<{
    categoryLabel: string;
    quantity: number;
    unitType: string;
    unitPrice: number;
    subtotal: number;
    photoUrl: string | null;
  }>;
}

// 수거 희망일 뱃지 렌더링 헬퍼 함수
// 수거 희망일(또는 확정일) 뱃지 렌더링 헬퍼 함수
const DesiredDateBadge = ({ desiredDate, confirmedDate }: { desiredDate?: string | Date, confirmedDate?: string | Date | null }) => {
  const targetDate = confirmedDate || desiredDate;
  if (!targetDate) return null;
  const isConfirmed = !!confirmedDate;
  const desired = new Date(targetDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const desiredDay = new Date(desired);
  desiredDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((desiredDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const month = desired.getMonth() + 1;
  const day = desired.getDate();
  const dayName = dayNames[desired.getDay()];
  const dateLabel = `${month}/${day}(${dayName})`;

  if (isConfirmed) {
    return <span className="inline-flex items-center gap-0.5 bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap" title="사장님이 방문일을 임의 변경함">📌 {dateLabel} 방문 확정</span>;
  }

  // 지연(과거), 오늘, 내일, 그 외에 따라 색상 분기
  if (diffDays < 0) {
    return <span className="inline-flex items-center gap-0.5 bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap">⚠️ {dateLabel} 희망 (지연)</span>;
  }
  if (diffDays === 0) {
    return <span className="inline-flex items-center gap-0.5 bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap">📅 오늘 수거 희망</span>;
  }
  if (diffDays === 1) {
    return <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap">📅 내일 ({dateLabel})</span>;
  }
  return <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap">📅 {dateLabel} 희망</span>;
};

interface CustomRegion {
  id: string;
  name: string;
  areas: string[];
}

interface Driver {
  id: string;
  user?: { name: string; phone?: string };
  name?: string; // Fallback
  todayDistanceKm?: number;
  customRegion?: CustomRegion | null;
  customRegionId?: string | null;
}

export default function AdminDashboard() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [activeView, setActiveView] = useState<'dispatch' | 'mapDispatch' | 'stats' | 'settings' | 'calendar'>('dispatch');
  const [settings, setSettings] = useState<{ pricePerKg: number; useBizMessage: boolean; useCrmAutomation: boolean } | null>(null);
  const [globalSettings, setGlobalSettings] = useState<{ globalNotice: string; noticeIsActive: boolean; globalNoticeDetail?: string } | null>(null);
  const [adminInfo, setAdminInfo] = useState<{ address?: string; businessName?: string; name?: string } | null>(null);
  const [page] = useState(1);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // 파트너 단가표 상태 (카테고리별 단가 설정)
  const [priceTableItems, setPriceTableItems] = useState<Array<{
    category: string; label: string; unitPrice: number; unitType: string; icon: string;
  }>>([
    { category: 'CLOTHES',  label: '헌옷 (신발, 가방 포함)', unitPrice: 400,   unitType: 'KG',   icon: '👕' },
    { category: 'BOOKS',    label: '헌책',                   unitPrice: 30,    unitType: 'KG',   icon: '📚' },
    { category: 'COOKWARE', label: '후라이팬, 냄비류',        unitPrice: 300,   unitType: 'KG',   icon: '🍳' },
    { category: 'PHONE',    label: '핸드폰',                 unitPrice: 500,   unitType: 'UNIT', icon: '📱' },
    { category: 'COMPUTER', label: '컴퓨터, 노트북',         unitPrice: 2000,  unitType: 'UNIT', icon: '💻' },
    { category: 'CD_TAPE',  label: '음악 CD/음악 테이프',     unitPrice: 500,   unitType: 'KG',   icon: '💿' },
    { category: 'LP',       label: '음악 LP판',              unitPrice: 1000,  unitType: 'KG',   icon: '🎵' },
    { category: 'AC_STAND', label: '스탠드 에어컨 (실외기 포함)', unitPrice: 20000, unitType: 'UNIT', icon: '❄️' },
    { category: 'AC_WALL',  label: '벽걸이 에어컨 (실외기 포함)', unitPrice: 10000, unitType: 'UNIT', icon: '🌀' },
  ]);
  const [isSavingPriceTable, setIsSavingPriceTable] = useState(false);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });

  const [customRegions, setCustomRegions] = useState<CustomRegion[]>([]);
  const [newRegionForm, setNewRegionForm] = useState<{ name: string; selectedAreas: string[]; exceptions: Record<string, string> }>({ name: '', selectedAreas: [], exceptions: {} });
  const [isAddingRegion, setIsAddingRegion] = useState(false);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ userName: '', phone: '', address: '', detailAddress: '', estimatedWeight: '', estimatedVolume: '', desiredDate: '' });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', email: '', vehicleInfo: '', customRegionId: '' });
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  // 로딩 스피너/비활성화를 위한 상태 추가
  const [isSavingDriver, setIsSavingDriver] = useState(false);
  const [isSubmittingRegion, setIsSubmittingRegion] = useState(false);
  const [deletingRegionId, setDeletingRegionId] = useState<string | null>(null);
  const [isBatchUnassigning, setIsBatchUnassigning] = useState(false);
  const [unassigningReqId, setUnassigningReqId] = useState<string | null>(null);
  const [isBulkClaiming, setIsBulkClaiming] = useState(false);
  const [isBulkUnclaiming, setIsBulkUnclaiming] = useState(false);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [unclaimingId, setUnclaimingId] = useState<string | null>(null);

  // 모바일/클릭 배정용 상태
  const [selectedRequestIdForAssign, setSelectedRequestIdForAssign] = useState<string | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<string[]>([]);
  const [selectedAssignedIds, setSelectedAssignedIds] = useState<string[]>([]);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);

  // 권역별 보기 탭
  const [activeRegionTab, setActiveRegionTab] = useState<string>('ALL');
  
  // 모바일 배차 탭
  const [dispatchTab, setDispatchTab] = useState<'requests' | 'drivers'>('requests');

  // 선택된 기사 (탭)
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);

  useEffect(() => {
    if (drivers.length > 0 && !activeDriverId) {
      setActiveDriverId(drivers[0].id);
    }
  }, [drivers, activeDriverId]);

  // 정산 통계
  const [stats, setStats] = useState<{ summary: any; monthlyStats: any[] } | null>(null);
  const [selectedCompletedRequest, setSelectedCompletedRequest] = useState<RequestItem | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const allCompletedRequests = requests
    .filter(r => r.status === 'COMPLETED')
    .sort((a, b) => {
      const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
      const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
      return dateB - dateA;
    });



  const fetchCustomRegions = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/custom-regions`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setCustomRegions(res.data.regions || []);
    } catch (error) {
      console.error('권역 조회 실패:', error);
    }
  };

  const fetchAdminInfo = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setAdminInfo(res.data.user);
    } catch (error) {
      console.error('관리자 정보 조회 실패:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setStats(res.data);
    } catch (error) {
      console.error('통계 데이터 조회 실패:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/settings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSettings(res.data.settings);
      // 파트너 커스텀 단가표가 있으면 로드, 없으면 기본값 유지
      if (res.data.priceItems && res.data.priceItems.length > 0) {
        setPriceTableItems(res.data.priceItems.map((item: any) => ({
          category: item.category,
          label: item.label,
          unitPrice: item.unitPrice,
          unitType: item.unitType,
          icon: item.icon || ''
        })));
      }
    } catch (error) {
      console.error('환경 설정 조회 실패:', error);
    }
  };

  const fetchGlobalSettings = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/global-settings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setGlobalSettings(res.data);
    } catch (error) {
      console.error('전역 설정 조회 실패:', error);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingManual(true);
    try {
      const payload = {
        ...manualForm,
        userName: manualForm.userName.trim() === '' ? '수동접수' : manualForm.userName,
        estimatedVolume: manualForm.estimatedWeight ? `${manualForm.estimatedWeight}kg - ${manualForm.estimatedVolume}` : manualForm.estimatedVolume
      };
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/requests/manual`, payload, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setIsManualModalOpen(false);
      setManualForm({ userName: '', phone: '', address: '', detailAddress: '', estimatedWeight: '', estimatedVolume: '', desiredDate: '' });
      fetchData();
      alert('수동 접수가 완료되었습니다.');
    } catch (error) {
      console.error('수동 접수 실패:', error);
      alert('접수 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleAddressSearch = () => {
    setIsAddressModalOpen(true);
  };

  const handleAddressComplete = (data: any) => {
    setManualForm(prev => ({ ...prev, address: data.address, detailAddress: '' }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const res = await axios.patch(`${import.meta.env.VITE_API_URL}/admin/settings`, {
        pricePerKg: settings.pricePerKg,
        useBizMessage: settings.useBizMessage,
        useCrmAutomation: settings.useCrmAutomation
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSettings(res.data.settings);

      if (globalSettings) {
        await axios.patch(`${import.meta.env.VITE_API_URL}/admin/global-settings`, {
          globalNotice: globalSettings.globalNotice,
          noticeIsActive: globalSettings.noticeIsActive,
          globalNoticeDetail: globalSettings.globalNoticeDetail || ''
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        window.dispatchEvent(new Event('globalNoticeUpdated'));
      }

      alert('설정이 성공적으로 저장되었습니다.');
    } catch (error: any) {
      alert(error.response?.data?.error || '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingSettings(false);
    }
  };


  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [reqsRes, driversRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/admin/requests?limit=9999`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/admin/drivers`, { headers })
      ]);
      setRequests(reqsRes.data.requests || []);
      setDrivers(driversRes.data.drivers || []);
    } catch (error) {
      console.error('데이터 조회 실패:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setAuthToken(null);
        localStorage.removeItem('admin_token');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchData();
      if (page === 1) {
        fetchAdminInfo();
        fetchStats();
        fetchSettings();
        fetchGlobalSettings();
        fetchCustomRegions();
      }
    } else {
      setTimeout(() => setLoading(false), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, page]);

  // 배정 건 클릭 시 기사님 탭으로 자동 이동 (모바일 최적화)
  useEffect(() => {
    if (selectedRequestIdForAssign) {
      setDispatchTab('drivers');
    }
  }, [selectedRequestIdForAssign]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.newPasswordConfirm) {
      return alert('새 비밀번호가 일치하지 않습니다.');
    }
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/auth/password`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.');
      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      localStorage.clear();
      window.location.href = '/staff-login';
    } catch (error: any) {
      alert(error.response?.data?.error || '비밀번호 변경 실패');
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingDriver) return;
    setIsSavingDriver(true);
    try {
      if (editingDriverId) {
        await axios.patch(`${import.meta.env.VITE_API_URL}/admin/drivers/${editingDriverId}`, {
          name: driverForm.name,
          phone: driverForm.phone,
          vehicleInfo: driverForm.vehicleInfo,
          customRegionId: driverForm.customRegionId || null
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        alert('기사 정보가 성공적으로 수정되었습니다.');
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/admin/drivers`, driverForm, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        alert('기사님이 성공적으로 등록되었습니다.');
      }
      setIsDriverModalOpen(false);
      setDriverForm({ name: '', phone: '', email: '', vehicleInfo: '', customRegionId: '' });
      setEditingDriverId(null);
      fetchData(); // 새 기사님 목록 불러오기
    } catch (error: any) {
      alert(error.response?.data?.error || '기사 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingDriver(false);
    }
  };

  const handleAddRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRegion) return;
    setIsSubmittingRegion(true);
    try {
      const areas = newRegionForm.selectedAreas.map(area => {
        const exception = newRegionForm.exceptions[area];
        if (exception && exception.trim() !== '') {
          return `${area} (${exception.trim()})`;
        }
        return area;
      });

      if (areas.length === 0) {
        return alert('최소 1개 이상의 지역을 선택해주세요.');
      }

      await axios.post(`${import.meta.env.VITE_API_URL}/admin/custom-regions`, {
        name: newRegionForm.name,
        areas
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('권역이 추가되었습니다.');
      setNewRegionForm({ name: '', selectedAreas: [], exceptions: {} });
      setIsAddingRegion(false);
      fetchCustomRegions();
    } catch (error: any) {
      alert(error.response?.data?.error || '권역 추가 실패');
    } finally {
      setIsSubmittingRegion(false);
    }
  };

  const handleToggleArea = (area: string) => {
    setNewRegionForm(prev => {
      const isSelected = prev.selectedAreas.includes(area);
      const newSelectedAreas = isSelected ? prev.selectedAreas.filter(a => a !== area) : [...prev.selectedAreas, area];
      return { ...prev, selectedAreas: newSelectedAreas };
    });
  };

  const handleExceptionChange = (area: string, value: string) => {
    setNewRegionForm(prev => ({
      ...prev,
      exceptions: { ...prev.exceptions, [area]: value }
    }));
  };

  const GYEONGGI_AREAS = [
    "수원시 장안구", "수원시 권선구", "수원시 팔달구", "수원시 영통구",
    "용인시 처인구", "용인시 기흥구", "용인시 수지구",
    "성남시 수정구", "성남시 중원구", "성남시 분당구",
    "고양시 덕양구", "고양시 일산동구", "고양시 일산서구",
    "안양시 만안구", "안양시 동안구",
    "안산시 상록구", "안산시 단원구",
    "부천시 원미구", "부천시 소사구", "부천시 오정구",
    "평택시", "화성시", "시흥시", "파주시", "김포시", "광주시",
    "광명시", "군포시", "하남시", "이천시", "양주시", "구리시",
    "안성시", "포천시", "의왕시", "여주시", "동두천시", "과천시",
    "양평군", "가평군", "연천군"
  ];

  const handleDeleteRegion = async (id: string) => {
    if (!confirm('정말 이 권역을 삭제하시겠습니까? 할당된 기사님들의 권역이 해제됩니다.')) return;
    setDeletingRegionId(id);
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/admin/custom-regions/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('권역이 삭제되었습니다.');
      fetchCustomRegions();
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || '권역 삭제 실패');
    } finally {
      setDeletingRegionId(null);
    }
  };

  const openDriverModalForEdit = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setDriverForm({
      name: driver.user?.name || driver.name || '',
      phone: driver.user?.phone || '',
      email: '', // 이메일은 수정 불가
      vehicleInfo: '', // TODO: fetch vehicle info if available, currently we just leave blank or need to get it from profile
      customRegionId: driver.customRegionId || ''
    });
    setIsDriverModalOpen(true);
  };

  // 공통 기사 배정 함수 (드래그앤드롭 & 모바일 클릭 모두 사용)
  const assignDriver = async (requestId: string, targetDriverId: string | null) => {
    if (!authToken) return alert('로그인이 필요합니다.');

    // UI 즉시 업데이트 (Optimistic Update)
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return { ...req, driverId: targetDriverId, status: targetDriverId ? 'SCHEDULED' : 'ASSIGNED' };
      }
      return req;
    }));

    try {
      if (targetDriverId) {
        await axios.post(`${import.meta.env.VITE_API_URL}/admin/assign-driver`, {
          requestId,
          driverId: targetDriverId
        }, { headers: { Authorization: `Bearer ${authToken}` } });
      } else {
        // 배정 해제
        await axios.patch(`${import.meta.env.VITE_API_URL}/requests/${requestId}/assign`, {
          driverId: null
        }, { headers: { Authorization: `Bearer ${authToken}` } });
      }
    } catch (error) {
      console.error('배정 실패, 롤백');
      alert('기사 배정에 실패했습니다.');
      fetchData(); // 롤백
    }
  };

  // 날짜 임의 변경 핸들러
  const handleUpdateDate = async (requestId: string, dateStr: string) => {
    if (!dateStr || !authToken) return;
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/admin/requests/${requestId}/date`, {
        confirmedDate: dateStr
      }, { headers: { Authorization: `Bearer ${authToken}` } });
      // UI 즉각 반영 또는 fetchData() 호출
      fetchData();
    } catch (error) {
      console.error('날짜 변경 실패:', error);
      alert('방문 확정일 변경에 실패했습니다.');
    }
  };


  // 권역 매칭 헬퍼 함수
  const matchesRegion = (req: RequestItem, areas: string[]) => {
    const address = req.address || '';
    for (const areaStr of areas) {
      const match = areaStr.match(/^([^(]+)(?:\((.*)\))?$/);
      if (match) {
        const baseArea = match[1].trim();
        const exceptionsStr = match[2];
        
        // 1. baseArea 매칭 확인
        let isBaseMatched = false;
        if (req.sigungu) {
          if (req.sigungu === baseArea || req.sigungu.startsWith(baseArea)) {
            isBaseMatched = true;
          }
        } else {
          // 구형 데이터 폴백
          if (address.includes(baseArea)) {
            isBaseMatched = true;
          }
        }

        if (isBaseMatched) {
          if (exceptionsStr) {
            const exceptions = exceptionsStr.split(',').map(s => s.trim());
            let isExcluded = false;
            for (const ex of exceptions) {
              if (ex.startsWith('-')) {
                const excludedDong = ex.substring(1).trim();
                if (req.bname && req.bname === excludedDong) {
                  isExcluded = true;
                  break;
                } else if (!req.bname && address.includes(excludedDong)) {
                  isExcluded = true;
                  break;
                }
              }
            }
            if (!isExcluded) return true;
          } else {
            return true;
          }
        } else {
          // 2. 명시적 포함(+) 확인
          if (exceptionsStr) {
            const exceptions = exceptionsStr.split(',').map(s => s.trim());
            for (const ex of exceptions) {
              if (ex.startsWith('+')) {
                const includedDong = ex.substring(1).trim();
                if (req.bname && req.bname === includedDong) {
                  return true;
                } else if (!req.bname && address.includes(includedDong)) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
    return false;
  };

  // 수락 대기 중인 요청 (아직 아무 사장님도 수락하지 않은 건)
  const allPendingRequests = requests.filter(r => r.status === 'PENDING' && !r.partnerId);
  // 수락 완료 + 기사 미배정 건 (사장님이 수락했지만 기사 미배정)
  const allAcceptedUnassigned = requests.filter(r => r.partnerId && !r.driverId && r.status !== 'COMPLETED');

  // 현재 탭에 맞는 목록 필터링
  const getFilteredRequests = (reqList: RequestItem[]) => {
    if (activeRegionTab === 'ALL') return reqList;
    if (activeRegionTab === 'UNCLASSIFIED') {
      return reqList.filter(req => {
        // 어떤 권역에도 매칭되지 않는 건
        return !customRegions.some(cr => matchesRegion(req, cr.areas));
      });
    }
    const targetRegion = customRegions.find(cr => cr.id === activeRegionTab);
    if (!targetRegion) return reqList;
    return reqList.filter(req => matchesRegion(req, targetRegion.areas));
  };

  const pendingRequests = getFilteredRequests(allPendingRequests);
  const unassignedRequests = getFilteredRequests(allAcceptedUnassigned);

  // 일괄 기사 배정 핸들러
  const handleBulkAssign = async (targetDriverId: string | 'AUTO') => {
    if (!authToken) return alert('로그인이 필요합니다.');
    
    setIsBulkAssigning(true);
    let successCount = 0;
    let failCount = 0;

    const updates = selectedUnassignedIds.map(async (reqId) => {
      const req = requests.find(r => r.id === reqId);
      if (!req) return;

      let finalDriverId = targetDriverId;
      
      if (targetDriverId === 'AUTO') {
        const matchedDriver = drivers.find(d => {
          if (!d.customRegionId) return false;
          const cr = customRegions.find(c => c.id === d.customRegionId);
          if (!cr) return false;
          return matchesRegion(req, cr.areas);
        });
        if (!matchedDriver) {
          failCount++;
          return;
        }
        finalDriverId = matchedDriver.id;
      }

      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/admin/assign-driver`, {
          requestId: reqId,
          driverId: finalDriverId,
          confirmedDate: new Date()
        }, { headers: { Authorization: `Bearer ${authToken}` } });
        successCount++;
      } catch (err) {
        failCount++;
      }
    });

    await Promise.all(updates);
    
    setIsBulkAssigning(false);
    alert(`${successCount}건 배정 성공` + (failCount > 0 ? `, ${failCount}건 실패 (권역 미스매치 또는 오류)` : ''));
    setSelectedUnassignedIds([]);
    setIsBulkAssignModalOpen(false);
    fetchData();
  };

  // 체크박스 토글 핸들러 (신규 요청)
  const handleToggleAllPending = () => {
    if (selectedRequestIds.length === pendingRequests.length && pendingRequests.length > 0) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(pendingRequests.map(r => r.id));
    }
  };

  const handleToggleOnePending = (id: string) => {
    if (selectedRequestIds.includes(id)) {
      setSelectedRequestIds(prev => prev.filter(rId => rId !== id));
    } else {
      setSelectedRequestIds(prev => [...prev, id]);
    }
  };

  // 체크박스 토글 핸들러 (기사 미배정)
  const handleToggleAllUnassigned = () => {
    if (selectedUnassignedIds.length === unassignedRequests.length && unassignedRequests.length > 0) {
      setSelectedUnassignedIds([]);
    } else {
      setSelectedUnassignedIds(unassignedRequests.map(r => r.id));
    }
  };

  const handleToggleOneUnassigned = (id: string) => {
    if (selectedUnassignedIds.includes(id)) {
      setSelectedUnassignedIds(prev => prev.filter(rId => rId !== id));
    } else {
      setSelectedUnassignedIds(prev => [...prev, id]);
    }
  };

  // 일괄 수락 핸들러
  const handleBulkClaim = async () => {
    if (selectedRequestIds.length === 0) return alert('선택된 수거 요청이 없습니다.');
    setIsBulkClaiming(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/requests/bulk-claim`, {
        requestIds: selectedRequestIds
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert(`${selectedRequestIds.length}건의 수거 요청을 한 번에 수락했습니다! 기사를 배정해주세요.`);
      setSelectedRequestIds([]);
      fetchData();
    } catch (error: any) {
      const msg = error?.response?.data?.error || '일괄 수락에 실패했습니다.';
      alert(msg);
      fetchData();
    } finally {
      setIsBulkClaiming(false);
    }
  };

  // 일괄 수락 취소 핸들러
  const handleBulkUnclaim = async () => {
    if (selectedUnassignedIds.length === 0) return alert('선택된 수거 요청이 없습니다.');
    if (!window.confirm(`선택한 ${selectedUnassignedIds.length}건의 수락을 취소하시겠습니까? 다시 [신규 수거 요청] 대기 상태로 돌아갑니다.`)) return;
    setIsBulkUnclaiming(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/requests/bulk-unclaim`, {
        requestIds: selectedUnassignedIds
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert(`${selectedUnassignedIds.length}건의 수락이 한 번에 취소되었습니다.`);
      setSelectedUnassignedIds([]);
      fetchData();
    } catch (error: any) {
      const msg = error?.response?.data?.error || '일괄 취소에 실패했습니다.';
      alert(msg);
      fetchData();
    } finally {
      setIsBulkUnclaiming(false);
    }
  };

  // 일괄 배정 취소 핸들러
  const handleBatchUnassign = async () => {
    if (selectedAssignedIds.length === 0) return alert('선택된 수거 요청이 없습니다.');
    if (!window.confirm(`선택한 ${selectedAssignedIds.length}건의 배정을 일괄 취소하시겠습니까?`)) return;
    if (isBatchUnassigning) return;
    setIsBatchUnassigning(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/requests/batch-unassign`, {
        ids: selectedAssignedIds
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert(`${selectedAssignedIds.length}건의 배정이 한 번에 취소되었습니다.`);
      setSelectedAssignedIds([]);
      fetchData();
    } catch (error: any) {
      const msg = error?.response?.data?.error || '일괄 배정 취소에 실패했습니다.';
      alert(msg);
      fetchData();
    } finally {
      setIsBatchUnassigning(false);
    }
  };

  // 수거 요청 수락 핸들러 (단일 건)
  const handleClaim = async (requestId: string) => {
    setClaimingId(requestId);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/requests/${requestId}/claim`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('수거 요청을 수락했습니다! 기사를 배정해주세요.');
      fetchData(); // 목록 새로고침
    } catch (error: any) {
      const msg = error?.response?.data?.error || '수락에 실패했습니다.';
      alert(msg);
      fetchData();
    } finally {
      setClaimingId(null);
    }
  };

  // 수거 요청 수락 취소 핸들러
  const handleUnclaim = async (requestId: string) => {
    if (!window.confirm('이 요청의 수락을 취소하시겠습니까? 다시 [신규 수거 요청] 대기 상태로 돌아갑니다.')) return;
    setUnclaimingId(requestId);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/requests/${requestId}/unclaim`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('수락이 취소되었습니다.');
      fetchData();
    } catch (error: any) {
      const msg = error?.response?.data?.error || '수락 취소에 실패했습니다.';
      alert(msg);
    } finally {
      setUnclaimingId(null);
    }
  };

  // 스마트폰 기본 문자 앱 호출 핸들러
  const handleSendSMS = (selectedIds: string[]) => {
    const selectedRequests = requests.filter(r => selectedIds.includes(r.id));
    const phones = selectedRequests.map(r => r.phone.replace(/[^0-9]/g, '')).filter(Boolean);
    
    if (phones.length === 0) {
      alert('선택된 항목에 유효한 전화번호가 없습니다.');
      return;
    }

    if (phones.length > 20) {
      alert(`스마트폰 스팸 방지 제한으로 인해 한 번에 최대 20명까지만 발송 가능합니다.\n현재 ${phones.length}명이 선택되었습니다. 20명 이하로 나누어서 발송해 주세요.`);
      return;
    }
    
    // 안드로이드/아이폰 등 다양한 기기 호환을 위해 콤마로 연결
    const phoneString = phones.join(',');
    const message = "[헌옷 수거 안내]\n안녕하세요! 내일 수거 방문 예정입니다. 감사합니다.";
    
    // 기기에 따라 iOS는 &body= 를 사용하는 경우도 있으나, 최신 기기들은 ?body= 가 표준입니다.
    // 문제가 있을 경우를 대비하여 우선 가장 널리 쓰이는 표준 방식을 사용합니다.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const bodyParam = isIOS ? `&body=${encodeURIComponent(message)}` : `?body=${encodeURIComponent(message)}`;
    const smsLink = `sms:${phoneString}${bodyParam}`;
    
    window.location.href = smsLink;
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24">
      <div className="w-full max-w-[1800px] mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="glass p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              지역 파트너 <span className="text-gradient">배차 대시보드</span>
            </h1>
            <p className="text-gray-500 mt-2 font-medium text-sm md:text-base">우리 지역에 접수된 수거 요청을 체크하여 기사님들께 일괄 배정하세요.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a href="https://docs.google.com/spreadsheets/d/1hOwdwvhPIq2QAGWMNsSWXQXWa6MFUOYsp3gM8rr6ImY/edit" target="_blank" rel="noopener noreferrer" className="hidden md:flex px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl text-sm border border-green-200 hover:bg-green-100 transition-colors items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              스프레드시트 열기
            </a>
            <div className="flex bg-gray-100/80 p-1.5 rounded-2xl shadow-inner relative w-48 border border-gray-200 backdrop-blur-sm shrink-0">
              <div className="absolute left-1.5 top-1.5 w-[calc(50%-6px)] bottom-1.5 bg-white rounded-xl shadow-[0_2px_8px_rgb(0,0,0,0.08)] transition-transform duration-300 translate-x-full"></div>
              <button 
                onClick={async () => {
                  try {
                    await axios.post(`${import.meta.env.VITE_API_URL}/admin/drivers/self`, {}, {
                      headers: { Authorization: `Bearer ${authToken}` }
                    });
                  } catch (e: any) { /* Ignore if already exists */ }
                  window.location.href = '/driver';
                }}
                className="flex-1 py-2 text-xs font-bold z-10 text-gray-500 hover:text-gray-700 transition-colors"
              >
                🚚 기사 모드
              </button>
              <button 
                className="flex-1 py-2 text-xs font-extrabold z-10 text-blue-600 transition-colors cursor-default"
              >
                🏢 사장 모드
              </button>
            </div>
            {/* 우측 상단 로그아웃 버튼 추가 */}
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.href = '/staff-login';
              }}
              className="flex items-center justify-center px-4 py-2 text-sm text-red-500 bg-red-50 font-bold rounded-xl hover:bg-red-100 border border-red-100 transition-all shrink-0 ml-1"
              title="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 탭 전환 */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button onClick={() => setActiveView('dispatch')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'dispatch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>📋 배차</button>
          <button onClick={() => setActiveView('calendar')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>📅 캘린더</button>
          <button onClick={() => setActiveView('mapDispatch')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'mapDispatch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>🗺️ 지도</button>
          <button onClick={() => setActiveView('stats')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'stats' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>📊 정산</button>
          <button onClick={() => setActiveView('settings')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>⚙️ 설정</button>
        </div>

        {/* 환경 설정 뷰 */}
        {activeView === 'settings' && settings && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">⚙️ 환경 설정</h2>
              <p className="text-gray-500 mb-8">수거 단가 및 카카오 알림톡 서비스 구독 여부를 설정할 수 있습니다.</p>

              <form onSubmit={handleSaveSettings}>
                {/* 전역 공지사항 설정 */}
                {globalSettings && (
                  <div className="py-6 border-b border-gray-100">
                    
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-lg font-bold text-gray-900">📢 전역 공지사항 (앱 전체 띠 배너)</label>
                      
                      {/* Toggle Button */}
                      <button 
                        type="button"
                        onClick={() => setGlobalSettings({...globalSettings, noticeIsActive: !globalSettings.noticeIsActive})}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none z-10 ${globalSettings.noticeIsActive ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${globalSettings.noticeIsActive ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    
                    <p className="text-sm text-gray-500 mb-4">
                      명절 휴무, 긴급 안내 등 <strong>고객과 기사님을 포함한 앱 전체 화면 최상단</strong>에 띄울 공지를 작성합니다.
                    </p>

                    <div className="relative mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">배너 텍스트 (간략히)</label>
                      <textarea
                        value={globalSettings.globalNotice}
                        onChange={(e) => setGlobalSettings({...globalSettings, globalNotice: e.target.value})}
                        placeholder="공지사항 내용을 입력하세요... (예: 설 연휴 2/9~2/12 수거 휴무 안내)"
                        rows={2}
                        className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 resize-none z-10 relative"
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">상세 내용 (클릭 시 팝업, 선택사항)</label>
                      <textarea
                        value={globalSettings.globalNoticeDetail || ''}
                        onChange={(e) => setGlobalSettings({...globalSettings, globalNoticeDetail: e.target.value})}
                        placeholder="상세 내용을 입력하세요. (입력 시 배너를 클릭하면 상세 내용 팝업이 뜹니다)"
                        rows={4}
                        className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 resize-none z-10 relative"
                      />
                    </div>
                  </div>
                )}

                {/* 항목별 단가 설정 */}
                <div className="py-6 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <label className="block text-lg font-bold text-gray-900">💰 항목별 수거 단가 설정</label>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">기사님이 수거 완료 처리 시 고객에게 안내되는 정산 금액의 기준 단가입니다. 단가를 수정하고 저장하면 기사님 앱에 즉시 반영됩니다.</p>
                  
                  <div className="space-y-2">
                    {priceTableItems.map((item, idx) => (
                      <div key={item.category} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                        <span className="text-xl w-8 text-center flex-shrink-0">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-gray-800 block">{item.label}</span>
                          <span className="text-xs text-gray-500">
                            {item.unitType === 'KG' ? '1kg당' : '1대당'}
                          </span>
                        </div>
                        <div className="relative w-28 flex-shrink-0">
                          <input 
                            type="number" 
                            min="0"
                            step="10"
                            value={item.unitPrice} 
                            onChange={(e) => {
                              const newItems = [...priceTableItems];
                              newItems[idx] = { ...newItems[idx], unitPrice: Number(e.target.value) };
                              setPriceTableItems(newItems);
                            }}
                            className="w-full text-right pl-2 pr-8 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-bold text-primary-700 text-sm"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">원</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    type="button"
                    disabled={isSavingPriceTable}
                    onClick={async () => {
                      setIsSavingPriceTable(true);
                      try {
                        const res = await axios.put(`${import.meta.env.VITE_API_URL}/admin/price-table`, {
                          items: priceTableItems
                        }, { headers: { Authorization: `Bearer ${authToken}` } });
                        if (res.data.priceItems) {
                          setPriceTableItems(res.data.priceItems.map((item: any) => ({
                            category: item.category, label: item.label, unitPrice: item.unitPrice,
                            unitType: item.unitType, icon: item.icon || ''
                          })));
                        }
                        alert('단가표가 저장되었습니다.');
                      } catch (error: any) {
                        alert(error.response?.data?.error || '단가표 저장 중 오류가 발생했습니다.');
                      } finally {
                        setIsSavingPriceTable(false);
                      }
                    }}
                    className={`mt-4 w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      isSavingPriceTable 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95 shadow-md'
                    }`}
                  >
                    {isSavingPriceTable && <Spinner className="w-4 h-4 text-current" />}
                    {isSavingPriceTable ? '저장 중...' : '💾 단가표 저장하기'}
                  </button>
                </div>

                {/* 프리미엄 유료 서비스 그룹 */}
                <div className="py-6 border-b border-gray-100 relative">
                  
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-2xl">✨</span>
                    <h3 className="text-xl font-bold text-gray-900">프리미엄 알림톡 서비스</h3>
                    <span className="px-2.5 py-1 bg-gradient-to-r from-orange-600 to-red-500 text-white text-xs font-black rounded-full shadow-sm ml-2 tracking-wide">유료 서비스</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    파트너님의 수거 단가를 높이고, 재이용률을 극대화하는 카카오 알림톡 기반의 프리미엄 자동화 기능입니다.
                  </p>

                  <div className="space-y-0 divide-y divide-gray-100 border-y border-gray-100">
                    {/* 1. 카카오 알림톡 자동 발송 */}
                    <div className="py-5">
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-lg font-bold text-gray-900">💬 기본 알림톡 자동 발송</label>
                        
                        <button 
                          type="button"
                          onClick={() => setSettings({...settings, useBizMessage: !settings.useBizMessage})}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none z-10 ${settings.useBizMessage ? 'bg-orange-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.useBizMessage ? 'translate-x-8' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed mb-4">
                        배정, 일정 확정, 수거 완료(영수증) 단계마다 고객의 <strong>개인 카카오톡</strong>으로 공식 알림톡이 발송되어 브랜드 신뢰도를 높입니다.
                      </p>
                      
                      {settings.useBizMessage && (
                        <div className="bg-orange-50 text-orange-800 p-3 rounded-xl text-xs font-bold flex gap-2 items-center">
                          <span className="text-base">✅</span>
                          <span>기본 알림톡 기능이 활성화되었습니다.</span>
                        </div>
                      )}
                    </div>

                    {/* 2. CRM 자동화 */}
                    <div className="py-5">
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-lg font-bold text-gray-900">🎯 CRM 리텐션 자동화</label>
                        
                        <button 
                          type="button"
                          onClick={() => setSettings({...settings, useCrmAutomation: !settings.useCrmAutomation})}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none z-10 ${settings.useCrmAutomation ? 'bg-orange-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.useCrmAutomation ? 'translate-x-8' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed mb-4">
                        수거 완료 후 <strong>정확히 3개월(90일)이 지난 고객</strong>에게 자동으로 옷장 정리 안내 및 재수거 유도 알림톡을 발송하여 단골 고객을 확보합니다.
                      </p>
                      
                      {settings.useCrmAutomation && (
                        <div className="bg-orange-50 text-orange-800 p-3 rounded-xl text-xs font-bold flex gap-2 items-center">
                          <span className="text-base">✅</span>
                          <span>과거 90일 전 수거 완료 고객에게 매일 아침 안내가 발송됩니다.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={isSavingSettings}
                    className="px-8 py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    {isSavingSettings ? '저장 중...' : '변경사항 저장하기'}
                  </button>
                </div>
              </form>
            </div>

            {/* 권역 관리 추가 */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🗺️ 사용자 정의 권역 관리</h2>
              <p className="text-gray-500 mb-6 border-b border-gray-100 pb-6">기사님들에게 배정할 권역(A권역, B권역 등)과 해당 권역에 포함될 지역을 자유롭게 설정하세요.</p>
              <div className="space-y-4">
                {customRegions.map(cr => (
                  <div key={cr.id} className="flex justify-between items-center p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <div>
                      <span className="font-bold text-gray-900 text-lg mr-3">{cr.name}</span>
                      <span className="text-sm text-gray-600">{cr.areas.join(', ')}</span>
                    </div>
                    <button 
                      disabled={deletingRegionId === cr.id}
                      onClick={() => handleDeleteRegion(cr.id)} 
                      className={`text-sm font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${deletingRegionId === cr.id ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                    >
                      {deletingRegionId === cr.id && <Spinner className="w-3 h-3 text-current" />}
                      삭제
                    </button>
                  </div>
                ))}
                {isAddingRegion ? (
                  <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-primary-900 mb-1">권역 이름</label>
                      <input type="text" value={newRegionForm.name} onChange={e => setNewRegionForm({...newRegionForm, name: e.target.value})} placeholder="예: A권역" className="w-full p-2 border border-primary-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-primary-900 mb-2">포함 지역 선택 (경기도)</label>
                      <div className="max-h-60 overflow-y-auto border border-primary-200 rounded-xl bg-white p-3 space-y-2">
                        {GYEONGGI_AREAS.map(area => {
                          const isSelected = newRegionForm.selectedAreas.includes(area);
                          return (
                            <div key={area} className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg transition-colors ${isSelected ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'}`}>
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => handleToggleArea(area)}
                                  className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                />
                                <span className={`font-bold ${isSelected ? 'text-primary-900' : 'text-gray-700'}`}>{area}</span>
                              </label>
                              {isSelected && (
                                <input 
                                  type="text" 
                                  value={newRegionForm.exceptions[area] || ''}
                                  onChange={(e) => handleExceptionChange(area, e.target.value)}
                                  placeholder="예외 동 (예: -정자동)" 
                                  className="mt-2 sm:mt-0 text-sm p-1.5 border border-primary-200 rounded outline-none focus:ring-1 focus:ring-primary-500 w-full sm:w-48 bg-white"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">※ 체크한 시/군/구의 모든 동이 포함됩니다. 특정 동을 제외하려면 우측 칸에 <strong>-뫄뫄동</strong> 형식으로 적어주세요.</p>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => setIsAddingRegion(false)} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-300 transition-colors">취소</button>
                      <button 
                        disabled={isSubmittingRegion}
                        onClick={handleAddRegion} 
                        className={`px-4 py-2 text-white font-bold rounded-lg text-sm shadow-sm transition-colors flex items-center gap-2 ${isSubmittingRegion ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'}`}
                      >
                        {isSubmittingRegion && <Spinner className="w-4 h-4" />}
                        {isSubmittingRegion ? '저장 중...' : '저장하기'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingRegion(true)} className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all">+ 새 권역 추가하기</button>
                )}
              </div>
            </div>

            {/* 관리자 메뉴 (비밀번호 변경, 로그아웃, 기사님 추가) */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🛠️ 계정 및 관리자 메뉴</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setIsDriverModalOpen(true)}
                  className="flex-1 py-4 bg-primary-600 text-white font-bold rounded-xl shadow-sm hover:bg-primary-700 transition-all active:scale-95"
                >
                  기사님 추가
                </button>
                <button 
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="flex-1 py-4 bg-gray-800 text-white font-bold rounded-xl shadow-sm hover:bg-gray-900 transition-all active:scale-95"
                >
                  비밀번호 변경
                </button>
              </div>
            </div>

          </div>
        )}

        {/* 📅 캘린더 뷰 — desiredDate 기준 날짜별 수거 관리 */}
        {activeView === 'calendar' && (
          <CalendarView requests={requests} />
        )}

        {/* 지도 기반 배정 뷰 */}
        {activeView === 'mapDispatch' && (
          <AdminMapDispatch 
            requests={requests} 
            drivers={drivers} 
            onAssigned={() => fetchData()} 
            authToken={authToken}
            partnerAddress={adminInfo?.address}
            partnerBusinessName={adminInfo?.businessName || adminInfo?.name}
          />
        )}

        {/* 정산/통계 뷰 */}
        {activeView === 'stats' && stats && (
          <div className="space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">총 수거 건수</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.summary.totalRequests}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">완료 건수</p>
                <p className="text-3xl font-extrabold text-green-600 mt-1">{stats.summary.completedCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">총 수거 무게</p>
                <p className="text-3xl font-extrabold text-blue-600 mt-1">{stats.summary.totalWeight}<span className="text-lg">kg</span></p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">완료율</p>
                <p className="text-3xl font-extrabold text-purple-600 mt-1">{stats.summary.completionRate}<span className="text-lg">%</span></p>
              </div>
            </div>

            {/* 현재 상태 현황 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📍 현재 진행 상황</h3>
              <div className="flex gap-4">
                <div className="flex-1 bg-yellow-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-yellow-600">{stats.summary.pendingCount}</p>
                  <p className="text-xs text-yellow-700 font-medium mt-1">대기 중</p>
                </div>
                <div className="flex-1 bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-blue-600">{stats.summary.inProgressCount}</p>
                  <p className="text-xs text-blue-700 font-medium mt-1">진행 중</p>
                </div>
                <div className="flex-1 bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-green-600">{stats.summary.completedCount}</p>
                  <p className="text-xs text-green-700 font-medium mt-1">완료</p>
                </div>
              </div>
            </div>

            {/* 월별 수거량 차트 (CSS 바 차트) */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📈 월별 수거 현황 (최근 6개월)</h3>
              <div className="space-y-3">
                {stats.monthlyStats.map((m: any) => {
                  const maxCount = Math.max(...stats.monthlyStats.map((s: any) => s.count), 1);
                  const barWidth = (m.count / maxCount) * 100;
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-500 w-16 shrink-0">{m.month}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500 flex items-center" style={{ width: `${Math.max(barWidth, 2)}%` }}>
                          {m.count > 0 && <span className="text-[10px] font-bold text-white ml-2 whitespace-nowrap">{m.count}건 / {m.weight}kg</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 완료된 수거 증빙 확인 섹션 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📸 완료된 수거 증빙 확인</h3>
              {allCompletedRequests.length === 0 ? (
                <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                  완료된 수거 건이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allCompletedRequests.map(req => {
                    const driverObj = drivers.find(d => d.id === req.driverId);
                    const driverName = driverObj?.user?.name || driverObj?.name || '미지정';
                    return (
                      <div 
                        key={req.id}
                        onClick={() => setSelectedCompletedRequest(req)}
                        className="p-4 bg-gray-50 hover:bg-primary-50/50 border border-gray-100 hover:border-primary-300 rounded-2xl shadow-sm cursor-pointer transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-extrabold text-gray-900 text-base">{req.userName} <span className="text-xs font-normal text-gray-500">{req.phone}</span></h4>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{req.address} {req.detailAddress}</p>
                          </div>
                          <span className="text-xs bg-green-50 text-green-700 font-bold px-2.5 py-1 rounded-lg shrink-0">
                            {req.actualWeight}kg
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-200/50">
                          <span>담당 기사: <strong className="text-gray-700">{driverName}</strong></span>
                          <span>{req.completedDate ? new Date(req.completedDate).toLocaleDateString('ko-KR') : ''}</span>
                        </div>
                        <div className="flex items-center justify-center py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-primary-600 hover:bg-primary-50 transition-colors">
                          📸 완료 증빙 사진 및 내역 보기
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 배차 관리 뷰 */}
        {activeView === 'dispatch' && <div className="flex flex-col gap-4">
          
          {/* 모바일 탭 */}
          <div className="flex lg:hidden bg-gray-100 rounded-2xl p-1 mb-2">
            <button 
              onClick={() => setDispatchTab('requests')} 
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${dispatchTab === 'requests' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              📥 신규/미배정 ({pendingRequests.length + unassignedRequests.length})
            </button>
            <button 
              onClick={() => setDispatchTab('drivers')} 
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${dispatchTab === 'drivers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              🚚 기사 배차
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: 수거 요청 (수락 대기 + 기사 미배정) */}
          <div 
            className={`lg:col-span-1 bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] lg:sticky lg:top-6 lg:h-[calc(100vh-120px)] overflow-y-auto ${dispatchTab === 'requests' ? 'block' : 'hidden lg:block'}`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">신규/미배정 리스트</h2>
              <button 
                onClick={() => setIsManualModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow transition-colors"
              >
                + 비회원(전화) 접수
              </button>
            </div>
            
            {/* 권역별 탭 */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
              <button 
                onClick={() => setActiveRegionTab('ALL')} 
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeRegionTab === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                전체
              </button>
              {customRegions.map(cr => (
                <button 
                  key={cr.id}
                  onClick={() => setActiveRegionTab(cr.id)} 
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeRegionTab === cr.id ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {cr.name}
                </button>
              ))}
              <button 
                onClick={() => setActiveRegionTab('UNCLASSIFIED')} 
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeRegionTab === 'UNCLASSIFIED' ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                미분류
              </button>
            </div>

            {/* 수락 대기 섹션 */}
            {pendingRequests.length > 0 && (
              <div className="mb-8">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-extrabold text-gray-800">🔔 신규 수거 요청 {activeRegionTab !== 'ALL' && <span className="text-sm text-gray-400 font-medium">({activeRegionTab === 'UNCLASSIFIED' ? '미분류' : customRegions.find(c => c.id === activeRegionTab)?.name})</span>}</h2>
                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm">{pendingRequests.length}건</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleToggleAllPending}
                      className="bg-gray-100 p-2.5 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center"
                      title="전체 선택"
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedRequestIds.length > 0 && selectedRequestIds.length === pendingRequests.length} 
                        readOnly 
                        className="w-5 h-5 rounded text-orange-500 cursor-pointer"
                      />
                    </button>
                    {selectedRequestIds.length > 0 && (
                      <>
                        <button
                          onClick={handleBulkClaim}
                          disabled={isBulkClaiming}
                          className={`text-sm font-bold text-white bg-orange-600 px-3 py-2 rounded-xl shadow-sm transition-all animate-fade-in flex items-center gap-1 ${isBulkClaiming ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-700'}`}
                        >
                          {isBulkClaiming && <Spinner className="w-4 h-4 text-white" />}
                          {selectedRequestIds.length}건 일괄 수락
                        </button>
                        <button
                          onClick={() => handleSendSMS(selectedRequestIds)}
                          className="text-sm font-bold text-white bg-green-500 px-3 py-2 rounded-xl shadow-sm hover:bg-green-600 transition-all animate-fade-in flex items-center gap-1"
                        >
                          💬 문자
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {pendingRequests.map(req => (
                    <div 
                      key={req.id} 
                      className={`p-4 sm:p-5 border rounded-2xl flex items-start gap-3 transition-all cursor-pointer ${selectedRequestIds.includes(req.id) ? 'bg-orange-50 border-orange-400 ring-1 ring-orange-400 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
                      onClick={() => handleToggleOnePending(req.id)}
                    >
                      <div className="pt-1">
                        <input 
                          type="checkbox" 
                          checked={selectedRequestIds.includes(req.id)}
                          readOnly
                          className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-gray-900">
                            {req.userName} <span className="text-sm font-normal text-gray-500">{req.phone}</span>
                            {req.isMustPickupDate && (
                              <span className="ml-2 inline-block bg-red-100 text-red-600 px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap">
                                🚨 지정일 필수 수거
                              </span>
                            )}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{req.address} {req.detailAddress}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="inline-block bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                            {req.estimatedVolume}
                          </span>
                          <DesiredDateBadge desiredDate={req.desiredDate} confirmedDate={req.confirmedDate} />
                          <div className="relative inline-block ml-1">
                            <input 
                              type="date"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(e) => handleUpdateDate(req.id, e.target.value)}
                            />
                            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-gray-200 transition-colors">
                              📅 날짜 변경
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-end items-center mt-2">
                          {!selectedRequestIds.includes(req.id) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClaim(req.id); }}
                              disabled={claimingId === req.id}
                              className={`px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-1 ${claimingId === req.id ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-600 active:scale-95'}`}
                            >
                              {claimingId === req.id ? <Spinner className="w-4 h-4" /> : '✋'} 수락
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 기사 미배정 섹션 (수락 완료, 기사 배정 필요) */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-gray-800">대기중인 수거</h2>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm">{unassignedRequests.length}건</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleToggleAllUnassigned}
                  className="bg-gray-100 p-2.5 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center"
                  title="전체 선택"
                >
                  <input 
                    type="checkbox" 
                    checked={selectedUnassignedIds.length > 0 && selectedUnassignedIds.length === unassignedRequests.length} 
                    readOnly 
                    className="w-5 h-5 rounded text-primary-600 cursor-pointer"
                  />
                </button>
                {selectedUnassignedIds.length > 0 && (
                  <>
                    <button
                      onClick={() => setIsBulkAssignModalOpen(true)}
                      className="text-sm font-bold text-white bg-primary-600 px-3 py-2 rounded-xl hover:bg-primary-700 shadow-sm transition-all animate-fade-in"
                    >
                      {selectedUnassignedIds.length}건 배정
                    </button>
                    <button
                      onClick={handleBulkUnclaim}
                      disabled={isBulkUnclaiming}
                      className={`text-sm font-bold text-gray-700 bg-gray-200 px-3 py-2 rounded-xl shadow-sm transition-all animate-fade-in flex items-center gap-1 ${isBulkUnclaiming ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-300'}`}
                    >
                      {isBulkUnclaiming && <Spinner className="w-4 h-4 text-gray-700" />}
                      {selectedUnassignedIds.length}건 취소
                    </button>
                    <button
                      onClick={() => handleSendSMS(selectedUnassignedIds)}
                      className="text-sm font-bold text-white bg-green-500 px-3 py-2 rounded-xl hover:bg-green-600 shadow-sm transition-all animate-fade-in flex items-center gap-1"
                    >
                      💬 문자
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-10 text-gray-400">로딩 중...</div>
            ) : unassignedRequests.length === 0 ? (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                {pendingRequests.length === 0 ? '수거 요청이 없습니다.' : '수락한 건을 기사에게 배정해주세요.'}
              </div>
            ) : (
              <div className="space-y-4">
                {unassignedRequests.map(req => (
                  <div 
                    key={req.id} 
                    onClick={() => setSelectedRequestIdForAssign(req.id)}
                    className={`p-4 sm:p-5 border rounded-2xl shadow-sm cursor-pointer transition-all flex items-start gap-3 ${
                      selectedRequestIdForAssign === req.id ? 'bg-primary-50 border-primary-500 ring-2 ring-primary-200' : 
                      selectedUnassignedIds.includes(req.id) ? 'bg-gray-50 border-gray-400' : 'bg-white border-gray-200 hover:border-primary-400'
                    }`}
                  >
                    <div className="pt-1">
                      <input 
                        type="checkbox" 
                        checked={selectedUnassignedIds.includes(req.id)}
                        onChange={(e) => { e.stopPropagation(); handleToggleOneUnassigned(req.id); }}
                        className="w-5 h-5 rounded border-gray-300 text-gray-500 focus:ring-gray-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900">
                          {req.userName} <span className="text-sm font-normal text-gray-500">{req.phone}</span>
                          {req.isMustPickupDate && (
                            <span className="ml-2 inline-block bg-red-100 text-red-600 px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap">
                              🚨 지정일 필수 수거
                            </span>
                          )}
                        </h3>
                        {selectedRequestIdForAssign === req.id && (
                          <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-bold shadow-sm">배정 대기중</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{req.address} {req.detailAddress}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="inline-block bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          {req.estimatedVolume}
                        </span>
                        <DesiredDateBadge desiredDate={req.desiredDate} confirmedDate={req.confirmedDate} />
                        <div className="relative inline-block ml-1">
                          <input 
                            type="date"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => handleUpdateDate(req.id, e.target.value)}
                          />
                          <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-gray-200 transition-colors">
                            📅 날짜 변경
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end items-center">
                        {!selectedUnassignedIds.includes(req.id) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUnclaim(req.id); }}
                            disabled={unclaimingId === req.id}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${unclaimingId === req.id ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 active:scale-95'}`}
                          >
                            {unclaimingId === req.id && <Spinner className="w-3 h-3 text-current" />}
                            수락 취소
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          </div>

          {/* Right Column: Drivers */}
          <div className={`lg:col-span-2 flex-col gap-4 ${dispatchTab === 'drivers' ? 'flex' : 'hidden lg:flex'}`}>
            {/* 기사 선택 탭 */}
            {drivers.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {drivers.map(driver => (
                  <button
                    key={`tab-${driver.id}`}
                    onClick={() => setActiveDriverId(driver.id)}
                    className={`shrink-0 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${activeDriverId === driver.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                  >
                    🚚 {driver.user?.name || driver.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-white border border-gray-200 rounded-3xl text-gray-500 font-bold shadow-sm">
                등록된 기사님이 없습니다.
              </div>
            )}

            {drivers.filter(d => d.id === activeDriverId).map(driver => {
              const rawDriverRequests = requests.filter(r => r.driverId === driver.id);
              // createdAt(접수시간) 오름차순으로 고유 순번(displayId) 부여
              const driverRequestsWithId = [...rawDriverRequests].sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (timeA === timeB) return a.id.localeCompare(b.id);
                return timeA - timeB;
              }).map((req, index) => ({ ...req, displayId: index + 1 }));

              // 화면 표시를 위해 배차 순서(orderIndex)로 재정렬
              const allDriverRequests = [...driverRequestsWithId].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

              const driverRequests = allDriverRequests.filter(r => r.status !== 'COMPLETED');
              const completedRequests = allDriverRequests.filter(r => r.status === 'COMPLETED');

              return (
                <div 
                  key={driver.id} 
                  className="bg-gray-50/50 border border-gray-200 rounded-3xl p-6 min-h-[500px] flex flex-col shadow-sm"
                >
                  <div className="flex justify-between items-start mb-6 pb-4 border-b border-primary-200 gap-2">
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-extrabold text-gray-800 break-keep">🚚 {driver.user?.name || driver.name}</h2>
                        <button onClick={() => openDriverModalForEdit(driver)} className="text-[10px] bg-gray-200 text-gray-600 px-2 py-1 rounded-md hover:bg-gray-300 transition-colors font-bold shrink-0">수정</button>
                      </div>
                      {driver.customRegion ? (
                        <span className="text-xs font-bold text-primary-700 mt-1.5 bg-primary-100 self-start px-2 py-1 rounded-md border border-primary-200 shadow-sm inline-block break-keep leading-tight">
                          {driver.customRegion.name} ({Array.from(new Set(driver.customRegion.areas.map(a => a.split(' ')[0]))).join(', ')})
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-400 mt-1.5 inline-block">할당된 권역 없음</span>
                      )}
                      {driver.todayDistanceKm && (
                        <span className="text-xs font-medium text-gray-500 mt-1">
                          오늘 예상 누적 주행거리: <span className="text-primary-600 font-bold">{driver.todayDistanceKm}km</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="shrink-0 whitespace-nowrap bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-xl text-xs font-extrabold shadow-sm mt-1">{driverRequests.length}건 대기</span>
                      {driverRequests.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <label className="flex items-center gap-1 text-[10px] text-gray-500 font-bold cursor-pointer hover:text-gray-900">
                            <input
                              type="checkbox"
                              checked={driverRequests.every(r => selectedAssignedIds.includes(r.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const idsToAdd = driverRequests.map(r => r.id).filter(id => !selectedAssignedIds.includes(id));
                                  setSelectedAssignedIds(prev => [...prev, ...idsToAdd]);
                                } else {
                                  setSelectedAssignedIds(prev => prev.filter(id => !driverRequests.find(r => r.id === id)));
                                }
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                            />
                            전체 선택
                          </label>
                          {driverRequests.some(r => selectedAssignedIds.includes(r.id)) && (
                            <button
                              disabled={isBatchUnassigning}
                              onClick={handleBatchUnassign}
                              className={`text-[10px] px-2 py-1 rounded-md font-bold transition-colors flex items-center gap-1 ${isBatchUnassigning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            >
                              {isBatchUnassigning && <Spinner className="w-3 h-3" />}
                              일괄 취소
                            </button>
                          )}
                          {driverRequests.some(r => selectedAssignedIds.includes(r.id)) && (
                            <button
                              onClick={() => handleSendSMS(selectedAssignedIds.filter(id => driverRequests.find(r => r.id === id)))}
                              className="text-[10px] px-2 py-1 rounded-md font-bold transition-colors flex items-center gap-1 bg-green-100 text-green-700 hover:bg-green-200"
                            >
                              💬 안내문자
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    {driverRequests.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-primary-400 font-medium pb-10">
                        배정된 수거 요청이 없습니다
                      </div>
                    ) : (
                      driverRequests.map((req, index) => (
                        <div 
                          key={req.id} 
                          className={`p-4 bg-white border rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] transition-all flex gap-3 hover:-translate-y-0.5 hover:shadow-md ${req.status === 'IN_PROGRESS' ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <div className="flex flex-col items-center gap-2 shrink-0">
                            <input
                              type="checkbox"
                              checked={selectedAssignedIds.includes(req.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAssignedIds(prev => [...prev, req.id]);
                                } else {
                                  setSelectedAssignedIds(prev => prev.filter(id => id !== req.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                              onClick={e => e.stopPropagation()}
                            />
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${req.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'bg-primary-100 text-primary-800'}`}>
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-900 text-sm">{req.userName}</h3>
                                {req.isMustPickupDate && (
                                  <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                    🚨 필수 수거
                                  </span>
                                )}
                                {req.status === 'IN_PROGRESS' && (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap">
                                    이동 중 {req.etaMinutes ? `(${req.etaMinutes}분)` : ''}
                                  </span>
                                )}
                              </div>
                              <button
                                disabled={unassigningReqId === req.id}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if(!confirm('해당 수거 건의 배정을 취소하시겠습니까?')) return;
                                  setUnassigningReqId(req.id);
                                  try {
                                    await axios.post(`${import.meta.env.VITE_API_URL}/admin/requests/${req.id}/unassign`, {}, {
                                      headers: { Authorization: `Bearer ${authToken}` }
                                    });
                                    fetchData();
                                  } catch (error) {
                                    alert('배정 취소에 실패했습니다.');
                                  } finally {
                                    setUnassigningReqId(null);
                                  }
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 ${unassigningReqId === req.id ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}
                              >
                                {unassigningReqId === req.id && <Spinner className="w-3 h-3" />}
                                취소
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{req.address}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <DesiredDateBadge desiredDate={req.desiredDate} confirmedDate={req.confirmedDate} />
                              <div className="relative inline-block ml-1">
                                <input 
                                  type="date"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onChange={(e) => handleUpdateDate(req.id, e.target.value)}
                                />
                                <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-gray-200 transition-colors">
                                  📅 날짜 변경
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Completed Items Section */}
                  {completedRequests.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-primary-200/50">
                      <h3 className="text-sm font-bold text-gray-600 mb-3">✅ 완료된 수거 ({completedRequests.length}건)</h3>
                      <div className="space-y-2 opacity-70">
                        {completedRequests.map(req => (
                          <div 
                            key={req.id} 
                            onClick={() => setSelectedCompletedRequest(req)}
                            className="p-3 bg-white border border-gray-100 hover:border-primary-400 hover:shadow-sm rounded-2xl flex justify-between items-center cursor-pointer transition-all"
                          >
                            <div className="min-w-0 flex-1 mr-2">
                              <p className="text-xs font-bold text-gray-800 flex items-center gap-1">
                                {req.userName} <span className="font-normal text-gray-500">님</span>
                                {req.isMustPickupDate && (
                                  <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-md">
                                    🚨 필수 수거
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-gray-500 truncate w-full mt-0.5">{req.address}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">
                                {req.actualWeight}kg
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">증빙 보기</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>}
      </div>

      {/* 비밀번호 변경 모달 */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">비밀번호 변경</h2>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">현재 비밀번호</label>
                <input required type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="기존 비밀번호 입력" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">새 비밀번호</label>
                <input required type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="새로운 비밀번호" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">새 비밀번호 확인</label>
                <input required type="password" value={passwordForm.newPasswordConfirm} onChange={e => setPasswordForm({...passwordForm, newPasswordConfirm: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="비밀번호 재입력" />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  변경 저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 기사님 추가/수정 모달 */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => { setIsDriverModalOpen(false); setEditingDriverId(null); setDriverForm({ name: '', phone: '', email: '', vehicleInfo: '', customRegionId: '' }); }}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{editingDriverId ? '기사님 정보 수정' : '기사님 등록'}</h2>
            <p className="text-sm text-gray-500 mb-6">
              {editingDriverId ? '기사님의 담당 권역(월별 교대) 및 정보를 수정합니다.' : '등록된 기사님의 초기 비밀번호는 입력하신 연락처로 설정됩니다.'}
            </p>
            
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">기사님 성함</label>
                <input required type="text" value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="홍길동" />
              </div>
              {!editingDriverId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">이메일 (ID 겸용)</label>
                  <input required type="email" value={driverForm.email} onChange={e => setDriverForm({...driverForm, email: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="driver@test.com" />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">연락처</label>
                <input required type="tel" value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="010-1234-5678" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">차량 정보 (선택)</label>
                <input type="text" value={driverForm.vehicleInfo} onChange={e => setDriverForm({...driverForm, vehicleInfo: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500" placeholder="1톤 트럭 (서울12가 3456)" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">담당 권역 배정</label>
                <select value={driverForm.customRegionId} onChange={e => setDriverForm({...driverForm, customRegionId: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900">
                  <option value="">-- 할당 안 함 --</option>
                  {customRegions.map(cr => (
                    <option key={cr.id} value={cr.id}>{cr.name} ({cr.areas.join(', ')})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">환경 설정 탭에서 권역을 추가할 수 있습니다.</p>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isSavingDriver}
                  className={`w-full py-4 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 ${isSavingDriver ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'}`}
                >
                  {isSavingDriver && <Spinner className="w-5 h-5" />}
                  {isSavingDriver ? '저장 중...' : (editingDriverId ? '수정 완료하기' : '등록 완료하기')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        {/* 모바일 기사 배정 모달 */}
        {selectedRequestIdForAssign && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">어느 기사님에게 배정할까요?</h3>
              
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {drivers.map(driver => (
                  <button
                    key={driver.id}
                    onClick={() => {
                      assignDriver(selectedRequestIdForAssign, driver.id);
                      setSelectedRequestIdForAssign(null);
                    }}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-primary-50 rounded-2xl border border-gray-100 hover:border-primary-200 transition-all"
                  >
                    <div className="font-bold text-gray-900 text-lg">
                      {driver.user?.name || driver.name} 기사님
                    </div>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setSelectedRequestIdForAssign(null)}
                className="mt-6 w-full py-4 text-gray-500 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                취소
              </button>
            </div>
          </div>
        )}

      {/* 모바일 기사 일괄 배정 모달 */}
      {isBulkAssignModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">선택한 {selectedUnassignedIds.length}건을 배정합니다</h3>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <button
                onClick={() => handleBulkAssign('AUTO')}
                disabled={isBulkAssigning}
                className={`w-full text-center p-4 rounded-2xl border transition-all mb-4 ${isBulkAssigning ? 'bg-primary-50 border-primary-100 opacity-70 cursor-not-allowed' : 'bg-primary-100 hover:bg-primary-200 border-primary-300'}`}
              >
                <div className="font-extrabold text-primary-900 text-lg flex items-center justify-center gap-2">
                  {isBulkAssigning && <Spinner className="w-5 h-5 text-primary-600" />}
                  ✨ 권역별 기사님께 자동 배정
                </div>
                <p className="text-sm text-primary-700 mt-1">각 수거건의 주소에 맞는 담당 기사님을 찾아 자동으로 일괄 배정합니다.</p>
              </button>
              <div className="flex items-center gap-2 my-4">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="text-xs font-bold text-gray-400">또는 특정 기사님께 전체 배정</span>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>
              {drivers.map(driver => (
                <button
                  key={driver.id}
                  onClick={() => handleBulkAssign(driver.id)}
                  disabled={isBulkAssigning}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-2 ${isBulkAssigning ? 'bg-gray-50 border-gray-100 opacity-70 cursor-not-allowed' : 'bg-gray-50 hover:bg-primary-50 border-gray-100 hover:border-primary-200'}`}
                >
                  {isBulkAssigning && <Spinner className="w-5 h-5 text-gray-500" />}
                  <div className="font-bold text-gray-900 text-lg">
                    {driver.user?.name || driver.name} 기사님
                  </div>
                </button>
              ))}
            </div>

            <button 
              onClick={() => setIsBulkAssignModalOpen(false)}
              className="mt-6 w-full py-4 text-gray-500 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 수거 완료 상세 증빙 모달 */}
      {selectedCompletedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedCompletedRequest(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">📸 수거 완료 증빙 상세</h2>
            <p className="text-sm text-gray-500 mb-6">기사님이 현장에서 수거 시 등록한 실제 무게 및 증빙 사진 정보입니다.</p>

            <div className="space-y-5">
              {/* 정보 표 */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">고객명</span><span className="font-bold text-gray-900">{selectedCompletedRequest.userName}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">연락처</span><span className="font-bold text-gray-900">{selectedCompletedRequest.phone}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">수거 주소</span><span className="font-bold text-gray-900 text-right max-w-[250px] break-all">{selectedCompletedRequest.address} {selectedCompletedRequest.detailAddress}</span></div>
                <div className="flex justify-between text-sm border-t border-gray-200/50 pt-2">
                  <span className="text-gray-500">총 정산 금액</span>
                  <span className="font-extrabold text-primary-600 text-lg">
                    {(selectedCompletedRequest.totalPrice || 0).toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">수거 완료일시</span><span className="font-semibold text-gray-800">{selectedCompletedRequest.completedDate ? new Date(selectedCompletedRequest.completedDate).toLocaleString('ko-KR') : '-'}</span></div>
                <div className="flex flex-col text-sm border-t border-gray-200/50 pt-2"><span className="text-gray-500">기사 메모</span><p className="font-medium text-gray-900 mt-1 bg-white p-3 rounded-lg border border-gray-100">{selectedCompletedRequest.driverNote || '특이사항 없음'}</p></div>
              </div>

              {/* 항목별 정산 내역 */}
              {selectedCompletedRequest.collectionItems && selectedCompletedRequest.collectionItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-3">🧾 수거 정산 내역</h3>
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                    {selectedCompletedRequest.collectionItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-200/50 pb-2 last:border-0 last:pb-0">
                        <div>
                          <span className="font-bold text-gray-900">{item.categoryLabel}</span>
                          <span className="text-gray-500 ml-2 text-xs">
                            {item.quantity}{item.unitType === 'KG' ? 'kg' : '대'} × {item.unitPrice.toLocaleString()}원
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">{item.subtotal.toLocaleString()}원</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 사진 리스트 */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">📍 첨부 증빙 사진</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* 고객 업로드 포장 사진 */}
                  {selectedCompletedRequest.customerPackedPhotoUrl && (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-full h-24 bg-blue-50 border border-blue-200 rounded-xl overflow-hidden flex items-center justify-center relative">
                        <img src={selectedCompletedRequest.customerPackedPhotoUrl} alt="고객 업로드 사진" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setEnlargedImage(selectedCompletedRequest.customerPackedPhotoUrl!)} />
                      </div>
                      <span className="text-[10px] text-blue-600 font-bold">고객 포장 사진</span>
                    </div>
                  )}

                  {/* 항목별 증빙 사진 (새 방식) */}
                  {selectedCompletedRequest.collectionItems && selectedCompletedRequest.collectionItems.map((item, idx) => {
                    if (!item.photoUrl) return null;
                    return (
                      <div key={`item-photo-${idx}`} className="flex flex-col items-center gap-1.5">
                        <div className="w-full h-24 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative">
                          <img src={item.photoUrl} alt={item.categoryLabel} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setEnlargedImage(item.photoUrl!)} />
                        </div>
                        <span className="text-[10px] text-gray-600 font-semibold truncate w-full text-center">{item.categoryLabel}</span>
                      </div>
                    );
                  })}

                  {/* 구버전 호환 (물품, 저울, 추가 사진) */}
                  {!selectedCompletedRequest.collectionItems?.length && (
                    <>
                      {selectedCompletedRequest.itemPhotoUrl && (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-full h-24 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative">
                            <img src={selectedCompletedRequest.itemPhotoUrl} alt="물품 사진" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setEnlargedImage(selectedCompletedRequest.itemPhotoUrl!)} />
                          </div>
                          <span className="text-[10px] text-gray-500 font-semibold">물품 사진</span>
                        </div>
                      )}
                      {selectedCompletedRequest.scalePhotoUrl && (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-full h-24 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative">
                            <img src={selectedCompletedRequest.scalePhotoUrl} alt="저울 사진" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setEnlargedImage(selectedCompletedRequest.scalePhotoUrl!)} />
                          </div>
                          <span className="text-[10px] text-gray-500 font-semibold">저울 사진</span>
                        </div>
                      )}
                      {selectedCompletedRequest.extraPhotoUrl && (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-full h-24 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative">
                            <img src={selectedCompletedRequest.extraPhotoUrl} alt="추가 사진" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setEnlargedImage(selectedCompletedRequest.extraPhotoUrl!)} />
                          </div>
                          <span className="text-[10px] text-gray-500 font-semibold">특이사항 사진</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* 사진이 하나도 없는 경우 */}
                  {!selectedCompletedRequest.customerPackedPhotoUrl && !selectedCompletedRequest.itemPhotoUrl && (!selectedCompletedRequest.collectionItems || selectedCompletedRequest.collectionItems.every(i => !i.photoUrl)) && (
                     <div className="col-span-full text-center text-sm text-gray-400 py-4">첨부된 사진이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedCompletedRequest(null)}
              className="mt-6 w-full py-4 text-white font-bold bg-primary-600 rounded-xl hover:bg-primary-700 transition-all shadow-md"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 이미지 확대 팝업 */}
      {enlargedImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setEnlargedImage(null)}>
          <div className="relative max-w-4xl w-full flex justify-center items-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setEnlargedImage(null); }}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors text-3xl font-bold"
            >
              ✕
            </button>
            <img src={enlargedImage} alt="확대된 증빙 사진" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* 비회원 수동 접수 모달 */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-blue-600 text-white p-4">
              <h3 className="font-bold text-lg">비회원 수동 접수</h3>
              <p className="text-sm opacity-80">전화로 요청받은 수거 건을 직접 등록합니다.</p>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">고객명</label>
                  <input type="text" value={manualForm.userName} onChange={e => setManualForm({...manualForm, userName: e.target.value})} className="w-full border rounded-lg p-2" placeholder="예: 김철수 (미입력시 수동접수)" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">연락처</label>
                  <input type="text" required value={manualForm.phone} onChange={e => setManualForm({...manualForm, phone: e.target.value})} className="w-full border rounded-lg p-2" placeholder="010-0000-0000" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">주소</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" required readOnly value={manualForm.address} className="flex-1 min-w-0 bg-gray-50 border rounded-lg p-2" placeholder="주소 검색을 눌러주세요" />
                  <button type="button" onClick={handleAddressSearch} className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap shrink-0">주소 검색</button>
                </div>
                <input type="text" required value={manualForm.detailAddress} onChange={e => setManualForm({...manualForm, detailAddress: e.target.value})} className="w-full border rounded-lg p-2" placeholder="상세 주소 (동/호수)" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">예상 수거량 (KG)</label>
                  <input type="number" value={manualForm.estimatedWeight} onChange={e => setManualForm({...manualForm, estimatedWeight: e.target.value})} className="w-full border rounded-lg p-2" placeholder="예: 20" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">메모 (선택)</label>
                  <input type="text" value={manualForm.estimatedVolume} onChange={e => setManualForm({...manualForm, estimatedVolume: e.target.value})} className="w-full border rounded-lg p-2" placeholder="예: 옷 3봉지" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">방문 희망일</label>
                <input type="date" required value={manualForm.desiredDate} onChange={e => setManualForm({...manualForm, desiredDate: e.target.value})} className="w-full border rounded-lg p-2" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">취소</button>
                <button type="submit" disabled={isSubmittingManual} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2">
                  {isSubmittingManual ? <Spinner /> : '접수 완료하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      <AdminChatDashboard adminId={JSON.parse(localStorage.getItem('user_info') || '{}').id || ''} />
      <AddressSearchModal 
        isOpen={isAddressModalOpen} 
        onClose={() => setIsAddressModalOpen(false)} 
        onComplete={handleAddressComplete} 
      />
    </div>
  );
}
