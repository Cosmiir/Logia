/* ================================================================== */
/*  Default avatar definitions — styled character-like avatars          */
/*  Each has a unique gradient background + geometric face/shape        */
/* ================================================================== */

export interface DefaultAvatar {
  id: string;
  label: string;
  bgGradient: string;
  svg: string;
}

export const DEFAULT_AVATARS: DefaultAvatar[] = [
  {
    id: 'default-1',
    label: 'Nova',
    bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    svg: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="45" r="22" fill="white" opacity="0.9"/>
      <circle cx="52" cy="42" r="3" fill="#334155"/>
      <circle cx="68" cy="42" r="3" fill="#334155"/>
      <path d="M54 52 Q60 58 66 52" stroke="#334155" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M38 30 Q60 10 82 30" fill="white" opacity="0.7"/>
      <rect x="30" y="75" rx="15" width="60" height="40" fill="white" opacity="0.85"/>
    </svg>`,
  },
  {
    id: 'default-2',
    label: 'Blaze',
    bgGradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    svg: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="45" r="22" fill="white" opacity="0.9"/>
      <circle cx="52" cy="42" r="3.5" fill="#334155"/>
      <circle cx="68" cy="42" r="3.5" fill="#334155"/>
      <path d="M53 53 L60 50 L67 53" stroke="#334155" stroke-width="2" fill="none" stroke-linecap="round"/>
      <polygon points="60,8 55,28 65,28" fill="white" opacity="0.7"/>
      <polygon points="48,12 50,28 42,25" fill="white" opacity="0.5"/>
      <polygon points="72,12 70,28 78,25" fill="white" opacity="0.5"/>
      <rect x="30" y="75" rx="15" width="60" height="40" fill="white" opacity="0.85"/>
    </svg>`,
  },
  {
    id: 'default-3',
    label: 'Ocean',
    bgGradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    svg: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="45" r="22" fill="white" opacity="0.9"/>
      <ellipse cx="52" cy="43" rx="4" ry="3" fill="#334155"/>
      <ellipse cx="68" cy="43" rx="4" ry="3" fill="#334155"/>
      <circle cx="52" cy="42" r="1.2" fill="white"/>
      <circle cx="68" cy="42" r="1.2" fill="white"/>
      <path d="M56 53 Q60 56 64 53" stroke="#334155" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M36 35 Q38 20 50 25" stroke="white" stroke-width="4" fill="none" opacity="0.7" stroke-linecap="round"/>
      <path d="M84 35 Q82 20 70 25" stroke="white" stroke-width="4" fill="none" opacity="0.7" stroke-linecap="round"/>
      <rect x="30" y="75" rx="15" width="60" height="40" fill="white" opacity="0.85"/>
    </svg>`,
  },
  {
    id: 'default-4',
    label: 'Ember',
    bgGradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    svg: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="45" r="22" fill="white" opacity="0.9"/>
      <line x1="46" y1="40" x2="56" y2="42" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
      <line x1="74" y1="40" x2="64" y2="42" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
      <circle cx="52" cy="46" r="2.5" fill="#334155"/>
      <circle cx="68" cy="46" r="2.5" fill="#334155"/>
      <path d="M55 54 Q60 59 65 54" stroke="#334155" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="60" cy="28" rx="18" ry="8" fill="white" opacity="0.6"/>
      <rect x="30" y="75" rx="15" width="60" height="40" fill="white" opacity="0.85"/>
    </svg>`,
  },
  {
    id: 'default-5',
    label: 'Sage',
    bgGradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    svg: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="47" r="22" fill="white" opacity="0.9"/>
      <circle cx="53" cy="44" r="2.5" fill="#334155"/>
      <circle cx="67" cy="44" r="2.5" fill="#334155"/>
      <path d="M56 54 Q60 52 64 54" stroke="#334155" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <rect x="42" y="30" rx="3" width="36" height="10" fill="white" opacity="0.7"/>
      <circle cx="44" cy="52" r="4" fill="white" opacity="0.3"/>
      <circle cx="76" cy="52" r="4" fill="white" opacity="0.3"/>
      <rect x="30" y="77" rx="15" width="60" height="40" fill="white" opacity="0.85"/>
    </svg>`,
  },
  {
    id: 'default-6',
    label: 'Cosmos',
    bgGradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    svg: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="45" r="22" fill="white" opacity="0.9"/>
      <circle cx="53" cy="42" r="3" fill="#334155"/>
      <circle cx="67" cy="42" r="3" fill="#334155"/>
      <circle cx="54" cy="41" r="1" fill="white"/>
      <circle cx="68" cy="41" r="1" fill="white"/>
      <path d="M55 52 Q60 57 65 52" stroke="#334155" stroke-width="2" fill="#334155" opacity="0.6"/>
      <circle cx="42" cy="48" r="4" fill="white" opacity="0.25"/>
      <circle cx="78" cy="48" r="4" fill="white" opacity="0.25"/>
      <path d="M40 28 Q60 15 80 28" fill="white" opacity="0.6"/>
      <rect x="30" y="75" rx="15" width="60" height="40" fill="white" opacity="0.85"/>
    </svg>`,
  },
];

/**
 * Get a default avatar by its ID.
 */
export function getDefaultAvatar(id: string): DefaultAvatar | undefined {
  return DEFAULT_AVATARS.find((a) => a.id === id);
}
