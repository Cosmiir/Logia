import React, { useState, useLayoutEffect, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Zap,
  Trophy,
  MousePointerClick,
  Rocket,
  FolderPlus,
  Film,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTutorialStore, TUTORIAL_STEPS, type TutorialPhase } from '@/stores/useTutorialStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface SpotlightState {
  mainRect: Rect;
  portalRects: Rect[];
  combinedBoundingRect: Rect;
  // Each inner array is one visually-connected cluster of target rects.
  // length === 1 -> render as a plain rounded rect (existing div styling).
  // length > 1   -> touching/overlapping rects; render as one exact
  //                 rectilinear-union outline (handles L-shapes) instead of
  //                 a lossy bounding box.
  renderGroups: Rect[][];
}

const PADDING = 8;
// Extra slack (px) used only to DECIDE whether two boxes are touching/overlapping
// closely enough to be treated as one visual cluster. It does not change the
// size of any rect that actually gets drawn.
const MERGE_TOLERANCE = 4;

const rectsShouldMerge = (a: Rect, b: Rect, tolerance = MERGE_TOLERANCE): boolean => {
  return !(
    a.left + a.width + tolerance <= b.left ||
    b.left + b.width + tolerance <= a.left ||
    a.top + a.height + tolerance <= b.top ||
    b.top + b.height + tolerance <= a.top
  );
};

// Groups rects into connected clusters (transitively) based on rectsShouldMerge.
// Purely topological — doesn't compute any bounding box, so there's no risk of
// a cluster's shape drifting away from the rects that actually make it up.
const groupOverlappingRects = (rects: Rect[]): Rect[][] => {
  const groups: Rect[][] = rects.map((r) => [r]);
  let mergedAny = true;
  while (mergedAny) {
    mergedAny = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const touching = groups[i].some((a) => groups[j].some((b) => rectsShouldMerge(a, b)));
        if (touching) {
          groups.push([...groups[i], ...groups[j]]);
          groups.splice(j, 1);
          groups.splice(i, 1);
          mergedAny = true;
          break outer;
        }
      }
    }
  }
  return groups;
};

// Computes the EXACT outline polygon of the union of a cluster of rects, via
// grid decomposition: slice the plane along every rect edge, mark which cells
// fall inside at least one rect, then trace the boundary of the covered cells.
// Unlike a bounding box, this naturally produces an L/T/plus-shaped outline
// when the rects don't line up — no wasted area, ever. Assumes the cluster is
// simply connected (true for touching/overlapping UI elements; no holes).
const buildUnionPolygon = (rects: Rect[]): Point[] => {
  if (rects.length === 1) {
    const r = rects[0];
    return [
      { x: r.left, y: r.top },
      { x: r.left + r.width, y: r.top },
      { x: r.left + r.width, y: r.top + r.height },
      { x: r.left, y: r.top + r.height },
    ];
  }

  const xsSet = new Set<number>();
  const ysSet = new Set<number>();
  rects.forEach((r) => {
    xsSet.add(r.left);
    xsSet.add(r.left + r.width);
    ysSet.add(r.top);
    ysSet.add(r.top + r.height);
  });
  const xs = Array.from(xsSet).sort((a, b) => a - b);
  const ys = Array.from(ysSet).sort((a, b) => a - b);
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  if (nx <= 0 || ny <= 0) return [];

  const covered: boolean[][] = Array.from({ length: ny }, () => new Array(nx).fill(false));
  for (let j = 0; j < ny; j++) {
    const cy = (ys[j] + ys[j + 1]) / 2;
    for (let i = 0; i < nx; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      covered[j][i] = rects.some((r) => cx > r.left && cx < r.left + r.width && cy > r.top && cy < r.top + r.height);
    }
  }

  // Boundary edges, each pointing so the covered region stays on its right
  // (clockwise walk) — this keeps the traced loop consistently oriented.
  type Edge = { x1: number; y1: number; x2: number; y2: number };
  const edges: Edge[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!covered[j][i]) continue;
      if (j === 0 || !covered[j - 1][i]) edges.push({ x1: xs[i], y1: ys[j], x2: xs[i + 1], y2: ys[j] });
      if (i === nx - 1 || !covered[j][i + 1]) edges.push({ x1: xs[i + 1], y1: ys[j], x2: xs[i + 1], y2: ys[j + 1] });
      if (j === ny - 1 || !covered[j + 1][i]) edges.push({ x1: xs[i + 1], y1: ys[j + 1], x2: xs[i], y2: ys[j + 1] });
      if (i === 0 || !covered[j][i - 1]) edges.push({ x1: xs[i], y1: ys[j + 1], x2: xs[i], y2: ys[j] });
    }
  }
  if (edges.length === 0) return [];

  const startMap = new Map<string, number[]>();
  edges.forEach((e, idx) => {
    const k = `${e.x1},${e.y1}`;
    if (!startMap.has(k)) startMap.set(k, []);
    startMap.get(k)!.push(idx);
  });

  const used = new Array(edges.length).fill(false);
  used[0] = true;
  const start: Point = { x: edges[0].x1, y: edges[0].y1 };
  let current: Point = { x: edges[0].x2, y: edges[0].y2 };
  const rawPoints: Point[] = [start, current];

  let safety = 0;
  while (!(current.x === start.x && current.y === start.y) && safety < edges.length + 5) {
    safety++;
    const candidates = startMap.get(`${current.x},${current.y}`) || [];
    const nextIdx = candidates.find((idx) => !used[idx]);
    if (nextIdx === undefined) break;
    used[nextIdx] = true;
    current = { x: edges[nextIdx].x2, y: edges[nextIdx].y2 };
    rawPoints.push(current);
  }

  // Drop the redundant closing point, then collapse collinear runs.
  const loop = rawPoints.slice(0, -1);
  const n = loop.length;
  if (n < 4) return loop;
  const simplified: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n];
    const cur = loop[i];
    const next = loop[(i + 1) % n];
    const collinear = (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y);
    if (!collinear) simplified.push(cur);
  }
  return simplified.length >= 4 ? simplified : loop;
};

