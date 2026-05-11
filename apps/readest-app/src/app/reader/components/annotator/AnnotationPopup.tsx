import clsx from 'clsx';
import React from 'react';
import { Position } from '@/utils/sel';
import { BookNote, HighlightColor, HighlightStyle } from '@/types/book';
import Popup from '@/components/Popup';
import AnnotationToolButton from './AnnotationToolButton';
import AnnotationNotes from './AnnotationNotes';
import HighlightOptions from './HighlightOptions';

interface AnnotationPopupProps {
  bookKey: string;
  dir: 'ltr' | 'rtl';
  isVertical: boolean;
  buttons: Array<{
    tooltipText: string;
    labelText?: string;
    Icon: React.ElementType;
    onClick: () => void;
    disabled?: boolean;
    visible?: boolean;
    isPrimary?: boolean;
  }>;
  notes: BookNote[];
  position: Position;
  trianglePosition: Position;
  highlightOptionsVisible: boolean;
  selectedStyle: HighlightStyle;
  selectedColor: HighlightColor;
  popupWidth: number;
  popupHeight: number;
  onHighlight: (update?: boolean) => void;
  onDismiss: () => void;
}

const AnnotationPopup: React.FC<AnnotationPopupProps> = ({
  bookKey,
  dir,
  isVertical,
  buttons,
  notes,
  position,
  trianglePosition,
  highlightOptionsVisible,
  selectedStyle,
  selectedColor,
  popupWidth,
  popupHeight,
  onHighlight,
  onDismiss,
}) => {
  const visibleButtons = buttons.filter((button) => button.visible !== false);
  const primaryButtons = visibleButtons.filter((button) => button.isPrimary);
  const secondaryButtons = visibleButtons.filter((button) => !button.isPrimary);

  return (
    <div dir={dir}>
      <Popup
        width={isVertical ? popupHeight : popupWidth}
        height={isVertical ? popupWidth : popupHeight}
        minHeight={isVertical ? popupWidth : popupHeight}
        position={position}
        trianglePosition={trianglePosition}
        className={clsx(
          'selection-popup bg-gray-600 text-white',
          notes.length > 0 && 'bg-transparent',
        )}
        triangleClassName='text-gray-600'
        onDismiss={onDismiss}
      >
        <div className={clsx('flex h-full gap-4', isVertical ? 'flex-row' : 'flex-col')}>
          {notes.length > 0 ? (
            <AnnotationNotes
              bookKey={bookKey}
              isVertical={isVertical}
              notes={notes}
              toolsVisible={false}
              triangleDir={trianglePosition.dir!}
              popupWidth={isVertical ? popupHeight : popupWidth}
              popupHeight={isVertical ? popupWidth : popupHeight}
              onDismiss={onDismiss}
            />
          ) : (
            <>
              <div
                className={clsx(
                  'selection-buttons flex h-full w-full p-2',
                  isVertical ? 'flex-row items-stretch gap-2' : 'flex-col gap-1.5',
                )}
              >
                {primaryButtons.map((button) => {
                  const Icon = button.Icon;
                  return (
                    <button
                      key={button.tooltipText}
                      type='button'
                      title={!highlightOptionsVisible ? button.tooltipText : undefined}
                      aria-label={button.tooltipText}
                      className={clsx(
                        'btn btn-primary flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3',
                        isVertical ? 'h-full w-10 p-0' : 'h-9 w-full',
                      )}
                      onClick={button.onClick}
                      disabled={button.disabled}
                    >
                      <Icon className='size-4 shrink-0' />
                      <span className={clsx('text-sm font-semibold', isVertical && 'sr-only')}>
                        {button.labelText || button.tooltipText}
                      </span>
                    </button>
                  );
                })}
                <div
                  className={clsx(
                    'flex min-w-0 flex-1 items-center justify-between',
                    isVertical ? 'flex-col overflow-y-auto' : 'flex-row overflow-x-auto',
                  )}
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {secondaryButtons.map((button, index) => (
                    <AnnotationToolButton
                      key={`${button.tooltipText}-${index}`}
                      showTooltip={!highlightOptionsVisible}
                      tooltipText={button.tooltipText}
                      Icon={button.Icon}
                      onClick={button.onClick}
                      disabled={button.disabled}
                    />
                  ))}
                </div>
              </div>
              {highlightOptionsVisible && (
                <HighlightOptions
                  isVertical={isVertical}
                  triangleDir={trianglePosition.dir!}
                  popupWidth={isVertical ? popupHeight : popupWidth}
                  popupHeight={isVertical ? popupWidth : popupHeight}
                  selectedStyle={selectedStyle}
                  selectedColor={selectedColor}
                  onHandleHighlight={onHighlight}
                />
              )}
            </>
          )}
        </div>
      </Popup>
    </div>
  );
};

export default AnnotationPopup;
