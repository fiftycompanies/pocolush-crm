'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import TypeBadge from '@/components/inquiries/TypeBadge';
import StatusBadge from '@/components/inquiries/StatusBadge';
import NoteTimeline from '@/components/inquiries/NoteTimeline';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { STATUS_OPTIONS } from '@/lib/constants';
import type { Inquiry, InquiryNote, Profile } from '@/types';

export default function InquiryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const id = params.id as string;

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [notes, setNotes] = useState<InquiryNote[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [inqRes, notesRes, staffRes] = await Promise.all([
      supabase
        .from('inquiries')
        .select('*, customer:customers(*), assignee:profiles(*)')
        .eq('id', id)
        .single(),
      supabase
        .from('inquiry_notes')
        .select('*, author:profiles(*)')
        .eq('inquiry_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);
    if (inqRes.data) setInquiry(inqRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (staffRes.data) setStaff(staffRes.data);
  };

  useEffect(() => {
    fetchData();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (newStatus: string) => {
    if (!inquiry) return;
    const old = inquiry.status;
    await supabase.from('inquiries').update({ status: newStatus }).eq('id', id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('inquiry_notes').insert({
      inquiry_id: id,
      author_id: user?.id,
      content: `상태 변경: ${old} → ${newStatus}`,
      note_type: 'status_change',
    });
    toast.success('상태가 변경되었습니다');
    fetchData();
  };

  const handleAssignee = async (assigneeId: string) => {
    await supabase.from('inquiries').update({ assignee_id: assigneeId || null }).eq('id', id);
    toast.success('담당자가 배정되었습니다');
    fetchData();
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('inquiry_notes').insert({
      inquiry_id: id,
      author_id: user?.id,
      content: newNote.trim(),
      note_type: 'memo',
    });
    setNewNote('');
    toast.success('메모가 저장되었습니다');
    fetchData();
    setSaving(false);
  };

  if (!inquiry) {
    return <div className="text-center py-20 text-text-tertiary">불러오는 중...</div>;
  }

  return (
    <div className="max-w-4xl space-y-5">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-text-primary transition-colors duration-150 cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
        목록으로
      </button>

      {/* Header */}
      <Card>
        <div className="flex items-center gap-2.5 mb-3">
          <TypeBadge type={inquiry.type} />
          <StatusBadge status={inquiry.status} />
        </div>
        <h1 className="text-[20px] font-bold text-text-primary tracking-tight">
          {inquiry.customer?.name || '이름 없음'}
        </h1>
        <p className="text-[14px] text-text-secondary mt-0.5">
          {format(new Date(inquiry.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })} 접수
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info */}
        <Card>
          <h2 className="text-[14px] font-semibold text-text-primary mb-4">기본 정보</h2>
          <div className="bg-bg-muted rounded-xl p-4 space-y-0">
            <div className="flex justify-between text-[14px] py-2.5 border-b border-border-light">
              <span className="text-text-secondary">연락처</span>
              <span className="text-text-primary font-medium">{inquiry.customer?.phone || '-'}</span>
            </div>
            <div className="flex justify-between text-[14px] py-2.5 border-b border-border-light last:border-b-0">
              <span className="text-text-secondary">접수경로</span>
              <span className="text-text-primary font-medium">{inquiry.source}</span>
            </div>
            {inquiry.data && Object.entries(inquiry.data).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[14px] py-2.5 border-b border-border-light last:border-b-0">
                <span className="text-text-secondary">{k}</span>
                <span className="text-text-primary font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <Card>
          <h2 className="text-[14px] font-semibold text-text-primary mb-4">관리</h2>
          <div className="space-y-4">
            <Select
              label="상태"
              options={STATUS_OPTIONS}
              value={inquiry.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full"
            />
            <Select
              label="담당자"
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="미배정"
              value={inquiry.assignee_id || ''}
              onChange={(e) => handleAssignee(e.target.value)}
              className="w-full"
            />
          </div>
        </Card>
      </div>

      {/* Note form */}
      <Card>
        <h2 className="text-[14px] font-semibold text-text-primary mb-3">메모 추가</h2>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          placeholder="메모를 입력하세요..."
          className="w-full bg-bg-input border border-border rounded-xl px-3.5 py-3 text-[14px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-150 resize-none mb-3"
        />
        <Button onClick={handleAddNote} variant="primary" size="sm" disabled={saving || !newNote.trim()} loading={saving}>
          메모 저장
        </Button>
      </Card>

      {/* Timeline */}
      <Card>
        <h2 className="text-[14px] font-semibold text-text-primary mb-4">히스토리</h2>
        <NoteTimeline notes={notes} />
      </Card>
    </div>
  );
}