// Turns a rectilinear polygon into a rounded SVG path (quadratic-bezier corner
// cuts), clamping the radius per-vertex so short edges never overshoot.
const buildRoundedPolygonPath = (points: Point[], radius: number): string => {
  const n = points.length;
  if (n < 3) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const p = points[i];
    const next = points[(i + 1) % n];
    const distPrev = Math.hypot(p.x - prev.x, p.y - prev.y);
    const distNext = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius, distPrev / 2, distNext / 2);

    const inLen = distPrev || 1;
    const inPoint: Point = { x: p.x - ((p.x - prev.x) / inLen) * r, y: p.y - ((p.y - prev.y) / inLen) * r };
    const outLen = distNext || 1;
    const outPoint: Point = { x: p.x + ((next.x - p.x) / outLen) * r, y: p.y + ((next.y - p.y) / outLen) * r };

    d += i === 0 ? `M ${inPoint.x} ${inPoint.y} ` : `L ${inPoint.x} ${inPoint.y} `;
    d += `Q ${p.x} ${p.y} ${outPoint.x} ${outPoint.y} `;
  }
  return d + 'Z';
};

const PHASE_ICONS: Record<TutorialPhase, React.ElementType> = {
  gettingStarted: Rocket,
  collectionSetup: FolderPlus,
  mediaCreation: Film,
};

