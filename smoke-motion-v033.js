import {SmokeMotion as BaseMotion} from './smoke-motion-v032.js';
export class SmokeMotion extends BaseMotion {
 update(progress,mode='entry',quality='auto'){
  super.update(progress,mode,quality);const u=this.progress,e=Math.sin(Math.PI*u),entry=mode==='entry';
  for(let i=0;i<this.capacity;i++){const p=this.puffs[i],h=p.height,a=p.phase+h*8+u*(entry?4.5:-3.8),curl=.12*e*(.4+p.radius*.6);p.x+=Math.sin(a)*curl;p.z+=Math.cos(a)*curl*.65;p.y+=e*.08*Math.sin(a*1.4)+(entry?.08:.22)*u*u;p.diameter*=1.13+.12*Math.sin(a*.7)*e;p.angle+=.3*e*Math.sin(a);p.alpha*=1.12;}
  this.order.sort((a,b)=>this.puffs[a].z-this.puffs[b].z);return this;
 }
}
