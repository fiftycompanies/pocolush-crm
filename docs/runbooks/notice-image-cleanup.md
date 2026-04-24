# Runbook: 공지 이미지 orphan 정리

**적용 대상**: Phase 0.5 PR-H3 이후 — `notice-images` 버킷 + `notice_images` 테이블.
**주기**: 매일 KST 03:00 cron (`notices_prune_drafts`) 자동 실행 + 필요시 수동.

## 모델

- 버킷: `notice-images` (public=TRUE, 2MB/장, MIME: image/jpeg + image/png + image/webp)
- 경로: `{notice_id}/{timestamp}-{random}.jpg`
- 테이블: `public.notice_images` — `notice_id FK → notices ON DELETE CASCADE`
- 트리거:
  - `trg_notice_images_guard` (BEFORE INSERT): 10장 가드 + `pg_advisory_xact_lock`
  - `trg_notice_images_cleanup_storage` (AFTER DELETE): `net.http_delete` 로 Storage 객체 삭제
- 드래프트 TTL cron: `notices_prune_drafts` — `is_published=false` + `created_at < NOW() - 7일` → DELETE → CASCADE → Storage cleanup

## 시나리오

### 시나리오 1 — draft 공지가 7일 경과 후 cron 으로 자동 정리

정상 동작. 다음을 주기적으로 확인하여 cron 이 살아있는지 점검.

```sql
-- 다음 실행 시각 확인
SELECT jobid, schedule, command, active
FROM cron.job
WHERE jobname = 'notices_prune_drafts';

-- 최근 실행 결과 (audit_logs)
SELECT created_at, metadata
FROM public.audit_logs
WHERE action = 'notices_prune_drafts'
ORDER BY created_at DESC
LIMIT 5;
```

**정상 출력 예**:
```json
{ "deleted_count": 3, "ran_at": "2026-04-25T18:00:12+00:00" }
```

### 시나리오 2 — DB row 는 있으나 Storage 객체가 사라진 경우 (broken image)

Storage 객체가 외부 원인(수동 삭제 등)으로 없어졌고 DB row 만 남음. 공지 상세 페이지에서 이미지가 broken.

**식별**:

```sql
-- notice_images 목록 샘플 100건 중 Storage 존재 확인은 CLI로
SELECT id, notice_id, storage_path FROM public.notice_images LIMIT 100;
```

```bash
# storage_path 각각에 대해 HEAD 체크
PUBLIC_BASE="https://lhuaxmzsvrmjavanunnv.supabase.co/storage/v1/object/public/notice-images"
for path in $(psql -Atc "SELECT storage_path FROM public.notice_images"); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -I "$PUBLIC_BASE/$path")
  if [ "$code" != "200" ]; then
    echo "MISSING: $path ($code)"
  fi
done
```

**처리**:

```sql
-- broken rows 삭제 (트리거가 http_delete 시도하지만 이미 없으면 404 swallow)
DELETE FROM public.notice_images
WHERE id IN (-- missing storage_path 목록);
```

### 시나리오 3 — Storage 에 객체가 있으나 DB row 가 없는 경우 (orphan 객체)

DB INSERT 실패로 rollback 이 실행되지 못한 케이스 (예: 네트워크 단절).

**식별**:

```bash
# Storage 객체 목록 dump
SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

curl -s -H "Authorization: Bearer $SERVICE_KEY" \
  "https://lhuaxmzsvrmjavanunnv.supabase.co/storage/v1/bucket/notice-images/objects" \
  | jq -r '.[].name' > /tmp/storage-paths.txt

# DB 에 있는 경로
psql -Atc "SELECT storage_path FROM public.notice_images" > /tmp/db-paths.txt

# 차집합 = orphan
comm -23 <(sort /tmp/storage-paths.txt) <(sort /tmp/db-paths.txt) > /tmp/orphans.txt
wc -l /tmp/orphans.txt
```

**처리**:

```bash
# 각 orphan 경로를 Storage API 로 DELETE
while read path; do
  curl -X DELETE \
    -H "Authorization: Bearer $SERVICE_KEY" \
    "https://lhuaxmzsvrmjavanunnv.supabase.co/storage/v1/object/notice-images/$path"
done < /tmp/orphans.txt
```

**주의**: 삭제 전 반드시 **백업** — `supabase storage download` 로 로컬 보존.

### 시나리오 4 — Vault secret 미설정으로 cleanup 트리거가 no-op

`fn_notice_images_cleanup_storage` 트리거는 Vault 에서 `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` 을 읽어 `net.http_delete` 를 호출함. Vault 미설정 시 `EXCEPTION WHEN OTHERS` 로 swallow 되어 DB DELETE 는 성공하되 Storage 에 객체가 남음.

**확인**:

```sql
SELECT name FROM vault.secrets
WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL');
```

둘 다 존재해야 정상.

**복구**:

```sql
SELECT vault.create_secret('<SRK>', 'SUPABASE_SERVICE_ROLE_KEY', 'Storage cleanup용');
SELECT vault.create_secret('https://<ref>.supabase.co', 'SUPABASE_URL', 'Storage cleanup용');
```

복구 후에는 시나리오 3 로직으로 누적된 orphan 일괄 정리.

### 시나리오 5 — 10장 제한 에러가 사용자 혼란 유발

`trg_notice_images_guard` 가 11번째 INSERT 에서 `RAISE EXCEPTION '한 공지에 최대 10장까지만 업로드 가능합니다 (현재 10)'`. 클라이언트도 동일 가드가 있으나, 동시 업로드 race 로 DB 에서 터지는 경우 존재.

**처리**: 현재는 `toast.error(e.message)` 로 노출. UX 문제면 클라이언트에서 10장 근접 시 경고 문구 노출 추가 고려.

## 체크리스트 — 주간 점검

- [ ] `cron.job` 에 `notices_prune_drafts` active=true
- [ ] 최근 7일 `audit_logs.action='notices_prune_drafts'` 행 존재
- [ ] `notice_images` row count vs Storage 객체 count 차이 < 10
- [ ] `vault.secrets` 에 `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` 존재

## 연관 파일 / 마이그레이션

- `supabase/migrations/056_notice_images.sql` — 테이블, 트리거, cron
- `lib/upload-notice-image.ts` — 업로드 + rollback
- `components/notices/NoticeImageDropzone.tsx` — 드롭존 UI
- `docs/runbooks/cron-secret-rotation.md` — Vault 키 교체 절차

## 긴급 완전 정리 (DANGER)

```sql
-- 모든 draft (7일 기준) 즉시 삭제
SELECT public.fn_notices_prune_drafts();
```

반환값 = 삭제된 draft 공지 수. CASCADE 로 `notice_images` + Storage 까지 정리됨.
