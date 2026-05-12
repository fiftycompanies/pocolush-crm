'use client';

/**
 * 064 Zone 이전 모달 (A 모달)
 *
 * 2-step 플로우 (kk + 풀스택 권고):
 * - Step 1: 정보 입력 + "검증하기" → validate_zone_change RPC
 *   - 검증 통과: Step 2 활성 + 결과 표시 (current/new zone, end_date, pending SO)
 *   - 검증 실패: 인라인 에러 + 충돌 시 override 옵션 노출
 *   - 미운영 zone / 같은 자리 / 활성 아님 등 사전 차단
 * - Step 2: "이전 확정" → change_membership_zone RPC
 *
 * 가격차 정책 C (수동):
 * - price_diff_krw 입력 (음수 환불 / 양수 청구 / 0 면제)
 * - |amount| > 1,000,000 시 confirm
 * - 음수 입력 시 settlement_note 필수
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { X, ArrowRight, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ZONE_CHANGE_REASONS, type ZoneChangeReason, type ValidateZoneChangeResult, type AvailableFarm } from '@/lib/zone-change';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  membershipId: string;
  memberName: string;
  currentFarmId?: string | null;
  onSuccess: () => void;
}

export default function ZoneTransferModal({ isOpen, onClose, membershipId, memberName, currentFarmId, onSuccess }: Props) {
  const supabase = createClient();
  const [farms, setFarms] = useState<AvailableFarm[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(false);
  const [newFarmId, setNewFarmId] = useState<string>('');
  const [reason, setReason] = useState<ZoneChangeReason | ''>('');
  const [memo, setMemo] = useState('');
  const [priceDiff, setPriceDiff] = useState<string>('0');
  const [settlementNote, setSettlementNote] = useState('');
  const [validation, setValidation] = useState<ValidateZoneChangeResult | null>(null);
  const [override, setOverride] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 사용 가능 farm 목록
  useEffect(() => {
    if (!isOpen) return;
    setLoadingFarms(true);
    supabase
      .rpc('get_available_farms_for_transfer', { p_exclude_farm_id: currentFarmId ?? null })
      .then(({ data, error }) => {
        if (error) toast.error('자리 목록 조회 실패: ' + error.message);
        else setFarms((data ?? []) as AvailableFarm[]);
        setLoadingFarms(false);
      });
  }, [isOpen, currentFarmId, supabase]);

  // ESC + 초기 포커스
  useEffect(() => {
    if (!isOpen) {
      setNewFarmId(''); setReason(''); setMemo(''); setPriceDiff('0');
      setSettlementNote(''); setValidation(null); setOverride(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // zone 별 그룹화
  const farmsByZone = useMemo(() => {
    const map = new Map<string, { zone_name: string; farms: AvailableFarm[] }>();
    farms.forEach(f => {
      if (!map.has(f.zone_id)) map.set(f.zone_id, { zone_name: f.zone_name, farms: [] });
      map.get(f.zone_id)!.farms.push(f);
    });
    return Array.from(map.values());
  }, [farms]);

  const priceNum = parseInt(priceDiff || '0', 10) || 0;
  const requiresMemo = reason === 'other';
  const requiresSettlementNote = priceNum < 0;  // 환불 시 메모 필수

  const canValidate =
    newFarmId &&
    reason &&
    (!requiresMemo || memo.trim().length > 0) &&
    (!requiresSettlementNote || settlementNote.trim().length > 0) &&
    !validating;

  const canSubmit =
    validation &&
    (validation.ok || (override && validation.error_code === 'FARM_ALREADY_TAKEN')) &&
    !submitting;

  const handleValidate = async () => {
    if (!canValidate) return;
    setValidating(true);
    setValidation(null);
    const { data, error } = await supabase.rpc('validate_zone_change', {
      p_membership_id: membershipId,
      p_new_farm_id: newFarmId,
    });
    setValidating(false);
    if (error) {
      toast.error('검증 실패: ' + error.message);
      return;
    }
    const row = (data?.[0] ?? null) as ValidateZoneChangeResult | null;
    setValidation(row);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !reason) return;

    if (Math.abs(priceNum) > 1_000_000) {
      const ok = confirm(`가격 차이 ${priceNum.toLocaleString()}원이 100만원을 초과합니다. 진행하시겠습니까?`);
      if (!ok) return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc('change_membership_zone', {
      p_membership_id: membershipId,
      p_new_farm_id: newFarmId,
      p_reason_category: reason,
      p_reason_memo: memo.trim() || null,
      p_price_diff_krw: priceNum,
      p_settlement_note: settlementNote.trim() || null,
      p_override: override,
    });
    setSubmitting(false);
    if (error) {
      toast.error('이전 실패: ' + error.message);
      return;
    }
    toast.success(`${memberName} Zone 이전 완료`);
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-transfer-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl w-[92vw] max-w-2xl max-h-[92vh] overflow-y-auto z-50 shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-blue-600" aria-hidden="true" />
            <h2 id="zone-transfer-title" className="text-base font-semibold text-text-primary">
              {memberName} 회원 — Zone 이전
            </h2>
          </div>
          <button onClick={onClose} aria-label="닫기" className="size-10 inline-flex items-center justify-center rounded-lg text-text-secondary hover:bg-accent">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1: 입력 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <span className="size-5 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">1</span>
              정보 입력
            </h3>

            {/* 자리 선택 */}
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">이동할 자리 <span className="text-red-500">*</span></label>
              {loadingFarms ? (
                <p className="text-xs text-text-tertiary">자리 목록 불러오는 중...</p>
              ) : farms.length === 0 ? (
                <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  ⚠️ 이동 가능한 빈자리가 없습니다 (모든 운영 zone 의 farm 이 점유 중).
                </p>
              ) : (
                <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                  {farmsByZone.map(group => (
                    <div key={group.zone_name} className="border-b last:border-0">
                      <div className="px-3 py-1.5 bg-accent/50 text-[11px] font-semibold text-text-secondary">
                        {group.zone_name} ({group.farms.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5 p-2">
                        {group.farms.map(f => (
                          <button
                            key={f.farm_id}
                            type="button"
                            onClick={() => { setNewFarmId(f.farm_id); setValidation(null); }}
                            className={`text-xs px-2.5 py-1 rounded-md border ${
                              newFarmId === f.farm_id
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-text-primary border-border hover:border-blue-300'
                            }`}
                          >
                            {group.zone_name.replace('존','')}{f.farm_number}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 사유 + 메모 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1.5">사유 <span className="text-red-500">*</span></label>
                <select
                  value={reason}
                  onChange={e => { setReason(e.target.value as ZoneChangeReason); setValidation(null); }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">선택하세요</option>
                  {ZONE_CHANGE_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1.5">
                  메모 {requiresMemo && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={e => { setMemo(e.target.value); setValidation(null); }}
                  placeholder={requiresMemo ? '구체적 사유' : '추가 설명 (선택)'}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* 가격차 (정책 C) */}
            <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-medium text-amber-900">
                💰 가격 차이 (어드민 수동 입력 — 양수=청구, 음수=환불, 0=면제)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={priceDiff}
                  onChange={e => setPriceDiff(e.target.value)}
                  placeholder="0"
                  className="border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={settlementNote}
                  onChange={e => setSettlementNote(e.target.value)}
                  placeholder={requiresSettlementNote ? '환불 처리 메모 *' : '정산 메모 (선택)'}
                  className="border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              {priceNum !== 0 && (
                <p className="text-[11px] text-amber-800">
                  {priceNum > 0 ? '↑ 추가 청구' : '↓ 환불 처리'}: {Math.abs(priceNum).toLocaleString()}원
                </p>
              )}
            </div>

            <button
              onClick={handleValidate}
              disabled={!canValidate}
              className="w-full py-2 text-sm font-medium text-blue-700 bg-white border-2 border-blue-500 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {validating ? '검증 중...' : '검증하기'}
            </button>
          </section>

          {/* 검증 결과 */}
          {validation && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <span className="size-5 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">2</span>
                검증 결과
              </h3>

              {validation.ok ? (
                <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" aria-hidden="true" /> 검증 통과 — 이전 가능
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[12px] text-emerald-800">
                    <div>
                      <p className="text-[10px] text-emerald-600">현재 위치</p>
                      <p className="font-medium">
                        {validation.current_zone_name ?? '미배정'}
                        {validation.current_farm_number !== null && ` ${validation.current_farm_number}번`}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <ArrowRight className="size-4 text-emerald-600" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-600">이동 위치</p>
                      <p className="font-medium">
                        {validation.new_zone_name} {validation.new_farm_number}번
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-600">계약 만료일</p>
                      <p className="font-medium">{validation.membership_end_date} (유지)</p>
                    </div>
                  </div>
                  {validation.pending_service_orders > 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                      ⚠️ 진행 중 서비스 주문 {validation.pending_service_orders}건 — 이전 후에도 자동 인계됩니다.
                    </p>
                  )}
                </div>
              ) : validation.error_code === 'FARM_ALREADY_TAKEN' ? (
                <div className="border border-orange-300 bg-orange-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-orange-900 flex items-center gap-1.5">
                    <AlertTriangle className="size-4" aria-hidden="true" /> 점유 충돌
                  </p>
                  <p className="text-[12px] text-orange-800">
                    {validation.new_zone_name} {validation.new_farm_number}번에 이미{' '}
                    <strong>{validation.conflict_member_name}</strong> 회원이 사용 중입니다.
                  </p>
                  <label className="flex items-start gap-2 cursor-pointer p-2 bg-white border border-orange-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={e => setOverride(e.target.checked)}
                      className="mt-0.5 accent-orange-600"
                    />
                    <span className="text-[12px] text-orange-900">
                      <strong>{validation.conflict_member_name}</strong> 회원의 회원권을 만료 처리하고 {memberName} 회원을 새로 등록합니다.
                      <br />
                      <span className="text-[10px] text-orange-700">
                        ⚠️ 기존 회원권은 expired 상태로 변경되며 이력에 영구 기록됩니다.
                      </span>
                    </span>
                  </label>
                </div>
              ) : (
                <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-red-900 flex items-center gap-1.5">
                    <AlertTriangle className="size-4" aria-hidden="true" /> 검증 실패
                  </p>
                  <p className="text-[12px] text-red-800 mt-1">
                    {validation.error_message ?? validation.error_code}
                  </p>
                </div>
              )}
            </section>
          )}

          <div className="flex gap-2 justify-end pt-3 border-t">
            <button
              ref={cancelRef}
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-text-secondary hover:bg-accent rounded-lg disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? '처리 중...' : '이전 확정'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
