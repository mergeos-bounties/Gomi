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

/** CSS class name for each diff line type */
const DIFF_TYPE_CLASS: Record<DiffLine['type'], string> = {
  added: 'gomi-diff-added',
  removed: 'gomi-diff-removed',
  header: 'gomi-diff-header',
  context: 'gomi-diff-context',
};

const DIFF_TYPE_LABEL: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  header: ' ',
  context: ' ',
};

/**
 * Parses a unified diff and returns an array of highlighted HTML line strings.
 * Each line is wrapped in a <div> with the appropriate CSS class.
 */
export function highlightDiffForDisplay(diff: string): string {
  const lines = parseDiffForHighlight(diff);
  const stats = getDiffStats(lines);
  const header = `<div class="gomi-diff-stats">+${stats.added} / -${stats.removed} / ${stats.total} lines</div>`;
  const body = lines.map((l) => {
    const cls = DIFF_TYPE_CLASS[l.type];
    const label = DIFF_TYPE_LABEL[l.type];
    return `<div class="${cls}"><span class="gomi-diff-marker">${label}</span>${escapeHtml(l.content.slice(1))}</div>`;
  }).join('\n');
  return header + '\n' + body;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
