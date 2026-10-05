import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean,IsIn,IsInt,IsNumber,IsOptional,IsString,IsUUID,Length,Max,MaxLength,Min,ValidateNested,IsArray,ArrayMaxSize,Matches } from 'class-validator';
export class CategoryDto {
 @IsString() @Length(2,120) Name!:string;
 @IsOptional() @IsString() @MaxLength(1000) Description?:string;
 @IsOptional() @IsBoolean() Active?:boolean;
 @IsOptional() @IsInt() @Min(0) @Max(10000) DisplayOrder?:number;
}
export class CategoryPatchDto extends PartialType(CategoryDto) {}
export class OptionDto {
 @IsString() @Length(1,120) Name!:string;
 @IsOptional() @IsString() @MaxLength(1000) Description?:string;
 @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(9999999999) Price?:number;
 @IsOptional() @IsBoolean() Active?:boolean;
}
export class ServiceDto {
 @IsOptional() @IsString() @Length(2,100) Destination?:string;
 @IsOptional() @IsString() @MaxLength(300) Location?:string;
 @IsOptional() @IsString() @MaxLength(12000) Images?:string;
 @IsOptional() @IsString() @MaxLength(2000) Amenities?:string;
 @IsOptional() @IsUUID('loose') VendorId?:string;
 @IsOptional() @IsString() @MaxLength(2000) BookingRequirements?:string;
 @IsOptional() @IsString() @MaxLength(2000) CancellationPolicy?:string;
 @IsOptional() @IsString() @MaxLength(1000) AvailabilityNotes?:string;
 @IsOptional() @IsBoolean() Published?:boolean;
 @IsOptional() @IsBoolean() Bookable?:boolean;
 @IsUUID('loose') CategoryId!:string;
 @IsString() @Length(2,160) Name!:string;
 @IsString() @Length(5,300) ShortDescription!:string;
 @IsString() @Length(5,12000) Description!:string;
 @IsOptional() @IsString() @MaxLength(1000) @Matches(/^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/) Image?:string;
 @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(9999999999) StartingPrice?:number;
 @IsIn(['Fixed','Starting From','Per Person','Per Hour','Custom Quote']) PricingType!:string;
 @IsOptional() @IsString() @MaxLength(100) Duration?:string;
 @IsOptional() @IsBoolean() Active?:boolean;
 @IsOptional() @IsBoolean() Featured?:boolean;
 @IsOptional() @IsInt() @Min(0) @Max(10000) DisplayOrder?:number;
 @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>OptionDto) Options?:OptionDto[];
}
export class ServicePatchDto extends PartialType(ServiceDto) {}

