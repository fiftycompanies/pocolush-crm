'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Notification } from '@/types';

export default function TopBar() {
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userName, setUserName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        if (data) setUserName(data.name);
      }
    };

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setNotifications(data);
    };

    fetchProfile();
    fetchNotifications();

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const notif = payload.new as Notification;
          setNotifications((prev) => [notif, ...prev].slice(0, 10));
          toast(notif.message, { icon: '🔔' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    setShowDropdown(false);
    if (notif.inquiry_id) {
      router.push(`/dashboard/inquiries?open=${notif.inquiry_id}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="h-[60px] border-b border-border bg-white flex items-center justify-between px-8">
      <div />

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-hover transition-colors"
          >
            <Bell className="w-[18px] h-[18px] text-text-secondary" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red text-white text-[10px] rounded-full flex items-center justify-center font-medium">
                {unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-10 w-80 bg-white border border-border rounded-xl shadow-[0_4px_6px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.06)] overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[14px] font-semibold text-text-primary">알림</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-text-tertiary text-[13px]">
                    알림이 없습니다
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => markAsRead(notif)}
                      className={`w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors border-b border-[#F3F4F6] ${
                        !notif.is_read ? 'bg-primary-light/30' : ''
                      }`}
                    >
                      <p className="text-[13px] text-text-primary line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[12px] text-text-tertiary mt-1">
                        {format(new Date(notif.created_at), 'M월 d일 HH:mm', { locale: ko })}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary text-[13px] font-semibold">
            {userName?.charAt(0) || 'U'}
          </div>
          <span className="text-[14px] text-text-primary font-medium hidden sm:block">
            {userName || '사용자'}
          </span>
          <button
            onClick={handleLogout}
            className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
