'use client';
import { QueryClient,QueryClientProvider,useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Actor,api } from './api';
export function Providers({children}:{children:React.ReactNode}){
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:1,refetchOnWindowFocus:false}}}));
 return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function useActor(){return useQuery({queryKey:['me'],queryFn:()=>api<Actor>('/auth/me'),retry:false,staleTime:60000});}

