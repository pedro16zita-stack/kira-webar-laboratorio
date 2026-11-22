// Camera-relative rest after an apparition has already been activated.
// It is deliberately separate from body evidence, identity and world tracking.
export class IdleStage {
 constructor(){this.reset();}
 reset(){this.active=false;this.since=null;this.target=null;this.entries=0;}
 enter(now,placement,refs,view){
  if(this.active)return false;
  this.active=true;this.since=now;this.entries++;
  const width=Math.max(.01,refs.width),height=Math.max(.01,refs.height);
  const bottomInset=Math.max(.18,Math.min(.42,view.bottomInset??.30));
  const scale=Math.min(placement.scale,view.height*(.90-bottomInset)/height,view.width*.78/width);
  const room=Math.max(0,(view.width-width*scale)/2-view.width*.06);
  this.target={x:Math.max(-room,Math.min(room,placement.x)),y:view.y+view.height*bottomInset/2-(refs.footY+height/2)*scale,scale,bottomInset};
  return true;
 }
 leave(){this.active=false;this.since=null;this.target=null;}
 snapshot(){return {active:this.active,since:this.since,entries:this.entries,target:this.target?{...this.target}:null,anchor:'camera-relative',worldAnchor:false};}
}
