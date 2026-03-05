'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';
import TypeBadge from '@/components/inquiries/TypeBadge';
import StatusBadge from '@/components/inquiries/StatusBadge';
import NoteTimeline from '@/components/inquiries/NoteTimeline';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
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
    return (
      <div className="text-center py-20 text-text-muted">불러오는 중...</div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <button
        onClick={() => router.back()}
        className="text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        ← 목록으로
      </button>

      {/* Header */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <TypeBadge type={inquiry.type} />
          <StatusBadge status={inquiry.status} />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          {inquiry.customer?.name || '이름 없음'}
        </h1>
        <p className="text-sm text-text-muted">
          {format(new Date(inquiry.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })} 접수
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info */}
        <div className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-text-secondary mb-2">기본 정보</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">연락처</span>
              <span className="text-text-primary">{inquiry.customer?.phone || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">접수경로</span>
              <span className="text-text-primary">{inquiry.source}</span>
            </div>
            {inquiry.data && Object.entries(inquiry.data).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-text-muted">{k}</span>
                <span className="text-text-primary">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-text-secondary mb-2">관리</h2>
          <div>
            <label className="block text-xs text-text-muted mb-1">상태</label>
            <Select
              options={STATUS_OPTIONS}
              value={inquiry.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">담당자</label>
            <Select
              options={staff.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="미배정"
              value={inquiry.assignee_id || ''}
              onChange={(e) => handleAssignee(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Note form */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-medium text-text-secondary mb-3">메모 추가</h2>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          placeholder="메모를 입력하세요..."
          className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors resize-none mb-3"
        />
        <Button onClick={handleAddNote} variant="gold" size="sm" disabled={saving || !newNote.trim()}>
          {saving ? '저장 중...' : '메모 저장'}
        </Button>
      </div>

      {/* Timeline */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-medium text-text-secondary mb-4">히스토리</h2>
        <NoteTimeline notes={notes} />
      </div>
    </div>
  );
}
