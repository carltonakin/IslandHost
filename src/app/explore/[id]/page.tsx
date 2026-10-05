import Marketplace from '@/views/marketplace';
export default async function Listing({params}:{params:Promise<{id:string}>}){return <Marketplace id={(await params).id}/>;}