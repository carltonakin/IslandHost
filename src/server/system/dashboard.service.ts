import { Injectable } from '@nestjs/common';
import { Db } from '../database/db';
import { Actor,bahamasToday,isStaff } from '../common/types';
import { like } from '../common/dto';
@Injectable()
export class DashboardService {
 constructor(private db:Db) {}
 async dashboard(a:Actor){
  const today=bahamasToday();
  if(!isStaff(a)){
   const [trip,requests,itinerary,unread]=await Promise.all([
    this.db.one('SELECT TOP(1) t.*,ac.Name AccommodationName FROM Trips t LEFT JOIN Accommodations ac ON ac.TripId=t.Id WHERE t.CustomerId=@0 AND t.DepartureDate>=@1 ORDER BY t.ArrivalDate,t.Id',[a.customerId||null,today]),
    this.db.query("SELECT TOP(5) r.*,s.Name ServiceName FROM ServiceRequests r JOIN Services s ON s.Id=r.ServiceId WHERE r.CustomerId=@0 AND r.Status NOT IN ('Completed','Cancelled','Refunded','Unavailable') ORDER BY r.PreferredDate,r.PreferredTime",[a.customerId||null]),
    this.db.query('SELECT TOP(5) i.* FROM ItineraryItems i JOIN Itineraries it ON it.Id=i.ItineraryId JOIN Trips t ON t.Id=it.TripId WHERE t.CustomerId=@0 AND i.Active=1 AND i.EventDate>=@1 ORDER BY i.EventDate,i.EventTime',[a.customerId||null,today]),
    this.db.one('SELECT COUNT(*) Count FROM Notifications WHERE UserId=@0 AND ReadAt IS NULL',[a.id])
   ]);return {mode:'customer',today,trip,requests,itinerary,unread:unread?.Count||0};
  }
  const kpis=await this.db.one(`SELECT
   (SELECT COUNT(*) FROM Trips WHERE ArrivalDate=@0) Arrivals,
   (SELECT COUNT(*) FROM Trips WHERE DepartureDate=@0) Departures,
   (SELECT COALESCE(SUM(Adults+Children),0) FROM Trips WHERE ArrivalDate<=@0 AND DepartureDate>=@0) ActiveGuests,
   (SELECT COUNT(*) FROM ServiceRequests WHERE Status NOT IN ('Completed','Cancelled','Unavailable','Refunded')) OpenRequests,
   (SELECT COUNT(*) FROM ServiceRequests WHERE Status IN ('Requested','Under Review')) PendingReviews,
   (SELECT COUNT(*) FROM ServiceRequests WHERE Status IN ('Confirmed','Assigned','In Progress')) ConfirmedServices,
   (SELECT COUNT(*) FROM ServiceRequests WHERE PreferredDate=@0 AND Status NOT IN ('Cancelled','Unavailable','Refunded')) ServicesToday`,[today]);
  const [operations,arrivals,recent,urgent,activity]=await Promise.all([
   this.db.query("SELECT TOP(8) r.*,s.Name ServiceName,c.DisplayName CustomerName FROM ServiceRequests r JOIN Services s ON s.Id=r.ServiceId JOIN Customers c ON c.Id=r.CustomerId WHERE r.PreferredDate=@0 AND r.Status NOT IN ('Cancelled','Unavailable','Refunded') ORDER BY r.PreferredTime",[today]),
   this.db.query('SELECT TOP(5) t.*,c.DisplayName CustomerName FROM Trips t JOIN Customers c ON c.Id=t.CustomerId WHERE t.ArrivalDate>=@0 ORDER BY t.ArrivalDate',[today]),
   this.db.query('SELECT TOP(5) r.*,s.Name ServiceName,c.DisplayName CustomerName FROM ServiceRequests r JOIN Services s ON s.Id=r.ServiceId JOIN Customers c ON c.Id=r.CustomerId ORDER BY r.CreatedAt DESC'),
   this.db.query("SELECT TOP(5) r.*,s.Name ServiceName,c.DisplayName CustomerName FROM ServiceRequests r JOIN Services s ON s.Id=r.ServiceId JOIN Customers c ON c.Id=r.CustomerId WHERE r.Status IN ('Requested','Under Review','Payment Required') AND r.PreferredDate<=@0 ORDER BY r.PreferredDate,r.PreferredTime",[today]),
   this.db.query('SELECT TOP(6) a.Action,a.CreatedAt,u.DisplayName ActorName FROM AuditLogs a LEFT JOIN Users u ON u.Id=a.ActorId ORDER BY a.CreatedAt DESC')
  ]);
  return {mode:'staff',today,kpis,operations,arrivals,recent,urgent,activity};
 }
 async search(term:string,a:Actor){
  if(term.trim().length<2)return [];
  const pattern=like(term.trim());const staff=isStaff(a);
  const [services,requests,trips,customers]=await Promise.all([
   this.db.query('SELECT TOP(5) s.Id,s.Name,s.ShortDescription FROM Services s JOIN ServiceCategories c ON c.Id=s.CategoryId WHERE s.Name LIKE @0 AND s.Active=1 AND c.Active=1 ORDER BY s.Name',[pattern]),
   this.db.query('SELECT TOP(5) Id,RequestNumber,Status FROM ServiceRequests WHERE RequestNumber LIKE @0'+(staff?'':' AND CustomerId=@1')+' ORDER BY CreatedAt DESC',staff?[pattern]:[pattern,a.customerId||null]),
   this.db.query('SELECT TOP(5) Id,Name,ArrivalDate FROM Trips WHERE Name LIKE @0'+(staff?'':' AND CustomerId=@1')+' ORDER BY ArrivalDate DESC',staff?[pattern]:[pattern,a.customerId||null]),
   staff?this.db.query('SELECT TOP(5) Id,DisplayName,Email FROM Customers WHERE DisplayName LIKE @0 OR Email LIKE @0 ORDER BY DisplayName',[pattern]):Promise.resolve([])
  ]);
  return [
   ...services.map(r=>({type:'Service',title:r.Name,subtitle:r.ShortDescription,href:'/services/'+r.Id})),
   ...requests.map(r=>({type:'Request',title:r.RequestNumber,subtitle:r.Status,href:'/requests/'+r.Id})),
   ...trips.map(r=>({type:'Trip',title:r.Name,subtitle:'Bahamas experience',href:'/trips/'+r.Id})),
   ...customers.map(r=>({type:'Customer',title:r.DisplayName,subtitle:r.Email,href:'/customers/'+r.Id}))
  ];
 }
}

