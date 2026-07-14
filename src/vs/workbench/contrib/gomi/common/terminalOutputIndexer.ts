/** Terminal output capture for project context (issue #31) */
export interface TerminalSnippet { output: string; cwd?: string; command?: string; exitCode?: number; timestamp: number; }
export class TerminalOutputCapture {
  private snippets: TerminalSnippet[] = []; private maxSnippets: number; private maxOutputLength: number;
  constructor(maxSnippets = 20, maxOutputLength = 4000) { this.maxSnippets = maxSnippets; this.maxOutputLength = maxOutputLength; }
  capture(output: string, cwd?: string, command?: string, exitCode?: number): TerminalSnippet {
    const snippet: TerminalSnippet = { output: output.slice(0, this.maxOutputLength), cwd, command, exitCode, timestamp: Date.now() };
    this.snippets.push(snippet); if (this.snippets.length > this.maxSnippets) this.snippets.shift(); return snippet;
  }
  getRecent(count?: number): TerminalSnippet[] { return this.snippets.slice(-(count ?? 10)); }
  getContextString(): string { return this.snippets.map(s => `[${s.command ?? 'shell'}] (exit: ${s.exitCode ?? '?'})\n${s.output}`).join('\n\n'); }
}
