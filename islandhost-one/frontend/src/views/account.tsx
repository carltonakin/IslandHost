'use client';
import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCheck,Check,MessageCircle,ArrowUpRight,Bell } from 'lucide-react';
import { api,write,Page,Row,can,stamp } from '@/lib/api';
import { useActor } from '@/lib/providers';
import { PageTitle,Panel,Form,Pager,Empty,Loading,ErrorState,Field } from '@/components/ui';
import { preferenceFields } from './customers';
function Profile({preferences=false}:{preferences?:boolean}){
 const {data:a}=useActor();const path=preferences?'/customers/me':'/users/me';
 const q=useQuery({queryKey:[path],queryFn:()=>api<Row>(path),enabled:!preferences||!!a?.customerId});
 if(preferences&&!a?.customerId)return <Empty title="Guest preferences" description="Preferences are attached to customer accounts. You can manage a guest’s preferences from Customers."/>;
 if(q.isPending)return <Loading/>;if(q.error)return <ErrorState error={q.error}/>;
 return <><PageTitle eyebrow="A MORE PERSONAL EXPERIENCE" title={preferences?'The little things make it yours.':'A little about you.'} description={preferences?'Tell us what you love, what you need, and what makes you feel at home.':'Keep your personal details up to date.'}/><Panel title={preferences?'Your preferences':'Your details'} className="narrow-panel"><div className="padded">{!preferences&&<p className="profile-email">{q.data!.Email}</p>}<Form fields={preferences?preferenceFields:[{name:'DisplayName',label:'Full name',required:true,max:120},{name:'Phone',label:'Phone number',max:40}]} initial={preferences?q.data!.Preferences:q.data} endpoint={preferences?'/customers/'+a!.customerId+'/preferences':'/users/me'} method="PATCH"/></div></Panel></>;
}
function Password(){
 const router=useRouter();const client=useQueryClient();
 return <><PageTitle eyebrow="YOUR ACCOUNT" title="A fresh password." description="Choose a unique password with at least 12 characters."/><Panel title="Change your password" className="narrow-panel"><div className="padded"><Form fields={[{name:'currentPassword',label:'Current password',type:'password',required:true},{name:'password',label:'New password',type:'password',required:true}]} endpoint="/auth/change-password" onSuccess={()=>{client.clear();router.replace('/login');}} submit="Change password and sign out"/></div></Panel></>;
}
function Notifications(){
 const [page,setPage]=useState(1);const [unread,setUnread]=useState(false);const [error,setError]=useState<Error|null>(null);const client=useQueryClient();
 const path='/notifications?page='+page+(unread?'&status=unread':'');
 const q=useQuery({queryKey:[path],queryFn:()=>api<Page>(path)});
 async function mark(id?:string){
  setError(null);const previous=q.data;
  client.setQueryData<Page>([path],old=>old?{...old,items:old.items.map(n=>!id||n.Id===id?{...n,ReadAt:new Date().toISOString()}:n)}:old);
  try{await write(id?'/notifications/'+id+'/read':'/notifications/read-all',{},id?'PATCH':'POST');await client.invalidateQueries();}catch(e){client.setQueryData([path],previous);setError(e as Error);}
 }
 return <><PageTitle eyebrow="A LITTLE UPDATE" title="Every detail, shared with you." description="Keep up with your plans and messages from your concierge." action={<button className="button secondary" onClick={()=>mark()}><CheckCheck size={17}/>Mark all as read</button>}/><div className="page-tabs"><button className={!unread?'selected':''} onClick={()=>{setUnread(false);setPage(1);}}>All updates</button><button className={unread?'selected':''} onClick={()=>{setUnread(true);setPage(1);}}>Unread</button></div>{error&&<ErrorState error={error}/>} {q.isPending?<Loading/>:q.error?<ErrorState error={q.error}/>:q.data?.items.length?<Panel>{q.data.items.map(n=><article className={'notification-row '+(!n.ReadAt?'unread':'')} key={n.Id}><span className="list-icon"><Bell size={18}/></span><div className="grow"><strong>{n.Title}</strong><p>{n.Body}</p><small>{stamp(n.CreatedAt)}</small>{n.Link&&<Link className="text-link" href={n.Link}>View update<ArrowUpRight size={13}/></Link>}</div>{!n.ReadAt&&<button className="icon-button" aria-label={'Mark '+n.Title+' as read'} onClick={()=>mark(n.Id)}><Check size={17}/></button>}</article>)}</Panel>:<Empty title="You’re all caught up" description="New updates will find their way here."/>}{q.data&&<Pager data={q.data} onPage={setPage}/>}</>;
}
function Messages(){
 const {data:a}=useActor();const staff=can(a,'operations.read');const [page,setPage]=useState(1);const [customer,setCustomer]=useState('');
 const customers=useQuery({queryKey:['message-customers'],queryFn:()=>api<Page>('/customers?limit=100'),enabled:staff});
 const path='/messages?page='+page+(customer?'&customerId='+customer:'');
 const q=useQuery({queryKey:[path],queryFn:()=>api<Page>(path),refetchInterval:30000});
 const fields:Field[]=[...(staff?[{name:'CustomerId',label:'To',source:'/customers',sourceLabel:'DisplayName',required:true}]:[]),{name:'Body',label:'Your message',type:'textarea',required:true,max:4000}];
 return <><PageTitle eyebrow="ALWAYS A PERSONAL CONNECTION" title="A little conversation goes a long way." description="Your concierge is here for the big plans and the little details."/><div className="messages-layout"><Panel title="Your conversations" action={<MessageCircle size={18}/>}>{staff&&<div className="padded"><select aria-label="Filter conversation" value={customer} onChange={e=>{setCustomer(e.target.value);setPage(1);}}><option value="">All customers</option>{customers.data?.items.map(c=><option key={c.Id} value={c.Id}>{c.DisplayName}</option>)}</select></div>}{q.isPending?<Loading/>:q.error?<ErrorState error={q.error}/>:q.data?.items.length?<div className="message-list">{q.data.items.map(m=><article className={'message '+(m.SenderId===a?.id?'own':'')} key={m.Id}><div><strong>{m.SenderName}</strong><small>{stamp(m.CreatedAt)}</small></div>{staff&&<span className="eyebrow">{m.CustomerName}</span>}<p>{m.Body}</p></article>)}</div>:<Empty title="We’re here when you need us" description="Send a note to begin your conversation."/>}{q.data&&<Pager data={q.data} onPage={setPage}/>}</Panel>{(!staff||can(a,'customers.write'))&&<Panel title="Send a personal note"><div className="padded"><Form key={customer} fields={fields} initial={{CustomerId:customer}} endpoint="/messages" submit="Send message"/></div></Panel>}</div></>;
}
export default function Account({page}:{page:string}){return page==='profile'?<Profile/>:page==='preferences'?<Profile preferences/>:page==='change-password'?<Password/>:page==='notifications'?<Notifications/>:<Messages/>;}

