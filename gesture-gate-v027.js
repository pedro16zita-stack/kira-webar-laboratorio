export class GestureGate {
 constructor(){this.reset()}
 reset(){this.armed=false;this.since=null;this.samples=0;this.last=null;this.lastPositive=null;this.previousPositive=false;this.fired=false;this.progress=0;this.evidenceMs=0;this.center=null;this.reason='waiting';this.history=[];this.resetCount=0;this.lastResetReason=null;}
 clear(reason){if(this.armed){this.resetCount++;this.lastResetReason=reason;}this.armed=false;this.since=null;this.samples=0;this.lastPositive=null;this.previousPositive=false;this.progress=0;this.evidenceMs=0;this.center=null;this.reason=reason;this.history=[];}
 expire(now){if(!this.fired&&this.lastPositive!==null&&now-this.lastPositive>650)this.clear('hand-lost');}
 update(gesture,now){
  if(this.fired||!Number.isFinite(now)||(this.last!==null&&now<=this.last))return false;
  this.expire(now);const dt=this.last===null?0:now-this.last;this.last=now;
  const threshold=this.armed?.5:.6;const positive=gesture?.name==='Closed_Fist'&&gesture.score>=threshold;
  if(!positive){this.history.push(false);if(this.history.length>8)this.history.shift();
   const clearOpen=gesture?.name==='Open_Palm'&&(gesture.score>=.85||(gesture.shape?.open??0)>=2);
   const clearOther=gesture&&['Thumb_Up','Thumb_Down','Pointing_Up','Victory','ILoveYou'].includes(gesture.name)&&gesture.score>=.55;
   if(clearOpen||clearOther)this.clear('different-gesture');
   else{this.previousPositive=false;this.reason=this.armed?'brief-uncertainty':'waiting';}
   return false;
  }
  const c=gesture.center;const moved=this.center&&c&&Math.hypot(c.x-this.center.x,c.y-this.center.y)>.23;
  if(moved)this.clear('hand-changed');
  if(!this.armed){if(gesture.score<.6)return false;this.armed=true;this.since=now;}
  if(this.lastPositive!==null)this.evidenceMs+=Math.min(dt,300);this.history.push(true);if(this.history.length>8)this.history.shift();
  this.lastPositive=now;this.previousPositive=true;this.samples++;if(c)this.center={...c};this.progress=Math.min(.99,this.evidenceMs/900);this.reason='holding';
  if(this.evidenceMs>=900&&this.samples>=5&&this.history.filter(Boolean).length/this.history.length>=.5){this.fired=true;this.progress=1;this.reason='confirmed';return true;}return false;
 }
 snapshot(){return {progress:this.progress,evidenceMs:this.evidenceMs,samples:this.samples,reason:this.reason,fired:this.fired,resetCount:this.resetCount,lastResetReason:this.lastResetReason};}
}
