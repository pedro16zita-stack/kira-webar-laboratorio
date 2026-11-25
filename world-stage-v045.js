export class WorldStage {
 constructor(){this.reset();}
 reset(){this.epoch=(this.epoch??0)+1;this.matrix=null;this.hit=null;this.anchor=null;this.pending=false;this.visible=false;this.placed=false;this.scale=1;this.mode='surface';}
 offer(matrix,now,result){if(this.placed)return false;if(!matrix||matrix.length!==16||!Array.from(matrix).every(Number.isFinite)||matrix[5]<.85||Math.abs(matrix[15]-1)>.001){this.hit=null;return false;}this.hit={matrix:Array.from(matrix),at:now,result};return true;}
 select(now){if(this.placed||!this.hit||now-this.hit.at>250||now<this.hit.at)return null;const hit=this.hit;this.matrix=hit.matrix.slice();this.placed=true;this.visible=true;this.hit=null;return {...hit,epoch:this.epoch};}
 acceptAnchor(anchor,epoch){if(epoch!==this.epoch||!this.placed){anchor?.delete?.();return false;}this.anchor=anchor;this.mode='anchor';return true;}
 update(frame,space){if(!this.placed)return;if(!this.anchor){this.visible=true;return;}const pose=frame.getPose(this.anchor.anchorSpace,space);this.visible=!!pose;if(pose)this.matrix=Array.from(pose.transform.matrix);}
 reposition(){this.anchor?.delete?.();this.reset();}
 snapshot(){return {placed:this.placed,visible:this.visible,matrix:this.matrix?.slice()??null,scale:this.scale,mode:this.mode,epoch:this.epoch,metricReferenceSpace:true,physicalCameraValidated:false};}
}
export async function supportsAR(xr){try{return !!xr&&await xr.isSessionSupported('immersive-ar');}catch{return false;}}
