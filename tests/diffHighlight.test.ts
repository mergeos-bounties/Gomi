import { describe, expect, it } from 'vitest';
import {
  parseDiffForHighlight,
  getDiffStats,
  highlightDiffForDisplay,
} from '../src/vs/workbench/contrib/gomi/common/diffHighlight';

const SAMPLE_DIFF = `diff --git a/src/main.ts b/src/main.ts
index abc..def 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,5 +1,7 @@
 const x = 1;
-const y = 2;
+const y = 3;
+const z = 4;
 function greet() {
   console.log('hello');
 }
@@ -10,3 +12,4 @@ function farewell() {
   console.log('bye');
 }
+export default greet;
`;

describe('diff highlighting (bounty #37)', () => {
  describe('parseDiffForHighlight', () => {
    it('parses a sample diff into typed lines', () => {
      const lines = parseDiffForHighlight(SAMPLE_DIFF);
      expect(lines.length).toBeGreaterThan(0);
      const types = lines.map(l => l.type);
      expect(types).toContain('header');
      expect(types).toContain('added');
      expect(types).toContain('removed');
      expect(types).toContain('context');
    });

    it('classifies header lines', () => {
      const lines = parseDiffForHighlight(SAMPLE_DIFF);
      expect(lines[0].type).toBe('header');
      expect(lines[0].content).toContain('diff --git');
    });

    it('tracks line numbers for @@ hunks', () => {
      const lines = parseDiffForHighlight(SAMPLE_DIFF);
      const headerLine = lines.find(l => l.type === 'header' && l.content.startsWith('@@'));
      expect(headerLine).toBeDefined();
      expect(headerLine?.content).toMatch(/^@@ -1,5 \+1,7 @@/);
    });
  });

  describe('getDiffStats', () => {
    it('counts additions and removals', () => {
      const lines = parseDiffForHighlight(SAMPLE_DIFF);
      const stats = getDiffStats(lines);
      expect(stats.added).toBe(3);
      expect(stats.removed).toBe(1);
      expect(stats.total).toBe(lines.length);
    });
  });

  describe('highlightDiffForDisplay', () => {
    it('returns HTML with CSS class wrappers', () => {
      const html = highlightDiffForDisplay(SAMPLE_DIFF);
      expect(html).toContain('gomi-diff-added');
      expect(html).toContain('gomi-diff-removed');
      expect(html).toContain('gomi-diff-header');
      expect(html).toContain('gomi-diff-stats');
    });

    it('includes diff stats summary', () => {
      const html = highlightDiffForDisplay(SAMPLE_DIFF);
      expect(html).toContain('+3 / -1');
    });

    it('escapes HTML special characters', () => {
      const dangerousDiff = '+<script>alert("xss")</script>';
      const html = highlightDiffForDisplay(dangerousDiff);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('returns empty output for empty diff', () => {
      const html = highlightDiffForDisplay('');
      const lines = html.split('\n').filter(l => l.trim());
      expect(lines[0]).toContain('0 /');
    });
  });
});
