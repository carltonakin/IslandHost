import { Transform } from 'class-transformer';
import { IsDateString,IsIn,IsInt,IsOptional,IsString,IsUUID,Matches,MaxLength,Min } from 'class-validator';
import { ListDto } from '../common/dto';
export class Phase2ListDto extends ListDto {
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) from?:string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) to?:string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') requestId?:string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') vendorId?:string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') driverId?:string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') vehicleId?:string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') invoiceId?:string;
 @IsOptional() @IsIn(['Today','Upcoming','Unassigned','Active','Completed']) view?:string;
 @IsOptional() @IsString() @MaxLength(40) type?:string;
}
export class ActionDto {
 @IsString() @MaxLength(30) Status!:string;
 @IsInt() @Min(1) Version!:number;
 @IsOptional() @IsString() @MaxLength(1000) Notes?:string;
}
