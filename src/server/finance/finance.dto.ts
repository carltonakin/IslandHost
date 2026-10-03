import { Transform,Type } from 'class-transformer';
import { ArrayMaxSize,ArrayMinSize,IsArray,IsDateString,IsIn,IsInt,IsOptional,IsString,IsUUID,Length,Matches,Max,MaxLength,Min,ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
const decimal=()=>Transform(({value})=>typeof value==='number'?String(value):value);
export class LineItemDto {
 @IsOptional() @IsUUID('loose') ServiceId?:string;
 @IsString() @Length(2,300) Description!:string;
 @IsInt() @Min(1) @Max(1000) Quantity!:number;
 @decimal() @IsString() @Matches(/^\d{1,9}(\.\d{1,2})?$/) UnitPrice!:string;
}
export class AmountsDto {
 @ApiProperty({type:()=>LineItemDto,isArray:true}) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>LineItemDto) Items!:LineItemDto[];
 @IsOptional() @decimal() @Matches(/^\d{1,3}(\.\d{1,2})?$/) TaxRate?:string;
 @IsOptional() @decimal() @Matches(/^\d{1,9}(\.\d{1,2})?$/) Fees?:string;
 @IsOptional() @decimal() @Matches(/^\d{1,9}(\.\d{1,2})?$/) Discount?:string;
 @IsOptional() @decimal() @Matches(/^\d{1,9}(\.\d{1,2})?$/) Deposit?:string;
 @IsOptional() @IsString() @MaxLength(4000) Terms?:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class QuoteDto extends AmountsDto {
 @IsUUID('loose') RequestId!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) ValidUntil!:string;
 @IsOptional() @IsInt() @Min(1) Version?:number;
}
export class InvoiceDto extends AmountsDto {
 @IsUUID('loose') TripId!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) DueDate!:string;
}
export class ConvertQuoteDto {
 @IsInt() @Min(1) Version!:number;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) DueDate!:string;
}
export class PaymentDto {
 @IsUUID('loose') InvoiceId!:string;
 @decimal() @Matches(/^\d{1,9}(\.\d{1,2})?$/) Amount!:string;
 @IsIn(['Cash','Bank Transfer','Cheque','External Card Terminal','Other']) Method!:string;
 @IsString() @Length(3,160) ProviderReference!:string;
 @IsString() @Matches(/^[a-zA-Z0-9_-]{16,100}$/) IdempotencyKey!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) ReceivedDate!:string;
 @IsOptional() @IsString() @MaxLength(1000) Notes?:string;
}
export class RefundDto {
 @IsUUID('loose') PaymentId!:string;
 @decimal() @Matches(/^\d{1,9}(\.\d{1,2})?$/) Amount!:string;
 @IsString() @Length(3,1000) Reason!:string;
 @IsString() @Length(3,160) ProviderReference!:string;
 @IsString() @Matches(/^[a-zA-Z0-9_-]{16,100}$/) IdempotencyKey!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) RefundedDate!:string;
}
