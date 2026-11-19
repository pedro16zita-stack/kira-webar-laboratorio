import {Compositor as BaseCompositor} from './compositor-v026.js';
export {cleanAlpha} from './compositor-v026.js';
export class Compositor extends BaseCompositor {
 constructor(view,front){super(view,front);this.probe=document.createElement('canvas');this.probe.width=64;this.probe.height=86;this.probeContext=this.probe.getContext('2d',{willReadFrequently:true});this.gate=document.createElement('canvas');this.gate.width=64;this.gate.height=86;this.gateContext=this.gate.getContext('2d');this.gateImage=this.gateContext.createImageData(64,86);for(let i=0;i<this.gateImage.data.length;i+=4)this.gateImage.data[i]=this.gateImage.data[i+1]=this.gateImage.data[i+2]=255;this.reference=null;this.motionRejectedFraction=0;}
 paint(r){
  if(!this.liveVideo)return super.paint(r);
  this.probeContext.drawImage(r.bitmap,0,0,64,86);this.reference=this.probeContext.getImageData(0,0,64,86).data;
  super.paint(r);this.maskAt=Number.isFinite(r.captureAt)?Math.min(performance.now(),r.captureAt):performance.now();
  if(this.mode==='refined'){for(let i=0;i<r.alpha.length;i++)this.maskImage.data[i*4+3]=r.alpha[i]>=200?255:0;this.matte.getContext('2d').putImageData(this.maskImage,0,0);}
 }
 paintVideo(video,visible,now=performance.now()){
  if(!this.liveVideo)return;this.previewFrames++;this.previewFirst??=now;this.previewLast=now;const ctx=this.layers[1].getContext('2d');
  if(!visible||!this.maskReady||!this.reference||now-this.maskAt>450||this.mode==='off'){ctx.clearRect(0,0,480,640);this.foregroundDrawn=false;return;}
  const vw=video.videoWidth??video.width,vh=video.videoHeight??video.height,s=Math.max(480/vw,640/vh),sw=480/s,sh=640/s,sx=(vw-sw)/2,sy=(vh-sh)/2;
  this.probeContext.drawImage(video,sx,sy,sw,sh,0,0,64,86);const current=this.probeContext.getImageData(0,0,64,86).data,out=this.gateImage.data;let rejected=0;
  for(let i=0;i<out.length;i+=4){const diff=(Math.abs(current[i]-this.reference[i])+Math.abs(current[i+1]-this.reference[i+1])+Math.abs(current[i+2]-this.reference[i+2]))/3;const keep=this.mode==='original'||diff<42;out[i+3]=keep?255:0;if(!keep)rejected++;}
  this.motionRejectedFraction=rejected/(64*86);this.gateContext.putImageData(this.gateImage,0,0);
  ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,480,640);ctx.drawImage(video,sx,sy,sw,sh,0,0,480,640);ctx.globalCompositeOperation='destination-in';ctx.drawImage(this.matte,0,0,480,640);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.gate,0,0,480,640);ctx.imageSmoothingEnabled=true;ctx.globalCompositeOperation='source-over';this.foregroundDrawn=true;
 }
 previewStats(now=performance.now()){return {...super.previewStats(now),motionRejectedFraction:this.motionRejectedFraction,maskLifetimeMs:450,maskAgeUsesCaptureTime:true,confidentInteriorOpaque:true};}
 clear(){super.clear();this.reference=null;this.motionRejectedFraction=0;}
}
