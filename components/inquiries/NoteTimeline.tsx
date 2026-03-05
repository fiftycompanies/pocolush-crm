'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { InquiryNote } from '@/types';

const noteIcons: Record<string, string> = {
  memo: '📝',
  call: '📞',
  visit: '🏠',
  status_change: '🔄',
};

export default function NoteTimeline({ notes }: { notes: InquiryNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-text-muted text-sm text-center py-8">
        아직 기록이 없습니다
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <div key={note.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="text-lg">{noteIcons[note.note_type] || '📝'}</span>
            <div className="w-px flex-1 bg-border mt-2" />
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-medium text-text-primary">
                {note.author?.name || '시스템'}
              </span>
              <span className="text-xs text-text-muted">
                {format(new Date(note.created_at), 'M월 d일 HH:mm', { locale: ko })}
              </span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {note.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
