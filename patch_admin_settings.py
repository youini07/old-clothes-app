import re

with open('frontend/src/pages/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add state
state_pattern = r'const \[isSavingPriceTable, setIsSavingPriceTable\] = useState\(false\);'
content = re.sub(state_pattern, 'const [isSavingPriceTable, setIsSavingPriceTable] = useState(false);\n  const [isShowPriceTableModal, setIsShowPriceTableModal] = useState(false);', content)

# Modify Settings View
settings_view_start = r'\{\/\* 환경 설정 뷰 \*\/\}.*?activeView === \'settings\' && settings && \('
settings_view_end = r'\{\/\* 📅 캘린더 뷰 — desiredDate 기준 날짜별 수거 관리 \*\/\}'

match = re.search(settings_view_start + r'.*?(?=' + settings_view_end + r')', content, re.DOTALL)
if match:
    old_view = match.group(0)
    
    new_view = '''{/* 환경 설정 뷰 */}
        {activeView === 'settings' && settings && (
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">⚙️ 환경 설정</h2>
                <p className="text-gray-500">수거 단가 및 카카오 알림톡 서비스 구독 여부를 설정할 수 있습니다.</p>
              </div>
              <button 
                type="button" 
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                {isSavingSettings ? '저장 중...' : '변경사항 저장하기'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* 왼쪽 단: 기본 설정 항목들 */}
              <div className="space-y-6">
                {globalSettings && (
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-lg font-bold text-gray-900">📢 전역 공지사항 (앱 전체 띠 배너)</label>
                      <button 
                        type="button"
                        onClick={() => setGlobalSettings({...globalSettings, noticeIsActive: !globalSettings.noticeIsActive})}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none z-10 ${globalSettings.noticeIsActive ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${globalSettings.noticeIsActive ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">명절 휴무, 긴급 안내 등 고객과 기사님을 포함한 앱 전체 화면 최상단에 띄울 공지를 작성합니다.</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">배너 텍스트 (간략히)</label>
                        <textarea
                          value={globalSettings.globalNotice}
                          onChange={(e) => setGlobalSettings({...globalSettings, globalNotice: e.target.value})}
                          placeholder="예: 설 연휴 2/9~2/12 수거 휴무 안내"
                          rows={2}
                          className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">상세 내용 (클릭 시 팝업, 선택사항)</label>
                        <textarea
                          value={globalSettings.globalNoticeDetail || ''}
                          onChange={(e) => setGlobalSettings({...globalSettings, globalNoticeDetail: e.target.value})}
                          placeholder="배너를 클릭하면 상세 내용 팝업이 뜹니다."
                          rows={3}
                          className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">✨</span>
                    <h3 className="text-xl font-bold text-gray-900">프리미엄 알림톡 서비스</h3>
                    <span className="px-2.5 py-1 bg-gradient-to-r from-orange-600 to-red-500 text-white text-xs font-black rounded-full shadow-sm ml-2 tracking-wide">유료 서비스</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">파트너님의 수거 단가를 높이고, 재이용률을 극대화하는 카카오 알림톡 기반의 프리미엄 자동화 기능입니다.</p>
                  
                  <div className="space-y-6 divide-y divide-gray-100 border-t border-gray-100 pt-4">
                    <div>
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
                      <p className="text-sm text-gray-500 leading-relaxed">수거 단계마다 고객의 개인 카카오톡으로 공식 알림톡이 발송됩니다.</p>
                    </div>

                    <div className="pt-4">
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
                      <p className="text-sm text-gray-500 leading-relaxed">수거 완료 3개월 뒤 자동으로 재수거 유도 알림톡을 발송합니다.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><span>🎉</span> 이벤트 및 리뷰 관리</h2>
                    <button 
                      type="button"
                      onClick={() => setSettings({...settings, eventIsActive: !settings.eventIsActive})}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none z-10 ${settings.eventIsActive ? 'bg-orange-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${settings.eventIsActive ? 'translate-x-8' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">문자 정산서 하단에 이벤트 문구를 노출하여 리뷰를 유도합니다.</p>
                  {settings.eventIsActive && (
                    <textarea
                      value={settings.eventText || ''}
                      onChange={(e) => setSettings({...settings, eventText: e.target.value})}
                      placeholder="간편 리뷰 작성 시 추첨을 통해 치킨 쿠폰 5장을 드립니다!"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                      rows={3}
                    />
                  )}
                </div>
              </div>

              {/* 오른쪽 단: 단가표, 권역, 계정 관리 */}
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <label className="block text-lg font-bold text-gray-900 mb-2">💰 항목별 수거 단가 설정</label>
                  <p className="text-sm text-gray-500 mb-4">기사님이 수거 완료 처리 시 고객에게 안내되는 정산 금액의 기준 단가입니다.</p>
                  <button
                    type="button"
                    onClick={() => setIsShowPriceTableModal(true)}
                    className="w-full py-3 font-bold rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 active:scale-95 transition-all shadow-sm"
                  >
                    단가표 설정하기
                  </button>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">🗺️ 사용자 정의 권역 관리</h2>
                  <p className="text-sm text-gray-500 mb-4">기사님들에게 배정할 권역과 포함 지역을 설정하세요.</p>
                  <div className="space-y-3">
                    {customRegions.map(cr => (
                      <div key={cr.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl">
                        <div>
                          <span className="font-bold text-gray-900 mr-2">{cr.name}</span>
                          <span className="text-xs text-gray-600">{cr.areas.join(', ')}</span>
                        </div>
                        <button 
                          disabled={deletingRegionId === cr.id}
                          onClick={() => handleDeleteRegion(cr.id)} 
                          className="text-xs font-bold px-2 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                    {isAddingRegion ? (
                      <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl space-y-3">
                        <input type="text" value={newRegionForm.name} onChange={e => setNewRegionForm({...newRegionForm, name: e.target.value})} placeholder="예: A권역" className="w-full p-2 border border-primary-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm" />
                        <div className="max-h-40 overflow-y-auto border border-primary-200 rounded-lg bg-white p-2 space-y-1">
                          {GYEONGGI_AREAS.map(area => {
                            const isSelected = newRegionForm.selectedAreas.includes(area);
                            return (
                              <div key={area} className={`flex flex-col sm:flex-row sm:items-center justify-between p-1.5 rounded-lg ${isSelected ? 'bg-primary-50' : ''}`}>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={isSelected} onChange={() => handleToggleArea(area)} className="w-4 h-4 text-primary-600" />
                                  <span className={`text-sm ${isSelected ? 'font-bold text-primary-900' : 'text-gray-700'}`}>{area}</span>
                                </label>
                                {isSelected && (
                                  <input type="text" value={newRegionForm.exceptions[area] || ''} onChange={(e) => handleExceptionChange(area, e.target.value)} placeholder="-뫄뫄동" className="text-xs p-1 border border-primary-200 rounded w-24" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                          <button onClick={() => setIsAddingRegion(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 font-bold rounded-lg text-xs hover:bg-gray-300">취소</button>
                          <button onClick={handleAddRegion} disabled={isSubmittingRegion} className="px-3 py-1.5 bg-primary-600 text-white font-bold rounded-lg text-xs hover:bg-primary-700">{isSubmittingRegion ? '저장 중' : '저장'}</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setIsAddingRegion(true)} className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all text-sm">+ 새 권역 추가하기</button>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">🛠️ 계정 및 관리자 메뉴</h2>
                  <div className="flex gap-3">
                    <button onClick={() => setIsDriverModalOpen(true)} className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-sm hover:bg-primary-700 text-sm active:scale-95">기사님 추가</button>
                    <button onClick={() => setIsPasswordModalOpen(true)} className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-xl shadow-sm hover:bg-gray-900 text-sm active:scale-95">비밀번호 변경</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
'''

    content = content.replace(old_view, new_view)

# Add Modal
modal_code = '''
      {isShowPriceTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 mb-2">항목별 수거 단가 설정</h3>
            <p className="text-sm text-gray-500 mb-6">단가를 수정하고 저장하면 기사님 앱에 즉시 반영됩니다.</p>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-6">
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

            <div className="flex gap-3 mt-auto">
              <button onClick={() => setIsShowPriceTableModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">닫기</button>
              <button 
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
                    setIsShowPriceTableModal(false);
                    alert('단가표가 저장되었습니다.');
                  } catch (error: any) {
                    alert(error.response?.data?.error || '단가표 저장 중 오류가 발생했습니다.');
                  } finally {
                    setIsSavingPriceTable(false);
                  }
                }}
                className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 active:scale-95 flex items-center justify-center gap-2"
              >
                {isSavingPriceTable ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}
'''

content = content.replace('    </div>\n  );\n}\n', modal_code + '\n    </div>\n  );\n}\n')

with open('frontend/src/pages/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
