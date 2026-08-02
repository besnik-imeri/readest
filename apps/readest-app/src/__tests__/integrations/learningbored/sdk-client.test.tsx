import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningBoredFetch } from '@learningbored/sdk';

const readerContext = vi.hoisted(() => ({ sideBarBookKey: 'book-key' }));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (message: string) => message,
}));

vi.mock('@/store/sidebarStore', () => ({
  useSidebarStore: () => ({ sideBarBookKey: readerContext.sideBarBookKey }),
}));

vi.mock('@/store/bookDataStore', () => ({
  useBookDataStore: () => ({
    getBookData: () => ({
      book: {
        hash: 'book-1',
        title: 'Fictional systems lesson',
        author: 'A. Example',
        format: 'EPUB',
      },
    }),
  }),
}));

vi.mock('@/store/readerStore', () => ({
  useReaderStore: () => ({ getView: () => null }),
}));

import { publishLearningBoredCapture } from '@/integrations/learningbored/bridge';
import LearningBoredPanelHost from '@/integrations/learningbored/LearningBoredPanelHost';
import LearningBoredSdkClientProvider from '@/integrations/learningbored/LearningBoredSdkClientProvider';
import {
  createLearningBoredSdkClient,
  type LearningBoredSdkPort,
} from '@/integrations/learningbored/sdk-client';

const SOURCE_SPAN = { sourceStart: 0, sourceEnd: 22 } as const;
const FIGURE_BYTES = Uint8Array.from([137, 80, 78, 71]);

const SPEC = {
  version: '3.0.0',
  kind: 'concept_map',
  title: 'A fictional rotor system',
  titleSourceSpan: SOURCE_SPAN,
  nodes: [
    {
      kind: 'content',
      id: 'node_undefined',
      label: 'Unexplained regulator',
      description: 'The passage names the regulator without defining it.',
      conceptIds: ['concept_regulator'],
      undefinedConceptIds: ['concept_regulator'],
      figureStatus: 'not_requested',
      provenance: 'anchored',
      sourceSpan: SOURCE_SPAN,
    },
    {
      kind: 'figure',
      id: 'node_figure',
      figureId: 'figure_123',
      label: 'Rotor arrangement',
      description: 'A depictive view of the fictional rotor inside its housing.',
      caption: 'The rotor sits inside the housing.',
      conceptIds: ['concept_rotor'],
      undefinedConceptIds: [],
      provenance: 'anchored',
      sourceSpan: SOURCE_SPAN,
      labels: [
        {
          id: 'label_rotor',
          text: 'Rotor',
          description: 'The moving part.',
          at: { x: 0.5, y: 0.5 },
          provenance: 'anchored',
          sourceSpan: SOURCE_SPAN,
        },
      ],
    },
  ],
  edges: [
    {
      id: 'edge_regulates',
      fromNodeId: 'node_undefined',
      toNodeId: 'node_figure',
      label: 'regulates',
      provenance: 'anchored',
      sourceSpan: SOURCE_SPAN,
    },
  ],
  groups: [
    {
      id: 'group_mechanism',
      label: 'Mechanism',
      nodeIds: ['node_undefined', 'node_figure'],
      provenance: 'anchored',
      sourceSpan: SOURCE_SPAN,
    },
  ],
} as const;

const FIGURE = {
  id: 'figure_123',
  nodeId: 'node_figure',
  mimeType: 'image/png',
  widthPx: 640,
  heightPx: 360,
  contentHash: '0'.repeat(64),
  description: 'A depictive view of the fictional rotor inside its housing.',
  caption: 'The rotor sits inside the housing.',
  contentPath: '/v1/boards/board_123/figures/node_figure/content',
  provenance: 'anchored',
  sourceSpan: SOURCE_SPAN,
} as const;

const BOARD = {
  id: 'board_123',
  generationId: 'generation_123',
  documentId: 'document_123',
  kind: 'concept_map',
  title: SPEC.title,
  spec: SPEC,
  specVersion: '3.0.0',
  compositionVersion: '2.0.0',
  outline: '# A fictional rotor system\n',
  cachedSvg: null,
  rendererVersion: null,
  nodeCount: 2,
  edgeCount: 1,
  scaffoldNodeCount: 0,
  figureCount: 1,
  figureFailureCount: 0,
  showScaffold: true,
  figureFailureNodeIds: [],
  figures: [FIGURE],
  recallPreview: [
    {
      id: 'recall_123',
      kind: 'short_answer',
      stem: 'What moves in the fictional system?',
      sourceSpan: SOURCE_SPAN,
    },
  ],
} as const;

const PROJECTION = {
  boardId: BOARD.id,
  options: { kind: 'concept_map', includeScaffold: true },
  spec: SPEC,
  figures: [FIGURE],
} as const;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function recordingTransport(responses: Response[]) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const transport: LearningBoredFetch = (input, init = {}) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    requests.push({ url, init });
    const response = responses.shift();
    if (!response) throw new Error('No fake response remains.');
    return Promise.resolve(response);
  };
  return { requests, transport };
}

function figureResponse(): Response {
  return new Response(FIGURE_BYTES, {
    headers: {
      'content-type': 'image/png',
      'content-length': String(FIGURE_BYTES.byteLength),
    },
  });
}

