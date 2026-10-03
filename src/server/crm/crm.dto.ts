import { PartialType } from '@nestjs/swagger';
import { IsEmail,IsIn,IsInt,IsOptional,IsString,IsUUID,IsDateString,Length,Max,MaxLength,Min,Matches } from 'class-validator';
export class ProfileDto {
 @IsString() @Length(2,120) DisplayName!:string;
 @IsOptional() @IsString() @MaxLength(40) Phone?:string;
}
export class CustomerDto extends ProfileDto {
 @IsEmail() @MaxLength(254) Email!:string;
 @IsString() @Length(12,128) Password!:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class CustomerPatchDto extends PartialType(ProfileDto) {
 @IsOptional() @IsIn(['Active','Inactive']) Status?:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class PreferencesDto {
 @IsOptional() @IsString() @MaxLength(1000) DietaryRequirements?:string;
 @IsOptional() @IsString() @MaxLength(1000) Interests?:string;
 @IsOptional() @IsString() @MaxLength(1000) Transportation?:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class GuestDto {
 @IsString() @Length(2,120) DisplayName!:string;
 @IsOptional() @IsString() @MaxLength(60) Relationship?:string;
 @IsOptional() @IsString() @MaxLength(1000) Notes?:string;
}
export class TripDto {
 @IsOptional() @IsUUID('loose') CustomerId?:string;
 @IsString() @Length(2,120) Name!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) ArrivalDate!:string;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) DepartureDate!:string;
 @IsInt() @Min(1) @Max(100) Adults!:number;
 @IsInt() @Min(0) @Max(100) Children!:number;
 @IsOptional() @IsString() @MaxLength(40) AccommodationType?:string;
 @IsOptional() @IsString() @MaxLength(160) AccommodationName?:string;
 @IsOptional() @IsString() @MaxLength(300) AccommodationAddress?:string;
 @IsOptional() @IsString() @MaxLength(30) ArrivalFlight?:string;
 @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) ArrivalTime?:string;
 @IsOptional() @IsString() @MaxLength(30) DepartureFlight?:string;
 @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) DepartureTime?:string;
 @IsOptional() @IsString() @MaxLength(1000) DietaryRequirements?:string;
 @IsOptional() @IsString() @MaxLength(200) SpecialOccasion?:string;
 @IsOptional() @IsString() @MaxLength(1000) TransportationRequirements?:string;
 @IsOptional() @IsString() @MaxLength(2000) PersonalPreferences?:string;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class TripPatchDto extends PartialType(TripDto) {}

