'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function NotificationSettingsPage() {
  const supabase = createClient();
  const [alimtalkEnabled, setAlimtalkEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('notification_settings').select('key, value');
      const map = Object.fromEntries((data || []).map(s => [s.key, s.value]));
      setAlimtalkEnabled(map['alimtalk_enabled'] === 'true');
      setPushEnabled(map['push_enabled'] === 'true');
      setLoading(false);
    }
    load();
  }, [supabase]);

  const toggleSetting = async (key: string, current: boolean) => {
    const newValue = (!current).toString();
    const { error } = await supabase.from('notification_settings').update({ value: newValue }).eq('key', key);
    if (error) {
      toast.error('설정 변경에 실패했습니다.');
      return;
    }
    if (key === 'alimtalk_enabled') setAlimtalkEnabled(!current);
    if (key === 'push_enabled') setPushEnabled(!current);
    toast.success(`${key === 'alimtalk_enabled' ? '알림톡' : '앱 푸시'} ${!current ? '활성화' : '비활성화'}됨`);
  };

  if (loading) return <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p>;

  return (
    <div className="space-y-5" style={{ maxWidth: '800px' }}>
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">알림 설정</h1>
        <p className="text-sm text-text-secondary mt-1">알림톡 및 앱 푸시 발송 설정</p>
      </div>

      <div className="bg-card border rounded-xl divide-y divide-border">
        {/* 알림톡 */}
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">카카오 알림톡 (알리고)</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              {alimtalkEnabled ? '활성화됨 — 환경변수(ALIGO_*)가 설정되어야 실제 발송됩니다.' : '비활성화됨'}
            </p>
          </div>
          <button onClick={() => toggleSetting('alimtalk_enabled', alimtalkEnabled)}
            className={`w-12 h-7 rounded-full transition-colors relative ${alimtalkEnabled ? 'bg-green' : 'bg-gray/30'}`}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${alimtalkEnabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {/* 앱 푸시 */}
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">앱 푸시 (FCM)</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              {pushEnabled ? '활성화됨 — FIREBASE_SERVICE_ACCOUNT 환경변수 필요' : '비활성화됨'}
            </p>
          </div>
          <button onClick={() => toggleSetting('push_enabled', pushEnabled)}
            className={`w-12 h-7 rounded-full transition-colors relative ${pushEnabled ? 'bg-green' : 'bg-gray/30'}`}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${pushEnabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className="bg-yellow-light border border-yellow/20 rounded-xl p-4">
        <p className="text-sm font-medium text-yellow mb-1">환경변수 설정 안내</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          알림톡: <code className="text-xs bg-bg-muted px-1 rounded">ALIGO_API_KEY</code>, <code className="text-xs bg-bg-muted px-1 rounded">ALIGO_USER_ID</code>, <code className="text-xs bg-bg-muted px-1 rounded">ALIGO_SENDER</code>, <code className="text-xs bg-bg-muted px-1 rounded">ALIGO_SENDER_KEY</code><br/>
          앱 푸시: <code className="text-xs bg-bg-muted px-1 rounded">FIREBASE_SERVICE_ACCOUNT</code>
        </p>
      </div>
    </div>
  );
}
