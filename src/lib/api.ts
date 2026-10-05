export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
let refreshing:Promise<boolean>|null=null;
async function refreshSession(){
 if(!refreshing)refreshing=fetch('/api/auth/refresh',{method:'POST',credentials:'include'}).then(r=>r.ok).catch(()=>false).finally(()=>{refreshing=null;});
 return refreshing;
}
export async function api<T>(path:string,init:RequestInit={},retry=true):Promise<T>{
 const response=await fetch('/api'+path,{...init,credentials:'include',headers:{...(init.body instanceof FormData?{}:{'Content-Type':'application/json'}),...init.headers}});
 if(response.status===401&&retry&&!['/auth/login','/auth/refresh','/auth/forgot-password','/auth/reset-password'].includes(path)){
  if(await refreshSession())return api<T>(path,init,false);
 }
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const raw=body.error?.message;throw new ApiError(response.status,Array.isArray(raw)?raw.join(' '):raw||"We couldn't complete that request. Please try again.");}
 return body.data as T;
}
export const write=<T>(path:string,body:unknown,method='POST')=>api<T>(path,{method,body:JSON.stringify(body)});
export type Actor={id:string;email:string;displayName:string;roles:string[];permissions:string[];customerId?:string;sessionId:string};
export const can=(actor:Actor|undefined,permission:string)=>!!actor&&(actor.permissions.includes('*')||actor.permissions.includes(permission));
// Dynamic resource documents mirror the validated REST contract at the view boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row=Record<string,any>;
export type Page={items:Row[];total:number;page:number;limit:number;totalPages:number};
export const money=(value:number|string|null|undefined)=>value==null?'On request':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value));
export const day=(value:string|undefined,short=false)=>value?new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-US',{month:short?'short':'long',day:'numeric',year:short?undefined:'numeric',timeZone:'America/Nassau'}):'To be arranged';
export const time=(value:string|undefined)=>value?new Date('2000-01-01T'+value.slice(0,5)+':00Z').toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}):'';
export const stamp=(value:string)=>new Date(value).toLocaleString('en-US',{timeZone:'America/Nassau',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

