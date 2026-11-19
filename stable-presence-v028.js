import {PersonSession as BaseSession} from './body-tracking-v023.js';
const torso=b=>b?.hip?Math.hypot(b.shoulder.x-b.hip.x,b.shoulder.y-b.hip.y):null;
export class PersonSession extends BaseSession {
 arm(){super.arm();this.candidate=null;this.relocations=0;}
 update(body,now){
  if(!this.expired&&this.bound&&body?.present&&this.last){
   const d=Math.hypot(body.center.x-this.last.center.x,body.center.y-this.last.center.y),a=torso(body),b=torso(this.last),ratio=a&&b?a/b:1;
   if(d>=.28&&ratio>.6&&ratio<1.7){const same=this.candidate&&now-this.candidate.at<=500&&Math.hypot(body.center.x-this.candidate.center.x,body.center.y-this.candidate.center.y)<.12;this.candidate={at:now,center:{...body.center}};
    if(same&&now-this.lastSeen<=1200){this.last=body;this.lastSeen=now;this.samples++;this.relocations++;this.candidate=null;return {...this.state(now),accepted:true,reacquired:true};}
    return {...this.state(now),accepted:false,pendingRelocation:true};
   }
  }
  this.candidate=null;return super.update(body,now);
 }
 state(now){const s=super.state(now);return {...s,visible:s.bound&&!s.expired&&s.missingMs!==null&&s.missingMs<=1000,graceMs:1000,expiryMs:1800,relocations:this.relocations??0};}
}
