import type { Metadata } from 'next';
import { Providers } from '@/lib/providers';
import './globals.css';
export const metadata:Metadata={title:{default:'IslandHost One · Your Bahamas',template:'%s · IslandHost One'},description:'Your Bahamas. One Seamless Experience. A personal concierge workspace for exceptional island stays.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><Providers>{children}</Providers></body></html>;}

