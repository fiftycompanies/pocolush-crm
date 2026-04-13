'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { InquiryNote } from '@/types';

const noteColors: Record<string, string> = {
  memo: '#3B82F6',
  call: '#10B981',
  visit: '#8B5CF6',
  status_change: '#F59E0B',
};

export default function NoteTimeline({ notes }: { notes: InquiryNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-text-tertiary text-[13px] text-center py-8">
        아직 기록이 없습니다
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {notes.map((note, i) => {
        const color = noteColors[note.note_type] || '#64748B';
        return (
          <div key={note.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="w-2.5 h-2.5 rounded-full mt-1.5 ring-2 ring-white"
                style={{ backgroundColor: color }}
              />
              {i < notes.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>
            <div className="flex-1 pb-5">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[13px] font-semibold text-text-primary">
                  {note.author?.name || '시스템'}
                </span>
                <span className="text-[11px] text-text-tertiary">
                  {format(new Date(note.created_at), 'M월 d일 HH:mm', { locale: ko })}
                </span>
              </div>
              <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
