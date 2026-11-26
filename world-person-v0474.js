import {WorkerRunner} from './worker-runner-v025.js';
import {Compositor} from './world-compositor-v0474.js';
export class WorldPerson {
 constructor(scene){this.compositor=new Compositor(document.createElement('div'),false);this.compositor.liveVideo=true;this.compositor.attach(scene);this.capture=document.createElement('canvas');this.context=this.capture.getContext('2d');this.closed=false;this.enabled=true;this.busy=false;this.last=-Infinity;this.epoch=0;this.stats={captures:0,discarded:0,inFlight:0,maxInFlight:0,physicalDepthMeasured:false,policy:'person-always-foreground',singleSharedCamera:true};}
 setEnabled(enabled){this.enabled=enabled;this.epoch++;this.compositor.clear();}
 update(video,placed,visible,width,height,now){
  if(this.closed)return;this.compositor.viewportWidth=width;this.compositor.viewportHeight=height;
  const active=this.enabled&&placed&&visible&&video?.readyState>=2;this.compositor.paintVideo(video,active,now);if(!active||this.busy||now-this.last<220)return;
  // One segmentation task, at most 4.6 requests/sec. No body/face/hand inference.
  this.runner??=new WorkerRunner('./world-person-worker-v0474.js');this.last=now;this.busy=true;this.stats.inFlight=1;this.stats.maxInFlight=Math.max(1,this.stats.maxInFlight);const epoch=this.epoch;
  const W=160,H=Math.max(1,Math.round(W*height/width)),vw=video.videoWidth,vh=video.videoHeight,s=Math.max(W/vw,H/vh),sw=W/s,sh=H/s;
  if(this.capture.width!==W||this.capture.height!==H){this.capture.width=W;this.capture.height=H;this.compositor.clear();}
  this.context.drawImage(video,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,W,H);
  this.runner.infer(this.capture,now).then(r=>{if(this.closed||epoch!==this.epoch||!this.enabled||performance.now()-r.captureAt>450){r.bitmap.close();this.stats.discarded++;return;}this.stats.captures++;this.stats.lastInferenceMs=r.ms;this.compositor.paint(r);}).catch(e=>{if(!this.closed){this.stats.error=e.message;this.enabled=false;this.compositor.clear();}}).finally(()=>{this.busy=false;this.stats.inFlight=0;});
 }
 snapshot(){return {...this.stats,enabled:this.enabled,busy:this.busy,...this.compositor.previewStats()};}
 clear(){this.epoch++;this.compositor.clear();}
 dispose(){if(this.closed)return;this.closed=true;this.epoch++;this.runner?.close();this.compositor.dispose();this.capture.width=this.capture.height=1;}
}
