import { Type,Transform } from 'class-transformer';
import { ArrayMaxSize,ArrayMinSize,ArrayUnique,IsArray,IsDateString,IsIn,IsInt,IsOptional,IsString,IsUUID,Length,Matches,Max,MaxLength,Min,ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ListDto } from '../common/dto';
import { BOOKING_STATES } from './booking-rules';
export class MarketplaceQuery extends ListDto {
 @IsOptional() @IsString() @MaxLength(100) destination?:string;
 @IsOptional() @IsString() @MaxLength(100) location?:string;
}
export class PlanItemDto {
 @IsUUID('loose') ServiceId!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) EventDate!:string;
 @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) EventTime!:string;
 @IsInt() @Min(1) @Max(1000) Quantity!:number;
 @IsInt() @Min(1) @Max(200) PartySize!:number;
 @IsOptional() @IsUUID('loose') OptionId?:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
 @IsOptional() @IsString() @MaxLength(300) Pickup?:string;
 @IsOptional() @IsString() @MaxLength(300) Dropoff?:string;
}
export class ChangeItemDto extends PartialType(PlanItemDto) {
 @IsInt() @Min(1) Version!:number;
}
export class PlanDto {
 @IsString() @Length(2,120) Name!:string;
 @IsString() @Length(2,100) Destination!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) ArrivalDate!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) DepartureDate!:string;
 @IsInt() @Min(1) @Max(100) Adults!:number;
 @IsInt() @Min(0) @Max(100) Children!:number;
}
export class ImportPlanDto extends PlanDto {
 @IsUUID('loose') GuestReference!:string;
 @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PlanItemDto) Items!:PlanItemDto[];
}
export class BookingActionDto {
 @IsInt() @Min(1) Version!:number;
 @IsIn(BOOKING_STATES) Status!:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
 @IsOptional() @Transform(({value})=>typeof value==='number'?String(value):value) @Matches(/^\d{1,9}(\.\d{1,2})?$/) ConfirmedPrice?:string;
 @IsOptional() @IsString() @Length(2,160) ConfirmationReference?:string;
 @IsOptional() @IsDateString({strict:true}) ConfirmationExpiresAt?:string;
 @IsOptional() @IsString() @MaxLength(2000) ConfirmationConditions?:string;
}
export class SelectionDto {
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsUUID('loose',{each:true}) ItemIds!:string[];
}
export class CheckoutDto extends SelectionDto {
 @IsString() @Matches(/^[a-zA-Z0-9_-]{16,100}$/) IdempotencyKey!:string;
}