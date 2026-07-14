/** Syntax-highlight unified diff (issue #37) */
export interface DiffLine { type: 'context' | 'added' | 'removed' | 'header'; content: string; lineNo?: { old?: number; new?: number }; }
export function parseDiffForHighlight(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0; let newLine = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git') || line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) { oldLine = parseInt(match[1]); newLine = parseInt(match[2]); }
      }
      lines.push({ type: 'header', content: line }); continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) { lines.push({ type: 'added', content: line, lineNo: { new: newLine++ } }); }
    else if (line.startsWith('-') && !line.startsWith('---')) { lines.push({ type: 'removed', content: line, lineNo: { old: oldLine++ } }); }
    else { lines.push({ type: 'context', content: line, lineNo: { old: oldLine++, new: newLine++ } }); }
  }
  return lines;
}
export function getDiffStats(lines: DiffLine[]): { added: number; removed: number; total: number } {
  let added = 0, removed = 0;
  for (const l of lines) { if (l.type === 'added') added++; if (l.type === 'removed') removed++; }
  return { added, removed, total: lines.length };
}
