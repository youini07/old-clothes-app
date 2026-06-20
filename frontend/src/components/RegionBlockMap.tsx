import { useState, useEffect } from 'react';
import axios from 'axios';

interface RegionBlockMapProps {
  selectedProvince: string;
  selectedCity: string;
  selectedDong: string;
  onSelectRegion: (province: string, city: string, dong: string) => void;
}

interface RegCode {
  code: string;
  name: string;
}

export default function RegionBlockMap({ selectedProvince, selectedCity, selectedDong, onSelectRegion }: RegionBlockMapProps) {
  const [currentView, setCurrentView] = useState<'PROVINCE' | 'CITY' | 'DONG'>('PROVINCE');
  
  const [provinces, setProvinces] = useState<RegCode[]>([]);
  const [cities, setCities] = useState<RegCode[]>([]);
  const [dongs, setDongs] = useState<RegCode[]>([]);
  
  const [loading, setLoading] = useState(false);

  const [, setProvCode] = useState<string>('');
  const [, setCityCode] = useState<string>('');

  // 1. 시/도 목록 가져오기
  useEffect(() => {
    const fetchProvinces = async () => {
      setLoading(true);
      try {
        const res = await axios.get('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000000');
        setProvinces(res.data.regcodes);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProvinces();
  }, []);

  const handleProvinceSelect = async (code: string, name: string) => {
    onSelectRegion(name, '', '');
    setProvCode(code.substring(0, 2));
    setCurrentView('CITY');
    
    // 시/군/구 목록 가져오기
    setLoading(true);
    try {
      const res = await axios.get(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${code.substring(0, 2)}*00000`);
      // 첫 번째 결과는 시/도 자신이므로 필터링
      const filteredCities = res.data.regcodes.filter((r: RegCode) => r.code !== code);
      setCities(filteredCities);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCitySelect = async (code: string | null, fullName: string) => {
    if (code === null) {
      // 전체 선택
      onSelectRegion(selectedProvince, '전체', '');
      setCurrentView('DONG');
      setDongs([]);
      return;
    }

    const shortName = fullName.split(' ').pop() || fullName; // "경기도 수원시" -> "수원시"
    onSelectRegion(selectedProvince, shortName, '');
    const cCode = code.substring(0, 5);
    setCityCode(cCode);
    setCurrentView('DONG');

    // 읍/면/동 목록 가져오기
    setLoading(true);
    try {
      const res = await axios.get(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${cCode}*&is_ignore_zero=true`);
      // 자신(시/군/구) 제외
      const filteredDongs = res.data.regcodes.filter((r: RegCode) => !r.code.endsWith('00000'));
      setDongs(filteredDongs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDongSelect = (fullName: string) => {
    if (fullName === '전체') {
      onSelectRegion(selectedProvince, selectedCity, '전체');
      return;
    }
    const shortName = fullName.split(' ').pop() || fullName; // "경기도 평택시 비전동" -> "비전동"
    onSelectRegion(selectedProvince, selectedCity, shortName);
  };

  const goBack = () => {
    if (currentView === 'DONG') {
      setCurrentView('CITY');
      onSelectRegion(selectedProvince, '', '');
    } else if (currentView === 'CITY') {
      setCurrentView('PROVINCE');
      onSelectRegion('', '', '');
    }
  };

  const renderProvinces = () => (
    <div className="grid grid-cols-4 gap-3">
      {provinces.map((prov) => (
        <button
          key={prov.code}
          type="button"
          onClick={() => handleProvinceSelect(prov.code, prov.name)}
          className={`
            p-4 rounded-2xl font-bold text-sm shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md break-keep
            ${selectedProvince === prov.name 
              ? 'bg-primary-600 text-white border-2 border-primary-700' 
              : 'bg-white text-gray-700 border border-gray-200 hover:border-primary-300'
            }
          `}
        >
          {prov.name}
        </button>
      ))}
    </div>
  );

  const renderCities = () => (
    <div className="space-y-4">
      <button type="button" onClick={goBack} className="text-sm text-gray-500 hover:text-gray-800 font-bold flex items-center">
        <span className="mr-1">←</span> 뒤로 (시/도 선택)
      </button>
      <h3 className="text-lg font-extrabold text-gray-800 mb-2">{selectedProvince} 상세</h3>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => handleCitySelect(null, '전체')}
          className={`p-3 rounded-xl font-bold text-sm transition-all
            ${selectedCity === '전체' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
          `}
        >
          {selectedProvince} 전체
        </button>

        {cities.map((city) => {
          const shortName = city.name.split(' ').pop() || city.name;
          return (
            <button
              key={city.code}
              type="button"
              onClick={() => handleCitySelect(city.code, city.name)}
              className={`
                p-3 rounded-xl font-bold text-sm shadow-sm transition-all duration-200 break-keep
                ${selectedCity === shortName 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-primary-300'
                }
              `}
            >
              {shortName}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDongs = () => (
    <div className="space-y-4">
      <button type="button" onClick={goBack} className="text-sm text-gray-500 hover:text-gray-800 font-bold flex items-center">
        <span className="mr-1">←</span> 뒤로 (시/군/구 선택)
      </button>
      <h3 className="text-lg font-extrabold text-gray-800 mb-2">{selectedProvince} {selectedCity} 상세 (선택)</h3>
      
      <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        <button
          type="button"
          onClick={() => handleDongSelect('전체')}
          className={`p-3 rounded-xl font-bold text-sm transition-all
            ${selectedDong === '전체' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
          `}
        >
          {selectedCity} 전체
        </button>

        {dongs.map((dong) => {
          const shortName = dong.name.split(' ').pop() || dong.name;
          return (
            <button
              key={dong.code}
              type="button"
              onClick={() => handleDongSelect(shortName)}
              className={`
                p-3 rounded-xl font-bold text-sm shadow-sm transition-all duration-200 break-keep
                ${selectedDong === shortName 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-primary-300'
                }
              `}
            >
              {shortName}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 min-h-[300px] relative">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}
      {currentView === 'PROVINCE' && renderProvinces()}
      {currentView === 'CITY' && renderCities()}
      {currentView === 'DONG' && renderDongs()}
    </div>
  );
}
