import { IconType } from 'react-icons';
import { FiSearch } from 'react-icons/fi';
import { FiCopy } from 'react-icons/fi';
import { PiHighlighterFill } from 'react-icons/pi';
import { BsPencilSquare } from 'react-icons/bs';
import { BsTranslate } from 'react-icons/bs';
import { TbHexagonLetterD } from 'react-icons/tb';
import { FaHeadphones } from 'react-icons/fa6';
import { AnnotationToolType } from '@/types/annotator';
import { StoryBoredLogoMarkIcon } from '@/integrations/storybored/StoryBoredLogo';
import { stubTranslation as _ } from '@/utils/misc';

type AnnotationToolButton = {
  type: AnnotationToolType;
  label: string;
  tooltip: string;
  Icon: IconType;
  quickAction?: boolean;
};

function createAnnotationToolButtons<T extends AnnotationToolType>(
  buttons: {
    [K in T]: {
      type: K;
      label: string;
      tooltip: string;
      Icon: IconType;
      quickAction?: boolean;
    };
  }[T][],
): AnnotationToolButton[] {
  return buttons;
}

export const annotationToolButtons = createAnnotationToolButtons([
  {
    type: 'copy',
    label: _('Copy'),
    tooltip: _('Copy text after selection'),
    Icon: FiCopy,
    quickAction: true,
  },
  {
    type: 'highlight',
    label: _('Highlight'),
    tooltip: _('Highlight text after selection'),
    Icon: PiHighlighterFill,
    quickAction: true,
  },
  {
    type: 'annotate',
    label: _('Annotate'),
    tooltip: _('Annotate text after selection'),
    Icon: BsPencilSquare,
  },
  {
    type: 'search',
    label: _('Search'),
    tooltip: _('Search text after selection'),
    Icon: FiSearch,
    quickAction: true,
  },
  {
    type: 'dictionary',
    label: _('Dictionary'),
    tooltip: _('Look up text in dictionary after selection'),
    Icon: TbHexagonLetterD,
    quickAction: true,
  },
  {
    type: 'translate',
    label: _('Translate'),
    tooltip: _('Translate text after selection'),
    Icon: BsTranslate,
    quickAction: true,
  },
  {
    type: 'tts',
    label: _('Speak'),
    tooltip: _('Read text aloud after selection'),
    Icon: FaHeadphones,
    quickAction: true,
  },
  {
    type: 'storybored',
    label: _('StoryBored'),
    tooltip: _('Generate a scene from selected text'),
    Icon: StoryBoredLogoMarkIcon,
  },
]);

export const annotationToolQuickActions = annotationToolButtons.filter(
  (button) => button.quickAction,
);

export const isAnnotationToolQuickAction = (
  action: AnnotationToolType | null | undefined,
): action is AnnotationToolType =>
  !!action && annotationToolQuickActions.some((button) => button.type === action);
