'use client';
import { useRef,useState } from 'react';
import Image from 'next/image';
import { ImagePlus,LoaderCircle,Star,Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
const accept='image/jpeg,image/png,image/webp';
const maximum=13; // One main photo plus the catalog's existing twelve gallery photos.
function initialPhotos(cover?:string|null,gallery?:string|null){
 let other:unknown=[];try{other=JSON.parse(gallery||'[]');}catch{/* Keep the main photo if an old gallery is unreadable. */}
 return [...new Set([cover,...(Array.isArray(other)?other:[])].filter((url):url is string=>typeof url==='string'&&url.length>0))];
}
export function ServicePhotos({cover,gallery,onBusyChange}:{cover?:string|null;gallery?:string|null;onBusyChange:(busy:boolean)=>void}){
 const [photos,setPhotos]=useState(()=>initialPhotos(cover,gallery));const [busy,setBusy]=useState(false);const [progress,setProgress]=useState('');const [error,setError]=useState('');const [address,setAddress]=useState('');const addInput=useRef<HTMLInputElement>(null);
 async function upload(files:File[],replace?:number){
  if(!files.length||busy)return;
  if(replace===undefined&&photos.length+files.length>maximum){setError('Choose up to 13 photos: one main photo and 12 gallery photos.');return;}
  if(files.some(file=>!accept.split(',').includes(file.type))){setError('Choose JPG, PNG or WebP photos.');return;}
  if(files.some(file=>file.size>5*1024*1024)){setError('Each photo must be 5 MB or smaller.');return;}
  setBusy(true);onBusyChange(true);setError('');
  try{
   for(const [index,file] of files.entries()){
    setProgress('Uploading photo '+(index+1)+' of '+files.length+'...');
    const body=new FormData();body.append('file',file);
    const result=await api<{Url:string}>('/service-photos',{method:'POST',body});
    setPhotos(previous=>replace===undefined?[...previous,result.Url]:previous.map((url,n)=>n===replace?result.Url:url));
   }
   setProgress('Photos are ready. Save the experience to apply your changes.');
  }catch(reason){setError(reason instanceof Error?reason.message:'Upload failed. Please try again.');setProgress('');}
  finally{setBusy(false);onBusyChange(false);}
 }
 return <fieldset className="service-photo-editor wide" disabled={busy}><legend>Photos</legend><input type="hidden" name="Image" value={photos[0]||''}/><input type="hidden" name="Images" value={JSON.stringify(photos.slice(1))}/><p>Choose a main photo for the listing and extra photos for its gallery. JPG, PNG or WebP, up to 5 MB each.</p>
 <div className="service-photo-toolbar"><input ref={addInput} tabIndex={-1} aria-label="Upload service photos" className="photo-file-input" type="file" accept={accept} multiple disabled={busy||photos.length>=maximum} onChange={e=>{void upload(Array.from(e.currentTarget.files||[]));e.currentTarget.value='';}}/><button type="button" className="button secondary" disabled={busy||photos.length>=maximum} onClick={()=>addInput.current?.click()}>{busy?<LoaderCircle size={17} className="spin"/>:<ImagePlus size={17}/>}Upload photos</button><span>{photos.length} / {maximum} photos</span></div>
 {progress&&<p className="photo-progress" role="status">{progress}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
 {!!photos.length&&<div className="service-photo-grid">{photos.map((url,index)=><article className="service-photo-card" key={index}><Image src={url} width={300} height={200} alt={'Service photo '+(index+1)} unoptimized/><div className="service-photo-actions">{index===0?<strong className="photo-main-label"><Star size={13}/>Main photo</strong>:<button className="text-button" type="button" onClick={()=>setPhotos([url,...photos.filter((_,n)=>n!==index)])}>Set as main photo</button>}<label className="photo-replace">Replace photo<input aria-label={'Replace photo '+(index+1)} type="file" accept={accept} onChange={e=>{void upload(Array.from(e.currentTarget.files||[]).slice(0,1),index);e.currentTarget.value='';}}/></label><button type="button" className="text-button" aria-label={'Remove photo '+(index+1)} onClick={()=>setPhotos(photos.filter((_,n)=>n!==index))}><Trash2 size={13}/>Remove</button></div></article>)}</div>}
 <details className="photo-existing"><summary>Use an existing image address</summary><div><input aria-label="Existing image address" placeholder="/images/photo.jpg or https://..." value={address} onChange={e=>setAddress(e.target.value)} maxLength={1000}/><button type="button" className="button secondary small" disabled={busy||photos.length>=maximum} onClick={()=>{const value=address.trim();if(!/^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/.test(value)){setError('Enter a local image path or an approved HTTPS image address.');return;}if(photos.includes(value)){setError('This photo is already selected.');return;}setPhotos([...photos,value]);setAddress('');setError('');}}>Add image</button></div></details>
 <small>Photo changes are applied when you save the experience. Removing a photo here removes it from this listing.</small></fieldset>;
}