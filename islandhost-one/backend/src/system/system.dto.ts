import { IsArray,ArrayMinSize,ArrayMaxSize,IsBoolean,IsEmail,IsIn,IsOptional,IsString,IsUUID,Length,MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ROLES } from '../common/types';
export class UserDto {
 @IsEmail() @MaxLength(254) Email!:string;
 @IsString() @Length(2,120) DisplayName!:string;
 @IsString() @Length(12,128) Password!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(9) @IsIn(ROLES,{each:true}) Roles!:string[];
}
export class UserPatchDto {
 @IsOptional() @IsString() @Length(2,120) DisplayName?:string;
 @IsOptional() @IsBoolean() Active?:boolean;
 @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(9) @IsIn(ROLES,{each:true}) Roles?:string[];
}
export class SettingDto {
 @IsIn(['BusinessName','ConciergeEmail','ConciergePhone','WelcomeMessage']) SettingKey!:string;
 @IsString() @Length(1,2000) Value!:string;
}
export class MessageDto {
 @IsOptional() @IsUUID('loose') CustomerId?:string;
 @IsString() @Length(1,4000) Body!:string;
}
export class MeDto { @IsString() @Length(2,120) DisplayName!:string; @IsOptional() @IsString() @MaxLength(40) Phone?:string; }
export class MePatchDto extends PartialType(MeDto) {}

