import {HandFramePlanner as PreviousPlanner} from './hand-frame-v035.js';
export {mapHandResult} from './hand-frame-v025.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const full=()=>({x:0,y:0,w:1,h:1,kind:'full'});
const crop=(cx,cy,size)=>({x:clamp(cx-size/2,0,1-size),y:clamp(cy-size/2,0,1-size),w:size,h:size,kind:'hand-crop'});
const visible=p=>p&&p.visibility>=.4&&(p.presence??1)>=.5&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
export class HandFramePlanner extends PreviousPlanner {
 reset(){super.reset();this.context=null;this.contextAt=-Infinity;this.anchor=null;this.lastFrame=null;this.searchStep=0;this.generic=false;this.weakObservations=0;}
 observe(result,now,frame=this.lastFrame){
  super.observe(result,now);if(!result.handSeen)return;
  // Retain the generic point-only planner API; gesture-aware input uses context quality.
  this.generic=!('gesture' in result);if(this.generic)return;
  const fist=result.gesture?.name==='Closed_Fist'&&result.gesture.score>=.6;
  const open=result.gesture?.name==='Open_Palm'&&result.rawGesture?.name==='Open_Palm'&&result.rawGesture.score>=.85;
  if(!(fist||open)||!frame){this.weakObservations++;return;}
  const wrist=result.points?.[0];let selected={...frame};
  if(frame.w===1){const b=this.bounds;selected=crop(b?(b.minX+b.maxX)/2:.5,b?(b.minY+b.maxY)/2:.5,.85);}
  // Preserve the successful field of view rather than narrowing automatically.
  if(this.context&&this.anchor&&wrist&&frame.kind!=='full'){
   selected.x=clamp(selected.x+clamp(wrist.x-this.anchor.x,-.04,.04),0,1-selected.w);
   selected.y=clamp(selected.y+clamp(wrist.y-this.anchor.y,-.04,.04),0,1-selected.h);
  }
  this.context=selected;this.context.kind='hand-crop';this.contextAt=now;this.anchor=wrist?{x:wrist.x,y:wrist.y}:null;
 }
 next(now,pose=[]){
  if(this.generic){const f=super.next(now,pose);this.lastFrame=f;return f;}
  let frame;
  if(this.context&&now-this.contextAt<=650){
   if(now-this.lastFullAt>=650){this.lastFullAt=now;frame=full();}
   else frame={...this.context};
  }else{
   this.context=null;this.anchor=null;const step=this.searchStep++,slot=step%6,group=Math.floor(step/6);this.frames++;
   const wrists=[15,16].filter(i=>visible(pose[i]));
   if(slot===0||slot===3){this.lastFullAt=now;frame=full();}
   else if(slot===1){
    const torso=[11,12,23,24].map(i=>pose[i]).filter(visible),center=torso.length?{x:torso.reduce((s,p)=>s+p.x,0)/torso.length,y:torso.reduce((s,p)=>s+p.y,0)/torso.length}:{x:.5,y:.5};
    frame=crop(center.x,center.y,.7);
   }else if(wrists.length){
    const i=wrists[group%wrists.length],p=pose[i],e=pose[i-2],dx=visible(e)?clamp((p.x-e.x)*.22,-.06,.06):0,dy=visible(e)?clamp((p.y-e.y)*.22,-.06,.06):0;
    frame=crop(p.x+dx,p.y+dy,slot===2?.5:slot===4?.32:.2);frame.kind='wrist-search';
   }else{
    const centers=[[.5,.4],[.7,.5],[.3,.5],[.5,.7]],p=centers[(group*3+(slot===2?0:slot===4?1:2))%centers.length];frame=crop(p[0],p[1],.5);
   }
  }
  this.lastFrame=frame;return frame;
 }
 snapshot(){return {trustedContext:this.context?{...this.context}:null,lastTrustedAt:Number.isFinite(this.contextAt)?this.contextAt:null,weakObservations:this.weakObservations,searchStep:this.searchStep,contextLifetimeMs:650,keepsSuccessfulFieldOfView:true,bodyWristsRequired:false};}
}
