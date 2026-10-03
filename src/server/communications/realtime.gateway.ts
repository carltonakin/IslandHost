import { OnModuleDestroy } from '@nestjs/common';
import { OnGatewayConnection,OnGatewayDisconnect,WebSocketGateway } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { Db } from '../database/db';
import { required } from '../config';
type Session={id:string;user:string;expires:number};
@WebSocketGateway({path:'/api/realtime',maxPayload:1024})
export class RealtimeGateway implements OnGatewayConnection,OnGatewayDisconnect,OnModuleDestroy {
 private clients=new Map<WebSocket,Session>();
 private timer:ReturnType<typeof setInterval>;
 private queued=false;
 private changed=()=>{if(this.queued)return;this.queued=true;setTimeout(()=>{this.queued=false;void this.publish().catch(()=>undefined);},150).unref();};
 constructor(private db:Db,private jwt:JwtService){this.db.changes.on('change',this.changed);this.timer=setInterval(()=>{void this.publish().catch(()=>undefined);},30000);this.timer.unref();}
 async handleConnection(client:WebSocket,request:IncomingMessage){
  try{
   if(process.env.REALTIME_ENABLED!=='true'||request.headers.origin!==new URL(required('APP_URL')).origin)throw new Error();
   const cookie=(request.headers.cookie||'').split(';').map(p=>p.trim()).find(p=>p.startsWith('ih_access='))?.slice(10);
   if(!cookie)throw new Error();
   const token=await this.jwt.verifyAsync<{sub:string;sid:string;exp:number}>(decodeURIComponent(cookie),{secret:required('JWT_SECRET'),algorithms:['HS256'],issuer:'islandhost',audience:'islandhost-web'});
   if(!await this.db.one('SELECT s.Id FROM AuthSessions s JOIN Users u ON u.Id=s.UserId WHERE s.Id=@0 AND s.UserId=@1 AND s.RevokedAt IS NULL AND s.ExpiresAt>SYSUTCDATETIME() AND u.Active=1',[token.sid,token.sub]))throw new Error();
   if([...this.clients.values()].filter(s=>s.user===token.sub).length>=5||this.clients.size>=500)throw new Error();
   this.clients.set(client,{id:token.sid,user:token.sub,expires:token.exp*1000});
   client.on('message',()=>client.close(1008,'Use the authenticated REST message endpoints.'));
   client.send(JSON.stringify({event:'ready'}));
  }catch{client.close(1008,'Please sign in again.');}
 }
 handleDisconnect(client:WebSocket){this.clients.delete(client);}
 private async publish(){
  if(!this.clients.size)return;
  const sessions=[...new Set([...this.clients.values()].map(s=>s.id))];
  const valid=await this.db.query('SELECT s.Id FROM AuthSessions s JOIN Users u ON u.Id=s.UserId WHERE s.Id IN ('+sessions.map((_,i)=>'@'+i).join(',')+') AND s.RevokedAt IS NULL AND s.ExpiresAt>SYSUTCDATETIME() AND u.Active=1',sessions);
  const live=new Set(valid.map(s=>String(s.Id).toLowerCase()));
  for(const [client,s] of this.clients){if(s.expires<=Date.now()||!live.has(s.id.toLowerCase())){client.close(1008,'Please renew your session.');this.clients.delete(client);}else if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify({event:'refresh'}));}
 }
 onModuleDestroy(){clearInterval(this.timer);this.db.changes.off('change',this.changed);for(const client of this.clients.keys())client.close(1001,'Server restarting.');this.clients.clear();}
}
