'use client';

import { useSearchParams } from 'next/navigation';
import RentalForm from '@/components/rentals/RentalForm';

export default function NewRentalPage() {
  const searchParams = useSearchParams();
  const farmId = searchParams.get('farmId') || undefined;
  const customerId = searchParams.get('customerId') || undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">새 임대 계약 등록</h1>
        <p className="text-[14px] text-text-secondary mt-0.5">자람터 농장 임대 계약을 등록합니다</p>
      </div>
      <RentalForm preselectedFarmId={farmId} preselectedCustomerId={customerId} />
    </div>
  );
}
