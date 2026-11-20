import {Compositor as PreviousCompositor} from './compositor-v028.js';
import {closePinholes,exposureOffset} from './matte-filter-v032.js';
export {cleanAlpha} from './compositor-v026.js';
export class Compositor extends PreviousCompositor {
 constructor(view,front){super(view,front);this.gateRaw=new Uint8Array(64*86);this.gateClosed=new Uint8Array(64*86);this.exposureHistogram=new Uint32Array(511);this.maskRaw=null;this.maskClosed=null;this.maskHolesFilled=0;this.gateHolesFilled=0;this.exposureDelta=0;}
 paint(r){super.paint(r);if(!this.liveVideo||this.mode!=='refined')return;if(!this.maskRaw||this.maskRaw.length!==r.alpha.length){this.maskRaw=new Uint8Array(r.alpha.length);this.maskClosed=new Uint8Array(r.alpha.length);}for(let i=0;i<r.alpha.length;i++)this.maskRaw[i]=r.alpha[i]>=200?255:0;this.maskHolesFilled=closePinholes(this.maskRaw,this.maskClosed,r.width,r.height);for(let i=0;i<r.alpha.length;i++)this.maskImage.data[i*4+3]=this.maskClosed[i];this.matte.getContext('2d').putImageData(this.maskImage,0,0);}
 paintVideo(video,visible,now=performance.now()){
  if(!this.liveVideo)return;this.previewFrames++;this.previewFirst??=now;this.previewLast=now;const ctx=this.layers[1].getContext('2d');
  if(!visible||!this.maskReady||!this.reference||now-this.maskAt>450||this.mode==='off'){ctx.clearRect(0,0,480,640);this.foregroundDrawn=false;return;}
  const vw=video.videoWidth??video.width,vh=video.videoHeight??video.height,s=Math.max(480/vw,640/vh),sw=480/s,sh=640/s,sx=(vw-sw)/2,sy=(vh-sh)/2;
  this.probeContext.drawImage(video,sx,sy,sw,sh,0,0,64,86);const current=this.probeContext.getImageData(0,0,64,86).data,out=this.gateImage.data;this.exposureDelta=exposureOffset(current,this.reference,this.exposureHistogram);let rejected=0;
  for(let i=0,j=0;i<out.length;i+=4,j++){const diff=(Math.abs(current[i]-this.reference[i]-this.exposureDelta)+Math.abs(current[i+1]-this.reference[i+1]-this.exposureDelta)+Math.abs(current[i+2]-this.reference[i+2]-this.exposureDelta))/3;this.gateRaw[j]=this.mode==='original'||diff<42?255:0;}
  this.gateHolesFilled=this.mode==='original'?0:closePinholes(this.gateRaw,this.gateClosed,64,86);if(this.mode==='original')this.gateClosed.set(this.gateRaw);
  for(let i=0;i<this.gateClosed.length;i++){out[i*4+3]=this.gateClosed[i];if(!this.gateClosed[i])rejected++;}this.motionRejectedFraction=rejected/(64*86);this.gateContext.putImageData(this.gateImage,0,0);
  ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,480,640);ctx.imageSmoothingEnabled=true;ctx.drawImage(this.matte,0,0,480,640);ctx.globalCompositeOperation='destination-in';ctx.drawImage(this.gate,0,0,480,640);ctx.globalCompositeOperation='source-in';ctx.drawImage(video,sx,sy,sw,sh,0,0,480,640);ctx.globalCompositeOperation='source-over';this.foregroundDrawn=true;
 }
 previewStats(now=performance.now()){return {...super.previewStats(now),maskHolesFilled:this.maskHolesFilled,gateHolesFilled:this.gateHolesFilled,exposureOffset:this.exposureDelta,motionGrid:[64,86],sourceRGBPreserved:true};}
 clear(){super.clear();this.maskHolesFilled=this.gateHolesFilled=0;this.exposureDelta=0;}
}
