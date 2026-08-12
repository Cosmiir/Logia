import type { Update } from '@tauri-apps/plugin-updater';
import type { UpdateStatus } from '@/hooks/useUpdateCheck';

export interface UpdateModalProps {
  open: boolean;
  status: UpdateStatus;
  update: Update | null;
  error: string | null;
  progress: number;
  onInstall: () => void;
  onDownloadManual?: () => void;
  onIgnore: () => void;
  onSkipVersion: () => void;
  onClose: () => void;
}
