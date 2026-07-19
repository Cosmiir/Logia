import React, { useEffect, useRef, useState } from 'react';
import { 
  Heart, 
  Play, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Trash2, 
  Share2, 
  Info
} from 'lucide-react';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface MediaContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  actions: ContextMenuAction[];
}

export const MediaContextMenu: React.FC<MediaContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  actions
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Set position immediately to avoid flash
      setPosition({ x, y });
      setIsPositioned(false);
      
      // Use requestAnimationFrame to adjust position if needed
      requestAnimationFrame(() => {
        if (menuRef.current) {
          const menu = menuRef.current;
          const rect = menu.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          let newX = x;
          let newY = y;

          // Adjust if menu goes off right edge
          if (x + rect.width > viewportWidth) {
            newX = viewportWidth - rect.width - 10;
          }

          // Adjust if menu goes off bottom edge
          if (y + rect.height > viewportHeight) {
            newY = viewportHeight - rect.height - 10;
          }

          setPosition({ x: newX, y: newY });
          setIsPositioned(true);
        }
      });
    } else {
      // Reset when closing to prevent flash on next open
      setIsPositioned(false);
    }
  }, [isOpen, x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 min-w-[180px] py-1.5 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl transition-opacity duration-150 ${
        isPositioned ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ left: position.x, top: position.y }}
    >
      {actions.map((action, index) => {
        const Icon = action.icon;
        const showDivider = action.variant === 'danger' && index > 0;

        return (
          <React.Fragment key={action.id}>
            {showDivider && (
              <div className="my-1 border-t border-white/10"></div>
            )}
            <button
              onClick={() => {
                action.onClick();
                onClose();
              }}
              disabled={action.disabled}
              className={`
                w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors duration-150
                ${action.disabled 
                  ? 'text-slate-500 cursor-not-allowed' 
                  : action.variant === 'danger'
                    ? 'text-red-400 hover:bg-red-500/20'
                    : 'text-slate-200 hover:bg-white/10'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{action.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Hook pour gérer le menu contextuel
export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    mediaId?: number;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    mediaId: undefined
  });

  const openContextMenu = (e: React.MouseEvent, mediaId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      mediaId
    });
  };

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu
  };
};

// Actions par défaut pour les médias
export const getDefaultMediaActions = (
  _mediaId: number,
  isFavorite: boolean,
  status: string,
  callbacks: {
    onToggleFavorite?: () => void;
    onChangeStatus?: (status: string) => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onShare?: () => void;
    onViewDetails?: () => void;
  }
): ContextMenuAction[] => {
  const actions: ContextMenuAction[] = [
    {
      id: 'favorite',
      label: isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris',
      icon: Heart,
      onClick: callbacks.onToggleFavorite || (() => {})
    },
    {
      id: 'details',
      label: 'Voir les détails',
      icon: Info,
      onClick: callbacks.onViewDetails || (() => {})
    }
  ];

  // Status actions based on current status
  if (status !== 'IN_PROGRESS') {
    actions.push({
      id: 'start',
      label: 'Marquer en cours',
      icon: Play,
      onClick: () => callbacks.onChangeStatus?.('IN_PROGRESS')
    });
  }

  if (status !== 'COMPLETED') {
    actions.push({
      id: 'complete',
      label: 'Marquer terminé',
      icon: CheckCircle,
      onClick: () => callbacks.onChangeStatus?.('COMPLETED')
    });
  }

  if (status !== 'ABANDONED') {
    actions.push({
      id: 'abandon',
      label: 'Marquer abandonné',
      icon: XCircle,
      onClick: () => callbacks.onChangeStatus?.('ABANDONED')
    });
  }

  actions.push(
    {
      id: 'edit',
      label: 'Modifier',
      icon: Edit,
      onClick: callbacks.onEdit || (() => {})
    },
    {
      id: 'share',
      label: 'Partager',
      icon: Share2,
      onClick: callbacks.onShare || (() => {})
    },
    {
      id: 'delete',
      label: 'Supprimer',
      icon: Trash2,
      onClick: callbacks.onDelete || (() => {}),
      variant: 'danger'
    }
  );

  return actions;
};

export default MediaContextMenu;
