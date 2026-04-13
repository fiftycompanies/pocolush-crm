'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Bell, LogOut } from 'lucide-react';
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
    <div className="flex items-center justify-between w-full">
      <div />

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative size-9 flex items-center justify-center rounded-md hover:bg-accent transition-all"
          >
            <Bell className="size-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 size-4 bg-destructive text-white text-[10px] rounded-full flex items-center justify-center font-semibold">
                {unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-[44px] w-80 bg-popover text-popover-foreground rounded-md border shadow-md overflow-hidden z-50">
              <div className="px-4 py-3 border-b">
                <span className="text-sm font-semibold">알림</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-muted-foreground text-sm">
                    알림이 없습니다
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => markAsRead(notif)}
                      className={`w-full text-left px-4 py-3 hover:bg-accent transition-all border-b border-border/40 ${
                        !notif.is_read ? 'bg-accent/50' : ''
                      }`}
                    >
                      <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notif.created_at), 'M월 d일 HH:mm', { locale: ko })}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-border mx-1" />

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
            {userName?.charAt(0) || 'U'}
          </div>
          <span className="text-sm text-foreground font-medium hidden sm:block">
            {userName || '사용자'}
          </span>
          <button
            onClick={handleLogout}
            className="size-8 flex items-center justify-center rounded-md hover:bg-accent transition-all text-muted-foreground hover:text-foreground"
            title="로그아웃"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
