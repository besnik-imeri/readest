import type { Book, BookFormat } from '@/types/book';
import type { EnvConfigType } from '@/services/environment';
import { INIT_BOOK_CONFIG, getLocalBookFilename } from '@/utils/book';
import { createStoryBoredReaderClient, isStoryBoredReaderEnabled } from './client';
import type { StoryBoredOwnedLibrary } from './types';

const SUPPORTED_MARKETPLACE_FORMATS = new Set<BookFormat>([
  'EPUB',
  'PDF',
  'MOBI',
  'AZW',
  'AZW3',
  'CBZ',
  'FB2',
  'FBZ',
  'TXT',
  'MD',
]);

function toBookFormat(format: string): BookFormat {
  const normalized = format.toUpperCase() as BookFormat;
  return SUPPORTED_MARKETPLACE_FORMATS.has(normalized) ? normalized : 'EPUB';
}

function toMarketplaceBook(item: StoryBoredOwnedLibrary['libraryItems'][number]): Book {
  const now = Date.now();

  return {
    hash: item.bookId,
    format: toBookFormat(item.format),
    title: item.title,
    sourceTitle: item.title,
    author: item.author ?? '',
    primaryLanguage: item.language ?? 'en',
    coverImageUrl: item.coverImageUrl,
    createdAt: new Date(item.acquiredAt).getTime() || now,
    updatedAt: now,
    deletedAt: null,
    uploadedAt: now,
    downloadedAt: null,
    coverDownloadedAt: item.coverImageUrl ? now : null,
    syncedAt: now,
    groupName: 'StoryBored Marketplace',
    marketplace: {
      libraryItemId: item.libraryItemId,
      listingId: item.listingId,
      grantedByListingId: item.grantedByListingId,
      slug: item.slug,
      entitlementStatus: item.entitlementStatus,
      offlineCachedAt: null,
      hasScenePack: item.hasScenePack,
    },
    exportAllowed: item.exportAllowed,
  };
}

export async function syncStoryBoredMarketplaceLibrary(input: {
  envConfig: EnvConfigType;
  token?: string | null;
  library: Book[];
}): Promise<Book[]> {
  if (!isStoryBoredReaderEnabled()) {
    return input.library;
  }

  const client = createStoryBoredReaderClient(input.token ? { accessToken: input.token } : {});
  const owned = await client.listOwnedLibrary();

  const nextLibrary = [...input.library];
  const activeLibraryItemIds = new Set(owned.libraryItems.map((item) => item.libraryItemId));
  let changed = false;

  for (const item of owned.libraryItems) {
    const idx = nextLibrary.findIndex(
      (book) => book.marketplace?.libraryItemId === item.libraryItemId || book.hash === item.bookId,
    );
    const marketplaceBook = toMarketplaceBook(item);

    if (idx === -1) {
      nextLibrary.unshift(marketplaceBook);
      changed = true;
    } else {
      const existing = nextLibrary[idx]!;
      nextLibrary[idx] = {
        ...existing,
        title: existing.title || marketplaceBook.title,
        author: existing.author || marketplaceBook.author,
        coverImageUrl: existing.coverImageUrl || marketplaceBook.coverImageUrl,
        deletedAt: null,
        uploadedAt: existing.uploadedAt ?? marketplaceBook.uploadedAt,
        syncedAt: Date.now(),
        marketplace: {
          ...marketplaceBook.marketplace!,
          offlineCachedAt: existing.marketplace?.offlineCachedAt ?? null,
          contentUrlExpiresAt: existing.marketplace?.contentUrlExpiresAt ?? null,
        },
        exportAllowed: false,
      };
      changed = true;
    }
  }

  for (let index = 0; index < nextLibrary.length; index += 1) {
    const book = nextLibrary[index]!;
    const marketplace = book.marketplace;
    if (!marketplace || activeLibraryItemIds.has(marketplace.libraryItemId)) {
      continue;
    }

    nextLibrary[index] = {
      ...book,
      deletedAt: book.deletedAt ?? Date.now(),
      downloadedAt: null,
      marketplace: {
        ...marketplace,
        entitlementStatus: 'revoked',
        offlineCachedAt: null,
        contentUrlExpiresAt: null,
      },
    };
    changed = true;
  }

  if (!changed) {
    return input.library;
  }

  const appService = await input.envConfig.getAppService();
  await appService.saveLibraryBooks(nextLibrary);
  return nextLibrary;
}

export async function cacheStoryBoredMarketplaceBook(input: {
  envConfig: EnvConfigType;
  token?: string | null;
  book: Book;
}): Promise<Book> {
  const marketplace = input.book.marketplace;
  if (!marketplace?.libraryItemId) {
    return input.book;
  }

  const { libraryItemId } = marketplace;
  const client = createStoryBoredReaderClient(input.token ? { accessToken: input.token } : {});
  const content = await client.getOwnedLibraryContent(libraryItemId);
  const response = await fetch(content.contentUrl);

  if (!response.ok) {
    throw new Error(`Marketplace content download failed with status ${response.status}`);
  }

  const appService = await input.envConfig.getAppService();
  if (!(await appService.exists(input.book.hash, 'Books'))) {
    await appService.createDir(input.book.hash, 'Books', true);
  }
  await appService.writeFile(
    getLocalBookFilename(input.book),
    'Books',
    await response.arrayBuffer(),
  );
  await appService.saveBookConfig(input.book, {
    ...INIT_BOOK_CONFIG,
    bookHash: input.book.hash,
    updatedAt: Date.now(),
  });

  return {
    ...input.book,
    url: content.contentUrl,
    downloadedAt: Date.now(),
    updatedAt: Date.now(),
    marketplace: {
      ...marketplace,
      libraryItemId,
      offlineCachedAt: Date.now(),
      contentUrlExpiresAt: new Date(content.expiresAt).getTime(),
    },
  };
}
