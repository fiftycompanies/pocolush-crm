'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Drawer from '@/components/ui/Drawer';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import TypeBadge from './TypeBadge';
import StatusBadge from './StatusBadge';
import NoteTimeline from './NoteTimeline';
import { STATUS_OPTIONS } from '@/lib/constants';
import type { Inquiry, InquiryNote, Profile, FarmRental } from '@/types';

interface InquiryDrawerProps {
  inquiryId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function InquiryDrawer({
  inquiryId,
  isOpen,
  onClose,
  onUpdate,
}: InquiryDrawerProps) {
  const supabase = createClient();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [notes, setNotes] = useState<InquiryNote[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [rental, setRental] = useState<(FarmRental & { farm?: { number: number; name: string } }) | null>(null);

  useEffect(() => {
    if (!inquiryId || !isOpen) return;

    const fetchData = async () => {
      const [inquiryRes, notesRes, staffRes] = await Promise.all([
        supabase
          .from('inquiries')
          .select('*, customer:customers(*), assignee:profiles(*)')
          .eq('id', inquiryId)
          .single(),
        supabase
          .from('inquiry_notes')
          .select('*, author:profiles(*)')
          .eq('inquiry_id', inquiryId)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
      ]);

      if (inquiryRes.data) {
        setInquiry(inquiryRes.data);
        if (inquiryRes.data.type === 'jaramter_inquiry' && inquiryRes.data.customer_id) {
          const { data: rentalData } = await supabase
            .from('farm_rentals')
            .select('*, farm:farms(number, name)')
            .eq('customer_id', inquiryRes.data.customer_id)
            .eq('status', 'active')
            .limit(1)
            .single();
          setRental(rentalData || null);
        } else {
          setRental(null);
        }
      }
      if (notesRes.data) setNotes(notesRes.data);
      if (staffRes.data) setStaff(staffRes.data);
    };

    fetchData();
  }, [inquiryId, isOpen, supabase]);

  const handleStatusChange = async (newStatus: string) => {
    if (!inquiry) return;
    const oldStatus = inquiry.status;

    await supabase
      .from('inquiries')
      .update({ status: newStatus })
      .eq('id', inquiry.id);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('inquiry_notes').insert({
      inquiry_id: inquiry.id,
      author_id: user?.id,
      content: `상태 변경: ${oldStatus} → ${newStatus}`,
      note_type: 'status_change',
    });

    setInquiry({ ...inquiry, status: newStatus as Inquiry['status'] });
    toast.success('상태가 변경되었습니다');

    const { data: newNotes } = await supabase
      .from('inquiry_notes')
      .select('*, author:profiles(*)')
      .eq('inquiry_id', inquiry.id)
      .order('created_at', { ascending: false });
    if (newNotes) setNotes(newNotes);
    onUpdate?.();
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    if (!inquiry) return;
    await supabase
      .from('inquiries')
      .update({ assignee_id: assigneeId || null })
      .eq('id', inquiry.id);

    const assignee = staff.find((s) => s.id === assigneeId) || null;
    setInquiry({ ...inquiry, assignee_id: assigneeId || null, assignee: assignee || undefined });
    toast.success('담당자가 배정되었습니다');
    onUpdate?.();
  };

  const handleAddNote = async () => {
    if (!inquiry || !newNote.trim()) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('inquiry_notes').insert({
      inquiry_id: inquiry.id,
      author_id: user?.id,
      content: newNote.trim(),
      note_type: 'memo',
    });

    setNewNote('');
    toast.success('메모가 저장되었습니다');

    const { data: newNotes } = await supabase
      .from('inquiry_notes')
      .select('*, author:profiles(*)')
      .eq('inquiry_id', inquiry.id)
      .order('created_at', { ascending: false });
    if (newNotes) setNotes(newNotes);
    setSaving(false);
  };

  if (!inquiry) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title="문의 상세">
        <div className="text-center py-12 text-text-tertiary text-[14px]">
          불러오는 중...
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TypeBadge type={inquiry.type} />
            <StatusBadge status={inquiry.status} />
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary w-8 h-8 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors duration-150">
            ✕
          </button>
        </div>

        <div>
          <h2 className="text-[20px] font-bold text-text-primary tracking-tight">
            {inquiry.customer?.name || '이름 없음'}
          </h2>
          <p className="text-[13px] text-text-tertiary mt-1">
            {format(new Date(inquiry.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
          </p>
        </div>

        {/* Basic info */}
        <div className="bg-bg-muted rounded-xl p-4 space-y-0">
          <div className="flex justify-between text-[14px] py-2.5 border-b border-border-light">
            <span className="text-text-secondary">연락처</span>
            <span className="text-text-primary font-medium">{inquiry.customer?.phone || '-'}</span>
          </div>
          <div className="flex justify-between text-[14px] py-2.5 border-b border-border-light">
            <span className="text-text-secondary">접수경로</span>
            <span className="text-text-primary font-medium">{inquiry.source}</span>
          </div>
          {inquiry.data && Object.keys(inquiry.data).length > 0 && (
            Object.entries(inquiry.data).map(([key, val]) => (
              <div key={key} className="flex justify-between text-[14px] py-2.5 border-b border-border-light last:border-b-0">
                <span className="text-text-secondary">{key}</span>
                <span className="text-text-primary font-medium">{String(val)}</span>
              </div>
            ))
          )}
        </div>

        {/* Status & Assignee */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="상태 변경"
            options={STATUS_OPTIONS}
            value={inquiry.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full"
          />
          <Select
            label="담당자 배정"
            options={staff.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="미배정"
            value={inquiry.assignee_id || ''}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Rental connection for jaramter inquiries */}
        {inquiry.type === 'jaramter_inquiry' && (
          <div className="bg-bg-muted rounded-xl p-4 border border-border/60">
            <h3 className="text-[13px] font-semibold text-text-primary mb-3">자람터 임대 연결</h3>
            {rental ? (
              <div className="space-y-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-text-secondary">농장</span>
                  <span className="text-primary font-semibold">{rental.farm?.number}번 {rental.farm?.name}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-text-secondary">기간</span>
                  <span className="text-text-primary">
                    {format(new Date(rental.start_date), 'yy.M.d')} ~ {format(new Date(rental.end_date), 'yy.M.d')}
                  </span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-text-secondary">월 결제액</span>
                  <span className="text-primary font-semibold">{rental.monthly_fee.toLocaleString()}원</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-[13px] text-text-tertiary mb-3">연결된 임대 계약 없음</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    window.location.href = `/dashboard/rentals/new?customerId=${inquiry.customer_id}`;
                  }}
                >
                  임대 계약 등록
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Add note */}
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1.5">메모 추가</label>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            placeholder="메모를 입력하세요..."
            className="w-full bg-bg-input border border-border rounded-xl px-3.5 py-3 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-150 resize-none"
          />
          <Button
            onClick={handleAddNote}
            variant="primary"
            size="sm"
            className="mt-2 w-full"
            disabled={saving || !newNote.trim()}
            loading={saving}
          >
            메모 저장
          </Button>
        </div>

        {/* Timeline */}
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary mb-4 border-t border-border pt-5">
            히스토리
          </h3>
          <NoteTimeline notes={notes} />
        </div>
      </div>
    </Drawer>
  );
}
