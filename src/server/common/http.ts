import { StreamableFile, ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger, Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Response } from 'express';
import { map } from 'rxjs';
const fallback = "We couldn't complete that request. Please try again or contact your concierge if the problem continues.";
@Catch()
export class Errors implements ExceptionFilter {
 private logger = new Logger('API');
 catch(error: unknown, host: ArgumentsHost) {
  let status = error instanceof HttpException ? error.getStatus() : 500;
  let message: string | string[] = fallback;
  if (error instanceof HttpException && status < 500) {
   const data = error.getResponse(); message = typeof data === 'string' ? data : (data as {message:string|string[]}).message;
  } else {
   const e = error as {name?:string; code?:string; number?:number; driverError?:{number?:number}};
   const number = e.number ?? e.driverError?.number;
   if (number === 2601 || number === 2627) { status=409; message='An item with these details already exists.'; }
   // Never log SQL text, parameters, passwords, tokens, or connection strings.
   this.logger.error(JSON.stringify({event:'request_failed',type:e.name,code:e.code,sqlNumber:number}));
  }
  host.switchToHttp().getResponse<Response>().status(status).json({error:{status,message}});
 }
}
@Injectable()
export class Envelope implements NestInterceptor {
 intercept(_context: ExecutionContext, next: CallHandler) { return next.handle().pipe(map(data=>data instanceof StreamableFile?data:({data}))); }
}

