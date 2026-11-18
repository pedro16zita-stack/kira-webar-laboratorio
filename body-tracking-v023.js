const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const visible=p=>p&&p.visibility>=.55&&p.presence>=.5&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
export function bodySnapshot(points){
 if(!points?.length)return {present:false,feetVisible:false,points:[]};
 const p=points.map(q=>({x:q.x,y:q.y,visibility:q.visibility??0,presence:q.presence??1}));
 const torsoVisible=q=>q&&q.visibility>=.4&&q.presence>=.7&&q.x>=0&&q.x<=1&&q.y>=0&&q.y<=1;
 const hips=torsoVisible(p[23])&&torsoVisible(p[24]);
 const shoulders=(visible(p[11])&&visible(p[12]))||(hips&&(visible(p[11])||visible(p[12]))&&p[11].presence>.7&&p[12].presence>.7);
 const head=[0,7,8].some(i=>visible(p[i]));
 const strongShoulders=[11,12].every(i=>torsoVisible(p[i])&&p[i].visibility>=.65&&p[i].presence>=.8);
 const torsoShoulders=torsoVisible(p[11])&&torsoVisible(p[12])&&hips;
 if(!(shoulders||torsoShoulders)||(!hips&&!head&&!strongShoulders))return {present:false,feetVisible:false,points:p};
 const shoulder=mid(p[11],p[12]),hip=hips?mid(p[23],p[24]):null;
 const feetVisible=[27,28,29,30,31,32].every(i=>visible(p[i]));
 const feet=feetVisible?{x:(p[31].x+p[32].x)/2,y:(Math.max(p[27].y,p[29].y,p[31].y)+Math.max(p[28].y,p[30].y,p[32].y))/2}:null;
 return {present:true,shoulder,hip,feet,feetVisible,presenceSource:head?'pose':'tronco-sem-rosto',shoulderWidth:Math.abs(p[11].x-p[12].x),center:hip?mid(shoulder,hip):shoulder,points:p};
}
export class BodyFramer {
 constructor(){this.reset()}
 reset(){this.last=null;this.shoulderCorrection=1}
 update(body,refs,proportion=1,viewHeight=3.49,aspect=.75){
  if(!body?.present)return null;
  const widthScale=body.shoulderWidth*aspect*viewHeight/refs.shoulderWidth;
  let scale,source;
  if(body.hip){
   const span=Math.hypot((body.shoulder.x-body.hip.x)*aspect,body.shoulder.y-body.hip.y);
   if(span<.025)return null;
   scale=span*viewHeight/refs.torsoHeight;source='torso';
   if(widthScale>.05&&body.shoulderWidth*aspect/span>.65)this.shoulderCorrection=clamp(scale/widthScale,.6,2.5);
  }else{const turning=this.last&&body.shoulderWidth<this.last.shoulderWidth*.55;scale=turning?this.last.scale/proportion:widthScale*this.shoulderCorrection;source=turning?'ombros-em-giro':'ombros';}
  scale=clamp(scale*proportion,.25,6);
  const anchor=body.feet??body.hip??body.shoulder;
  const localY=body.feet?refs.footY:body.hip?refs.hipY:refs.shoulderY;
  this.last={scale,source,shoulderWidth:source==='ombros-em-giro'?this.last.shoulderWidth:body.shoulderWidth,centerX:body.center.x,anchorY:anchor.y,localY,feetVisible:body.feetVisible};return this.last;
 }
}
// Continuity is spatial, not biometric identification. A lost session cannot
// attach itself to a new person; it must be armed with the target again.
export class PersonSession {
 constructor(){this.arm()}
 arm(){this.lastSeen=null;this.last=null;this.samples=0;this.bound=false;this.expired=false}
 update(body,now){
  if(this.expired)return this.state(now);
  let accept=!!body?.present;
  if(accept&&this.last){const d=Math.hypot(body.center.x-this.last.center.x,body.center.y-this.last.center.y);let comparable=true;if(body.hip&&this.last.hip){const size=b=>Math.hypot(b.shoulder.x-b.hip.x,b.shoulder.y-b.hip.y);const ratio=size(body)/size(this.last);comparable=ratio>.5&&ratio<2;}accept=d<.28&&comparable;}
  if(accept){this.last=body;this.lastSeen=now;this.samples++;if(this.samples>=2)this.bound=true;}
  else if(!this.bound){this.samples=0;this.last=null;this.lastSeen=null;}
  return {...this.state(now),accepted:accept};
 }
 state(now){
  const missing=this.lastSeen===null?Infinity:now-this.lastSeen;
  if(this.bound&&missing>1800)this.expired=true;
  return {bound:this.bound,visible:this.bound&&!this.expired&&missing<=650,expired:this.expired,missingMs:Number.isFinite(missing)?missing:null};
 }
}
