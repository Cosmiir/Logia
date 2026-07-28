# Plan: Welcome Tutorial Mode (Coach Marks / Spotlight)

## Overview

Implement an interactive, spotlight-based tutorial that guides new users through creating their first collection and first media item after they reach the Dashboard. The tutorial is optional, interruptible at any time, and triggered by a discreet badge rather than an intrusive popup.

---

## Design Principles

- **Spotlight + coach marks**: Dark overlay with a "cut-out" spotlight on the targeted UI element, plus a floating tooltip card.
- **Glassmorphism tooltips**: Translucent background, thin border, subtle purple glow — matching existing card aesthetics.
- **Stepper indicator**: Reuse the onboarding stepper pattern ("Step 2/5") for consistency with the existing onboarding flow.
- **Micro-interactions**: Subtle pulsing glow animation on the spotlighted element to draw the eye.
- **Always-visible skip**: "Passer le tutoriel" button in the top-right corner of every tooltip.
- **Discreet invitation**: A small badge/pastille on the Dashboard ("Nouveau ici ? Découvrir Logia") instead of a forced modal.
- **"Don't show again" checkbox** on the final step.
- **Bilingual**: All text via i18n (en + fr).

---

## Architecture

### 1. Tutorial Store — `src/stores/useTutorialStore.ts`

A Zustand store managing tutorial state:

```ts
interface TutorialState {
  isActive: boolean;
  currentStep: number;
  hasSeenInvitation: boolean;   // user has seen/dismissed the badge
  hasCompleted: boolean;         // user finished the tutorial
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  dismissInvitation: () => void;
}
```

- Persisted via `useSettingsStore` backend sync (add `tutorial_has_seen_invitation` and `tutorial_has_completed` keys).
- `skipTutorial()` sets `isActive = false`, `hasSeenInvitation = true`.
- `completeTutorial()` sets `isActive = false`, `hasCompleted = true`, `hasSeenInvitation = true`.

### 2. Tutorial Steps Definition — `src/stores/useTutorialStore.ts` (co-located)

Steps are page-aware and have three types:

```ts
type StepType = 'info' | 'action' | 'completion';

interface TutorialStep {
  id: string;
  type: StepType;
  page: PageType;              // which page this step belongs to
  selector?: string;           // CSS selector for the target element
  titleKey: string;            // i18n key for step title
  descKey: string;             // i18n key for step description
  position?: 'top' | 'bottom' | 'left' | 'right';  // tooltip placement
  // For 'action' steps:
  waitFor?: 'navigation' | 'collectionCreated' | 'mediaCreated';
  targetPage?: PageType;       // for navigation wait
}
```

**Proposed steps (7 total):**

| # | Type | Page | Target | Description |
|---|------|------|--------|-------------|
| 1 | info | dashboard | Collections section | "Welcome to your Dashboard. Collections organize your media — let's create your first one." |
| 2 | action | dashboard | "+" button in Collections | "Click here to create a new collection." → waits for navigation to `collection-edit` |
| 3 | info | collection-edit | Name input field | "Give your collection a name (e.g., Movies, Series, Manga...)" |
| 4 | info | collection-edit | Save button | "Click Save to create your collection." → waits for navigation back to dashboard (or collection created) |
| 5 | info | dashboard | Collections section (refreshed) | "Your collection is created! Now let's add your first media item." → guides to click the collection |
| 6 | action | dashboard | New collection card or "Add media" | "Click on your collection to add a media item." → waits for navigation to `media-create` |
| 7 | completion | media-create | Save button area | "Fill in your media details and save. That's it — you're all set!" + "Don't show again" checkbox |

> **Note**: Steps 5-6 may be simplified — after collection creation, the app returns to Dashboard. The tutorial can then spotlight the newly created collection card and prompt the user to click it, or directly navigate to `media-create` with the new collection ID.

### 3. Tutorial Overlay Component — `src/components/tutorial/TutorialOverlay.tsx`

Renders the spotlight + tooltip. Key mechanics:

- **Spotlight**: Uses `box-shadow: 0 0 0 9999px rgba(0,0,0,0.75)` on a positioned div wrapping the target element's bounding rect. This creates the "cut-out" effect without SVG.
- **Tooltip card**: Positioned relative to the spotlight rect (top/bottom/left/right with auto-flip if near screen edge).
- **Stepper**: "Step X/Y" indicator at top of tooltip, matching onboarding stepper style.
- **Skip button**: Always visible in tooltip header.
- **Next/Prev buttons**: Footer of tooltip (hidden for `action` steps — user must perform the action).
- **Pulse animation**: CSS `@keyframes` applied to the target element via a class or wrapper.
- **Repositioning**: `useLayoutEffect` + `ResizeObserver` + scroll/resize listeners to keep spotlight and tooltip aligned.

```
<TutorialOverlay>
  ├── <Spotlight />          // dark overlay with cut-out
  ├── <PulseRing />          // animated glow on target
  └── <TutorialTooltip />    // glassmorphism card with content
       ├── <Stepper />       // "Step 2/7"
       ├── <SkipButton />    // top-right "Passer"
       ├── <Content />       // title + description
       └── <NavButtons />    // Prev / Next
</TutorialOverlay>
```

### 4. Tutorial Invitation Badge — `src/components/tutorial/TutorialBadge.tsx`

