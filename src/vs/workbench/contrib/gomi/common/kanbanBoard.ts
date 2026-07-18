/** Live task kanban #23 */
export type KanbanColumn='queued'|'running'|'done'|'blocked';
export interface KanbanTask{id:string;title:string;column:KanbanColumn;agentId?:string}
export class KanbanBoard{private tasks:KanbanTask[]=[];add(t:KanbanTask):void{this.tasks.push(t)}move(id:string,col:KanbanColumn):boolean{const t=this.tasks.find(x=>x.id===id);if(!t)return false;t.column=col;return true}getByColumn(col:KanbanColumn):KanbanTask[]{return this.tasks.filter(t=>t.column===col)}getAll():KanbanTask[]{return[...this.tasks]}}
