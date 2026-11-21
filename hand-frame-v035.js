import {HandFramePlanner as BasePlanner} from './hand-frame-v025.js';
export {mapHandResult} from './hand-frame-v025.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const crop=(x,y,extent,kind)=>({x:clamp(x-extent/2,0,1-extent),y:clamp(y-extent/2,0,1-extent),w:extent,h:extent,kind});
export class HandFramePlanner extends BasePlanner {
 reset(){super.reset();this.lastFullAt=-Infinity;this.searches=0;this.focusFrames=0;}
 next(now,pose=[]){
  this.frames++;
  if(this.bounds&&now-this.lastSeen<=650){
   if(now-this.lastFullAt>=650){this.lastFullAt=now;return {x:0,y:0,w:1,h:1,kind:'full'};}
   this.focusFrames++;const b=this.bounds,wide=this.focusFrames%3===0,extent=clamp(Math.max(wide?.32:.2,(b.maxX-b.minX)*(wide?3:2.6),(b.maxY-b.minY)*(wide?3:2.6)),.2,.85);
   return crop((b.minX+b.maxX)/2,(b.minY+b.maxY)/2,extent,'hand-crop');
  }
  this.bounds=null;this.focusFrames=0;
  const wrists=[15,16].map((i,index)=>({p:pose[i],elbow:pose[i-2],index})).filter(({p})=>p&&p.visibility>=.4&&(p.presence??1)>=.5&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
  if(!wrists.length||this.frames%3===1){this.lastFullAt=now;return {x:0,y:0,w:1,h:1,kind:'full'};}
  const step=this.searches++,wrist=wrists[Math.floor(step/2)%wrists.length],extent=step%2===0?.32:.2,p=wrist.p,e=wrist.elbow;
  const reliable=e&&e.visibility>=.4&&(e.presence??1)>=.5,dx=reliable?clamp((p.x-e.x)*.22,-.06,.06):0,dy=reliable?clamp((p.y-e.y)*.22,-.06,.06):0;
  return crop(p.x+dx,p.y+dy,extent,'wrist-search');
 }
}
