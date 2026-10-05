import { BadRequestException,ForbiddenException,Injectable } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor,allowed,dateOnly,isStaff } from '../common/types';
import { ListDto,like } from '../common/dto';
import { ownCustomer } from '../auth/access';
import { lock } from '../phase2/support';
import { TripDto,TripPatchDto } from './crm.dto';
@Injectable()
export class TripsService {
 constructor(private db:Db) {}
 list(q:ListDto,a:Actor) {
  const params:unknown[]=[];const clauses=['1=1'];
  if(!isStaff(a)){params.push(a.customerId||null);clauses.push('t.CustomerId=@0');}
  else if(q.customerId){params.push(q.customerId);clauses.push('t.CustomerId=@0');}
  if(q.search){params.push(like(q.search));clauses.push('t.Name LIKE @'+(params.length-1));}
  return this.db.page('t.*,c.DisplayName CustomerName,ac.Name AccommodationName,ac.Type AccommodationType','Trips t JOIN Customers c ON c.Id=t.CustomerId LEFT JOIN Accommodations ac ON ac.TripId=t.Id',clauses.join(' AND '),params,q,'t.ArrivalDate DESC,t.Id');
 }
 async detail(id:string,a:Actor) {
  const trip=await this.db.get('Trips',id);ownCustomer(a,trip.CustomerId);
  const accommodation=await this.db.one('SELECT * FROM Accommodations WHERE TripId=@0',[id]);
  const flights=await this.db.query('SELECT * FROM Flights WHERE TripId=@0',[id]);
  return {...trip,AccommodationType:accommodation?.Type,AccommodationName:accommodation?.Name,AccommodationAddress:accommodation?.Address,ArrivalFlight:flights.find(f=>f.Direction==='Arrival')?.FlightNumber,ArrivalTime:flights.find(f=>f.Direction==='Arrival')?.FlightTime,DepartureFlight:flights.find(f=>f.Direction==='Departure')?.FlightNumber,DepartureTime:flights.find(f=>f.Direction==='Departure')?.FlightTime};
 }
 async save(dto:TripDto|TripPatchDto,a:Actor,id?:string) {
  if(isStaff(a)&&!allowed(a,'trips.write'))throw new ForbiddenException();
  const previous=id?await this.db.get('Trips',id):undefined;
  const customerId=previous?.CustomerId || dto.CustomerId || a.customerId;
  if(!customerId)throw new BadRequestException('Select a customer.');
  ownCustomer(a,customerId);
  if(previous&&dto.CustomerId&&dto.CustomerId!==previous.CustomerId)throw new BadRequestException('A trip cannot be moved to another customer.');
  const arrival=dto.ArrivalDate || dateOnly(previous!.ArrivalDate);const departure=dto.DepartureDate || dateOnly(previous!.DepartureDate);
  if(arrival>departure)throw new BadRequestException('Departure must be on or after arrival.');
  return this.db.transaction(async tx=>{
   if(id) {
    const plan=await this.db.one('SELECT Id FROM Itineraries WHERE TripId=@0',[id],tx);if(plan)await lock(this.db,tx,'itinerary:'+plan.Id);
    const outside=await this.db.one('SELECT TOP(1) i.Id FROM ItineraryItems i JOIN Itineraries it ON it.Id=i.ItineraryId WHERE it.TripId=@0 AND i.Active=1 AND (i.EventDate<@1 OR i.EventDate>@2)',[id,arrival,departure],tx);
    if(outside)throw new BadRequestException('Update itinerary items outside the new trip dates first.');
    await this.db.one('SELECT Id FROM Trips WITH (UPDLOCK,ROWLOCK) WHERE Id=@0',[id],tx);
    const conflict=await this.db.one("SELECT TOP(1) Id FROM ServiceRequests WHERE TripId=@0 AND Status NOT IN ('Cancelled','Unavailable','Refunded') AND (PreferredDate<@1 OR PreferredDate>@2)",[id,arrival,departure],tx);
    if(conflict)throw new BadRequestException('Update or cancel requests outside the new trip dates first.');
   }
   const {AccommodationType,AccommodationName,AccommodationAddress,ArrivalFlight,ArrivalTime,DepartureFlight,DepartureTime,...data}=dto;
   const trip=id?await this.db.update('Trips',id,{...data,CustomerId:customerId},a.id,tx):await this.db.insert('Trips',{...data,CustomerId:customerId},a.id,tx);
   const accommodation=await this.db.one('SELECT Id FROM Accommodations WHERE TripId=@0',[trip.Id],tx);
   const ac={Type:AccommodationType,Name:AccommodationName,Address:AccommodationAddress};
   if(accommodation)await this.db.update('Accommodations',accommodation.Id,ac,a.id,tx);
   else await this.db.insert('Accommodations',{...ac,TripId:trip.Id},a.id,tx);
   for(const [Direction,FlightNumber,FlightTime] of [['Arrival',ArrivalFlight,ArrivalTime],['Departure',DepartureFlight,DepartureTime]]) {
    const flight=await this.db.one('SELECT Id FROM Flights WHERE TripId=@0 AND Direction=@1',[trip.Id,Direction],tx);
    if(flight)await this.db.update('Flights',flight.Id,{FlightNumber,FlightTime},a.id,tx);
    else await this.db.insert('Flights',{TripId:trip.Id,Direction,FlightNumber,FlightTime},a.id,tx);
   }
   if(!id)await this.db.insert('Itineraries',{TripId:trip.Id,Name:trip.Name},a.id,tx);
   await this.db.audit(a.id,id?'Trip edited':'Trip created','Trips',trip.Id,{},tx);return trip;
  });
 }
}

