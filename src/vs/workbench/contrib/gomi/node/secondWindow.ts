/** Electron second window stub #28 */
export interface SecondWindowConfig{url:string;width:number;height:number}
export function createSecondWindowConfig(config:Partial<SecondWindowConfig>={}):SecondWindowConfig{return{url:config.url??'about:blank',width:config.width??1024,height:config.height??768}}
export function isSecondWindowSupported():boolean{try{require('electron');return true}catch{return false}}
