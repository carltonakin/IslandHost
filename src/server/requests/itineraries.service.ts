import { BadRequestException,Injectable } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor,dateOnly,isStaff } from '../common/types';
import { ListDto } from '../common/dto';
import { ownCustomer } from '../auth/access';
import { lock } from '../phase2/support';
import { ItineraryDto } from './requests.dto';
@Injectable()
export class ItinerariesService {
 constructor(private db:Db) {}
 list(q:ListDto,a:Actor) {
  const p:unknown[]=[];const w=['i.Active=1'];
  if(!isStaff(a)){p.push(a.customerId||null);w.push('t.CustomerId=@0');}
  else if(q.customerId){p.push(q.customerId);w.push('t.CustomerId=@0');}
  if(q.tripId){w.push('t.Id=@'+p.length);p.push(q.tripId);}
  if(q.date){w.push('i.EventDate=@'+p.length);p.push(q.date);}
  return this.db.page('i.*,t.Name TripName,t.Id TripId,c.DisplayName CustomerName,r.RequestNumber,r.Status ServiceStatus','ItineraryItems i JOIN Itineraries it ON it.Id=i.ItineraryId JOIN Trips t ON t.Id=it.TripId JOIN Customers c ON c.Id=t.CustomerId LEFT JOIN ServiceRequests r ON r.Id=i.RequestId',w.join(' AND '),p,q,'i.EventDate,i.EventTime,i.Id');
 }
 async create(dto:ItineraryDto,a:Actor) {
  return this.db.transaction(async tx=>{
   const parent=await this.db.one('SELECT Id FROM Itineraries WHERE TripId=@0',[dto.TripId],tx);if(parent)await lock(this.db,tx,'itinerary:'+parent.Id);
   const trip=await this.db.get('Trips',dto.TripId,tx);ownCustomer(a,trip.CustomerId);
   if(dto.EventDate<dateOnly(trip.ArrivalDate)||dto.EventDate>dateOnly(trip.DepartureDate))throw new BadRequestException('Choose a date within this trip.');
   const itinerary=await this.db.one('SELECT Id FROM Itineraries WHERE TripId=@0',[dto.TripId],tx);
   if(!itinerary)throw new BadRequestException('This trip has no itinerary.');
   const {TripId:_tripId,...data}=dto;
   const item=await this.db.insert('ItineraryItems',{...data,ItineraryId:itinerary.Id},a.id,tx);
   const customer=await this.db.get('Customers',trip.CustomerId,tx);
   if(customer.UserId)await this.db.notify(customer.UserId,'Your itinerary was updated',dto.Activity+' was added to your experience.','/itinerary',tx);
   await this.db.audit(a.id,'Itinerary entry created','ItineraryItems',item.Id,{},tx);return item;
  });
 }
}

