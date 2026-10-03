'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus,MapPin,ArrowUpRight,Sun,CalendarDays } from 'lucide-react';
import { api,Page,Row,can,day,time } from '@/lib/api';
import { useActor } from '@/lib/providers';
import { PageTitle,Modal,Form,Pager,Empty,Loading,ErrorState,Status } from '@/components/ui';
export default function Itinerary(){
 const {data:a}=useActor();const params=useSearchParams();const [page,setPage]=useState(1);const [trip,setTrip]=useState(params.get('trip')||'');const [modal,setModal]=useState(false);
 const trips=useQuery({queryKey:['itinerary-trips'],queryFn:()=>api<Page>('/trips?limit=100')});
 const path='/itineraries?page='+page+(trip?'&tripId='+trip:'');
 const q=useQuery({queryKey:[path],queryFn:()=>api<Page>(path),refetchInterval:30000});
 const grouped:Record<string,Row[]>={};
 for(const item of q.data?.items||[]){const date=item.EventDate.slice(0,10);(grouped[date]||=[]).push(item);}
 return <><PageTitle eyebrow="A LITTLE LESS PLANNING" title="Just follow your island time." description="Your days, beautifully arranged. All times are local to The Bahamas." action={can(a,'itineraries.write')&&<button className="button" onClick={()=>setModal(true)}><Plus size={16}/>Add an activity</button>}/><div className="itinerary-toolbar"><span><CalendarDays size={18}/>Your personal itinerary</span><select aria-label="Select itinerary trip" value={trip} onChange={e=>{setTrip(e.target.value);setPage(1);}}><option value="">All experiences</option>{trips.data?.items.map(t=><option key={t.Id} value={t.Id}>{t.Name}{t.CustomerName?' · '+t.CustomerName:''}</option>)}</select></div>
 {q.isPending?<Loading/>:q.error?<ErrorState error={q.error}/>:!q.data?.items.length?<Empty title="There’s something lovely on the horizon" description="When your concierge confirms an experience, you’ll find it here." action={<Link className="button secondary" href="/services">Find an experience <ArrowUpRight size={16}/></Link>}/>:<div className="itinerary-days">{Object.entries(grouped).map(([date,items])=><section className="itinerary-day" key={date}><div className="itinerary-date"><div><Sun size={18}/><span>{new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'})}</span></div><h2>{day(date,true)}</h2></div><div className="itinerary-events">{items.map(item=><article className="itinerary-event" key={item.Id}><span className="timeline-dot"/><div className="event-time">{time(item.EventTime)}</div><div className="event-card"><div><p className="eyebrow">{item.TripName}</p><h3>{item.Activity}</h3><p className="event-location"><MapPin size={14}/>{item.Location||'Your concierge will share the meeting point'}</p>{item.Notes&&<p className="muted">{item.Notes}</p>}</div><div className="event-action">{item.ServiceStatus?<Status value={item.ServiceStatus}/>:<span className="status">Personally arranged</span>}{item.RequestId&&<Link href={'/requests/'+item.RequestId} className="text-link">View details<ArrowUpRight size={14}/></Link>}</div></div></article>)}</div></section>)}</div>}
 {q.data&&<Pager data={q.data} onPage={setPage}/>}
 {modal&&<Modal title="A thoughtful addition" onClose={()=>setModal(false)}><Form endpoint="/itineraries" fields={[{name:'TripId',label:'Trip',source:'/trips',required:true},{name:'Activity',label:'Activity',required:true,max:160},{name:'EventDate',label:'Date',type:'date',required:true},{name:'EventTime',label:'Time',type:'time',required:true},{name:'Location',label:'Location',max:300},{name:'Notes',label:'The little details',type:'textarea'}]} initial={{TripId:trip}} onSuccess={()=>setModal(false)} submit="Add to itinerary"/></Modal>}</>;
}

