import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean,IsEmail,IsIn,IsOptional,IsString,IsUUID,Length,Matches,MaxLength } from 'class-validator';
export const VENDOR_TYPES=['Transportation','Driver','Yacht Operator','Tour Operator','Restaurant','Private Chef','Photographer','Florist','Grocery Supplier','Spa','Event Provider','Other'];
export class VendorDto {
 @IsString() @Length(2,160) Name!:string;
 @IsIn(VENDOR_TYPES) Type!:string;
 @IsOptional() @IsEmail() @MaxLength(254) Email?:string;
 @IsOptional() @IsString() @MaxLength(40) Phone?:string;
 @IsOptional() @IsUUID('loose') UserId?:string;
 @IsOptional() @IsBoolean() Active?:boolean;
 @IsOptional() @IsString() @MaxLength(2000) Notes?:string;
}
export class VendorPatchDto extends PartialType(VendorDto){}
export class VendorServiceDto {
 @IsUUID('loose') ServiceId!:string;
 @Transform(({value})=>typeof value==='number'?String(value):value) @Matches(/^\d{1,9}(\.\d{1,2})?$/) Cost!:string;
 @IsOptional() @IsBoolean() Active?:boolean;
}
export class AssignmentDto {
 @IsUUID('loose') VendorId!:string;
 @IsUUID('loose') RequestId!:string;
 @IsOptional() @Transform(({value})=>typeof value==='number'?String(value):value) @Matches(/^\d{1,9}(\.\d{1,2})?$/) Cost?:string;
 @IsOptional() @IsString() @MaxLength(2000) OperationalNotes?:string;
}
