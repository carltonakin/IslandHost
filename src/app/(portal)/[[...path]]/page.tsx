'use client';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { Loading } from '@/components/ui';
import { Access } from '@/components/shell';
const Dashboard=dynamic(()=>import('@/views/dashboard'),{loading:Loading});
const Catalog=dynamic(()=>import('@/views/catalog'),{loading:Loading});
const Requests=dynamic(()=>import('@/views/requests'),{loading:Loading});
const Trips=dynamic(()=>import('@/views/trips'),{loading:Loading});
const Itinerary=dynamic(()=>import('@/views/itinerary'),{loading:Loading});
const Customers=dynamic(()=>import('@/views/customers'),{loading:Loading});
const Account=dynamic(()=>import('@/views/account'),{loading:Loading});
const System=dynamic(()=>import('@/views/system'),{loading:Loading});
const Bookings=dynamic(()=>import('@/views/bookings'),{loading:Loading});
const Finance=dynamic(()=>import('@/views/finance'),{loading:Loading});
const Suppliers=dynamic(()=>import('@/views/finance').then(m=>m.Suppliers),{loading:Loading});
export default function PortalPage(){
 const params=useParams<{path?:string[]}>();const [page='',id]=params.path||[];
 if(page==='bookings')return <Bookings/>;
 if(page==='vendors')return <Access permission="vendors.read"><Suppliers/></Access>;
 if(['quotes','invoices','payments','refunds'].includes(page))return <Finance mode={page} id={id}/>;
 if(!page)return <Dashboard/>;
 if(page==='services'||page==='categories')return <Access permission={page==='categories'?'catalog.write':undefined}><Catalog mode={page} id={id}/></Access>;
 if(page==='requests'||page==='operations')return <Access permission={page==='operations'?'operations.read':undefined}><Requests board={page==='operations'} id={id}/></Access>;
 if(page==='trips')return <Trips id={id}/>;
 if(page==='itinerary')return <Itinerary/>;
 if(page==='customers')return <Access permission="operations.read"><Customers id={id}/></Access>;
 if(['profile','preferences','change-password','notifications','messages'].includes(page))return <Account page={page}/>;
 if(['users','roles','settings','audit-log'].includes(page))return <Access permission={{users:'users.manage',roles:'users.manage',settings:'settings.manage','audit-log':'audit.read'}[page]}><System page={page}/></Access>;
 return <div className="empty"><h1>A little off the beaten path</h1><p>This page is not part of your itinerary.</p><a className="button" href="/">Back to your overview</a></div>;
}

