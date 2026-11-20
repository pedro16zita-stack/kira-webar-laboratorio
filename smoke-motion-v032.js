import {SmokeMotion as BaseMotion} from './smoke-motion-v029.js';
export class SmokeMotion extends BaseMotion {
 update(progress,mode='entry',quality='auto'){super.update(progress,mode,quality);const u=this.progress,swirl=.045*Math.sin(Math.PI*u);for(const p of this.puffs){const a=p.height*9+p.phase+u*3;p.x+=Math.sin(a)*swirl;p.z+=Math.cos(a)*swirl*.5;if(mode==='exit')p.y+=.18*u*u;p.angle+=.15*Math.sin(a*.8)*Math.sin(Math.PI*u);}this.order.sort((a,b)=>this.puffs[a].z-this.puffs[b].z);return this;}
}
