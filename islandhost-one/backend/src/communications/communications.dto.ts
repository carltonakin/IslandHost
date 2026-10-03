import { ArrayMaxSize,ArrayUnique,IsArray,IsIn,IsInt,IsOptional,IsString,IsUUID,Length,Max,Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ListDto } from '../common/dto';
export class ConversationDto {
 @IsString() @Length(2,160) Subject!:string;
 @IsIn(['Customer','Operations']) Kind!:string;
 @IsOptional() @IsUUID('loose') CustomerId?:string;
 @IsOptional() @IsArray() @ArrayMaxSize(30) @ArrayUnique() @IsUUID('loose',{each:true}) ParticipantIds?:string[];
}
export class ConversationMessageDto { @IsString() @Length(1,4000) Body!:string; }
export class ConversationReadDto { @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) ThroughSequence!:number; }
export class MessageListDto extends ListDto {
 @Transform(({value})=>value===''?undefined:value) @IsOptional() @IsUUID('loose') conversationId?:string;
}
