import { redirect } from 'next/navigation';

/**
 * 2026-05-16 — 평상 메뉴 페이지를 평상 설정 §3 섹션으로 통합.
 * 외부 북마크/링크 보존을 위해 /dashboard/bbq#products 로 redirect.
 *
 * 근거: thoughts/plans/20260516-0100_bbq_consolidation_plan.md (Q3=a)
 */
export default function BbqProductsRedirectPage() {
  redirect('/dashboard/bbq#products');
}
