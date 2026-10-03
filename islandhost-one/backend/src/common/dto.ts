import { Type,Transform } from 'class-transformer';
import { IsDateString, IsUUID, Matches, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class ListDto {
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page = 1;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit = 20;
 @IsOptional() @IsString() @MaxLength(120) search?: string;
 @IsOptional() @IsString() @MaxLength(60) status?: string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') categoryId?: string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') serviceId?: string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') customerId?: string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') tripId?: string;
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
 @IsOptional() @IsIn(['newest','oldest','date','name']) sort = 'newest';
 @IsOptional() @IsIn(['true','false']) all?: string;
}
export const pageResult = (items: unknown[], total: number, query: ListDto) => ({items,total,page:query.page,limit:query.limit,totalPages:Math.ceil(total/query.limit)});
export const like = (value: string) => '%' + value.replace(/[[\]%_]/g, c => '['+c+']') + '%';

