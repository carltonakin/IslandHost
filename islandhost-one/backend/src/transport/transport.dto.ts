import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean,IsDateString,IsIn,IsInt,IsOptional,IsString,IsUUID,Length,Matches,Max,MaxLength,Min } from 'class-validator';
export const TRANSFER_TYPES=['Airport Pickup','Airport Drop-off','Point-to-Point','Private Chauffeur'];
export class DriverDto {
 @IsUUID('loose') UserId!:string;
 @IsString() @Length(2,120) DisplayName!:string;
 @IsOptional() @IsString() @MaxLength(40) Phone?:string;
 @IsString() @Length(2,80) LicenseNumber!:string;
 @IsOptional() @IsBoolean() Active?:boolean;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class DriverPatchDto extends PartialType(DriverDto){}
export class VehicleDto {
 @IsString() @Length(2,120) Name!:string;
 @IsString() @Length(2,40) Registration!:string;
 @IsInt() @Min(1) @Max(200) Capacity!:number;
 @IsOptional() @IsBoolean() Active?:boolean;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class VehiclePatchDto extends PartialType(VehicleDto){}
export class TransferDto {
 @IsUUID('loose') RequestId!:string;
 @IsIn(TRANSFER_TYPES) Type!:string;
 @IsString() @Length(2,300) Pickup!:string;
 @IsString() @Length(2,300) Destination!:string;
 @IsInt() @Min(1) @Max(200) Passengers!:number;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) ScheduledDate!:string;
 @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) ScheduledTime!:string;
 @IsInt() @Min(15) @Max(1440) DurationMinutes!:number;
 @IsOptional() @IsString() @MaxLength(30) FlightNumber?:string;
 @IsOptional() @IsString() @MaxLength(2000) OperationalNotes?:string;
 @IsOptional() @Transform(({value})=>typeof value==='number'?String(value):value) @Matches(/^\d{1,9}(\.\d{1,2})?$/) DirectCost?:string;
}
export class TransferEditDto extends TransferDto { @IsInt() @Min(1) Version!:number; }
export class TransferAssignDto {
 @IsUUID('loose') DriverId!:string;
 @IsUUID('loose') VehicleId!:string;
 @IsInt() @Min(1) Version!:number;
 @IsOptional() @IsString() @MaxLength(1000) Notes?:string;
}
