import { create } from 'zustand';
import type { PageType } from './useNavigationStore';

export type StepType = 'info' | 'action' | 'completion';

export type TutorialPhase = 'gettingStarted' | 'collectionSetup' | 'mediaCreation';

export interface TutorialStep {
  id: string;
  type: StepType;
  page: PageType;
  phase: TutorialPhase;
  selector?: string;
  titleKey: string;
  descKey: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  waitFor?: 'navigation' | 'collectionCreated' | 'mediaCreated';
  targetPage?: PageType;
  interactive?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    type: 'info',
    page: 'dashboard',
    phase: 'gettingStarted',
    titleKey: 'tutorial.steps.welcome.title',
    descKey: 'tutorial.steps.welcome.desc',
  },
  {
    id: 'goToLibrary',
    type: 'action',
    page: 'dashboard',
    phase: 'gettingStarted',
    selector: '[data-tutorial="nav-library"]',
    titleKey: 'tutorial.steps.goToLibrary.title',
    descKey: 'tutorial.steps.goToLibrary.desc',
    position: 'bottom',
    waitFor: 'navigation',
    targetPage: 'library',
    interactive: true,
  },
  {
    id: 'libraryNewCollection',
    type: 'action',
    page: 'library',
    phase: 'gettingStarted',
    selector: '[data-tutorial="library-collection-nav"]',
    titleKey: 'tutorial.steps.libraryNewCollection.title',
    descKey: 'tutorial.steps.libraryNewCollection.desc',
    position: 'bottom',
    waitFor: 'navigation',
    targetPage: 'collection-edit',
    interactive: true,
  },
  {
    id: 'collectionName',
    type: 'info',
    page: 'collection-edit',
    phase: 'collectionSetup',
    selector: '[data-tutorial="collection-name-input"]',
    titleKey: 'tutorial.steps.collectionName.title',
    descKey: 'tutorial.steps.collectionName.desc',
    position: 'bottom',
    interactive: true,
  },
  {
    id: 'collectionDynamicIntro',
    type: 'info',
    page: 'collection-edit',
    phase: 'collectionSetup',
    selector: '[data-tutorial="collection-dynamic-fields"]',
    titleKey: 'tutorial.steps.collectionDynamicIntro.title',
    descKey: 'tutorial.steps.collectionDynamicIntro.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'collectionCreator',
    type: 'info',
    page: 'collection-edit',
    phase: 'collectionSetup',
    selector: '[data-tutorial="collection-creator-section"]',
    titleKey: 'tutorial.steps.collectionCreator.title',
    descKey: 'tutorial.steps.collectionCreator.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'collectionDates',
    type: 'info',
    page: 'collection-edit',
    phase: 'collectionSetup',
    selector: '[data-tutorial="collection-dates-section"]',
    titleKey: 'tutorial.steps.collectionDates.title',
    descKey: 'tutorial.steps.collectionDates.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'collectionProgression',
    type: 'info',
    page: 'collection-edit',
    phase: 'collectionSetup',
    selector: '[data-tutorial="collection-progression-section"]',
    titleKey: 'tutorial.steps.collectionProgression.title',
    descKey: 'tutorial.steps.collectionProgression.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'collectionAdvanced',
    type: 'info',
    page: 'collection-edit',
    phase: 'collectionSetup',
    selector: '[data-tutorial="collection-advanced-section"]',
    titleKey: 'tutorial.steps.collectionAdvanced.title',
    descKey: 'tutorial.steps.collectionAdvanced.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'collectionVisual',
    type: 'info',
    page: 'collection-edit',
    phase: 'collectionSetup',
    selector: '[data-tutorial="collection-visual-column"]',
    titleKey: 'tutorial.steps.collectionVisual.title',
    descKey: 'tutorial.steps.collectionVisual.desc',
    position: 'left',
    interactive: true,
  },
  {
    id: 'collectionSave',
    type: 'action',
    page: 'collection-edit',
    phase: 'collectionSetup',
    selector: '[data-tutorial="collection-save-btn"]',
    titleKey: 'tutorial.steps.collectionSave.title',
    descKey: 'tutorial.steps.collectionSave.desc',
    position: 'top',
    waitFor: 'navigation',
    targetPage: 'library',
    interactive: true,
  },
  {
    id: 'libraryAddMedia',
    type: 'action',
    page: 'library',
    phase: 'mediaCreation',
    selector: '[data-tutorial="library-new-media-btn"]',
    titleKey: 'tutorial.steps.libraryAddMedia.title',
    descKey: 'tutorial.steps.libraryAddMedia.desc',
    position: 'bottom',
    waitFor: 'navigation',
    targetPage: 'media-create',
    interactive: true,
  },
  {
    id: 'mediaCollectionDropdown',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-collection-dropdown"]',
    titleKey: 'tutorial.steps.mediaCollectionDropdown.title',
    descKey: 'tutorial.steps.mediaCollectionDropdown.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'mediaTitle',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-title-input"]',
    titleKey: 'tutorial.steps.mediaTitle.title',
    descKey: 'tutorial.steps.mediaTitle.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'mediaCreator',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-creator"]',
    titleKey: 'tutorial.steps.mediaCreator.title',
    descKey: 'tutorial.steps.mediaCreator.desc',
    position: 'left',
    interactive: true,
  },
  {
    id: 'mediaStatusDate',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-status-date"]',
    titleKey: 'tutorial.steps.mediaStatusDate.title',
    descKey: 'tutorial.steps.mediaStatusDate.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'mediaSynopsis',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-synopsis"]',
    titleKey: 'tutorial.steps.mediaSynopsis.title',
    descKey: 'tutorial.steps.mediaSynopsis.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'mediaGenres',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-genres"]',
    titleKey: 'tutorial.steps.mediaGenres.title',
    descKey: 'tutorial.steps.mediaGenres.desc',
    position: 'left',
    interactive: true,
  },
  {
    id: 'mediaProgress',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-progress"]',
    titleKey: 'tutorial.steps.mediaProgress.title',
    descKey: 'tutorial.steps.mediaProgress.desc',
    position: 'left',
    interactive: true,
  },
  {
    id: 'mediaReview',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-review"]',
    titleKey: 'tutorial.steps.mediaReview.title',
    descKey: 'tutorial.steps.mediaReview.desc',
    position: 'right',
    interactive: true,
  },
  {
    id: 'mediaRating',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-rating"]',
    titleKey: 'tutorial.steps.mediaRating.title',
    descKey: 'tutorial.steps.mediaRating.desc',
    position: 'left',
    interactive: true,
  },
  {
    id: 'mediaGallery',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-gallery"]',
    titleKey: 'tutorial.steps.mediaGallery.title',
    descKey: 'tutorial.steps.mediaGallery.desc',
    position: 'top',
    interactive: true,
  },
  {
    id: 'mediaAttachments',
    type: 'info',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-attachments"]',
    titleKey: 'tutorial.steps.mediaAttachments.title',
    descKey: 'tutorial.steps.mediaAttachments.desc',
    position: 'top',
    interactive: true,
  },
  {
    id: 'mediaCreate',
    type: 'completion',
    page: 'media-create',
    phase: 'mediaCreation',
    selector: '[data-tutorial="media-save-btn"]',
    titleKey: 'tutorial.steps.mediaCreate.title',
    descKey: 'tutorial.steps.mediaCreate.desc',
    position: 'top',
  },
];