const TutorialOverlay: React.FC = () => {
  const { t } = useTranslation();
  const isActive = useTutorialStore((s) => s.isActive);
  const currentStep = useTutorialStore((s) => s.currentStep);
  const nextStep = useTutorialStore((s) => s.nextStep);
  const prevStep = useTutorialStore((s) => s.prevStep);
  const skipTutorial = useTutorialStore((s) => s.skipTutorial);
  const completeTutorial = useTutorialStore((s) => s.completeTutorial);

  const currentPage = useNavigationStore((s) => s.currentPage);
  const setTutorialHasSeenInvitation = useProfileSettingsStore((s) => s.setTutorialHasSeenInvitation);
  const setTutorialHasCompleted = useProfileSettingsStore((s) => s.setTutorialHasCompleted);

  const [spotlight, setSpotlight] = useState<SpotlightState | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = TUTORIAL_STEPS[currentStep];
  const isStepOnCurrentPage = step?.page === currentPage;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const isActionStep = step?.type === 'action';

  const PhaseIcon = step?.phase ? PHASE_ICONS[step.phase] : Sparkles;

  const updatePosition = useCallback(() => {
    if (!step?.selector) {
      setSpotlight(null);
      setTooltipPos({ top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - 210 });
      return;
    }

    const el = document.querySelector(step.selector);
    if (!el) {
      setSpotlight(null);
      setTooltipPos({ top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - 210 });
      return;
    }

    const rawRect = el.getBoundingClientRect();

    // Clamp spotlight to the header's bottom edge so the highlight border
    // never bleeds into the header area — it must stay within the page content.
    const headerEl = document.querySelector('header');
    const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;

    const clampTop = (paddedRect: Rect, rawTop: number): Rect => {
      // Only clamp if the element itself is at or below the header bottom —
      // this trims padding that bleeds up into the header without clipping
      // elements that legitimately live inside the header (e.g. nav-library).
      if (rawTop >= headerBottom && paddedRect.top < headerBottom) {
        const overlap = headerBottom - paddedRect.top;
        return {
          ...paddedRect,
          top: headerBottom,
          height: Math.max(0, paddedRect.height - overlap),
        };
      }
      return paddedRect;
    };

    const mainPadded: Rect = clampTop({
      top: rawRect.top - PADDING,
      left: rawRect.left - PADDING,
      width: rawRect.width + PADDING * 2,
      height: rawRect.height + PADDING * 2,
    }, rawRect.top);

    // Detect open popovers/dropdowns/portals
    const portalRects: Rect[] = [];

    // Check document-level portals (React datepickers, listboxes, dialogs, tutorial popovers)
    const portalElements = document.querySelectorAll(
      '[role="dialog"], [role="listbox"], .rdp, .react-datepicker, [data-tutorial-popover="true"], [data-tutorial-dropdown="true"]'
    );
    portalElements.forEach((portal) => {
      if (overlayRef.current?.contains(portal)) return;
      const style = window.getComputedStyle(portal);
      if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0) {
        const pRect = portal.getBoundingClientRect();
        if (pRect.width > 5 && pRect.height > 5 && pRect.bottom > 0 && pRect.right > 0) {
          portalRects.push(clampTop({
            top: pRect.top - PADDING,
            left: pRect.left - PADDING,
            width: pRect.width + PADDING * 2,
            height: pRect.height + PADDING * 2,
          }, pRect.top));
        }
      }
    });

    // Check absolute/fixed children popping outside main container
    const absoluteChildren = el.querySelectorAll('.absolute, .fixed, [role="listbox"]');
    absoluteChildren.forEach((child) => {
      const style = window.getComputedStyle(child);
      if (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity || '1') > 0 &&
        (style.position === 'absolute' || style.position === 'fixed')
      ) {
        const cRect = child.getBoundingClientRect();
        if (
          cRect.width > 5 &&
          cRect.height > 5 &&
          (cRect.bottom > rawRect.bottom + 5 ||
            cRect.top < rawRect.top - 5 ||
            cRect.right > rawRect.right + 5 ||
            cRect.left < rawRect.left - 5)
        ) {
          portalRects.push(clampTop({
            top: cRect.top - PADDING,
            left: cRect.left - PADDING,
            width: cRect.width + PADDING * 2,
            height: cRect.height + PADDING * 2,
          }, cRect.top));
        }
      }
    });

    // Compute combined bounding box strictly for tooltip collision avoidance
    let minTop = mainPadded.top;
    let minLeft = mainPadded.left;
    let maxRight = mainPadded.left + mainPadded.width;
    let maxBottom = mainPadded.top + mainPadded.height;

    portalRects.forEach((r) => {
      minTop = Math.min(minTop, r.top);
      minLeft = Math.min(minLeft, r.left);
      maxRight = Math.max(maxRight, r.left + r.width);
      maxBottom = Math.max(maxBottom, r.top + r.height);
    });

    const combinedBoundingRect: Rect = {
      top: minTop,
      left: minLeft,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    };

    const mergedRects = groupOverlappingRects([mainPadded, ...portalRects]);

    setSpotlight({ mainRect: mainPadded, portalRects, combinedBoundingRect, renderGroups: mergedRects });

    // Calculate tooltip position avoiding combined bounding box
    const tooltipWidth = 420;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 240;
    const gap = 16;
    let top = 0;
    let left = 0;

    let preferredPos = step.position || 'bottom';
    if (step.selector === '[data-tutorial="media-progress"]' || step.selector === '[data-tutorial="media-genres"]') {
      preferredPos = 'left';
    }

    if (preferredPos === 'top') {
      top = combinedBoundingRect.top - tooltipHeight - gap;
      left = combinedBoundingRect.left + combinedBoundingRect.width / 2 - tooltipWidth / 2;
    } else if (preferredPos === 'bottom') {
      top = combinedBoundingRect.top + combinedBoundingRect.height + gap;
      left = combinedBoundingRect.left + combinedBoundingRect.width / 2 - tooltipWidth / 2;
    } else if (preferredPos === 'left') {
      top = combinedBoundingRect.top + combinedBoundingRect.height / 2 - tooltipHeight / 2;
      left = combinedBoundingRect.left - tooltipWidth - gap;
    } else if (preferredPos === 'right') {
      top = combinedBoundingRect.top + combinedBoundingRect.height / 2 - tooltipHeight / 2;
      left = combinedBoundingRect.left + combinedBoundingRect.width + gap;
    }

    // Clamp to viewport boundaries
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    // Collision detection with combined target
    const overlapsTarget =
      top < combinedBoundingRect.top + combinedBoundingRect.height &&
      top + tooltipHeight > combinedBoundingRect.top &&
      left < combinedBoundingRect.left + combinedBoundingRect.width &&
      left + tooltipWidth > combinedBoundingRect.left;

    if (overlapsTarget) {
      if (preferredPos === 'top') {
        top = combinedBoundingRect.top + combinedBoundingRect.height + gap;
      } else if (preferredPos === 'bottom') {
        top = combinedBoundingRect.top - tooltipHeight - gap;
      } else if (preferredPos === 'left') {
        left = combinedBoundingRect.left + combinedBoundingRect.width + gap;
      } else if (preferredPos === 'right') {
        left = combinedBoundingRect.left - tooltipWidth - gap;
      }
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
    }

    setTooltipPos({ top, left });
  }, [step]);

  // Auto-scroll target into view on step change
  useEffect(() => {
    if (!isActive || !step?.selector || !isStepOnCurrentPage) return;
    const el = document.querySelector(step.selector);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isActive, currentStep, step, isStepOnCurrentPage]);

  useLayoutEffect(() => {
    if (!isActive || !isStepOnCurrentPage) return;
    const raf = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(raf);
  }, [isActive, isStepOnCurrentPage, currentStep, updatePosition]);

  useEffect(() => {
    if (!isActive) return;
    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    const interval = setInterval(updatePosition, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      clearInterval(interval);
    };
  }, [isActive, updatePosition]);

  // Auto-advance for action steps when target page is reached
  useEffect(() => {
    if (!isActive || !step) return;

    if (isLastStep && step.page !== currentPage) {
      completeTutorial();
      return;
    }

    if (step.type === 'action' && step.waitFor === 'navigation' && step.targetPage) {
      if (currentPage === step.targetPage) {
        const timeout = setTimeout(() => {
          nextStep();
        }, 500);
        return () => clearTimeout(timeout);
      }
    }
    if (step.page !== currentPage && currentStep + 1 < TUTORIAL_STEPS.length) {
      const nextStepDef = TUTORIAL_STEPS[currentStep + 1];
      if (nextStepDef.page === currentPage) {
        const timeout = setTimeout(() => {
          nextStep();
        }, 500);
        return () => clearTimeout(timeout);
      }
    }
  }, [isActive, step, currentPage, currentStep, isLastStep, completeTutorial, nextStep]);

  const handleSkip = useCallback(() => {
    skipTutorial();
    setTutorialHasSeenInvitation(true);
  }, [skipTutorial, setTutorialHasSeenInvitation]);

  const handleNext = useCallback(() => {
    if (step?.type === 'completion' || isLastStep) {
      if (dontShowAgain) {
        setTutorialHasCompleted(true);
      }
      setTutorialHasSeenInvitation(true);
      completeTutorial();
    } else {
      nextStep();
    }
  }, [step, isLastStep, dontShowAgain, nextStep, completeTutorial, setTutorialHasCompleted, setTutorialHasSeenInvitation]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'Enter' && step?.type !== 'action') {
        handleNext();
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        prevStep();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive, step, currentStep, prevStep, handleSkip, handleNext]);

  if (!isActive || !step) return null;

  // Waiting state for page navigation
  if (!isStepOnCurrentPage) {
    return (
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm pointer-events-auto" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="glass-card rounded-2xl px-6 py-4 flex items-center gap-3.5 border border-white/10 shadow-2xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-white/80">
              {t('tutorial.step', { current: currentStep + 1, total: TUTORIAL_STEPS.length })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  // Phase step calculation for compact indicator
  const phaseSteps = TUTORIAL_STEPS.filter((s) => s.phase === step.phase);
  const currentStepInPhase = phaseSteps.findIndex((s) => s.id === step.id);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999] pointer-events-none">
      {/* SVG Spotlight Mask */}
      {spotlight ? (
        <>
          <svg
            className="fixed inset-0 w-full h-full pointer-events-none"
            style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <defs>
              <mask id="tutorial-spotlight">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {/* Target cutouts — each cluster of touching/overlapping boxes (e.g. a
                    field + its open dropdown) is cut as ONE exact rectilinear-union
                    shape (L-shape included) so no unrelated UI is ever swept in, and
                    no double edge forms where two independent rects would collide */}
                {spotlight.renderGroups.map((group, i) =>
                  group.length === 1 ? (
                    <rect
                      key={i}
                      x={group[0].left}
                      y={group[0].top}
                      width={group[0].width}
                      height={group[0].height}
                      rx="14"
                      fill="black"
                    />
                  ) : (
                    <path key={i} d={buildRoundedPolygonPath(buildUnionPolygon(group), 14)} fill="black" />
                  )
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(8, 10, 20, 0.78)"
              mask="url(#tutorial-spotlight)"
            />
          </svg>

          {/* Strict click-blocking backdrops outside active target area */}
          <div
            className="fixed top-0 left-0 right-0 pointer-events-auto"
            style={{ height: spotlight.combinedBoundingRect.top }}
          />
          <div
            className="fixed left-0 right-0 bottom-0 pointer-events-auto"
            style={{ top: spotlight.combinedBoundingRect.top + spotlight.combinedBoundingRect.height }}
          />
          <div
            className="fixed pointer-events-auto"
            style={{
              top: spotlight.combinedBoundingRect.top,
              height: spotlight.combinedBoundingRect.height,
              left: 0,
              width: spotlight.combinedBoundingRect.left,
            }}
          />
          <div
            className="fixed pointer-events-auto"
            style={{
              top: spotlight.combinedBoundingRect.top,
              height: spotlight.combinedBoundingRect.height,
              left: spotlight.combinedBoundingRect.left + spotlight.combinedBoundingRect.width,
              right: 0,
            }}
          />

          {/* Transparent click blocker over target ONLY if step explicitly disables interactivity */}
          {step.interactive === false && (
            <div
              className="fixed pointer-events-auto cursor-not-allowed"
              style={{
                top: spotlight.combinedBoundingRect.top,
                left: spotlight.combinedBoundingRect.left,
                width: spotlight.combinedBoundingRect.width,
                height: spotlight.combinedBoundingRect.height,
              }}
            />
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-black/78 pointer-events-auto" />
      )}

      {/* Pulse rings — a lone rect keeps the existing div-based glow style
          untouched. A cluster of 2+ touching/overlapping rects (e.g. a field
          + its open dropdown) is instead outlined as ONE exact polygon path
          (see buildUnionPolygon) so it reads as a single continuous shape —
          L-shapes included — with no double border and no invented area. */}
      {spotlight && (
        <>
          {spotlight.renderGroups.map((group, idx) =>
            group.length === 1 ? (
              <div
                key={idx}
                className="absolute pointer-events-none tutorial-pulse-ring"
                style={{
                  top: group[0].top,
                  left: group[0].left,
                  width: group[0].width,
                  height: group[0].height,
                  borderRadius: 14,
                }}
              />
            ) : null
          )}

          {spotlight.renderGroups.some((g) => g.length > 1) && (
            <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
              <style>{`
                @keyframes tutorialMergedRingPulse {
                  0%, 100% { opacity: 0.55; }
                  50% { opacity: 1; }
                }
                .tutorial-merged-ring-path {
                  fill: none;
                  stroke: var(--primary, #a855f7);
                  stroke-width: 2;
                  filter: drop-shadow(0 0 8px var(--primary, #a855f7)) drop-shadow(0 0 16px var(--primary, #a855f7));
                  animation: tutorialMergedRingPulse 1.6s ease-in-out infinite;
                }
              `}</style>
              {spotlight.renderGroups
                .filter((g) => g.length > 1)
                .map((group, idx) => (
                  <path
                    key={idx}
                    className="tutorial-merged-ring-path"
                    d={buildRoundedPolygonPath(buildUnionPolygon(group), 14)}
                  />
                ))}
            </svg>
          )}
        </>
      )}

      {/* Tooltip Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute pointer-events-auto"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            width: 420,
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <div className="relative glass-card rounded-2xl border border-white/15 shadow-2xl overflow-hidden backdrop-blur-2xl bg-zinc-950/90 flex flex-col">
            {/* Top Linear Progress Bar */}
            <div className="w-full h-1 bg-white/10 overflow-hidden shrink-0">
              <motion.div
                className="h-full bg-gradient-to-r from-primary via-purple-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            </div>

            {/* Header: Phase Badge, Step Counter, Close Button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/30">
                  <PhaseIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider truncate">
                  {t(`tutorial.phases.${step.phase}`)}
                </span>
                <span className="text-[10px] text-white/30">•</span>
                <span className="text-[11px] font-medium text-primary shrink-0">
                  {t('tutorial.step', { current: currentStep + 1, total: TUTORIAL_STEPS.length })}
                </span>
              </div>

              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer group shrink-0"
                title={t('tutorial.skip')}
              >
                <span>{t('tutorial.skip')}</span>
                <kbd className="tutorial-keycap">Esc</kbd>
                <X className="w-3.5 h-3.5 text-white/40 group-hover:text-white" />
              </button>
            </div>

            {/* Body Content */}
            <div className="px-5 py-4 flex-1">
              <div className="flex items-start gap-3.5 mb-2">
                {/* Step Type Icon Badge */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-lg ${
                    step.type === 'action'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : step.type === 'completion'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-primary/20 border-primary/40 text-primary'
                  }`}
                >
                  {step.type === 'action' ? (
                    <MousePointerClick className="w-4 h-4 animate-bounce" />
                  ) : step.type === 'completion' ? (
                    <Trophy className="w-4.5 h-4.5" />
                  ) : (
                    <Sparkles className="w-4.5 h-4.5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                    {t(step.titleKey)}
                  </h3>
                </div>
              </div>

              <p className="text-xs text-white/75 leading-relaxed font-normal pl-[46px]">
                {t(step.descKey)}
              </p>

              {/* Action Required Banner for Action Steps */}
              {isActionStep && (
                <div className="mt-3.5 ml-[46px] p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-300 text-xs font-medium tutorial-action-pulse">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('tutorial.clickToContinue')}</span>
                </div>
              )}

              {/* Completion Screen Options */}
              {step.type === 'completion' && (
                <div className="mt-4 ml-[46px]">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setDontShowAgain(!dontShowAgain)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                        dontShowAgain
                          ? 'bg-emerald-500 border-emerald-500 text-black'
                          : 'border-white/30 hover:border-white/60'
                      }`}
                    >
                      {dontShowAgain && <Check className="w-3.5 h-3.5 font-bold" />}
                    </button>
                    <span className="text-xs text-white/80">{t('tutorial.dontShowAgain')}</span>
                  </label>
                </div>
              )}
            </div>

            {/* Footer Controls & Buttons */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-white/[0.02] gap-3 shrink-0">
              {/* Sleek Step Pill Indicator */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/10 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-white/70 tracking-wide">
                    {currentStepInPhase + 1} <span className="text-white/30 font-normal">/</span> {phaseSteps.length}
                  </span>
                  <div className="w-10 h-1 bg-white/10 rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-gradient-to-r from-primary via-purple-400 to-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${((currentStepInPhase + 1) / phaseSteps.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons — shrink-0 to prevent text clipping */}
              <div className="flex items-center gap-2 shrink-0">
                {!isFirstStep && (
                  <button
                    onClick={prevStep}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{t('tutorial.previous')}</span>
                    <kbd className="tutorial-keycap hidden sm:inline-flex">←</kbd>
                  </button>
                )}

                {!isActionStep && (
                  <button
                    onClick={handleNext}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-primary to-purple-600 hover:from-primary-dark hover:to-purple-700 text-xs font-semibold text-white shadow-lg shadow-primary/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                  >
                    <span>{isLastStep ? t('tutorial.done') : t('tutorial.next')}</span>
                    {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
                    {!isLastStep && <kbd className="tutorial-keycap bg-white/20 border-white/30 text-white">↵</kbd>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TutorialOverlay;