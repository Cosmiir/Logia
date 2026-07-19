/**
 * Unified rating color system
 * Provides consistent colors across the entire application
 */
export const getRatingColor = (rating: number | null): string => {
  if (rating === null || rating === undefined) {
    return 'rgba(255,255,255,0.15)';
  }
  if (rating >= 95) return '#06b6d4';   // turquoise  - Chef-d'œuvre (95-100)
  if (rating >= 90) return '#22c55e';   // green      - Parfait      (90-94)
  if (rating >= 85) return '#84cc16';   // lime       - Excellent    (85-89)
  if (rating >= 80) return '#a3e635';   // light lime - Très bon     (80-84)
  if (rating >= 75) return '#facc15';   // yellow     - Bien         (75-79)
  if (rating >= 70) return '#f59e0b';   // amber      - Bon          (70-74)
  if (rating >= 60) return '#f97316';   // orange     - Assez bon    (60-69)
  if (rating >= 50) return '#ef4444';   // red        - Moyen        (50-59)
  if (rating >= 40) return '#dc2626';   // darker red - Passable     (40-49)
  if (rating >= 20) return '#991b1b';   // dark red   - Mauvais      (20-39)
  return '#4a0d0d';                     // very dark  - Nul          (0-19)
};

/**
 * Get rating color with opacity for backgrounds/gradients
 */
export const getRatingColorWithOpacity = (rating: number | null, opacity: number = 0.8): string => {
  if (rating === null || rating === undefined) {
    return 'rgba(255,255,255,0.08)';
  }
  const color = getRatingColor(rating);
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Get rating category label for UI display
 */
export const getRatingCategory = (rating: number | null): string => {
  if (rating === null || rating === undefined) return 'Non noté';
  if (rating >= 95) return "Chef-d'œuvre";
  if (rating >= 90) return 'Parfait';
  if (rating >= 85) return 'Excellent';
  if (rating >= 80) return 'Très bon';
  if (rating >= 75) return 'Bien';
  if (rating >= 70) return 'Bon';
  if (rating >= 60) return 'Assez bon';
  if (rating >= 50) return 'Moyen';
  if (rating >= 40) return 'Passable';
  if (rating >= 20) return 'Mauvais';
  return 'Nul';
};