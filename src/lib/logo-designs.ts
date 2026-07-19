import type { LogoVariant } from '@/stores/useSettingsStore';

export interface LogoDesign {
  id: LogoVariant;
  name: string;
  description: string;
}

export const logoDesigns: LogoDesign[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Le x glass standard',
  },
  {
    id: 'glow',
    name: 'Glow',
    description: 'Hover avec lueur neon',
  },
  {
    id: 'split',
    name: 'Split',
    description: 'Espacement large',
  },
  {
    id: 'tight',
    name: 'Tight',
    description: 'Compact sans espacement',
  },
  {
    id: 'dot',
    name: 'Dot',
    description: 'Point glass au lieu du x',
  },
  {
    id: 'fade',
    name: 'Fade',
    description: 'MEDIA en fondu subtil',
  },
];
