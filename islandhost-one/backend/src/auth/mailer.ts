import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { required } from '../config';
@Injectable()
export class Mailer {
 async passwordReset(email:string,token:string) {
  const link=new URL('/reset-password',required('APP_URL')); link.searchParams.set('token',token);
  const text=`Reset your IslandHost One password using this link within 30 minutes: ${link.toString()}\nIf you did not request a reset, you can ignore this email.`;
  if(process.env.MAIL_MODE==='file' && process.env.NODE_ENV!=='production') {
   const dir=resolve(__dirname,'../../../.local-mail'); await mkdir(dir,{recursive:true});
   await writeFile(resolve(dir,randomUUID()+'.txt'),`To: ${email}\nSubject: Reset your password\n\n${text}`,{mode:0o600}); return;
  }
  const transport=nodemailer.createTransport({host:required('SMTP_HOST'),port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:required('SMTP_PASSWORD')}:undefined});
  await transport.sendMail({from:required('SMTP_FROM'),to:email,subject:'Reset your IslandHost One password',text});
 }
}

