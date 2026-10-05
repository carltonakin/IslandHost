import { Suspense } from 'react';
import TripBuilder from '@/views/trip-builder';
export const metadata={title:'My Trip'};
export default function MyTrip(){return <Suspense fallback={<p>Preparing your trip...</p>}><TripBuilder/></Suspense>;}