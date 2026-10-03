import { Db } from './db';
import { required } from '../config';
import { hashPassword } from '../auth/password';
import { ROLES,Row } from '../common/types';
export async function ensureRoles(db:Db) {
 for(const name of ROLES)if(!await db.one('SELECT Id FROM Roles WHERE Name=@0',[name]))await db.insert('Roles',{Name:name});
}
export async function createAdmin(db:Db) {
 const email=required('ADMIN_EMAIL').trim().toLowerCase();const password=required('ADMIN_PASSWORD');
 if(password.length<12)throw new Error('ADMIN_PASSWORD must have at least 12 characters');
 if(await db.one('SELECT Id FROM Users WHERE Email=@0',[email]))throw new Error('This user already exists');
 await ensureRoles(db);
 const hash=await hashPassword(password);
 await db.transaction(async tx=>{
  const user=await db.insert('Users',{Email:email,DisplayName:process.env.ADMIN_NAME||'Administrator',PasswordHash:hash},undefined,tx);
  const role=await db.one("SELECT Id FROM Roles WHERE Name='SuperAdmin'",[],tx);
  await db.insert('UserRoles',{UserId:user.Id,RoleId:role!.Id},user.Id,tx);
  await db.audit(user.Id,'User created','Users',user.Id,{role:'SuperAdmin'},tx);
 });
}
export async function seed(db:Db){
 if(!['development','test'].includes(process.env.NODE_ENV||''))throw new Error('Demo seeding is prohibited in production');
 const password=required('SEED_PASSWORD');if(password.length<12)throw new Error('SEED_PASSWORD must have at least 12 characters');
 if(await db.one("SELECT Id FROM SystemSettings WHERE SettingKey='DevelopmentSeedVersion'"))return;
 await ensureRoles(db);const hash=await hashPassword(password);
 await db.transaction(async tx=>{
  const accounts=[['SuperAdmin',process.env.SEED_ADMIN_EMAIL||'admin@islandhost.example','Avery Thompson'],['Management','management@islandhost.example','Camille Rolle'],['ConciergeAgent','concierge@islandhost.example','Jules Miller'],['Customer',process.env.SEED_CUSTOMER_EMAIL||'guest@islandhost.example','Morgan Ellis']];
  const users:Record<string,Row>={};
  for(const [role,email,name] of accounts){
   const user=await db.insert('Users',{Email:email,DisplayName:name,PasswordHash:hash},undefined,tx);
   const r=await db.one('SELECT Id FROM Roles WHERE Name=@0',[role],tx);
   await db.insert('UserRoles',{UserId:user.Id,RoleId:r!.Id},user.Id,tx);users[role]=user;
  }
  const admin=users.SuperAdmin.Id;
  const customer=await db.insert('Customers',{UserId:users.Customer.Id,DisplayName:users.Customer.DisplayName,Email:users.Customer.Email,Phone:'+1 242 555 0148',Notes:'Celebrating an anniversary. Prefers a relaxed pace.'},admin,tx);
  await db.insert('CustomerPreferences',{CustomerId:customer.Id,DietaryRequirements:'Pescatarian; no shellfish',Interests:'Sailing, architecture and local food',Transportation:'Private transfers',Notes:'A quiet table with an ocean view is always appreciated.'},admin,tx);
  await db.insert('CustomerGuests',{CustomerId:customer.Id,DisplayName:'Alex Ellis',Relationship:'Partner'},admin,tx);
  const date=(offset:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
  const trip=await db.insert('Trips',{CustomerId:customer.Id,Name:'A little time in paradise',ArrivalDate:date(-1),DepartureDate:date(5),Adults:2,Children:0,SpecialOccasion:'Anniversary',DietaryRequirements:'Pescatarian; no shellfish',Notes:'An unhurried escape to Nassau.'},admin,tx);
  await db.insert('Accommodations',{TripId:trip.Id,Type:'Resort',Name:'The Ocean Club, Paradise Island'},admin,tx);
  await db.insert('Flights',{TripId:trip.Id,Direction:'Arrival',FlightNumber:'BA 253',FlightTime:'14:30'},admin,tx);
  await db.insert('Flights',{TripId:trip.Id,Direction:'Departure',FlightNumber:'BA 252',FlightTime:'21:55'},admin,tx);
  const itinerary=await db.insert('Itineraries',{TripId:trip.Id,Name:trip.Name},admin,tx);
  const names=['Airport Transportation','Private Transportation','Tours & Excursions','Yacht & Boat Charters','Dining','Private Chef','Grocery Provisioning','Villa & Hotel Services','Celebrations','Wellness','VIP Services','Personal Concierge'];
  const categories:Row[]=[];
  for(const [index,Name] of names.entries())categories.push(await db.insert('ServiceCategories',{Name,DisplayOrder:index},admin,tx));
  const samples=[
   {Name:'Your arrival, effortlessly',Category:0,ShortDescription:'A personal welcome and a private transfer from Lynden Pindling International Airport.',Description:'Step off the plane and into island time. Your host meets you at arrivals, assists with luggage and takes you directly to your Nassau or Paradise Island accommodation in a private, air-conditioned vehicle.',StartingPrice:125,PricingType:'Starting From',Duration:'45–60 minutes'},
   {Name:'A day on the turquoise',Category:3,ShortDescription:'Private sailing, hidden coves and the freedom to follow the sea.',Description:'Explore the waters off Nassau aboard a private crewed charter. Your concierge will shape the route around your group, from quiet swimming spots to an afternoon anchored beside a deserted beach. Weather and availability are confirmed by your concierge.',StartingPrice:1450,PricingType:'Starting From',Duration:'4 hours'},
   {Name:'A taste of the islands',Category:4,ShortDescription:'An oceanfront table and an evening of extraordinary Bahamian flavours.',Description:'Let us secure the right table for your occasion. Share your preferences, dietary needs and ideal evening, and your concierge will arrange a dining experience with a personal touch. Restaurant charges are quoted separately.',StartingPrice:75,PricingType:'Starting From',Duration:'An evening'},
   {Name:'Nassau, beyond the ordinary',Category:2,ShortDescription:'Colourful streets, local stories and the places worth slowing down for.',Description:'Discover Nassau with a knowledgeable local guide. Explore historic architecture, artisan workshops and favourite neighbourhood food stops at your own pace. Your route can be adapted for your interests and accessibility needs.',StartingPrice:180,PricingType:'Per Person',Duration:'3 hours'},
   {Name:'The chef comes to you',Category:5,ShortDescription:'A beautifully prepared dinner in the comfort of your own villa.',Description:'Your private chef plans a seasonal menu, sources ingredients, prepares dinner and handles the kitchen clean-up. Tell us about your tastes and let the evening unfold. Menus and pricing are confirmed before booking.',StartingPrice:250,PricingType:'Per Person',Duration:'3 hours'},
   {Name:'A moment of island calm',Category:9,ShortDescription:'Restorative wellness, thoughtfully arranged around your stay.',Description:'Make room for yourself with a tailored massage or wellness session. Your concierge coordinates a qualified provider, setting and treatment preferences. Availability and treatment choices are confirmed before your session.',StartingPrice:160,PricingType:'Starting From',Duration:'60–90 minutes'}
  ];
  const services:Row[]=[];
  for(const [index,sample] of samples.entries()){
   const {Category,...data}=sample;
   const service=await db.insert('Services',{...data,CategoryId:categories[Category].Id,Image:'/images/coast.svg',Featured:index<3,DisplayOrder:index},admin,tx);
   await db.insert('ServiceOptions',{ServiceId:service.Id,Name:'Personalised experience',Description:'Your concierge will tailor the details to your party.',Price:0},admin,tx);services.push(service);
  }
  for(const [index,status] of ['Completed','Confirmed','Under Review','Requested'].entries()){
   const service=services[index];const request=await db.insert('ServiceRequests',{TripId:trip.Id,CustomerId:customer.Id,ServiceId:service.Id,PreferredDate:date(index-1),PreferredTime:['14:30','10:00','19:00','09:30'][index],Guests:2,Status:status,AssignedStaffId:index<2?users.ConciergeAgent.Id:null},admin,tx);
   await db.insert('ServiceRequestHistory',{RequestId:request.Id,PreviousStatus:null,NewStatus:'Requested',ActorId:users.Customer.Id,Notes:'Looking forward to our stay.'},users.Customer.Id,tx);
   if(status!=='Requested')await db.insert('ServiceRequestHistory',{RequestId:request.Id,PreviousStatus:'Requested',NewStatus:status,ActorId:admin,Notes:'Development seed history.'},admin,tx);
   if(status==='Confirmed'||status==='Completed')await db.insert('ItineraryItems',{ItineraryId:itinerary.Id,RequestId:request.Id,EventDate:request.PreferredDate,EventTime:request.PreferredTime,Activity:service.Name,Location:index===1?'Nassau Harbour':'Lynden Pindling International Airport'},admin,tx);
   await db.audit(admin,'Service request created','ServiceRequests',request.Id,{developmentSeed:true},tx);
  }
  await db.notify(users.Customer.Id,'Welcome to your Bahamas experience','Your concierge is here to make every detail feel effortless.','/messages',tx);
  await db.notify(admin,'Your operations workspace is ready','Review upcoming experiences and requests from your guests.','/operations',tx);
  await db.insert('Messages',{CustomerId:customer.Id,SenderId:users.ConciergeAgent.Id,Body:'Welcome to Nassau, Morgan. I’m Jules, your concierge. Your charter is confirmed; let me know if there is anything you would like us to arrange for your anniversary.'},admin,tx);
  await db.insert('SystemSettings',{SettingKey:'BusinessName',Value:'Island Host Concierge Services'},admin,tx);
  await db.insert('SystemSettings',{SettingKey:'WelcomeMessage',Value:'Your Bahamas. One Seamless Experience.'},admin,tx);
  await db.insert('SystemSettings',{SettingKey:'DevelopmentSeedVersion',Value:'1'},admin,tx);
 });
}

