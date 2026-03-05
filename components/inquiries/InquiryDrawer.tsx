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
import type { Inquiry, InquiryNote, Profile } from '@/types';

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

      if (inquiryRes.data) setInquiry(inquiryRes.data);
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

    // Auto-log status change
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('inquiry_notes').insert({
      inquiry_id: inquiry.id,
      author_id: user?.id,
      content: `상태 변경: ${oldStatus} → ${newStatus}`,
      note_type: 'status_change',
    });

    setInquiry({ ...inquiry, status: newStatus as Inquiry['status'] });
    toast.success('상태가 변경되었습니다');

    // Refresh notes
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
        <div className="text-center py-12 text-text-muted text-sm">
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
          <div className="flex items-center gap-3">
            <TypeBadge type={inquiry.type} />
            <StatusBadge status={inquiry.status} />
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl">
            ✕
          </button>
        </div>

        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {inquiry.customer?.name || '이름 없음'}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {format(new Date(inquiry.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
          </p>
        </div>

        {/* Basic info */}
        <div className="bg-bg-secondary rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">연락처</span>
            <span className="text-text-primary">{inquiry.customer?.phone || '-'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">접수경로</span>
            <span className="text-text-primary">{inquiry.source}</span>
          </div>
          {inquiry.data && Object.keys(inquiry.data).length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-text-muted mb-2">추가 데이터</p>
              {Object.entries(inquiry.data).map(([key, val]) => (
                <div key={key} className="flex justify-between text-sm mb-1">
                  <span className="text-text-muted">{key}</span>
                  <span className="text-text-primary">{String(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status change */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">상태 변경</label>
          <Select
            options={STATUS_OPTIONS}
            value={inquiry.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">담당자 배정</label>
          <Select
            options={staff.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="미배정"
            value={inquiry.assignee_id || ''}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Add note */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">메모 추가</label>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            placeholder="메모를 입력하세요..."
            className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors resize-none"
          />
          <Button
            onClick={handleAddNote}
            variant="gold"
            size="sm"
            className="mt-2"
            disabled={saving || !newNote.trim()}
          >
            {saving ? '저장 중...' : '메모 저장'}
          </Button>
        </div>

        {/* Timeline */}
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-4 border-t border-border pt-4">
            히스토리
          </h3>
          <NoteTimeline notes={notes} />
        </div>
      </div>
    </Drawer>
  );
}
