import { IsDateString,IsIn,IsInt,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min } from 'class-validator';
import { STATUSES,Status } from '../common/types';
export class RequestDto {
 @IsUUID('loose') TripId!:string;
 @IsUUID('loose') ServiceId!:string;
 @IsOptional() @IsUUID('loose') OptionId?:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) PreferredDate!:string;
 @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) PreferredTime!:string;
 @IsInt() @Min(1) @Max(200) Guests!:number;
 @IsOptional() @IsString() @MaxLength(2000) SpecialRequirements?:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class StatusDto {
 @IsIn(STATUSES) Status!:Status;
 @IsInt() @Min(1) Version!:number;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
 @IsOptional() @IsUUID('loose') AssignedStaffId?:string|null;
 @IsOptional() @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) PreferredDate?:string;
 @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) PreferredTime?:string;
}
export class ItineraryDto {
 @IsUUID('loose') TripId!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) EventDate!:string;
 @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) EventTime!:string;
 @IsString() @MaxLength(160) Activity!:string;
 @IsOptional() @IsString() @MaxLength(300) Location?:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}

