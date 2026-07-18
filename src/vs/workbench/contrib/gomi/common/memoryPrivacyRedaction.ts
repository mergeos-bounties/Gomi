/** Shared project memory privacy redactions #75 */
const PATTERNS=[{p:/sk-[a-zA-Z0-9]{20,}/g,r:'[REDACTED:API_KEY]'},{p:/ghp_[a-zA-Z0-9]{36}/g,r:'[REDACTED:GITHUB]'},{p:/github_pat_[a-zA-Z0-9_]{20,}/g,r:'[REDACTED:PAT]'}];
export function redactMemory(c:string):{redacted:string,safe:boolean}{let r=c;for(const{p:pat,repl}of PATTERNS){const b=r;r=r.replace(pat,repl)}return{redacted:r,safe:r===c}}
