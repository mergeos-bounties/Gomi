/** SecureKeyStore for provider API keys (#47) */
export interface SecureKeyStore { getKey(id:string):Promise<string|undefined>; setKey(id:string,key:string):Promise<void>; }
