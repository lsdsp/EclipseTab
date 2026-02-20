import { DockItem } from '../types';
import { getDomainFromUrl, normalizeUrl } from './url';

export interface BookmarkNodeLike {
  id?: string;
  title?: string;
  url?: string;
  children?: BookmarkNodeLike[];
}

export interface BookmarkCandidate {
  title: string;
  url: string;
  domain: string;
}

export interface BookmarkImportOptions {
  limit: number;
  mergeByDomain: boolean;
}

export interface BookmarkImportPreview {
  total: number;
  selected: BookmarkCandidate[];
  skippedExistingUrl: number;
  skippedDomainMerged: number;
  skippedInvalid: number;
}

const walkBookmarkNodes = (nodes: BookmarkNodeLike[], output: BookmarkNodeLike[]): void => {
  nodes.forEach((node) => {
    if (node.url) {
      output.push(node);
    }
    if (node.children?.length) {
      walkBookmarkNodes(node.children, output);
    }
  });
};

export const extractBookmarkLinks = (tree: BookmarkNodeLike[]): BookmarkNodeLike[] => {
  const output: BookmarkNodeLike[] = [];
  walkBookmarkNodes(tree, output);
  return output;
};

const collectExistingUrls = (dockItems: DockItem[]): Set<string> => {
  const urls = new Set<string>();
  const walk = (items: DockItem[]) => {
    items.forEach((item) => {
      if (item.type === 'folder' && item.items) {
        walk(item.items);
        return;
      }
      if (!item.url) return;
      try {
        urls.add(normalizeUrl(item.url));
      } catch {
        // ignore invalid url in legacy data
      }
    });
  };
  walk(dockItems);
  return urls;
};

export const buildBookmarkImportPreview = (
  bookmarkTree: BookmarkNodeLike[],
  existingDockItems: DockItem[],
  options: BookmarkImportOptions
): BookmarkImportPreview => {
  const limit = Math.max(1, options.limit);
  const existingUrls = collectExistingUrls(existingDockItems);
  const seenIncomingUrls = new Set<string>();
  const seenDomains = new Set<string>();

  let skippedExistingUrl = 0;
  let skippedDomainMerged = 0;
  let skippedInvalid = 0;

  const selected: BookmarkCandidate[] = [];
  const links = extractBookmarkLinks(bookmarkTree);

  for (const node of links) {
    if (selected.length >= limit) {
      break;
    }

    if (!node.url) {
      skippedInvalid += 1;
      continue;
    }

    let normalizedUrl = '';
    try {
      normalizedUrl = normalizeUrl(node.url);
    } catch {
      skippedInvalid += 1;
      continue;
    }

    if (existingUrls.has(normalizedUrl) || seenIncomingUrls.has(normalizedUrl)) {
      skippedExistingUrl += 1;
      continue;
    }

    const domain = getDomainFromUrl(normalizedUrl);
    if (options.mergeByDomain && seenDomains.has(domain)) {
      skippedDomainMerged += 1;
      continue;
    }

    seenIncomingUrls.add(normalizedUrl);
    if (options.mergeByDomain) {
      seenDomains.add(domain);
    }

    selected.push({
      title: (node.title || domain || 'Bookmark').trim() || domain || 'Bookmark',
      url: normalizedUrl,
      domain,
    });
  }

  return {
    total: links.length,
    selected,
    skippedExistingUrl,
    skippedDomainMerged,
    skippedInvalid,
  };
};

export const createDockItemsFromBookmarks = (bookmarks: BookmarkCandidate[]): DockItem[] => {
  return bookmarks.map((bookmark, index) => ({
    id: `bookmark_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    name: bookmark.title,
    url: bookmark.url,
    type: 'app',
  }));
};

