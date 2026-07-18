/** Demo scenarios #40 */
export interface DemoStep{agentId:string;action:string;detail:string;delay:number}
export interface DemoScenario{id:string;name:string;steps:DemoStep[]}
export function getScenarios():DemoScenario[]{return[{id:'code-review',name:'Code Review',steps:[{agentId:'ceo',action:'plan',detail:'Review login module',delay:0},{agentId:'qa',action:'analyze',detail:'Check edge cases',delay:2000}]},{id:'feature-plan',name:'Feature Planning',steps:[{agentId:'ceo',action:'plan',detail:'Plan REST API',delay:0}]}]}
