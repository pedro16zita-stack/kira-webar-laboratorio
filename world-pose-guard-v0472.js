// Safety checks for world tracking. Never infer translation from screen position or gyro.
export class WorldPoseGuard {
 constructor(){this.reset();}
 reset(){this.first=null;this.previous=null;this.observations=0;this.travel=0;this.displacement=0;this.fault=null;this.reason='calibrating-translation';this.ready=false;this.safe=false;this.motionTime=null;this.motionTotal=0;this.window=null;}
 motion(rate,now){if(!rate)return;const values=[rate.alpha,rate.beta,rate.gamma];if(!values.every(Number.isFinite))return;const dt=this.motionTime===null?0:Math.max(0,Math.min((now-this.motionTime)/1000,.1));this.motionTime=now;this.motionTotal+=Math.hypot(...values)*dt;}
 observe(raw,camera,now,placed){
  this.safe=false;const p=raw?.position,q=raw?.rotation,k=raw?.intrinsics;
  if(placed&&raw?.trackingReason==='INITIALIZING'){this.fault=this.reason='tracking-origin-lost';return false;}
  if(raw?.trackingStatus!=='NORMAL'||!p||!q||!k||k.length!==16||![p.x,p.y,p.z,q.x,q.y,q.z,q.w,...k].every(Number.isFinite)){this.reason='tracking-unavailable';this.window=null;return false;}
  const quat=[q.x,q.y,q.z,q.w],pos=[p.x,p.y,p.z],norm=Math.hypot(...quat);
  if(norm<.98||norm>1.02){this.reason='invalid-rotation';return false;}
  const angle=(a,b)=>2*Math.acos(Math.max(0,Math.min(1,Math.abs(a.reduce((v,x,i)=>v+x*b[i],0))/(Math.hypot(...a)*Math.hypot(...b)))))*180/Math.PI;
  const renderedQ=camera.quaternion.toArray(),renderedP=camera.position.toArray();
  const mismatch=Math.hypot(...pos.map((v,i)=>v-renderedP[i]))>.01||angle(quat,renderedQ)>1||k.some((v,i)=>Math.abs(v-camera.projectionMatrix.elements[i])>.01);
  if(mismatch){this.reason='camera-pose-mismatch';if(placed)this.fault=this.reason;return false;}
  if(this.fault){this.reason=this.fault;return false;}
  const current={p:pos,q:quat,at:now};
  if(this.previous){const dt=(now-this.previous.at)/1000,distance=Math.hypot(...pos.map((v,i)=>v-this.previous.p[i]));if(placed&&dt>0&&dt<.3&&distance>.3&&distance/dt>4){this.fault=this.reason='tracking-jump';return false;}if(dt>=.07&&dt<.5){this.observations++;if(distance>=.003&&distance<.25)this.travel+=distance;}}
  if(!this.previous||now-this.previous.at>=80)this.previous=current;
  this.first??=current;this.displacement=Math.max(this.displacement,Math.hypot(...pos.map((v,i)=>v-this.first.p[i])));
  this.ready=this.observations>=5&&this.travel>=.06&&this.displacement>=.05;
  this.window??={at:now,motion:this.motionTotal,q:quat,path:0,lastQ:quat};this.window.path+=angle(quat,this.window.lastQ);this.window.lastQ=quat;
  if(now-this.window.at>=1200){const gyro=this.motionTotal-this.window.motion;if(placed&&gyro>25&&this.window.path<3){this.fault=this.reason='pose-frozen-during-motion';return false;}this.window={at:now,motion:this.motionTotal,q:quat,path:0,lastQ:quat};}
  this.safe=true;this.reason=this.ready?'tracked-translation-confirmed':'calibrating-translation';return true;
 }
 snapshot(){return {ready:this.ready,safe:this.safe,reason:this.reason,fault:this.fault,observations:this.observations,travel:this.travel,displacement:this.displacement,motionTotal:this.motionTotal,physicalCameraValidated:false};}
}
