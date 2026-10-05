import { BadRequestException } from '@nestjs/common';
import { Row } from '../common/types';
export const BOOKING_STATES=['PLANNED','PENDING_CONFIRMATION','CONFIRMED','CHANGE_REQUESTED','RECONFIRMING','REJECTED','CANCELLED','EXPIRED','COMPLETED'] as const;
export function effectiveStatus(item:Row,now=new Date()) {
 return item.BookingStatus==='CONFIRMED'&&['UNPAID','PENDING'].includes(item.PaymentStatus)&&item.ConfirmationExpiresAt&&new Date(item.ConfirmationExpiresAt)<=now?'EXPIRED':item.BookingStatus;
}
export function ineligibleReason(item:Row,now=new Date(),invoiceId?:string):string|null {
 if(!item.Active)return 'This booking was removed.';
 if(effectiveStatus(item,now)!=='CONFIRMED')return 'Only currently confirmed bookings can be paid.';
 if(!item.ConfirmedPrice||Number(item.ConfirmedPrice)<=0||!item.ConfirmationReference)return 'A final price and confirmation reference are required.';
 if(['PAID','PARTIALLY_REFUNDED','REFUNDED'].includes(item.PaymentStatus))return 'This booking already has a settled payment.';
 if(item.CheckoutInvoiceId&&item.CheckoutInvoiceId.toLowerCase()!==invoiceId?.toLowerCase())return 'This booking already has an invoice awaiting payment.';
 return null;
}
export function assertEligible(item:Row,now=new Date(),invoiceId?:string){const reason=ineligibleReason(item,now,invoiceId);if(reason)throw new BadRequestException(reason);}
export function materialChange(previous:Row,next:Row){return ['EventDate','EventTime','Quantity','PartySize','OptionId','Pickup','Dropoff'].some(key=>next[key]!==undefined&&String(key==='EventDate'?new Date(previous[key]).toISOString().slice(0,10):previous[key]??'')!==String(next[key]??''));}