const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class SideWalk {
 constructor(){this.reset();}
 reset(){this.active=false;this.velocity=0;this.speed=0;this.distance=0;this.blend=0;this.settling=0;this.heading=0;this.changes=0;this.frameSpeed=0;}
 request(from,to,enabled){if(!enabled||from===to)return;this.active=true;this.settling=0;this.changes++;}
 cancel(){this.frameSpeed=0;this.active=false;this.velocity=0;this.speed=0;this.blend=0;this.settling=0;}
 step(current,target,scale,dt){
  if(!this.active)return current;dt=clamp(dt,0,.1);scale=Math.max(.001,scale);const delta=(target-current)/scale,maxSpeed=.65,accel=2.6;
  const wanted=Math.sign(delta)*Math.min(maxSpeed,Math.sqrt(2*accel*Math.abs(delta)));this.velocity+=clamp(wanted-this.velocity,-accel*dt,accel*dt);
  let step=this.velocity*dt;if(Math.sign(step)===Math.sign(delta)&&Math.abs(step)>Math.abs(delta)){step=delta;this.velocity=0;}
  this.frameSpeed=dt>0?Math.abs(step)/dt:0;this.distance+=Math.abs(step);this.speed=Math.abs(this.velocity);if(this.speed>.025)this.heading=Math.sign(this.velocity)*Math.PI/2;
  const arrived=Math.abs(delta)<.018&&this.speed<.08;this.settling=arrived?this.settling+dt:0;this.blend+=(Number(!arrived)-this.blend)*(1-Math.exp(-dt/0.18));
  if(this.settling>.65){this.active=false;this.velocity=0;this.speed=0;this.blend=0;}
  return current+step*scale;
 }
 snapshot(){return {active:this.active,speed:this.speed,velocity:this.velocity,distance:this.distance,blend:this.blend,heading:this.heading,changes:this.changes,maxSpeed:.65,frameSpeed:this.frameSpeed,walkUsesActualDistance:true};}
}
