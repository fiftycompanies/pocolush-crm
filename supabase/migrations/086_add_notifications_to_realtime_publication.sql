-- 086: notifications 테이블을 supabase_realtime publication 에 추가
--
-- 배경:
--   - components/layout/TopBar.tsx 가 .channel('notifications').on('postgres_changes', { table: 'notifications' }) 구독
--   - 그러나 publication 에는 member_notifications, bbq_reservations, notices 만 포함
--   - notifications 테이블이 publication 미포함 → INSERT 이벤트 미수신 → 어드민 알림 toast 무용
--
-- 변경:
--   - ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications
--   - 어드민 TopBar 의 realtime 알림 toast 활성화 (Phase 0 의도 복원)
--
-- 영향:
--   - 어드민: notifications INSERT 시 toast 자동 표시 (RLS 로 user_id 필터링)
--   - 회원 측: 0 (member_notifications 별도 publication 포함)
--   - DB 부하: notifications INSERT 시 publication WAL 전파 추가 (미미 — 알림은 저빈도)

-- idempotent: 이미 추가됐을 경우 무시
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;

-- 검증 코멘트
COMMENT ON TABLE public.notifications IS
  '086: supabase_realtime publication 포함 (TopBar.tsx realtime 토스트 활성화)';
