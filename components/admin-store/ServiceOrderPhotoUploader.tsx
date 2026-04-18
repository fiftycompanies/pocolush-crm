'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadServiceOrderPhoto } from '@/lib/upload-service-photo';
import { auditLog } from '@/lib/audit-log';

interface Props {
  serviceOrderId: string;
  onUploaded: () => void;
}

interface PendingFile {
  file: File;
  previewUrl: string;
  caption: string;
  state: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export default function ServiceOrderPhotoUploader({ serviceOrderId, onUploaded }: Props) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
    if (selected.length === 0) return;
    setFiles(prev => [
      ...prev,
      ...selected.map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        caption: '',
        state: 'pending' as const,
      })),
    ]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removePending = (idx: number) => {
    setFiles(prev => {
      const item = prev[idx];
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateCaption = (idx: number, caption: string) => {
    setFiles(prev => prev.map((f, i) => (i === idx ? { ...f, caption } : f)));
  };

  const handleUploadAll = async () => {
    const targets = files.filter(f => f.state !== 'done');
    if (targets.length === 0) return;
    setBusy(true);

    let uploadedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.state === 'done') continue;
      setFiles(prev => prev.map((x, idx) => (idx === i ? { ...x, state: 'uploading' } : x)));
      const res = await uploadServiceOrderPhoto(serviceOrderId, f.file, f.caption || undefined);
      if ('error' in res) {
        setFiles(prev => prev.map((x, idx) => (idx === i ? { ...x, state: 'error', error: res.error } : x)));
      } else {
        uploadedCount++;
        setFiles(prev => prev.map((x, idx) => (idx === i ? { ...x, state: 'done' } : x)));
        await auditLog({
          action: 'upload_service_photo',
          resource_type: 'service_order_photo',
          resource_id: res.id,
          metadata: { service_order_id: serviceOrderId },
        });
      }
    }

    setBusy(false);
    if (uploadedCount > 0) {
      toast.success(`${uploadedCount}장 업로드 완료`);
      onUploaded();
      // done 항목 제거 (에러는 남겨서 재시도 가능)
      setFiles(prev => prev.filter(f => f.state !== 'done'));
    }
  };

  const errorCount = files.filter(f => f.state === 'error').length;
  const pendingCount = files.filter(f => f.state === 'pending').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-border rounded-lg text-sm hover:bg-accent/50 disabled:opacity-50"
        >
          <Upload className="size-4" /> 사진 선택
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelect}
          className="hidden"
        />
        {files.length > 0 && (
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={busy || pendingCount === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? '업로드 중...' : `${pendingCount}장 업로드`}
          </button>
        )}
        {errorCount > 0 && (
          <span className="text-[11px] text-red-600">{errorCount}장 실패 — 재시도 가능</span>
        )}
      </div>

      <p className="text-[11px] text-text-tertiary">
        ⚠️ 민감한 개인정보가 담긴 사진은 업로드하지 마세요 (공개 bucket).
      </p>

      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-2">
          {files.map((f, i) => (
            <li key={i} className="border border-border rounded-lg p-2 space-y-2">
              <div className="relative">
                <img
                  src={f.previewUrl}
                  alt={`preview ${i}`}
                  className="w-full h-32 object-cover rounded"
                />
                <button
                  type="button"
                  onClick={() => removePending(i)}
                  disabled={busy}
                  className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-black/80"
                >
                  <X className="size-3" />
                </button>
                <span
                  className={`absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded ${
                    f.state === 'done'
                      ? 'bg-emerald-500 text-white'
                      : f.state === 'error'
                      ? 'bg-red-500 text-white'
                      : f.state === 'uploading'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700/80 text-white'
                  }`}
                >
                  {f.state === 'done'
                    ? '✓'
                    : f.state === 'error'
                    ? '실패'
                    : f.state === 'uploading'
                    ? '업로드 중'
                    : '대기'}
                </span>
              </div>
              <input
                type="text"
                value={f.caption}
                onChange={e => updateCaption(i, e.target.value)}
                disabled={busy || f.state === 'done'}
                placeholder="캡션 (선택)"
                className="w-full text-xs px-2 py-1 border border-border rounded"
              />
              {f.error && <p className="text-[10px] text-red-600">{f.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
