import { BadRequestException } from '@nestjs/common';
export type MoneyInput=number|string;
const maximum=99999999999999n;
export function cents(value:MoneyInput):bigint {
 const s=String(value);if(!/^\d{1,12}(\.\d{1,2})?$/.test(s))throw new BadRequestException('Use a non-negative amount with at most two decimal places.');
 const [whole,fraction='']=s.split('.');const n=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
 if(n>maximum)throw new BadRequestException('The amount is too large.');return n;
}
export function money(value:bigint){if(value<0n||value>maximum)throw new BadRequestException('The calculated amount is outside the supported range.');return (value/100n).toString()+'.'+(value%100n).toString().padStart(2,'0');}
export function totals(items:{Quantity:number;UnitPrice:MoneyInput}[],taxRate:MoneyInput=0,fees:MoneyInput=0,discount:MoneyInput=0,deposit:MoneyInput=0){
 const lines=items.map(i=>{if(!Number.isInteger(i.Quantity)||i.Quantity<1||i.Quantity>1000)throw new BadRequestException('Quantity must be between 1 and 1000.');return cents(i.UnitPrice)*BigInt(i.Quantity);});
 const subtotal=lines.reduce((a,b)=>a+b,0n),rate=cents(taxRate),fee=cents(fees),off=cents(discount),down=cents(deposit);
 if(rate>10000n||off>subtotal)throw new BadRequestException('Check the tax rate and discount.');
 const tax=((subtotal-off)*rate+5000n)/10000n;const total=subtotal-off+tax+fee;
 if(total<=0n||down>total)throw new BadRequestException('Total must be positive and the deposit cannot exceed it.');
 return {Subtotal:money(subtotal),TaxRate:money(rate),Tax:money(tax),Fees:money(fee),Discount:money(off),Total:money(total),Deposit:money(down),Lines:lines.map(money)};
}
