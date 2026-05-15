-- 076: supabase_realtime publication 에 BBQ/공지/알림 테이블 등록
-- 배경: A1 hotfix (setAuth) 후에도 401 무한 재시도 — 진짜 원인은 publication 미등록.
--       postgres_changes 채널이 publication 없는 테이블 구독 시도 → 401 발현.
--
-- 영향: BBQ 보드 Realtime 자동 갱신 정상 동작 + TopBar notifications 채널 정상화

ALTER PUBLICATION supabase_realtime ADD TABLE public.bbq_reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.member_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