function passage() {
  const selectedText = 'A fictional rotor turns inside a stationary housing.';
  return {
    bookId: 'book-1',
    selectedText,
    surroundingContext: `Before ${selectedText} after`,
    contextOffset: 7,
    location: {
      version: 1 as const,
      kind: 'cfi' as const,
      bookId: 'book-1',
      cfi: 'epubcfi(/6/2!/4/2/1:0)',
      pageIndex: 0,
    },
  };
}

describe('LearningBored SDK Reader adapter', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('mounts the real host with an SDK-backed client from the application provider', async () => {
    const createStudyGeneration = vi.fn<LearningBoredSdkPort['createStudyGeneration']>(
      async () => ({
        id: 'generation_123',
        status: 'queued' as const,
        documentId: 'document_123',
        passageId: 'passage_123',
        compositionVersion: '2.0.0',
        requestedBoardKind: null,
        selectedTextPreview: 'A fictional rotor turns inside a stationary housing.',
        chalkCost: 1,
        chalkBalanceAfterReserve: 9,
        createdAt: '2026-08-02T12:00:00.000Z',
      }),
    );
    const sdk = {
      createStudyGeneration,
      getStudyGeneration: vi.fn(),
      cancelStudyGeneration: vi.fn(),
      retryStudyGeneration: vi.fn(),
      getBoard: vi.fn(),
      rerenderBoard: vi.fn(),
      requestFigureRegeneration: vi.fn(),
      getFigureRegeneration: vi.fn(),
      submitFeedback: vi.fn(),
    } as unknown as LearningBoredSdkPort;

    render(
      <LearningBoredSdkClientProvider sdkClient={sdk}>
        <LearningBoredPanelHost />
      </LearningBoredSdkClientProvider>,
    );

    act(() => {
      publishLearningBoredCapture({ bookKey: 'book-key', passage: passage() });
    });

    await waitFor(() => expect(createStudyGeneration).toHaveBeenCalledTimes(1));
    expect(createStudyGeneration.mock.calls[0]?.[0]).toMatchObject({
      selectedText: 'A fictional rotor turns inside a stationary housing.',
      document: { bookId: 'book-1', title: 'Fictional systems lesson' },
    });
  });

  it('loads a Board through the real SDK, hydrates private bytes, and preserves the full outline', async () => {
    const transport = recordingTransport([
      jsonResponse(BOARD),
      jsonResponse(PROJECTION),
      figureResponse(),
    ]);
    const controller = new AbortController();
    const client = createLearningBoredSdkClient({
      apiBaseUrl: 'https://api.example.test',
      transport: transport.transport,
      getAccessToken: () => 'signed-reader-token',
    });

    const board = await client.getBoard(
      BOARD.id,
      { includeScaffold: true },
      { signal: controller.signal },
    );

    expect(board.figures[0]).toMatchObject({
      id: FIGURE.id,
      nodeId: FIGURE.nodeId,
      imageUrl: 'data:image/png;base64,iVBORw==',
      failed: false,
    });
    expect(board.outline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'node_undefined',
          undefined: true,
          undefinedConceptIds: ['concept_regulator'],
        }),
        expect.objectContaining({
          id: 'node_figure',
          labels: [expect.objectContaining({ text: 'Rotor', at: { x: 0.5, y: 0.5 } })],
        }),
        expect.objectContaining({
          id: 'relationship:edge_regulates',
          kind: 'relationship',
          label: 'Unexplained regulator → Rotor arrangement',
        }),
        expect.objectContaining({
          id: 'group:group_mechanism',
          kind: 'group',
          description: 'Unexplained regulator, Rotor arrangement',
        }),
      ]),
    );
    expect(transport.requests.map((request) => request.url)).toEqual([
      'https://api.example.test/v1/boards/board_123',
      'https://api.example.test/v1/boards/board_123/rerender',
      'https://api.example.test/v1/boards/board_123/figures/node_figure/content',
    ]);
    for (const request of transport.requests) {
      expect(request.init.credentials).toBe('include');
      expect(request.init.signal).toBe(controller.signal);
      expect(new Headers(request.init.headers).get('authorization')).toBe(
        'Bearer signed-reader-token',
      );
    }
  });

  it('keeps figure labels and structural meaning when private hydration fails', async () => {
    const transport = recordingTransport([
      jsonResponse(BOARD),
      jsonResponse(PROJECTION),
      jsonResponse({ error: 'figure_not_found', message: 'Figure not found.' }, 404),
    ]);
    const client = createLearningBoredSdkClient({
      apiBaseUrl: 'https://api.example.test',
      transport: transport.transport,
    });

    const board = await client.getBoard(BOARD.id, { includeScaffold: true });

    expect(board.figures[0]).toMatchObject({
      imageUrl: null,
      failed: true,
      labels: [
        expect.objectContaining({
          text: 'Rotor',
          description: 'The moving part.',
          sourceSpan: SOURCE_SPAN,
        }),
      ],
    });
    expect(board.outline.find((item) => item.id === 'node_figure')).toMatchObject({
      figureFailed: true,
      labels: [expect.objectContaining({ text: 'Rotor' })],
    });
  });
});
