/** Custom department/agent roles #32 */
export interface CustomRole{id:string;name:string;role:string;icon:string}
export class CustomRoleRegistry{private roles:CustomRole[]=[];add(r:CustomRole):void{this.roles.push(r)}remove(id:string):boolean{const i=this.roles.findIndex(r=>r.id===id);if(i===-1)return false;this.roles.splice(i,1);return true}getAll():CustomRole[]{return[...this.roles]}get(id:string):CustomRole|undefined{return this.roles.find(r=>r.id===id)}}
