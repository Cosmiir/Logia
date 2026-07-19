/**
 * Performance Logger pour Logia
 * Utilitaire de logging pour auditer les performances de l'application
 */

import React from 'react';

// Toggle global pour activer/désactiver les logs (peut être contrôlé par env var)
const PERF_LOGS_ENABLED = import.meta.env.VITE_PERF_LOGS_ENABLED === 'true' || import.meta.env.DEV;

// Colors pour les logs console
const COLORS = {
  render: '#22c55e',      // green
  query: '#3b82f6',      // blue
  scroll: '#f59e0b',     // amber
  resize: '#ef4444',     // red
  state: '#8b5cf6',      // purple
  backend: '#06b6d4',    // cyan
  memo: '#ec4899',       // pink
};

/**
 * Logger les temps de rendu des composants
 */
export function logRender(componentName: string, renderTime: number, additionalInfo?: Record<string, unknown>) {
  if (!PERF_LOGS_ENABLED) return;
  
  const style = `color: ${COLORS.render}; font-weight: bold`;
  console.log(
    `%c[RENDER] ${componentName}`,
    style,
    `${renderTime.toFixed(2)}ms`,
    additionalInfo || ''
  );
}

/**
 * Logger les requêtes TanStack Query
 */
export function logQuery(queryKey: string[], duration: number, cacheStatus: 'fresh' | 'stale' | 'fetching', additionalInfo?: Record<string, unknown>) {
  if (!PERF_LOGS_ENABLED) return;
  
  const style = `color: ${COLORS.query}; font-weight: bold`;
  const statusStyle = cacheStatus === 'fresh' ? 'color: #22c55e' : cacheStatus === 'stale' ? 'color: #f59e0b' : 'color: #3b82f6';
  
  console.log(
    `%c[QUERY] ${queryKey.join(' > ')}`,
    style,
    `${duration.toFixed(2)}ms`,
    `%c[${cacheStatus}]`,
    statusStyle,
    additionalInfo || ''
  );
}

/**
 * Logger les events scroll (throttled)
 */
let lastScrollLog = 0;
const SCROLL_LOG_THROTTLE = 100; // ms

export function logScroll(page: string, scrollPosition: number, direction?: 'up' | 'down') {
  if (!PERF_LOGS_ENABLED) return;
  
  const now = performance.now();
  if (now - lastScrollLog < SCROLL_LOG_THROTTLE) return;
  lastScrollLog = now;
  
  const style = `color: ${COLORS.scroll}; font-weight: bold`;
  console.log(
    `%c[SCROLL] ${page}`,
    style,
    `position: ${scrollPosition.toFixed(0)}px`,
    direction ? `direction: ${direction}` : ''
  );
}

/**
 * Logger les triggers du ResizeObserver
 */
let lastResizeLog = 0;
const RESIZE_LOG_THROTTLE = 200; // ms

export function logResizeObserver(componentName: string, triggerCount: number, timeSinceLast?: number) {
  if (!PERF_LOGS_ENABLED) return;
  
  const now = performance.now();
  if (now - lastResizeLog < RESIZE_LOG_THROTTLE) return;
  lastResizeLog = now;
  
  const style = `color: ${COLORS.resize}; font-weight: bold`;
  console.log(
    `%c[RESIZE] ${componentName}`,
    style,
    `triggers: ${triggerCount}`,
    timeSinceLast ? `since last: ${timeSinceLast.toFixed(0)}ms` : ''
  );
}

/**
 * Logger les changements de state importants
 */
export function logStateChange(componentName: string, stateName: string, oldValue: unknown, newValue: unknown) {
  if (!PERF_LOGS_ENABLED) return;
  
  const style = `color: ${COLORS.state}; font-weight: bold`;
  console.log(
    `%c[STATE] ${componentName}.${stateName}`,
    style,
    { oldValue, newValue }
  );
}

/**
 * Logger les appels backend
 */
export function logBackend(command: string, duration: number, additionalInfo?: Record<string, unknown>) {
  if (!PERF_LOGS_ENABLED) return;
  
  const style = `color: ${COLORS.backend}; font-weight: bold`;
  console.log(
    `%c[BACKEND] ${command}`,
    style,
    `${duration.toFixed(2)}ms`,
    additionalInfo || ''
  );
}

/**
 * Logger les re-renders de composants memoïzés
 */
export function logMemoRender(componentName: string, reason: 'props changed' | 'parent re-render', props?: Record<string, unknown>) {
  if (!PERF_LOGS_ENABLED) return;
  
  const style = `color: ${COLORS.memo}; font-weight: bold`;
  console.log(
    `%c[MEMO] ${componentName}`,
    style,
    reason,
    props ? '' : ''
  );
}

/**
 * Logger les changements de page
 */
export function logPageChange(fromPage: string, toPage: string, duration?: number) {
  if (!PERF_LOGS_ENABLED) return;
  
  const style = `color: ${COLORS.render}; font-weight: bold`;
  console.log(
    `%c[PAGE] ${fromPage} → ${toPage}`,
    style,
    duration ? `${duration.toFixed(2)}ms` : ''
  );
}

/**
 * Logger les temps de chargement des ressources
 */
export function logResourceLoad(resourceType: string, url: string, duration: number, size?: number) {
  if (!PERF_LOGS_ENABLED) return;
  
  const style = `color: ${COLORS.query}; font-weight: bold`;
  console.log(
    `%c[RESOURCE] ${resourceType}`,
    style,
    url,
    `${duration.toFixed(2)}ms`,
    size ? `size: ${(size / 1024).toFixed(2)}KB` : ''
  );
}

/**
 * Mesurer le temps d'exécution d'une fonction
 */
export function measurePerformance<T>(name: string, fn: () => T): T {
  if (!PERF_LOGS_ENABLED) return fn();
  
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  console.log(
    `%c[PERF] ${name}`,
    `color: ${COLORS.render}; font-weight: bold`,
    `${(end - start).toFixed(2)}ms`
  );
  
  return result;
}

/**
 * Wrapper pour les useEffect avec logging de temps
 */
export function useEffectWithLog(
  effect: () => void | (() => void),
  deps: unknown[],
  componentName: string,
  effectName: string
) {
  if (!PERF_LOGS_ENABLED) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return React.useEffect(effect, deps);
  }
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    const start = performance.now();
    const cleanup = effect();
    const end = performance.now();
    
    const style = `color: ${COLORS.render}; font-weight: bold`;
    console.log(
      `%c[EFFECT] ${componentName}.${effectName}`,
      style,
      `${(end - start).toFixed(2)}ms`,
      deps
    );
    
    return cleanup;
  }, deps);
}

/**
 * Hook personnalisé pour logger les re-renders
 */
export function useRenderLog(componentName: string, additionalInfo?: Record<string, unknown>) {
  if (!PERF_LOGS_ENABLED) return;
  
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(performance.now());
  
  React.useEffect(() => {
    renderCount.current += 1;
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    logRender(
      componentName,
      timeSinceLastRender,
      {
        renderCount: renderCount.current,
        ...additionalInfo,
      }
    );
  });
}

export { PERF_LOGS_ENABLED };
