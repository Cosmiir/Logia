export interface Theme {
  id: string;
  name: string;
  gradient: string;        // CSS gradient pour le fond de l'app
  accent: string;          // Couleur principale (boutons, éléments actifs)
  accentDark: string;      // Variante foncée de l'accent (hover)
  accentRgb: string;       // Valeurs RGB de l'accent pour les opacités (ex: "217,70,239")
  cardBg: string;          // Fond des glass-cards
  cardBorder: string;      // Bordure des glass-cards
  isDark: boolean;         // true pour les thèmes sombres, false pour les thèmes clairs
}

export const THEMES: Theme[] = [
  {
    id: 'nebula',
    name: 'Nebula',
    gradient: 'linear-gradient(135deg, #1a0a2e 0%, #0d1117 50%, #0a1628 100%)',
    accent: '#a855f7',
    accentDark: '#9333ea',
    accentRgb: '168,85,247',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    isDark: true,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    gradient: 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #0a0d1f 100%)',
    accent: '#3b82f6',
    accentDark: '#2563eb',
    accentRgb: '59,130,246',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    isDark: true,
  },
  {
    id: 'ember',
    name: 'Ember',
    gradient: 'linear-gradient(135deg, #1a0a00 0%, #120800 50%, #1a0f05 100%)',
    accent: '#f97316',
    accentDark: '#ea6c0a',
    accentRgb: '249,115,22',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,180,100,0.08)',
    isDark: true,
  },
  {
    id: 'forest',
    name: 'Forest',
    gradient: 'linear-gradient(135deg, #021a0a 0%, #010d05 50%, #021408 100%)',
    accent: '#10b981',
    accentDark: '#059669',
    accentRgb: '16,185,129',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(100,255,150,0.08)',
    isDark: true,
  },
  {
    id: 'arctic',
    name: 'Arctic',
    gradient: 'linear-gradient(135deg, #e8f4f8 0%, #f0f8ff 50%, #e8f0f8 100%)',
    accent: '#0891b2',
    accentDark: '#0e7490',
    accentRgb: '8,145,178',
    cardBg: 'rgba(0,0,0,0.04)',
    cardBorder: 'rgba(0,0,0,0.08)',
    isDark: false,
  },
];

export const DEFAULT_THEME_ID = 'nebula';
