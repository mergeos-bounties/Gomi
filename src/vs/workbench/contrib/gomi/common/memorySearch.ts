/** Memory board search + filter (issue #9) */
export interface MemoryBoardItem { id: string; key: string; title: string; content: string; source: string; kind: string; createdAt: string; }
export function searchMemoryBoard(items: MemoryBoardItem[], query: string): MemoryBoardItem[] {
  if (!query.trim()) return items;
  const terms = query.toLowerCase().trim().split(/\s+/);
  return items.filter(item => {
    const text = [item.key, item.title, item.content, item.kind].join(' ').toLowerCase();
    return terms.every(t => text.includes(t));
  });
}
export function filterMemoryByKind(items: MemoryBoardItem[], kind: string): MemoryBoardItem[] {
  return kind ? items.filter(i => i.kind === kind) : items;
}
export function filterMemoryBySource(items: MemoryBoardItem[], source: string): MemoryBoardItem[] {
  return source ? items.filter(i => i.source === source) : items;
}
