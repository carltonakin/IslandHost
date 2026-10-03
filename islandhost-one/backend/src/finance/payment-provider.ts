import { Injectable,ServiceUnavailableException } from '@nestjs/common';
export type PaymentReceipt={provider:string;reference:string;status:'Paid'};
export interface PaymentProvider {
 readonly key:string;
 offlineReceipt(reference:string):PaymentReceipt;
 refundReceipt(reference:string):PaymentReceipt;
}
// This adapter records funds already settled externally. It never charges a card.
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
 readonly key='manual';
 offlineReceipt(reference:string):PaymentReceipt{return {provider:this.key,reference,status:'Paid'};}
 refundReceipt(reference:string):PaymentReceipt{return this.offlineReceipt(reference);}
}
@Injectable()
export class PaymentProviders {
 private providers:Map<string,PaymentProvider>;
 constructor(manual:ManualPaymentProvider){this.providers=new Map([[manual.key,manual]]);}
 configured(){const provider=this.providers.get(process.env.PAYMENT_PROVIDER||'manual');if(!provider)throw new ServiceUnavailableException('The configured payment provider is not available.');return provider;}
 forRecorded(key:string){const p=this.providers.get(key);if(!p)throw new ServiceUnavailableException('This payment provider requires its registered adapter.');return p;}
}
