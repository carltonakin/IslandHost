'use client';
import { useEffect,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { usePathname,useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard,Compass,CalendarDays,ClipboardList,MessageCircle,Bell,UserRound,SlidersHorizontal,UsersRound,Layers,Settings,ShieldCheck,History,PanelLeftClose,PanelLeftOpen,Search,Menu,X,LogOut,KeyRound,ChevronDown,ArrowUpRight,Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Actor,api,can,write,Row } from '@/lib/api';
import { useActor } from '@/lib/providers';
import { Loading,ErrorState } from './ui';
import { Brand } from './brand';
type NavItem={label:string;href:string;icon:LucideIcon;permission?:string};
function sections(a:Actor):{title:string;items:NavItem[]}[]{
 if(can(a,'vendor')&&!can(a,'operations.read'))return [{title:'SUPPLIER WORKSPACE',items:[{label:'Booking confirmations',href:'/bookings',icon:ClipboardList},{label:'Profile',href:'/profile',icon:UserRound}]}];
 if(can(a,'operations.read'))return [
  {title:'WORKSPACE',items:[{label:'Command Center',href:'/',icon:LayoutDashboard}]},
  {title:'OPERATIONS',items:[{label:'Service Requests',href:'/requests',icon:ClipboardList},{label:'Operations Board',href:'/operations',icon:Layers},{label:'Trips',href:'/trips',icon:Compass},{label:'Itineraries',href:'/itinerary',icon:CalendarDays}]},
  {title:'BOOKINGS & BILLING',items:[{label:'Booking confirmations',href:'/bookings',icon:ClipboardList,permission:'bookings.manage'},{label:'Quotes',href:'/quotes',icon:ClipboardList,permission:'quotes.read'},{label:'Invoices',href:'/invoices',icon:ClipboardList,permission:'invoices.read'},{label:'Payments',href:'/payments',icon:ClipboardList,permission:'payments.read'},{label:'Refunds',href:'/refunds',icon:History,permission:'payments.read'},{label:'Suppliers',href:'/vendors',icon:UsersRound,permission:'vendors.read'}]},
  {title:'RELATIONSHIPS',items:[{label:'Customers',href:'/customers',icon:UsersRound},{label:'Messages',href:'/messages',icon:MessageCircle}]},
  {title:'EXPERIENCES',items:[{label:'Services',href:'/services',icon:Waves},{label:'Categories',href:'/categories',icon:Layers,permission:'catalog.write'}]},
  {title:'SYSTEM',items:[{label:'Users',href:'/users',icon:UsersRound,permission:'users.manage'},{label:'Roles',href:'/roles',icon:ShieldCheck,permission:'users.manage'},{label:'Settings',href:'/settings',icon:Settings,permission:'settings.manage'},{label:'Audit Log',href:'/audit-log',icon:History,permission:'audit.read'}]}
 ];
 return [
  {title:'YOUR ISLAND',items:[{label:'Overview',href:'/',icon:LayoutDashboard}]},
  {title:'MY EXPERIENCE',items:[{label:'My Trip',href:'/trips',icon:Compass},{label:'Services',href:'/services',icon:Waves},{label:'Itinerary',href:'/itinerary',icon:CalendarDays}]},
  {title:'CONCIERGE',items:[{label:'Requests',href:'/requests',icon:ClipboardList},{label:'Messages',href:'/messages',icon:MessageCircle},{label:'Notifications',href:'/notifications',icon:Bell}]},
  {title:'MY BOOKINGS',items:[{label:'Explore Jamaica',href:'/explore',icon:Compass},{label:'Trip builder',href:'/my-trip',icon:CalendarDays},{label:'My quotes',href:'/quotes',icon:ClipboardList},{label:'My invoices',href:'/invoices',icon:ClipboardList},{label:'My payments',href:'/payments',icon:ClipboardList}]},
  {title:'ACCOUNT',items:[{label:'Profile',href:'/profile',icon:UserRound},{label:'Preferences',href:'/preferences',icon:SlidersHorizontal}]}
 ];
}
function GlobalSearch(){
 const [value,setValue]=useState('');const [term,setTerm]=useState('');const [open,setOpen]=useState(false);
 useEffect(()=>{const t=setTimeout(()=>setTerm(value),300);return()=>clearTimeout(t);},[value]);
 const query=useQuery({queryKey:['search',term],queryFn:()=>api<Row[]>('/search?search='+encodeURIComponent(term)),enabled:term.trim().length>=2});
 return <div className="global-search"><Search size={17}/><input aria-label="Global search" placeholder="Search your island…" value={value} onFocus={()=>setOpen(true)} onChange={e=>{setValue(e.target.value);setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}/><span className="search-hint">SEARCH</span>{open&&term.length>=2&&<div className="search-results"><div className="search-result-heading">Search results<button className="icon-button" aria-label="Close search" onClick={()=>setOpen(false)}><X size={14}/></button></div>{query.isFetching?<p>Searching…</p>:query.error?<p>Search is unavailable. Please try again.</p>:query.data?.length?query.data.map(r=><Link key={r.href} href={r.href} onClick={()=>{setOpen(false);setValue('');}}><span className="eyebrow">{r.type}</span><strong>{r.title}</strong><small>{r.subtitle}</small></Link>):<p>No matches yet. Try another name.</p>}</div>}</div>;
}
export function Shell({children}:{children:React.ReactNode}){
 const auth=useActor();const a=auth.data;const path=usePathname();const router=useRouter();const client=useQueryClient();
 const [collapsed,setCollapsed]=useState(false);const [mobile,setMobile]=useState(false);const [menu,setMenu]=useState(false);const [logoutError,setLogoutError]=useState('');
 useEffect(()=>{setCollapsed(localStorage.getItem('islandhost-nav')==='collapsed');},[]);
 useEffect(()=>{if(auth.error)router.replace('/login');},[auth.error,router]);
 useEffect(()=>{setMobile(false);setMenu(false);},[path]);
 const unread=useQuery({queryKey:['unread'],queryFn:()=>api<{Count:number}>('/notifications/unread'),enabled:!!a,refetchInterval:60000});
 if(auth.isPending||!a)return <div className="auth-loading"><Brand/><Loading/></div>;
 if(!can(a,'customer')&&!can(a,'operations.read')&&!can(a,'vendor'))return <div className="auth-loading"><Brand/><h1>Your workspace is being prepared</h1><p>Your account is active. Vendor and driver portals will be available in a later phase.</p><button className="button" onClick={async()=>{await write('/auth/logout',{});client.clear();router.push('/login');}}>Sign out</button></div>;
 const nav=sections(a);const current=nav.flatMap(s=>s.items).find(i=>i.href==='/'?path==='/':path.startsWith(i.href))?.label||({profile:'Profile',preferences:'Preferences','change-password':'Change password',notifications:'Notifications'}[path.slice(1)]||'Your experience');
 return <div className={'app-shell '+(collapsed?'nav-collapsed ':'')+(mobile?'nav-open':'')}>
 {mobile&&<button className="drawer-overlay" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
 <aside className="sidebar"><Link href="/" className="brand-link" aria-label="Island Host Concierge home"><Brand/></Link><div className="workspace-label"><span className="live-dot"/><span>{can(a,'operations.read')?'CONCIERGE WORKSPACE':'YOUR BAHAMAS EXPERIENCE'}</span></div>
 <nav aria-label="Main navigation">{nav.map(s=><div className="nav-section" key={s.title}><p>{s.title}</p>{s.items.filter(i=>!i.permission||can(a,i.permission)).map(i=><Link title={collapsed?i.label:undefined} key={i.href} href={i.href} className={'nav-item '+((i.href==='/'?path==='/':path.startsWith(i.href))?'active':'')} aria-current={(i.href==='/'?path==='/':path.startsWith(i.href))?'page':undefined}><i.icon size={19} strokeWidth={1.6}/><span>{i.label}</span></Link>)}</div>)}</nav>
 <div className="sidebar-bottom"><Link href="/messages" className="concierge-note"><span className="concierge-icon"><MessageCircle size={19}/></span><span><strong>A little help, always.</strong><small>Your concierge is a message away.</small></span><ArrowUpRight size={15}/></Link><button className="collapse-button" onClick={()=>setCollapsed(v=>{localStorage.setItem('islandhost-nav',v?'expanded':'collapsed');return !v;})} aria-label={collapsed?'Expand navigation':'Collapse navigation'}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}<span>Collapse navigation</span></button></div></aside>
 <div className="workspace"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setMobile(true)}><Menu size={21}/></button><div className="breadcrumb">Your workspace <span>/</span><strong>{current}</strong></div><GlobalSearch/><div className="header-actions"><Link className="icon-button notification-button" href="/notifications" aria-label={'Notifications'+(unread.data?.Count?', '+unread.data.Count+' unread':'')}><Bell size={19}/>{!!unread.data?.Count&&<i/>}</Link><span className="header-divider"/><div className="user-area"><button className="user-toggle" onClick={()=>setMenu(!menu)} aria-expanded={menu}><span className="avatar">{a.displayName.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span className="user-name">{a.displayName}<small>{can(a,'operations.read')?'Your concierge team':'Welcome to the islands'}</small></span><ChevronDown size={14}/></button>{menu&&<div className="user-menu"><Link href="/profile"><UserRound size={16}/> Profile</Link>{a.customerId&&<Link href="/preferences"><SlidersHorizontal size={16}/> Preferences</Link>}<Link href="/change-password"><KeyRound size={16}/> Change password</Link><button onClick={async()=>{try{await write('/auth/logout',{});client.clear();router.push('/login');}catch{setLogoutError('Sign out failed. Please try again.');}}}><LogOut size={16}/> Sign out</button>{logoutError&&<p className="field-error">{logoutError}</p>}</div>}</div></div></header>
 <main id="main-content" className="main-content">{children}</main><footer className="page-footer"><span>ISLAND HOST CONCIERGE SERVICES</span><span>Nassau, The Bahamas <i/> Thoughtfully arranged.</span></footer></div></div>;
}
export function Access({permission,children}:{permission?:string;children:React.ReactNode}){const {data:a}=useActor();return permission&&!can(a,permission)?<ErrorState error={new Error('Your account does not have access to this page.')}/>:<>{children}</>;}

