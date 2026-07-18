/** Drag-and-drop file context #42 */
export interface DroppedFile{name:string;path:string;size:number;type:string}
export function parseDropEvent(e:{dataTransfer?:{files?:Array<{name:string;path?:string;size:number;type:string}>}}):DroppedFile[]|null{const f=e.dataTransfer?.files;if(!f||f.length===0)return null;return Array.from(f).map(x=>({name:x.name,path:x.path??x.name,size:x.size,type:x.type}))}
