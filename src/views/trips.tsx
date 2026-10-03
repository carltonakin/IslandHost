'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus,PlaneLanding,PlaneTakeoff,Users,MapPin,Pencil,ArrowUpRight,Compass } from 'lucide-react';
import { api,Page,Row,can,day,time } from '@/lib/api';
import { useActor } from '@/lib/providers';
import { PageTitle,Panel,Modal,Form,Field,Pager,Empty,Loading,ErrorState,Back } from '@/components/ui';
export const tripFields:Field[]=[
 {name:'Name',label:'Give your experience a name',required:true,max:120,wide:true},
 {name:'ArrivalDate',label:'Arrival date',type:'date',required:true},{name:'DepartureDate',label:'Departure date',type:'date',required:true},
 {name:'Adults',label:'Adults',type:'number',min:1,max:100,required:true},{name:'Children',label:'Children',type:'number',min:0,max:100,required:true},
 {name:'AccommodationType',label:'Accommodation type',type:'select',options:['Hotel','Resort','Villa','Private residence','Other'].map(x=>({label:x,value:x}))},{name:'AccommodationName',label:'Accommodation name',max:160},
 {name:'AccommodationAddress',label:'Accommodation address',max:300,wide:true},
 {name:'ArrivalFlight',label:'Arrival flight',max:30},{name:'ArrivalTime',label:'Arrival time',type:'time'},
 {name:'DepartureFlight',label:'Departure flight',max:30},{name:'DepartureTime',label:'Departure time',type:'time'},
 {name:'DietaryRequirements',label:'Dietary requirements',type:'textarea',max:1000},{name:'SpecialOccasion',label:'A special occasion',max:200},
 {name:'TransportationRequirements',label:'Transportation preferences',type:'textarea',max:1000},
 {name:'PersonalPreferences',label:'The little things that matter',type:'textarea'},{name:'Notes',label:'Anything else for your concierge?',type:'textarea'}
];
export default function Trips({id,customerId}:{id?:string;customerId?:string}){
 const {data:a}=useActor();const staff=can(a,'operations.read');const edit=!staff||can(a,'trips.write');
 const [page,setPage]=useState(1);const [modal,setModal]=useState(false);
 const path='/trips?page='+page+(customerId?'&customerId='+customerId:'');
 const q=useQuery({queryKey:[path],queryFn:()=>api<Page>(path),enabled:!id});
 const detail=useQuery({queryKey:['trip',id],queryFn:()=>api<Row>('/trips/'+id),enabled:!!id});
 const r=detail.data;
 const fields=[...(!id&&staff&&!customerId?[{name:'CustomerId',label:'Customer',source:'/customers',sourceLabel:'DisplayName',required:true}]:[]),...tripFields];
 const form=modal&&<Modal title={id?'Refine your Bahamas experience':'Let’s plan your island time'} onClose={()=>setModal(false)}><div className="form-intro"><span className="step-number"><Compass size={18}/></span><p>Your dates, your people, your preferences.<br/><small>Share what you know. Your concierge can help with the rest.</small></p></div><div className="trip-form"><Form fields={fields} steps={[{label:'Your stay',fields:['CustomerId','Name','ArrivalDate','DepartureDate','Adults','Children','AccommodationType','AccommodationName','AccommodationAddress']},{label:'Personal touches',fields:tripFields.slice(8).map(f=>f.name)}]} initial={r||{Adults:2,Children:0}} endpoint={'/trips'+(id?'/'+id:'')} method={id?'PATCH':'POST'} extra={customerId?{CustomerId:customerId}:{}} onSuccess={()=>setModal(false)} submit={id?'Save my experience':'Create my experience'}/></div></Modal>;
 if(id){
  if(detail.isPending)return <Loading/>;if(detail.error)return <ErrorState error={detail.error}/>;
  return <><Back href="/trips">All experiences</Back><PageTitle eyebrow="YOUR BAHAMAS EXPERIENCE" title={r!.Name} description="Every detail, just the way you like it." action={edit&&<button className="button secondary" onClick={()=>setModal(true)}><Pencil size={16}/>Edit experience</button>}/><section className="trip-hero"><div><p className="eyebrow">NASSAU & PARADISE ISLAND</p><h2>Your stay, at a glance.</h2><p><MapPin size={16}/>{r!.AccommodationName||'Accommodation to be arranged'}</p></div><div className="trip-hero-facts"><span><PlaneLanding size={20}/>Arrival<strong>{day(r!.ArrivalDate,true)}</strong></span><span><PlaneTakeoff size={20}/>Departure<strong>{day(r!.DepartureDate,true)}</strong></span><span><Users size={20}/>Your party<strong>{r!.Adults} adults · {r!.Children} children</strong></span></div></section><div className="detail-grid"><Panel title="Getting here. Getting home."><div className="travel-grid"><div><PlaneLanding size={24}/><small>ARRIVING</small><h3>{r!.ArrivalFlight||'Flight to be confirmed'}</h3><p>{day(r!.ArrivalDate,true)} · {time(r!.ArrivalTime)||'Time to be confirmed'}</p></div><div><PlaneTakeoff size={24}/><small>DEPARTING</small><h3>{r!.DepartureFlight||'Flight to be confirmed'}</h3><p>{day(r!.DepartureDate,true)} · {time(r!.DepartureTime)||'Time to be confirmed'}</p></div></div></Panel><Panel title="Your personal touches"><div className="padded">{[['Special occasion',r!.SpecialOccasion],['Dietary preferences',r!.DietaryRequirements],['Transportation',r!.TransportationRequirements],['Personal preferences',r!.PersonalPreferences],['A note for your concierge',r!.Notes]].map(([label,value])=><div className="preference-line" key={label}><small>{label}</small><p>{value||'Nothing shared just yet'}</p></div>)}</div></Panel></div><div className="quick-actions"><Link href={'/itinerary?trip='+id}>Your itinerary<ArrowUpRight size={17}/></Link><Link href="/services">Discover experiences<ArrowUpRight size={17}/></Link><Link href="/messages">Contact your concierge<ArrowUpRight size={17}/></Link></div>{form}</>;
 }
 return <><PageTitle eyebrow={staff?'GUEST EXPERIENCES':'MY EXPERIENCE'} title={staff?'Every stay, personally considered.':'Your next chapter, in the islands.'} description={staff?'A clear view of arrivals, departures and the details that make a difference.':'Tell us a little about your stay. We’ll make the rest feel effortless.'} action={edit&&<button className="button" onClick={()=>{setModal(true);}}><Plus size={17}/>New experience</button>}/>{q.isPending?<Loading/>:q.error?<ErrorState error={q.error}/>:q.data?.items.length?<div className="trip-grid">{q.data.items.map(t=><Link href={'/trips/'+t.Id} className="trip-card" key={t.Id}><div className="trip-card-top"><p className="eyebrow">NASSAU · THE BAHAMAS</p><Compass size={28}/></div><div className="trip-card-copy"><small>{staff?t.CustomerName:'YOUR ISLAND ESCAPE'}</small><h2>{t.Name}</h2><p><MapPin size={14}/>{t.AccommodationName||'A place to call your own'}</p><div className="trip-card-dates"><span>{day(t.ArrivalDate,true)} — {day(t.DepartureDate,true)}</span><span><Users size={14}/>{t.Adults+t.Children}</span></div><div className="text-link">See your experience<ArrowUpRight size={16}/></div></div></Link>)}</div>:<Empty title="Your island story starts here" description="Add your dates and preferences to begin a personal Bahamas experience." action={edit&&<button className="button" onClick={()=>setModal(true)}>Plan my stay <Plus size={16}/></button>}/>} {q.data&&<Pager data={q.data} onPage={setPage}/>} {form}</>;
}

