export interface FavoritePoem {
  id: string;
  content: string;
  poem_title: string;
  author: string;
  createdAt: string;
  shareImage?: string;
  shareImageCreatedAt?: string;
}

const FAVORITES_KEY = 'blindpoem.favorites.v1';
const MAX_FAVORITES = 60;

export function getFavoriteId(content: string, poemTitle: string, author: string): string {
  return `${content.trim()}|${poemTitle.trim()}|${author.trim()}`;
}

function parseFavorites(raw: string | null): FavoritePoem[] {
  if (!raw) return [];

  try {
    const favorites = JSON.parse(raw) as FavoritePoem[];
    return Array.isArray(favorites)
      ? favorites.filter((favorite) => favorite?.id && favorite.content)
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

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(nextFavorites));
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
  const existingFavorite = existingFavorites.find((favorite) => favorite.id === id);
  const nextFavorite: FavoritePoem = {
    ...existingFavorite,
    id,
    content: poem.content,
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

export function updateFavoriteShareImage(favoriteId: string, shareImage: string): FavoritePoem[] {
  return writeFavorites(
    readFavorites().map((favorite) => (
      favorite.id === favoriteId
        ? {
            ...favorite,
            shareImage,
            shareImageCreatedAt: new Date().toISOString(),
          }
        : favorite
    ))
  );
}
