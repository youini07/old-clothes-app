const fs = require('fs');
try {
  const p = 'frontend/src/pages/AdminDashboard.tsx';
  let content = fs.readFileSync(p, 'utf8');

  // 1. Update the state type
  content = content.replace(
      'const [globalSettings, setGlobalSettings] = useState<{ globalNotice: string; noticeIsActive: boolean; globalNoticeDetail?: string; popupImageUrl?: string | null; popupIsActive?: boolean } | null>(null);',
      'const [globalSettings, setGlobalSettings] = useState<{ globalNotice: string; noticeIsActive: boolean; globalNoticeDetail?: string; popupImageUrl?: string | null; popupIsActive?: boolean; eventYoutubeUrl?: string | null } | null>(null);'
  );

  // 2. Update save function payload
  content = content.replace(
      'popupImageUrl: globalSettings.popupImageUrl || null,',
      'popupImageUrl: globalSettings.popupImageUrl || null,\n          eventYoutubeUrl: globalSettings.eventYoutubeUrl || null,'
  );

  // 3. Add UI element after popupImageUrl block
  const ui_target = `                      {globalSettings.popupImageUrl && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">미리보기</p>
                          <div className="bg-gray-100 p-4 rounded-xl flex items-center justify-center">
                            <img src={globalSettings.popupImageUrl} alt="Popup Preview" className="max-w-full h-auto rounded-lg border border-gray-200 max-h-48 object-contain" />
                          </div>
                        </div>
                      )}
                    </div>`;

  const ui_replacement = ui_target + `
                    
                    {/* Event Youtube Link Setup */}
                    <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100/50 shadow-sm transition-all hover:shadow-md mt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-100 rounded-lg text-red-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </div>
                        <h4 className="font-bold text-gray-900">이벤트 당첨자 발표 영상</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">유튜브 링크 (URL)</label>
                          <input 
                            type="text" 
                            className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                            placeholder="예: https://www.youtube.com/watch?v=..."
                            value={globalSettings.eventYoutubeUrl || ''}
                            onChange={(e) => setGlobalSettings({...globalSettings, eventYoutubeUrl: e.target.value})}
                          />
                          <p className="mt-2 text-xs text-gray-500">링크를 등록하시면 랜딩페이지의 진행중인 이벤트 영역에 당첨자 발표 영상이 뜹니다. 비워두시면 이벤트 포스터만 표시됩니다.</p>
                        </div>
                      </div>
                    </div>`;

  content = content.replace(ui_target, ui_replacement);

  fs.writeFileSync(p, content, 'utf8');
  fs.writeFileSync('debug_admin.txt', 'SUCCESS!');
} catch (e) {
  fs.writeFileSync('debug_admin.txt', e.toString());
}
