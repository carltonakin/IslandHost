import type { Metadata,Viewport } from 'next';
import { Providers } from '@/lib/providers';
import './globals.css';
export const metadata:Metadata={title:{default:'IslandHost One · Your Bahamas',template:'%s · IslandHost One'},description:'Your Bahamas. One Seamless Experience. A personal concierge workspace for exceptional island stays.',icons:{icon:{url:'/images/islandhost-logo.jpeg',type:'image/jpeg'}},robots:{index:false,follow:false}};
export const viewport:Viewport={themeColor:'#0E7A86'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><Providers>{children}</Providers></body></html>;}

