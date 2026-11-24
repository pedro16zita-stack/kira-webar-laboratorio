const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// A visual proportion estimate from body landmarks, not a metric depth sensor.
// Keep one shoulder/torso calibration through short losses and camera cropping.
export class BodyFramer {
 constructor(){this.reset();}
 reset(){this.last=null;this.shoulderCorrection=1;this.calibrated=false;this.anchor=null;this.anchorBias=0;this.feetRun=0;this.hipRun=0;this.lastBodyCenter=null;this.pendingFoot=null;this.footRejected=0;}
 snapshot(){return {last:this.last?{...this.last}:null,calibrated:this.calibrated,shoulderCorrection:this.shoulderCorrection,trustedDimension:this.anchor,metricDepth:false,footRejected:this.footRejected};}
 update(body,refs,proportion=1,viewHeight=3.49,aspect=.75){
  if(!body?.present)return null;
  const width=body.shoulderWidth*aspect*viewHeight/refs.shoulderWidth;
  const span=body.hip?Math.hypot((body.shoulder.x-body.hip.x)*aspect,body.shoulder.y-body.hip.y):null;
  const torso=span>=.025?span*viewHeight/refs.torsoHeight:null;
  if(!this.calibrated&&torso&&width>.05){
   const lean=Math.abs(body.shoulder.x-body.hip.x)*aspect/span;
   if(lean<.35&&body.shoulderWidth>.06){this.shoulderCorrection=clamp(torso/width,.6,2.5);this.calibrated=true;}
  }
  const shoulders=width*this.shoulderCorrection;let scale,source;
  if(torso){
   scale=Math.max(torso,shoulders);source=torso>=shoulders?'torso':'ombros-postura';
   if(shoulders/torso<.8||shoulders/torso>1.25){
    if(!this.anchor){const rw=this.last?.widthMetric>0?width/this.last.widthMetric:1,rt=this.last?.torsoMetric>0?torso/this.last.torsoMetric:1;this.anchor=Math.abs(Math.log(rw))<Math.abs(Math.log(rt))?'width':'torso';}
    const useWidth=this.anchor==='width';scale=useWidth?shoulders:torso;source=useWidth?'ombros-postura':'torso-em-giro';
   }else {this.anchor=null;
    if(this.last&&Math.abs(Math.log(shoulders/torso))>.075){const ds=Math.abs(Math.log(shoulders/this.last.baseScale)),dt=Math.abs(Math.log(torso/this.last.baseScale));if(Math.abs(ds-dt)>.035){scale=ds<dt?shoulders:torso;source=ds<dt?'ombros-estaveis':'torso-estavel';}}
   }
  }else{
   const turning=this.last&&width<this.last.widthMetric*.55;
   scale=turning?this.last.baseScale:shoulders;source=turning?'ombros-em-giro':'ombros';
  }
  if(!Number.isFinite(scale)||scale<=0)return null;
  const baseScale=scale;scale=clamp(baseScale*proportion,.25,6);
  this.feetRun=body.feet?this.feetRun+1:0;this.hipRun=body.hip?this.hipRun+1:0;
  const useFeet=body.feet&&(!this.last||this.last.anchorKind==='feet'||this.feetRun>=3),useHip=body.hip&&this.anchor!=='width'&&(!this.last||this.last.anchorKind!=='shoulders'||this.hipRun>=2);
  const anchor=useFeet?body.feet:useHip?body.hip:body.shoulder,localY=useFeet?refs.footY:useHip?refs.hipY:refs.shoulderY,anchorKind=useFeet?'feet':useHip?'hip':'shoulders';
  let stableAnchorY=anchor.y;
  if(useFeet&&this.last?.anchorKind==='feet'&&this.lastBodyCenter){const expected=this.last.anchorY+(body.center.y-this.lastBodyCenter.y),jump=anchor.y-expected,centerShift=Math.hypot(body.center.x-this.lastBodyCenter.x,body.center.y-this.lastBodyCenter.y);
   if(Math.abs(jump)>.045&&centerShift<.025&&Math.abs(baseScale/this.last.baseScale-1)<.06){if(this.pendingFoot&&Math.abs(this.pendingFoot-anchor.y)<.018)this.pendingFoot=null;else{this.pendingFoot=anchor.y;stableAnchorY=expected;this.footRejected++;}}else this.pendingFoot=null;
  }else this.pendingFoot=null;
  this.lastBodyCenter={...body.center};const rawRoot=(.5-stableAnchorY)*viewHeight-localY*scale;
  if(this.last&&this.last.anchorKind!==anchorKind)this.anchorBias=clamp(this.last.rootOffset-rawRoot,-viewHeight*.4,viewHeight*.4);else this.anchorBias*=.70;
  const anchorY=stableAnchorY-this.anchorBias/viewHeight,rootOffset=rawRoot+this.anchorBias;
  const widthMetric=source==='ombros-em-giro'?this.last.widthMetric:width;
  this.last={scale,baseScale,source,widthMetric,torsoMetric:torso??this.last?.torsoMetric??null,shoulderWidth:body.shoulderWidth,centerX:body.center.x,anchorY,localY,anchorKind,rootOffset,anchorBias:this.anchorBias,feetVisible:body.feetVisible};return this.last;
 }
}
