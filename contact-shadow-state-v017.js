// Screen-space ground reference only; this does not estimate a real plane.
export class ShadowState {
 constructor(){this.reset()}
 reset(){this.stableSince=null;this.alpha=0;this.position=null;this.width=0;this.height=0;this.visible=false}
 update({now,dt,enabled,sessionVisible,feetFresh,opacity=1,x,y,scale,lift=0}){
  if(!enabled||!sessionVisible){this.reset();return this.snapshot()}
  const valid=feetFresh&&[x,y,scale,lift].every(Number.isFinite)&&scale>0;
  if(!valid)this.stableSince=null;
  else if(this.stableSince===null)this.stableSince=now;
  const ready=valid&&now-this.stableSince>=350;
  const blend=1-Math.exp(-Math.min(.1,Math.max(0,dt))*12);
  if(ready){
   const grow=1+Math.min(.5,Math.max(0,lift)*3);
   this.position={x,y};this.width=.9*scale*grow;this.height=.13*scale*grow;
  }
  // Freeze the last ground point while fading; never use a torso anchor as floor.
  this.alpha+=((ready?.24/(1+Math.max(0,lift)*5):0)-this.alpha)*blend;
  if(this.alpha<.004)this.alpha=0;
  this.visible=!!this.position&&this.alpha*Math.max(0,Math.min(1,opacity))>.003;
  return {...this.snapshot(),opacity:this.alpha*Math.max(0,Math.min(1,opacity))};
 }
 snapshot(){return {visible:this.visible,alpha:this.alpha,position:this.position?{...this.position}:null,width:this.width,height:this.height,simulation:true,physicalFloorTracking:false}}
}
