export interface FavoritePoem {
  id: string;
  content: string;
  poem_title: string;
  author: string;
  createdAt: string;
  shareImage?: string;
  shareImageCreatedAt?: string;
  shareBackgroundImage?: string;
  shareBackgroundSource?: 'ai' | 'semantic-fallback' | 'local-fallback';
  shareLayout?: unknown;
  shareDefaultLayout?: unknown;
}

const FAVORITES_KEY = 'blindpoem.favorites.v1';
const MAX_FAVORITES = 60;

function isStorageQuotaError(error: unknown): boolean {
  const storageError = error as { name?: string; code?: number } | null;
  if (!storageError) return false;

  return (
    storageError.name === 'QuotaExceededError' ||
    storageError.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    storageError.code === 22 ||
    storageError.code === 1014
  );
}

function normalizeFavoriteContent(content: string): string {
  const lines = content
    .replace(/[/／\\|]+/g, '\n')
    .replace(/[，。、；！？,.!?;:：]+/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.replace(/[“”"‘’'《》〈〉「」『』（）()【】[\]{}]/g, '').trim())
    .filter(Boolean);

  return lines.join('\n') || content.trim();
}

function isDataImage(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function prepareFavoritesForStorage(favorites: FavoritePoem[]): FavoritePoem[] {
  return favorites.map((favorite) => ({
    ...favorite,
    // Final posters are reproducible from the clean background + layout, and are too
    // large for mobile localStorage once a few favorites accumulate.
    shareImage: undefined,
    shareBackgroundImage: isDataImage(favorite.shareBackgroundImage)
      ? undefined
      : favorite.shareBackgroundImage,
  }));
}

export function getFavoriteId(content: string, poemTitle: string, author: string): string {
  return `${normalizeFavoriteContent(content)}|${poemTitle.trim()}|${author.trim()}`;
}

function parseFavorites(raw: string | null): FavoritePoem[] {
  if (!raw) return [];

  try {
    const favorites = JSON.parse(raw) as FavoritePoem[];
    return Array.isArray(favorites)
      ? favorites
          .filter((favorite) => favorite?.id && favorite.content)
          .map((favorite) => ({
            ...favorite,
            id: getFavoriteId(favorite.content, favorite.poem_title || '', favorite.author || ''),
            content: normalizeFavoriteContent(favorite.content),
          }))
      : [];
  } catch (error) {
    console.warn('⚠️ 读取收藏夹失败：', error);
    return [];
  }
}

export function readFavorites(): FavoritePoem[] {
  if (typeof window === 'undefined') return [];
  return parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
}

export function writeFavorites(favorites: FavoritePoem[]): FavoritePoem[] {
  const nextFavorites = favorites.slice(0, MAX_FAVORITES);
  const storedFavorites = prepareFavoritesForStorage(nextFavorites);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(storedFavorites));
    } catch (error) {
      if (!isStorageQuotaError(error)) {
        console.warn('⚠️ 写入收藏夹失败：', error);
        return nextFavorites;
      }

      console.warn('⚠️ 收藏夹图片缓存已满，正在降级保存文字和最近分享图：', error);

      const compactFavorites = storedFavorites.map((favorite) => ({
        ...favorite,
        shareBackgroundImage: undefined,
        shareDefaultLayout: undefined,
      }));

      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(compactFavorites));
      } catch (compactError) {
        console.warn('⚠️ 收藏夹图片缓存仍然过大，仅保存诗句文字：', compactError);

        const textOnlyFavorites = nextFavorites.map((favorite) => ({
          ...favorite,
          shareImage: undefined,
          shareImageCreatedAt: undefined,
          shareBackgroundImage: undefined,
          shareLayout: undefined,
          shareDefaultLayout: undefined,
        }));

        try {
          window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(textOnlyFavorites));
        } catch (textOnlyError) {
          console.warn('⚠️ 收藏夹文字缓存保存失败：', textOnlyError);
        }
      }
    }
  }

  return nextFavorites;
}

export function addFavorite(poem: {
  content: string;
  poem_title: string;
  author: string;
}): FavoritePoem[] {
  const id = getFavoriteId(poem.content, poem.poem_title, poem.author);
  const existingFavorites = readFavorites();
  const existingFavorite = existingFavorites.find((favorite) => (
    favorite.id === id ||
    getFavoriteId(favorite.content, favorite.poem_title, favorite.author) === id
  ));
  const nextFavorite: FavoritePoem = {
    ...existingFavorite,
    id,
    content: normalizeFavoriteContent(poem.content),
    poem_title: poem.poem_title,
    author: poem.author,
    createdAt: existingFavorite?.createdAt || new Date().toISOString(),
  };

  return writeFavorites([
    nextFavorite,
    ...existingFavorites.filter((favorite) => favorite.id !== id),
  ]);
}

export function removeFavorite(favoriteId: string): FavoritePoem[] {
  return writeFavorites(readFavorites().filter((favorite) => favorite.id !== favoriteId));
}

export function updateFavoriteShareImage(
  favoriteId: string,
  shareImage: string,
  metadata: Pick<FavoritePoem, 'shareBackgroundImage' | 'shareLayout'> & Partial<Pick<FavoritePoem, 'shareDefaultLayout' | 'shareBackgroundSource'>> = {},
  sourceFavorites = readFavorites()
): FavoritePoem[] {
  return writeFavorites(
    sourceFavorites.map((favorite) => (
      favorite.id === favoriteId
        ? {
            ...favorite,
            shareImage,
            shareImageCreatedAt: new Date().toISOString(),
            ...metadata,
          }
        : favorite
    ))
  );
}
