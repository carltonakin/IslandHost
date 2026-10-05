'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Compass,Map,ArrowUpRight } from 'lucide-react';
import { Brand } from './brand';
import { api,Row } from '@/lib/api';
import { useActor } from '@/lib/providers';
import { currentPlan,readDraft } from '@/lib/trip-draft';
export function MarketplaceShell({children}:{children:React.ReactNode}){
 const {data:actor}=useActor();const [count,setCount]=useState(0);const [id,setId]=useState('');
 useEffect(()=>{const update=()=>{setCount(readDraft().Items.length);setId(actor?.customerId?currentPlan(actor.customerId):'');};update();window.addEventListener('islandone-trip',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('islandone-trip',update);window.removeEventListener('storage',update);};},[actor?.customerId]);
 const plan=useQuery({queryKey:['trip-indicator',id],queryFn:()=>api<Row>('/trip-plans/'+id),enabled:!!id&&!!actor?.customerId,refetchInterval:30000});
 const total=plan.data?.Items.filter((i:Row)=>i.Active).length??count;
 return <div className="marketplace"><header className="market-header"><Link href="/explore" aria-label="Island One home"><Brand/></Link><nav aria-label="Marketplace navigation"><Link href="/explore"><Compass size={18}/> Explore</Link><Link href="/my-trip" className="trip-indicator"><Map size={18}/> My Trip <span>{total}</span></Link><Link href={actor?'/':'/login?next=/my-trip'}>{actor?'My workspace':'Sign in'}<ArrowUpRight size={17}/></Link></nav></header><main id="main-content" className="market-main">{children}</main><footer className="market-footer"><strong>Island One</strong><span>A little discovery. A trip that feels like you.</span><Link href="/my-trip">Your plans, all in one place</Link></footer></div>;
}
export const bookingLabels:Record<string,string>={PLANNED:'Added to trip',PENDING_CONFIRMATION:'Awaiting confirmation',CONFIRMED:'Confirmed',CHANGE_REQUESTED:'Change requested',RECONFIRMING:'Reconfirming',REJECTED:'Unavailable',CANCELLED:'Cancelled',EXPIRED:'Expired',COMPLETED:'Completed'};
export function BookingBadge({status}:{status:string}){return <span className={'booking-badge booking-'+status.toLowerCase()}>{bookingLabels[status]||status}</span>;}