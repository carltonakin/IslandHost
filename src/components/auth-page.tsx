'use client';
import { Suspense,useState } from 'react';
import { useSearchParams,useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowRight,ArrowLeft,Eye,EyeOff,LoaderCircle } from 'lucide-react';
import { Brand } from './brand';
import { Actor,write } from '@/lib/api';
import { ErrorState } from './ui';
function AuthForm({mode}:{mode:'login'|'forgot'|'reset'}){
 const router=useRouter();const client=useQueryClient();const params=useSearchParams();
 const [busy,setBusy]=useState(false);const [show,setShow]=useState(false);const [error,setError]=useState<Error|null>(null);const [message,setMessage]=useState('');
 return <><p className="eyebrow">YOUR ISLAND AWAITS</p><h1>{mode==='login'?'A warm welcome back.':mode==='forgot'?'Let’s get you back in.':'A fresh start.'}</h1><p className="muted">{mode==='login'?'Sign in to your own seamless island experience.':mode==='forgot'?'Enter your email and we’ll send a password reset link.':'Choose a new password with at least 12 characters.'}</p><form className="login-form" onSubmit={async e=>{
 e.preventDefault();setError(null);setMessage('');setBusy(true);const form=new FormData(e.currentTarget);
 try{
  if(mode==='login'){const actor=await write<Actor>('/auth/login',{email:form.get('email'),password:form.get('password')});client.setQueryData(['me'],actor);router.replace(params.get('next')==='/my-trip'?'/my-trip':actor.permissions.includes('vendor')&&!actor.permissions.includes('operations.read')?'/bookings':'/');}
  else if(mode==='forgot'){const r=await write<{message:string}>('/auth/forgot-password',{email:form.get('email')});setMessage(r.message);}
  else{if(form.get('password')!==form.get('confirm'))throw new Error('Your passwords do not match.');const r=await write<{message:string}>('/auth/reset-password',{token:params.get('token')||'',password:form.get('password')});setMessage(r.message);}
 }catch(err){setError(err as Error);}finally{setBusy(false);}
 }}>{mode!=='reset'&&<label>Email address<input name="email" type="email" placeholder="you@example.com" required autoComplete="email" maxLength={254}/></label>}{mode!=='forgot'&&<label>{mode==='reset'?'New password':'Password'}<div className="password-input"><input name="password" type={show?'text':'password'} placeholder="Your password" required minLength={mode==='reset'?12:1} maxLength={128} autoComplete={mode==='reset'?'new-password':'current-password'}/><button type="button" className="icon-button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}{mode==='reset'&&<label>Confirm password<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>}{mode==='login'&&<Link href="/forgot-password" className="forgot-link">Forgot your password?</Link>}{error&&<ErrorState error={error}/>} {message&&<div className="notice success" role="status">{message}</div>}<button className="button full" disabled={busy}>{busy?<LoaderCircle size={18} className="spin"/>:null}{busy?'One moment…':mode==='login'?'Step into your island':mode==='forgot'?'Send reset link':'Set new password'}{!busy&&<ArrowRight size={17}/>}</button></form>{mode!=='login'&&<Link className="back-link" href="/login"><ArrowLeft size={15}/> Back to sign in</Link>}<Link className="back-link" href="/explore">Explore Jamaica and plan your trip <ArrowRight size={15}/></Link><p className="login-help">A personal experience starts with a personal connection.<br/>Contact your Island Host concierge to arrange your account.</p></>;
}
export default function AuthPage({mode}:{mode:'login'|'forgot'|'reset'}){return <main className="auth-page" id="main-content"><section className="auth-story"><Brand/><div className="auth-art"/><div className="auth-story-copy"><p className="eyebrow">JAMAICA & THE BAHAMAS</p><h2>Arrive.<br/>Unwind.<br/><em>We’ll take it<br/>from here.</em></h2><p>Your islands. One seamless experience.</p></div><span className="auth-coordinates">25°04′ N &nbsp; 77°20′ W</span></section><section className="auth-form-side"><Link href="/login" className="mobile-brand"><Brand/></Link><div className="auth-form-wrap"><Suspense fallback={<p>Preparing your welcome…</p>}><AuthForm mode={mode}/></Suspense></div><footer>ISLAND HOST CONCIERGE SERVICES <span>Thoughtfully arranged.</span></footer></section></main>;}

