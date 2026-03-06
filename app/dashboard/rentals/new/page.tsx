'use client';

import { useSearchParams } from 'next/navigation';
import RentalForm from '@/components/rentals/RentalForm';

export default function NewRentalPage() {
  const searchParams = useSearchParams();
  const farmId = searchParams.get('farmId') || undefined;
  const customerId = searchParams.get('customerId') || undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-text-primary">새 임대 계약 등록</h1>
        <p className="text-[14px] text-text-secondary mt-1">자람터 농장 임대 계약을 등록합니다</p>
      </div>
      <RentalForm preselectedFarmId={farmId} preselectedCustomerId={customerId} />
    </div>
  );
}