- Small, discreet pill/badge displayed on the Dashboard.
- Text: "Nouveau ici ? Découvrir Logia" (i18n).
- Animated entrance (fade + slide).
- Clicking starts the tutorial (`startTutorial()`).
- Auto-dismissed after `hasSeenInvitation` is set.
- Positioned near the top of the Dashboard content area, non-intrusive.

### 5. Settings Store Integration — `src/stores/useSettingsStore.ts`

Add two new persisted settings:

```ts
// In SettingsState interface:
tutorialHasSeenInvitation: boolean;
tutorialHasCompleted: boolean;
setTutorialHasSeenInvitation: (seen: boolean) => void;
setTutorialHasCompleted: (completed: boolean) => void;
```

- Synced to backend via `syncToBackend('tutorial_has_seen_invitation', seen)` and `syncToBackend('tutorial_has_completed', completed)`.
- Hydrated in `hydrateStoreFromBackend()`.

### 6. i18n Keys — `src/i18n/locales/en.json` + `fr.json`

New `tutorial` namespace:

```json
{
  "tutorial": {
    "badge": "New here? Discover Logia",
    "skip": "Skip tutorial",
    "previous": "Previous",
    "next": "Next",
    "done": "Done",
    "dontShowAgain": "Don't show again",
    "step": "Step {{current}}/{{total}}",
    "steps": {
      "welcome": {
        "title": "Welcome to your Dashboard",
        "desc": "Collections organize your media. Let's create your first one!"
      },
      "clickCreateCollection": {
        "title": "Create a collection",
        "desc": "Click this button to start creating a collection."
      },
      "collectionName": {
        "title": "Name your collection",
        "desc": "Give it a name like Movies, Series, Manga, Books..."
      },
      "collectionSave": {
        "title": "Save your collection",
        "desc": "Click Save to create your collection. You can customize other fields later."
      },
      "collectionDone": {
        "title": "Collection created!",
        "desc": "Now let's add your first media item to this collection."
      },
      "addMedia": {
        "title": "Add a media item",
        "desc": "Click your collection to add your first media."
      },
      "mediaCreate": {
        "title": "Create your first media",
        "desc": "Fill in the details and save. You're all set!"
      }
    }
  }
}
```

### 7. App.tsx Integration

- Render `<TutorialOverlay />` at the app root level (outside page-specific components) so it persists across page navigations.
- The overlay reads `isActive` from the tutorial store and only renders when active.
- The overlay reads `currentPage` from `useNavigationStore` to determine which steps are relevant.

### 8. Dashboard.tsx Integration

- Render `<TutorialBadge />` conditionally: show when `!hasSeenInvitation && !hasCompleted && !isActive`.
- No other changes needed — the overlay handles targeting via CSS selectors.

---

## Implementation Order

1. **i18n keys** — Add `tutorial` namespace to `en.json` and `fr.json`.
2. **Settings store** — Add `tutorialHasSeenInvitation` and `tutorialHasCompleted` + setters + backend sync + hydration.
3. **Tutorial store** — Create `useTutorialStore.ts` with state, actions, and step definitions.
4. **TutorialOverlay component** — Spotlight + tooltip + stepper + skip + pulse animation.
5. **TutorialBadge component** — Discreet invitation badge.
6. **App.tsx** — Mount `<TutorialOverlay />` globally.
7. **Dashboard.tsx** — Mount `<TutorialBadge />` conditionally.
8. **CSS animations** — Add pulse/glow keyframes to `global.css` or a dedicated `tutorial.css`.

---

## Edge Cases & Considerations

- **Target element not found**: If a CSS selector doesn't match (e.g., user navigated away), the tutorial should either wait or skip to the next relevant step. Add a timeout with graceful fallback.
- **Window resize / scroll**: Spotlight and tooltip must reposition. Use `ResizeObserver` + scroll/resize listeners.
- **Page transitions**: For `action` steps, the tutorial waits for the expected page/collection/media change before advancing. Use `useNavigationStore` subscription or React Query cache invalidation callbacks.
- **Re-entry**: If the user closes the app mid-tutorial, `isActive` is not persisted (only `hasSeenInvitation` and `hasCompleted` are). On next launch, the badge won't show again, but the user can restart the tutorial from Settings (future enhancement).
- **Z-index**: Tutorial overlay must be above everything including modals/toasts. Use a very high z-index (e.g., `z-[9999]`).
- **Accessibility**: Tooltip should be keyboard-navigable (Esc to skip, Enter for next). Add `aria-live` for step descriptions.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/stores/useTutorialStore.ts` | Tutorial state + step definitions |
| `src/components/tutorial/TutorialOverlay.tsx` | Spotlight + tooltip overlay |
| `src/components/tutorial/TutorialBadge.tsx` | Discreet invitation badge |
| `src/components/tutorial/TutorialTooltip.tsx` | Tooltip card sub-component (optional, can be inline) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/i18n/locales/en.json` | Add `tutorial` namespace |
| `src/i18n/locales/fr.json` | Add `tutorial` namespace |
| `src/stores/useSettingsStore.ts` | Add tutorial settings + backend sync |
| `src/App.tsx` | Mount `<TutorialOverlay />` |
| `src/pages/Dashboard.tsx` | Mount `<TutorialBadge />` |
| `src/styles/global.css` | Add pulse/glow keyframes (or new `tutorial.css`) |
