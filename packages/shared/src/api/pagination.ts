/**
 * Cursor- and offset-pagination primitives shared across features. Cursor-based
 * is preferred for infinite scroll (CLAUDE.md Performance Rules); offset is
 * included for admin/CLI surfaces.
 */

export type PaginationParams = {
  limit: number;
  cursor?: string | null;
  page?: number;
};

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
  total?: number;
};
