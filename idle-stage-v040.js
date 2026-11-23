// Preserve the latest body-derived scale. A close character is cropped naturally;
// never shrink a large apparition just because tracking has become idle.
export class IdleStage {
 constructor(){this.reset();}
 reset(){this.active=false;this.since=null;this.target=null;this.entries=0;}
 enter(now,placement,refs,view){
  if(this.active)return false;this.active=true;this.since=now;this.entries++;
  const scale=placement.scale,headHalf=refs.headWidth*scale*.5;
  const room=Math.max(0,view.width/2-headHalf-view.width*.025);
  const faceY=refs.headY*scale,low=view.y-view.height*.15-faceY,high=view.y+view.height*.25-faceY;
  this.target={x:Math.max(-room,Math.min(room,placement.x)),y:Math.max(low,Math.min(high,placement.y)),scale,cropAllowed:true};return true;
 }
 leave(){this.active=false;this.since=null;this.target=null;}
 snapshot(){return {active:this.active,since:this.since,entries:this.entries,target:this.target?{...this.target}:null,anchor:'camera-relative',worldAnchor:false,scalePreserved:true};}
}
