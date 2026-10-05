import { Row } from './api';
const key='islandone-guest-itinerary-v1';
export function freshDraft():Row{const start=new Date(Date.now()+7*86400000).toISOString().slice(0,10);return {GuestReference:crypto.randomUUID(),Name:'My Jamaica escape',Destination:'Jamaica',ArrivalDate:start,DepartureDate:new Date(Date.now()+14*86400000).toISOString().slice(0,10),Adults:2,Children:0,Items:[]};}
export function readDraft():Row {try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&Array.isArray(value.Items)&&typeof value.GuestReference==='string')return value;}catch{/* Ignore an unreadable browser draft and start fresh. */}return freshDraft();}
export function saveDraft(draft:Row){localStorage.setItem(key,JSON.stringify(draft));window.dispatchEvent(new Event('islandone-trip'));}
export function clearDraft(){localStorage.removeItem(key);window.dispatchEvent(new Event('islandone-trip'));}
export function itemInput(item:Row){return {ServiceId:item.ServiceId,EventDate:item.EventDate.slice(0,10),EventTime:item.EventTime,Quantity:Number(item.Quantity),PartySize:Number(item.PartySize),...(item.OptionId?{OptionId:item.OptionId}:{}),Notes:item.Notes||'',Pickup:item.Pickup||'',Dropoff:item.Dropoff||''};}
export function planInput(plan:Row){return {Name:plan.Name,Destination:plan.Destination,ArrivalDate:plan.ArrivalDate.slice(0,10),DepartureDate:plan.DepartureDate.slice(0,10),Adults:Number(plan.Adults),Children:Number(plan.Children)};}
export function currentPlan(customerId:string){return localStorage.getItem('islandone-plan-'+customerId)||'';}
export function selectPlan(customerId:string,id:string){localStorage.setItem('islandone-plan-'+customerId,id);window.dispatchEvent(new Event('islandone-trip'));}