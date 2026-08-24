import React from 'react';
import i18next from 'i18next';
import { FileText, Download, BookOpen } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import type { MediaAttachment } from '@/types';

interface AttachmentItemProps {
  attachment: MediaAttachment;
  isCbz: boolean;
  onRead: () => void;
  onDownload: () => void;
}

const AttachmentItem: React.FC<AttachmentItemProps> = ({ attachment, isCbz, onRead, onDownload }) => {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        <FileText className="w-3.5 h-3.5 text-white/35" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white/70 truncate" title={attachment.original_name}>{attachment.original_name}</p>
        <p className="text-[10px] text-white/25">{formatFileSize(attachment.size_bytes)}</p>
      </div>

      {isCbz && (
        <button
          type="button"
          onClick={onRead}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400/70 hover:text-emerald-400 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          title={i18next.t('mangaReader.read')}
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        type="button"
        onClick={onDownload}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        title={i18next.t('mediaDetail.download')}
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default AttachmentItem;
