// World-space placement only. Body landmarks and viewport fitting do not enter this state.
export class BrowserStage {
 constructor(){this.reset();}
 reset(){this.epoch=(this.epoch??0)+1;this.placed=false;this.position=null;this.yaw=0;this.hit=null;this.tracking=false;this.normalSince=null;this.lastFrame=null;this.visible=false;this.scale=1;}
 update(reality,now){
  const p=reality?.position,q=reality?.rotation;
  const valid=reality?.trackingStatus==='NORMAL'&&p&&q&&[p.x,p.y,p.z,q.x,q.y,q.z,q.w].every(Number.isFinite);
  if(!valid){this.tracking=false;this.normalSince=null;this.hit=null;this.visible=false;return false;}
  if(this.lastFrame===null||now-this.lastFrame>500)this.normalSince=now;
  this.normalSince??=now;this.lastFrame=now;this.tracking=now-this.normalSince>=300;this.visible=this.placed&&this.tracking;return this.tracking;
 }
 offer(hits,now){
  if(this.placed||!this.tracking){this.hit=null;return false;}
  const horizontal=h=>{const q=h.rotation;if(!q||![q.x,q.y,q.z,q.w].every(Number.isFinite))return false;const n=q.x*q.x+q.y*q.y+q.z*q.z+q.w*q.w;return n>1e-8&&1-2*(q.x*q.x+q.z*q.z)/n>=.85;};
  const h=hits?.find(h=>['DETECTED_SURFACE','ESTIMATED_SURFACE'].includes(h.type)&&horizontal(h)&&h.position&&[h.position.x,h.position.y,h.position.z,h.distance].every(Number.isFinite)&&h.distance>=.4&&h.distance<=8);
  this.hit=h?{position:{...h.position},type:h.type,at:now}:null;return !!this.hit;
 }
 place(camera,now){
  if(this.placed||!this.tracking||!this.hit||now<this.hit.at||now-this.hit.at>200||!camera||![camera.x,camera.z].every(Number.isFinite))return false;
  this.position={...this.hit.position};this.yaw=Math.atan2(camera.x-this.position.x,camera.z-this.position.z);this.surfaceType=this.hit.type;this.hit=null;this.placed=this.visible=true;return true;
 }
 fresh(now){if(this.lastFrame===null||now-this.lastFrame>500){this.tracking=this.visible=false;this.normalSince=null;this.hit=null;}return this.visible;}
 snapshot(){return {placed:this.placed,visible:this.visible,position:this.position?{...this.position}:null,yaw:this.yaw,scale:this.scale,surfaceType:this.surfaceType??null,worldSpace:true,physicalCameraValidated:false};}
}
