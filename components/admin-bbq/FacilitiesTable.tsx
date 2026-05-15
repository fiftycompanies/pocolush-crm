'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Edit3, Trash2, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import type { BBQFacility } from '@/types';

interface Props {
  /** 부모가 외부에서 refresh 트리거 시 사용 (선택) */
  refreshKey?: number;
}

/**
 * §4 시설 목록 테이블 (collapsible <details>)
 * - 기본 닫힘 (Q2=1)
 * - 활성/비활성/수정/삭제 advanced 액션
 */
export default function FacilitiesTable({ refreshKey = 0 }: Props) {
  const supabase = createClient();
  const [facilities, setFacilities] = useState<BBQFacility[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFacilities = useCallback(async () => {
    const { data } = await supabase.from('bbq_facilities').select('*').order('number');
    setFacilities(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities, refreshKey]);

  const toggleActive = async (f: BBQFacility) => {
    await supabase
      .from('bbq_facilities')
      .update({ is_active: !f.is_active })
      .eq('id', f.id);
    toast.success(f.is_active ? '비활성화됨' : '활성화됨');
    fetchFacilities();
  };

  const handleDelete = async (f: BBQFacility) => {
    if (!confirm(`"${f.name}" 시설을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('bbq_facilities').delete().eq('id', f.id);
    if (error) toast.error('예약 이력이 있어 삭제할 수 없습니다.');
    else {
      toast.success('삭제되었습니다.');
      fetchFacilities();
    }
  };

  // 수정은 상단 배치도 카드 클릭 (FacilitiesSection) 으로 일원화
  // 테이블에선 빠른 조회 + 활성 토글 + 삭제만 제공
  const openEditHint = () => {
    toast('수정은 상단 배치도 카드를 클릭하세요.', { icon: '💡' });
  };

  return (
    <details className="bg-card border rounded-xl overflow-hidden group">
      <summary className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors list-none">
        <div className="flex items-center gap-2">
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          <h3 className="text-sm font-semibold">시설 목록 (advanced)</h3>
          <span className="text-xs text-muted-foreground">총 {facilities.length}개</span>
        </div>
        <span className="text-[11px] text-text-tertiary">펼쳐서 보기</span>
      </summary>
      <div className="border-t border-border">
        {loading ? (
          <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-text-secondary">번호</th>
                <th className="px-4 py-3 font-medium text-text-secondary">이름</th>
                <th className="px-4 py-3 font-medium text-text-secondary">가격</th>
                <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
                <th className="px-4 py-3 font-medium text-text-secondary">메모</th>
                <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-border last:border-0 hover:bg-accent/30"
                >
                  <td className="px-4 py-3 font-medium">{f.number}번</td>
                  <td className="px-4 py-3">{f.name}</td>
                  <td className="px-4 py-3">{f.price.toLocaleString()}원</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        f.is_active
                          ? 'text-green bg-green-light'
                          : 'text-gray bg-gray-light'
                      }`}
                    >
                      {f.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-tertiary text-xs">
                    {f.notes || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleActive(f)}
                        className="p-1.5 hover:bg-accent rounded-md"
                        aria-label={f.is_active ? '비활성화' : '활성화'}
                      >
                        {f.is_active ? (
                          <ToggleRight className="size-4 text-green" />
                        ) : (
                          <ToggleLeft className="size-4 text-gray" />
                        )}
                      </button>
                      <button
                        onClick={openEditHint}
                        className="p-1.5 hover:bg-accent rounded-md"
                        aria-label="수정 안내"
                        title="수정은 상단 배치도 카드를 클릭"
                      >
                        <Edit3 className="size-3.5 text-text-secondary" />
                      </button>
                      <button
                        onClick={() => handleDelete(f)}
                        className="p-1.5 hover:bg-accent rounded-md"
                        aria-label="삭제"
                      >
                        <Trash2 className="size-3.5 text-red" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
