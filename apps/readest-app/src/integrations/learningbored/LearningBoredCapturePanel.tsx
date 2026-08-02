'use client';

import Image from 'next/image';
import React from 'react';
import { Trash2, X } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import type { LearningBoredCapturedPassage } from './types';

interface LearningBoredCapturePanelProps {
  isOpen: boolean;
  passage: LearningBoredCapturedPassage | null;
  onClose: () => void;
  onClear: () => void;
}

const LearningBoredCapturePanel: React.FC<LearningBoredCapturePanelProps> = ({
  isOpen,
  passage,
  onClose,
  onClear,
}) => {
  const _ = useTranslation();

  if (!isOpen) return null;

  const contextAfterOffset = passage ? passage.contextOffset + passage.selectedText.length : 0;

  return (
    <aside
      aria-label={_('LearningBored passage preview')}
      className='bg-base-100 text-base-content border-base-300 fixed inset-x-0 bottom-0 z-30 flex max-h-[82vh] flex-col rounded-t-2xl border-t shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[min(420px,calc(100vw-2rem))] sm:rounded-none sm:border-l sm:border-t-0'
    >
      <header className='border-base-300 flex min-h-14 items-center justify-between gap-3 border-b px-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <Image
            src='/learningbored/mark.svg'
            width={28}
            height={28}
            alt=''
            aria-hidden='true'
            className='shrink-0'
          />
          <div className='min-w-0'>
            <h2 className='truncate text-base font-semibold'>{_('LearningBored')}</h2>
            <p className='text-base-content/60 truncate text-xs'>{_('Passage preview')}</p>
          </div>
        </div>
        <button
          type='button'
          className='btn btn-ghost btn-sm h-10 min-h-10 w-10 p-0'
          aria-label={_('Close passage preview')}
          title={_('Close passage preview')}
          onClick={onClose}
        >
          <X className='size-5' />
        </button>
      </header>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        <section className='border-base-300 border-b p-4'>
          <span className='text-base-content/60 mb-3 block text-xs font-semibold uppercase tracking-wide'>
            {_('Exact selected passage')}
          </span>
          {passage ? (
            <blockquote className='bg-base-200 whitespace-pre-wrap break-words rounded-md p-4 text-sm leading-6'>
              {passage.selectedText}
            </blockquote>
          ) : (
            <p className='text-base-content/60 text-sm'>{_('No passage captured')}</p>
          )}
        </section>

        {passage && (
          <>
            <section className='border-base-300 border-b p-4'>
              <span className='text-base-content/60 mb-3 block text-xs font-semibold uppercase tracking-wide'>
                {_('Capture metadata')}
              </span>
              <dl className='grid grid-cols-[auto,minmax(0,1fr)] gap-x-4 gap-y-2 text-sm'>
                {passage.chapter && (
                  <>
                    <dt className='text-base-content/60'>{_('Chapter')}</dt>
                    <dd className='min-w-0 break-words text-right'>{passage.chapter}</dd>
                  </>
                )}
                {passage.location.pageLabel && (
                  <>
                    <dt className='text-base-content/60'>{_('Page')}</dt>
                    <dd className='text-right'>{passage.location.pageLabel}</dd>
                  </>
                )}
                {passage.location.sectionHref && (
                  <>
                    <dt className='text-base-content/60'>{_('Section')}</dt>
                    <dd className='min-w-0 break-all text-right'>{passage.location.sectionHref}</dd>
                  </>
                )}
                <dt className='text-base-content/60'>{_('Selection length')}</dt>
                <dd className='text-right'>
                  {passage.selectedText.length} {_('UTF-16 code units')}
                </dd>
                <dt className='text-base-content/60'>{_('Context offset')}</dt>
                <dd className='text-right'>{passage.contextOffset}</dd>
                <dt className='text-base-content/60'>{_('Context length')}</dt>
                <dd className='text-right'>{passage.surroundingContext.length}</dd>
              </dl>
            </section>

            <section className='border-base-300 border-b p-4'>
              <details>
                <summary className='cursor-pointer text-sm font-medium'>
                  {_('Review surrounding context')}
                </summary>
                <p className='text-base-content/60 mt-2 text-xs'>
                  {_('The selected passage begins at offset')} {passage.contextOffset}{' '}
                  {_('and ends at offset')} {contextAfterOffset}.
                </p>
                <pre className='bg-base-200 mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md p-3 font-sans text-xs leading-5'>
                  {passage.surroundingContext}
                </pre>
              </details>
            </section>

            <section className='p-4'>
              <details>
                <summary className='cursor-pointer text-sm font-medium'>
                  {_('Stable reader location')}
                </summary>
                <code className='bg-base-200 mt-3 block max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md p-3 text-xs'>
                  {passage.location.cfi}
                </code>
              </details>
            </section>
          </>
        )}
      </div>

      {passage && (
        <footer className='border-base-300 border-t p-4'>
          <button
            type='button'
            className='btn btn-ghost text-error h-11 min-h-11 w-full'
            onClick={onClear}
          >
            <Trash2 className='size-4' />
            {_('Clear captured passage')}
          </button>
        </footer>
      )}
    </aside>
  );
};

export default LearningBoredCapturePanel;
