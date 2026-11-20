import {alignMask,illuminationOffset} from './mask-alignment-v034.js';
import * as THREE from 'three';
import {Compositor as PreviousCompositor} from './compositor-v032.js';
import {closePinholes,exposureOffset} from './matte-filter-v032.js';
export {cleanAlpha} from './compositor-v026.js';

// The CPU path remains available for diagnostics and file-based tests.
// Live video is sampled by the existing renderer, never copied at 480x640 each frame.
export class Compositor extends PreviousCompositor {
 attach(scene){
  if(this.overlay)return;
  const mask=new THREE.CanvasTexture(this.matte),gate=new THREE.CanvasTexture(this.gate);
  for(const t of [mask,gate]){t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.LinearFilter;t.colorSpace=THREE.NoColorSpace;}
  gate.minFilter=gate.magFilter=THREE.LinearFilter;
  this.overlayMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{videoMap:{value:null},maskMap:{value:mask},gateMap:{value:gate},crop:{value:new THREE.Vector4(1,1,0,0)},refined:{value:1},maskOffset:{value:new THREE.Vector2()}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy*2.0,0.0,1.0);}`,fragmentShader:`uniform sampler2D videoMap,maskMap,gateMap;uniform vec4 crop;uniform vec2 maskOffset;uniform float refined;varying vec2 vUv;void main(){vec2 maskUv=vUv-maskOffset;float m=(maskUv.x<0.0||maskUv.x>1.0||maskUv.y<0.0||maskUv.y>1.0)?0.0:texture2D(maskMap,maskUv).a;float gate=texture2D(gateMap,vUv).a;float a=m*gate;if(refined>.5)a=step(.5,a);if(a<.004)discard;vec3 rgb=texture2D(videoMap,vUv*crop.xy+crop.zw).rgb;gl_FragColor=vec4(rgb,a);}`});
  this.overlay=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.overlayMaterial);this.overlay.renderOrder=10000;this.overlay.frustumCulled=false;this.overlay.visible=false;this.overlay.name='KIRA_person_occlusion_034';scene.add(this.overlay);
  this.maskTexture=mask;this.gateTexture=gate;this.gateUpdates=0;this.lastGateAt=-Infinity;this.gateDirty=true;this.cpuFullFrameCopies=0;this.disposed=false;
 }
 paint(r){
  if(!this.overlay||!this.liveVideo)return super.paint(r);
  try{
   this.probeContext.drawImage(r.bitmap,0,0,64,86);this.reference=this.probeContext.getImageData(0,0,64,86).data;
   const m=this.matte;
   if(!this.maskImage||m.width!==r.width||m.height!==r.height){m.width=r.width;m.height=r.height;this.maskImage=m.getContext('2d').createImageData(r.width,r.height);for(let i=0;i<this.maskImage.data.length;i+=4)this.maskImage.data[i]=this.maskImage.data[i+1]=this.maskImage.data[i+2]=255;this.maskRaw=new Uint8Array(r.alpha.length);this.maskClosed=new Uint8Array(r.alpha.length);}
   if(this.mode==='refined'){for(let i=0;i<r.alpha.length;i++)this.maskRaw[i]=r.alpha[i]>=200?255:0;this.maskHolesFilled=closePinholes(this.maskRaw,this.maskClosed,r.width,r.height);}
   for(let i=0;i<r.alpha.length;i++)this.maskImage.data[i*4+3]=this.mode==='off'?0:this.mode==='original'?r.alpha[i]:this.maskClosed[i];
   m.getContext('2d').putImageData(this.maskImage,0,0);this.maskTexture.needsUpdate=true;this.maskAt=Number.isFinite(r.captureAt)?Math.min(performance.now(),r.captureAt):performance.now();this.maskReady=true;this.body=r.body;this.gateDirty=true;
  }finally{r.bitmap.close();}
 }
 paintVideo(video,visible,now=performance.now()){
  if(!this.overlay)return super.paintVideo(video,visible,now);
  if(!this.liveVideo)return;
  this.previewFrames++;this.previewFirst??=now;this.previewLast=now;
  const valid=visible&&this.maskReady&&this.reference&&now-this.maskAt<=450&&this.mode!=='off';
  if(!valid){this.overlay.visible=false;this.foregroundDrawn=false;return;}
  const vw=video.videoWidth??video.width,vh=video.videoHeight??video.height;if(!vw||!vh)return;
  const scale=Math.max(480/vw,640/vh),sw=480/scale,sh=640/scale,sx=(vw-sw)/2,sy=(vh-sh)/2;
  if(this.videoSource!==video){this.videoTexture?.dispose();this.videoSource=video;this.videoTexture=video instanceof HTMLVideoElement?new THREE.VideoTexture(video):new THREE.CanvasTexture(video);this.videoTexture.colorSpace=THREE.NoColorSpace;this.videoTexture.generateMipmaps=false;this.videoTexture.minFilter=this.videoTexture.magFilter=THREE.LinearFilter;this.videoTexture.needsUpdate=true;this.overlayMaterial.uniforms.videoMap.value=this.videoTexture;}
  if(!this.videoTexture.isVideoTexture)this.videoTexture.needsUpdate=true;
  if(this.gateDirty||now-this.lastGateAt>=66){
   this.probeContext.drawImage(video,sx,sy,sw,sh,0,0,64,86);const current=this.probeContext.getImageData(0,0,64,86).data,out=this.gateImage.data;this.exposureDelta=illuminationOffset(current,this.reference,this.exposureHistogram);let rejected=0;
   this.alignment=this.mode==='refined'?alignMask(current,this.reference,this.exposureDelta):{dx:0,dy:0,accepted:false};const {dx,dy}=this.alignment;this.overlayMaterial.uniforms.maskOffset.value.set(dx/64,-dy/86);
   for(let i=0,j=0;i<out.length;i+=4,j++){const x=j%64-dx,y=Math.floor(j/64)-dy,k=(y*64+x)*4,valid=x>=0&&x<64&&y>=0&&y<86;const d=valid?(Math.abs(current[i]-this.reference[k]-this.exposureDelta)+Math.abs(current[i+1]-this.reference[k+1]-this.exposureDelta)+Math.abs(current[i+2]-this.reference[k+2]-this.exposureDelta))/3:255;this.gateRaw[j]=this.mode==='original'||d<42?255:0;}
   this.gateHolesFilled=this.mode==='original'?0:closePinholes(this.gateRaw,this.gateClosed,64,86);if(this.mode==='original')this.gateClosed.set(this.gateRaw);
   for(let i=0;i<this.gateClosed.length;i++){out[i*4+3]=this.gateClosed[i];if(!this.gateClosed[i])rejected++;}
   this.motionRejectedFraction=rejected/(64*86);this.gateContext.putImageData(this.gateImage,0,0);this.gateTexture.needsUpdate=true;this.gateDirty=false;this.lastGateAt=now;this.gateUpdates++;
  }
  this.overlayMaterial.uniforms.crop.value.set(sw/vw,sh/vh,sx/vw,sy/vh);this.overlayMaterial.uniforms.refined.value=Number(this.mode==='refined');this.overlay.visible=true;this.foregroundDrawn=true;
 }
 previewStats(now=performance.now()){return {...super.previewStats(now),composition:this.overlay?'gpu-current-video':'cpu-diagnostic',opaqueRefinedInterior:true,gateUpdates:this.gateUpdates??0,gateIntervalMs:66,cpuFullFrameCopies:this.cpuFullFrameCopies??null,occlusionDrawCalls:this.overlay?.visible?1:0,occlusionTriangles:this.overlay?.visible?2:0,physicalDepthMeasured:false,alignment:this.alignment??null,exposureOffsetLimit:48};}
 clear(){super.clear();if(this.overlay)this.overlay.visible=false;this.gateDirty=true;this.lastGateAt=-Infinity;this.alignment=null;if(this.overlayMaterial)this.overlayMaterial.uniforms.maskOffset.value.set(0,0);}
 dispose(){if(this.disposed)return;this.disposed=true;this.clear();this.overlay?.removeFromParent();this.overlay?.geometry.dispose();this.overlayMaterial?.dispose();this.videoTexture?.dispose();this.maskTexture?.dispose();this.gateTexture?.dispose();super.dispose();}
}
