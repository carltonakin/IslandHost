'use client';
import { useEffect,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { ArrowLeft,ArrowRight,Check,LoaderCircle,Plus,X,Inbox } from 'lucide-react';
import Link from 'next/link';
import { api,write,Row,Page } from '@/lib/api';
export function PageTitle({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}){return <div className="page-title"><div><p className="eyebrow">{eyebrow||'ISLANDHOST ONE'}</p><h1>{title}</h1>{description&&<p className="muted">{description}</p>}</div>{action}</div>;}
export function Status({value}:{value:string}){return <span className={'status status-'+value.toLowerCase().replaceAll(' ','-')}><i/>{value}</span>;}
export function Loading(){return <div className="skeleton-stack" aria-label="Loading" role="status"><div className="skeleton wide"/><div className="skeleton tall"/><div className="skeleton tall"/></div>;}
export function ErrorState({error,retry}:{error:Error;retry?:()=>void}){return <div className="notice error" role="alert"><p>{error.message}</p>{retry&&<button className="button secondary small" onClick={retry}>Try again</button>}</div>;}
export function Empty({title='Nothing here just yet',description='Your next experience starts with a little inspiration.',action}:{title?:string;description?:string;action?:React.ReactNode}){return <div className="empty"><Inbox size={28}/><h3>{title}</h3><p>{description}</p>{action}</div>;}
export function Pager({data,onPage}:{data:Page;onPage:(page:number)=>void}){return <div className="pager"><span>{data.total} {data.total===1?'result':'results'} · Page {data.page} of {Math.max(1,data.totalPages)}</span><div><button className="icon-button" aria-label="Previous page" disabled={data.page<=1} onClick={()=>onPage(data.page-1)}><ArrowLeft size={16}/></button><button className="icon-button" aria-label="Next page" disabled={data.page>=data.totalPages} onClick={()=>onPage(data.page+1)}><ArrowRight size={16}/></button></div></div>;}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog className="modal" ref={ref} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-inner"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</div></dialog>;
}
export type Field={name:string;label:string;type?:string;required?:boolean;options?:{value:string;label:string}[];source?:string;sourceLabel?:string;sourceValue?:string;min?:number;max?:number;step?:string;hint?:string;wide?:boolean};
function RemoteSelect({field,value}:{field:Field;value:unknown}){
 const [search,setSearch]=useState('');const [term,setTerm]=useState('');
 const [selected,setSelected]=useState({value:String(value||''),label:'Current selection'});
 useEffect(()=>{const t=setTimeout(()=>setTerm(search),250);return()=>clearTimeout(t);},[search]);
 const path=field.source!+(field.source!.includes('?')?'&':'?')+'limit=100&search='+encodeURIComponent(term);
 const query=useQuery({queryKey:[path],queryFn:()=>api<Page|Row[]>(path),placeholderData:previous=>previous});
 const rows=Array.isArray(query.data)?query.data:query.data?.items||[];
 const key=field.sourceValue||'Id';const label=field.sourceLabel||'Name';
 return <><input className="select-search" aria-label={'Search '+field.label.toLowerCase()} placeholder={'Find '+field.label.toLowerCase()+'…'} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label={field.label} name={field.name} value={selected.value} onChange={e=>setSelected({value:e.target.value,label:e.target.selectedOptions[0]?.text||'Current selection'})} required={field.required}><option value="">Choose {field.label.toLowerCase()}</option>{selected.value&&!rows.some(r=>String(r[key])===selected.value)?<option value={selected.value}>{selected.label}</option>:null}{rows.map(r=><option key={String(r[key])} value={String(r[key])}>{String(r[label]||r.DisplayName)}</option>)}</select>{query.error&&<span className="field-error">Could not load choices. Try searching again.</span>}</>;
}
function OptionEditor({value}:{value:Row[]|undefined}){
 const [options,setOptions]=useState<Row[]>(value||[]);
 return <div className="option-editor"><input type="hidden" name="Options" value={JSON.stringify(options)}/>{options.map((option,i)=><div className="option-row" key={i}><input aria-label={'Option '+(i+1)+' name'} placeholder="Option name" value={option.Name||''} required maxLength={120} onChange={e=>setOptions(options.map((v,n)=>n===i?{...v,Name:e.target.value}:v))}/><input aria-label={'Option '+(i+1)+' price'} type="number" min="0" step="0.01" placeholder="Price" value={option.Price??''} onChange={e=>setOptions(options.map((v,n)=>n===i?{...v,Price:e.target.value===''?null:Number(e.target.value)}:v))}/><button type="button" className="icon-button" aria-label={'Remove option '+(i+1)} onClick={()=>setOptions(options.filter((_,n)=>n!==i))}><X size={16}/></button></div>)}<button type="button" className="text-button" onClick={()=>setOptions([...options,{Name:'',Price:0}])}><Plus size={15}/> Add an option</button></div>;
}
export function Form({fields,initial={},endpoint,method='POST',onSuccess,submit='Save changes',extra={},steps}:{steps?:{label:string;fields:string[]}[];fields:Field[];initial?:Row;endpoint:string;method?:string;onSuccess?:(result:Row)=>void;submit?:string;extra?:Row}){
 const client=useQueryClient();const [busy,setBusy]=useState(false);const [error,setError]=useState<Error|null>(null);const [saved,setSaved]=useState(false);const [step,setStep]=useState(0);
 return <form onSubmit={async e=>{
  e.preventDefault();if(steps&&step<steps.length-1){setStep(step+1);return;}setBusy(true);setError(null);setSaved(false);
  const form=new FormData(e.currentTarget);const body:Row={...extra};
  for(const f of fields){const value=form.get(f.name);body[f.name]=f.type==='checkbox'?form.has(f.name):f.type==='number'?(value===''?null:Number(value)):f.type==='options'?JSON.parse(String(value)).map((o:Row)=>({Name:o.Name,Price:o.Price,Description:o.Description,Active:true})):f.type==='multiselect'?form.getAll(f.name):value===''?null:value;}
  try{const result=await write<Row>(endpoint,body,method);await client.invalidateQueries();setSaved(true);onSuccess?.(result);}catch(err){setError(err as Error);}finally{setBusy(false);}
 }} className="resource-form">
 {steps&&<div className="form-step-tabs" aria-label="Experience steps">{steps.map((s,i)=><button key={s.label} type="button" disabled={i>step} aria-current={i===step?'step':undefined} className={i===step?'selected':''} onClick={()=>setStep(i)}>{i+1}. {s.label}</button>)}</div>}
 <div className="form-grid">{fields.map(f=><label key={f.name} style={steps&&!steps[step].fields.includes(f.name)?{display:'none'}:undefined} className={(f.wide||f.type==='textarea'||f.type==='options'?'wide ':'')+(f.type==='checkbox'?'check-label':'')}><span>{f.label}{f.required&&<em> *</em>}</span>
 {f.source?<RemoteSelect field={f} value={initial[f.name]}/>:f.type==='options'?<OptionEditor value={initial[f.name]}/>:f.type==='select'||f.type==='multiselect'?<select aria-label={f.label} name={f.name} multiple={f.type==='multiselect'} defaultValue={initial[f.name]??(f.type==='multiselect'?[]:'')} required={f.required}>{f.type!=='multiselect'&&<option value="">Choose {f.label.toLowerCase()}</option>}{f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:f.type==='textarea'?<textarea aria-label={f.label} name={f.name} defaultValue={initial[f.name]??''} required={f.required} rows={3} maxLength={f.max||2000}/>:f.type==='checkbox'?<input type="checkbox" name={f.name} defaultChecked={Boolean(initial[f.name])}/>:<input aria-label={f.label} name={f.name} type={f.type||'text'} defaultValue={f.type==='date'?initial[f.name]?.slice(0,10)||'':initial[f.name]??''} required={f.required} min={f.min} max={f.type==='number'?f.max:undefined} step={f.step} minLength={f.type==='password'?12:undefined} maxLength={f.type==='number'?undefined:f.max||200} autoComplete={f.type==='password'?'new-password':'off'}/>}
 {f.hint&&<small>{f.hint}</small>}</label>)}</div>{error&&<ErrorState error={error}/>}<div className="form-footer">{steps&&step>0&&<button className="button secondary" type="button" onClick={()=>setStep(step-1)}>Previous</button>}{saved&&<span className="success"><Check size={16}/> Saved</span>}<button className="button" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:null}{busy?'Saving…':steps&&step<steps.length-1?'Continue':submit}</button></div></form>;
}
export function Back({href,children}:{href:string;children:React.ReactNode}){return <Link className="back-link" href={href}><ArrowLeft size={15}/>{children}</Link>;}
export function Panel({title,action,children,className=''}:{title?:string;action?:React.ReactNode;children:React.ReactNode;className?:string}){return <section className={'panel '+className}>{title&&<div className="panel-heading"><h2>{title}</h2>{action}</div>}{children}</section>;}

