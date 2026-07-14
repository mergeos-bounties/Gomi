/** Prompt template library (issue #34) */
export interface PromptTemplate { id: string; name: string; systemPrompt: string; userPrompt: string; tags: string[]; }
export class PromptTemplateLibrary {
  private templates: PromptTemplate[] = []; private idCounter = 0;
  add(name: string, systemPrompt: string, userPrompt: string, tags: string[] = []): PromptTemplate {
    const t: PromptTemplate = { id: `tmpl-${++this.idCounter}`, name, systemPrompt, userPrompt, tags };
    this.templates.push(t); return t;
  }
  remove(id: string): boolean { const idx = this.templates.findIndex(t => t.id === id); if (idx === -1) return false; this.templates.splice(idx, 1); return true; }
  search(query: string): PromptTemplate[] { const q = query.toLowerCase(); return this.templates.filter(t => t.name.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q))); }
  getAll(): PromptTemplate[] { return [...this.templates]; }
  apply(id: string): { systemPrompt: string; userPrompt: string } | null { const t = this.templates.find(t => t.id === id); return t ? { systemPrompt: t.systemPrompt, userPrompt: t.userPrompt } : null; }
}
