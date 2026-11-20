import {HandFramePlanner as PreviousPlanner} from './hand-frame-v025.js';
export {mapHandResult} from './hand-frame-v025.js';
export class HandFramePlanner extends PreviousPlanner {
 reset(){super.reset();this.lastFullAt=-Infinity;this.uses=0;}
 next(now,posePoints=[]){
  // Once associated, spend more samples on the actual hand. Keep a bounded
  // full-frame search and expire the ROI instead of chasing stale coordinates.
  if(this.bounds&&now-this.lastSeen<=650){
   this.frames++;this.uses++;
   if(now-this.lastFullAt>=650){this.lastFullAt=now;return {x:0,y:0,w:1,h:1,kind:'full'};}
   const b=this.bounds,extent=Math.min(.85,Math.max(.3,(b.maxX-b.minX)*2.2,(b.maxY-b.minY)*2.2)),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;
   return {x:Math.max(0,Math.min(1-extent,cx-extent/2)),y:Math.max(0,Math.min(1-extent,cy-extent/2)),w:extent,h:extent,kind:'hand-crop'};
  }
  // An expired associated hand must not trigger the old planner's 800ms ROI.
  if(this.bounds&&now-this.lastSeen>650)this.bounds=null;
  const frame=super.next(now,posePoints);if(frame.kind==='full')this.lastFullAt=now;return frame;
 }
}
