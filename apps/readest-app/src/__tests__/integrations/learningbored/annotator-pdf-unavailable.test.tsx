import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  getCfi: vi.fn(() => 'epubcfi(/6/2!/4/2/1:0)'),
}));

let setSelectionForTest: ((selection: unknown) => void) | undefined;

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ envConfig: {}, appService: null }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (message: string) => message,
}));

vi.mock('@/hooks/useResponsiveSize', () => ({
  useResponsiveSize: (size: number) => size,
}));

vi.mock('@/hooks/useShortcuts', () => ({ default: () => undefined }));
vi.mock('@/app/reader/hooks/useNotesSync', () => ({ useNotesSync: () => undefined }));
vi.mock('@/app/reader/hooks/useReadwiseSync', () => ({ useReadwiseSync: () => undefined }));
vi.mock('@/app/reader/hooks/useHardcoverSync', () => ({ useHardcoverSync: () => undefined }));
vi.mock('@/app/reader/hooks/useFoliateEvents', () => ({ useFoliateEvents: () => undefined }));

vi.mock('@/app/reader/hooks/useTextSelector', () => ({
  useTextSelector: (_bookKey: string, setSelection: (selection: unknown) => void) => {
    setSelectionForTest = setSelection;
    return {
      isTextSelected: { current: true },
      isInstantAnnotating: { current: false },
      handleScroll: () => undefined,
      handleTouchStart: () => undefined,
      handleTouchMove: () => undefined,
      handleTouchEnd: () => undefined,
      handlePointerDown: () => undefined,
      handlePointerMove: () => undefined,
      handlePointerCancel: () => undefined,
      handlePointerUp: () => undefined,
      handleSelectionchange: () => undefined,
      handleShowPopup: () => undefined,
      handleUpToPopup: () => undefined,
      handleContextmenu: () => undefined,
    };
  },
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: () => ({
    settings: {
      globalReadSettings: {
        highlightStyle: 'highlight',
        highlightStyles: {
          highlight: 'yellow',
          underline: 'red',
          squiggly: 'blue',
        },
      },
    },
  }),
}));

vi.mock('@/store/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

vi.mock('@/store/bookDataStore', () => ({
  useBookDataStore: () => ({
    getConfig: () => ({ booknotes: [] }),
    saveConfig: vi.fn(),
    getBookData: () => ({
      book: {
        title: 'Fictional PDF lesson',
        format: 'PDF',
        primaryLanguage: 'en',
      },
      bookDoc: { toc: [] },
      isFixedLayout: true,
    }),
    updateBooknotes: vi.fn(),
  }),
}));

vi.mock('@/store/readerStore', () => ({
  useReaderStore: () => ({
    getProgress: () => ({
      page: 1,
      sectionHref: 'page-1',
      location: { current: 0, next: 1, total: 1 },
    }),
    getView: () => ({
      renderer: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      getCFI: mocks.getCfi,
      deselect: vi.fn(),
      addAnnotation: vi.fn(),
    }),
    getViewsById: () => [],
    getViewSettings: () => ({
      vertical: false,
      rtl: false,
      scrolled: false,
      copyToNotebook: false,
      enableAnnotationQuickActions: false,
      annotationQuickAction: null,
      defaultFontSize: 16,
      lineHeight: 1.5,
      isEink: false,
      isColorEink: false,
    }),
  }),
}));

vi.mock('@/store/notebookStore', () => ({
  useNotebookStore: () => ({
    setNotebookVisible: vi.fn(),
    setNotebookNewAnnotation: vi.fn(),
  }),
}));

vi.mock('@/store/deviceStore', () => ({
  useDeviceControlStore: () => ({ listenToNativeTouchEvents: vi.fn() }),
}));

vi.mock('@/integrations/learningbored/config', () => ({
  isLearningBoredReaderEnabled: () => true,
}));

vi.mock('@/utils/event', () => ({
  eventDispatcher: {
    dispatch: mocks.dispatch,
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock('@/utils/sel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/sel')>();
  return {
    ...actual,
    getPosition: () => ({ point: { x: 120, y: 100 }, dir: 'up' }),
    getPopupPosition: () => ({ point: { x: 20, y: 40 }, dir: 'up' }),
  };
});

vi.mock('@/app/reader/components/annotator/AnnotationPopup', () => ({
  default: ({
    buttons,
  }: {
    buttons: Array<{
      tooltipText: string;
      onClick: () => void;
      visible?: boolean;
    }>;
  }) => (
    <div>
      {buttons
        .filter(({ visible }) => visible !== false)
        .map(({ tooltipText, onClick }) => (
          <button key={tooltipText} type='button' onClick={onClick}>
            {tooltipText}
          </button>
        ))}
    </div>
  ),
}));

vi.mock('@/app/reader/components/annotator/AnnotationRangeEditor', () => ({
  default: () => null,
}));
vi.mock('@/app/reader/components/annotator/WiktionaryPopup', () => ({ default: () => null }));
vi.mock('@/app/reader/components/annotator/WikipediaPopup', () => ({ default: () => null }));
vi.mock('@/app/reader/components/annotator/TranslatorPopup', () => ({ default: () => null }));
vi.mock('@/app/reader/components/annotator/ProofreadPopup', () => ({ default: () => null }));
vi.mock('@/app/reader/components/annotator/ExportMarkdownDialog', () => ({ default: () => null }));
vi.mock('@/integrations/learningbored/LearningBoredCapturePanel', () => ({ default: () => null }));

import Annotator from '@/app/reader/components/annotator/Annotator';

describe('LearningBored PDF action in the annotator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setSelectionForTest = undefined;

    const gridCell = document.createElement('div');
    gridCell.id = 'gridcell-pdf-book';
    document.body.append(gridCell);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('shows the learner-visible unavailable warning when Board it is chosen for a PDF', async () => {
    render(<Annotator bookKey='pdf-book' />);

    const paragraph = document.createElement('p');
    paragraph.textContent = 'A fictional PDF passage about a generic process.';
    document.body.append(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);

    expect(setSelectionForTest).toBeDefined();
    act(() => {
      setSelectionForTest?.({
        key: 'pdf-book',
        text: range.toString(),
        range,
        index: 0,
        page: 1,
      });
    });

    const boardIt = await screen.findByRole('button', {
      name: 'Board it — capture the selected passage for LearningBored',
    });
    fireEvent.click(boardIt);

    await waitFor(() => {
      expect(mocks.dispatch).toHaveBeenCalledWith('toast', {
        type: 'warning',
        message: 'Board it is unavailable for PDF because exact selected text cannot be preserved.',
        timeout: 4000,
      });
    });
    expect(mocks.getCfi).not.toHaveBeenCalled();
  });
});
