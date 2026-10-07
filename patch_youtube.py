import os

file_path = 'frontend/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """                        {globalSettings.popupImageUrl && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-1">미리보기:</p>
                            <img src={globalSettings.popupImageUrl} alt="Popup Preview" className="max-w-full h-auto rounded-lg border border-gray-200 max-h-48 object-contain" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}"""

replacement = target + """

                {globalSettings && (
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-red-100 rounded-lg text-red-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">🎥 이벤트 당첨자 발표 영상</h4>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">유튜브 링크 (URL)</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 text-gray-800 transition-shadow"
                          placeholder="예: https://www.youtube.com/watch?v=..."
                          value={globalSettings.eventYoutubeUrl || ''}
                          onChange={(e) => setGlobalSettings({...globalSettings, eventYoutubeUrl: e.target.value})}
                        />
                        <p className="mt-2 text-xs text-gray-500">링크를 등록하시면 랜딩페이지의 이벤트 영역에 당첨자 발표 영상이 재생됩니다. 비워두시면 이벤트 배너 이미지만 표시됩니다.</p>
                      </div>
                    </div>
                  </div>
                )}"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully!")
else:
    print("Target not found.")