interface TutorialState {
  isActive: boolean;
  currentStep: number;
  justFinishedOnboarding: boolean;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  goToStep: (step: number) => void;
  setJustFinishedOnboarding: (value: boolean) => void;
}

export const useTutorialStore = create<TutorialState>((set) => ({
  isActive: false,
  currentStep: 0,
  justFinishedOnboarding: false,
  startTutorial: () => set({ isActive: true, currentStep: 0 }),
  nextStep: () =>
    set((s) => {
      if (s.currentStep + 1 >= TUTORIAL_STEPS.length) {
        return { isActive: false, currentStep: 0 };
      }
      return { currentStep: s.currentStep + 1 };
    }),
  prevStep: () =>
    set((s) => ({
      currentStep: Math.max(0, s.currentStep - 1),
    })),
  skipTutorial: () => set({ isActive: false, currentStep: 0 }),
  completeTutorial: () => set({ isActive: false, currentStep: 0 }),
  goToStep: (step) => set({ currentStep: step }),
  setJustFinishedOnboarding: (value) => set({ justFinishedOnboarding: value }),
}));

const COLLECTION_SECTION_UNLOCK_STEP: Record<string, number> = {
  creator: 5,
  dates: 6,
  progression: 7,
  advanced: 8,
  visual: 9,
};

const MEDIA_SECTION_UNLOCK_STEP: Record<string, number> = {
  mediaTitle: 13,
  mediaCreator: 14,
  mediaStatusDate: 15,
  mediaSynopsis: 16,
  mediaGenres: 17,
  mediaProgress: 18,
  mediaReview: 19,
  mediaRating: 20,
  mediaGallery: 21,
  mediaAttachments: 22,
};

export function isTutorialSectionLocked(section: string): (state: TutorialState) => boolean {
  return (state) => {
    if (!state.isActive) return false;
    const step = TUTORIAL_STEPS[state.currentStep];
    if (!step) return false;
    if (step.page === 'collection-edit') {
      const unlockAt = COLLECTION_SECTION_UNLOCK_STEP[section];
      if (unlockAt === undefined) return false;
      return state.currentStep < unlockAt;
    }
    if (step.page === 'media-create') {
      const unlockAt = MEDIA_SECTION_UNLOCK_STEP[section];
      if (unlockAt === undefined) return false;
      return state.currentStep < unlockAt;
    }
    return false;
  };
}
