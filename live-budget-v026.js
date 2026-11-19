// A single inference at a time; prioritize hands without starving body presence.
export class LiveBudget {
 constructor(){this.last={body:-Infinity,hand:-Infinity};this.frames={body:-1,hand:-1};this.cost={body:80,hand:60};this.count={body:0,hand:0};this.active=null;this.start=0;}
 choose(now,s){
  if(this.active||s.bodyBusy||s.handBusy)return null;
  const b=s.bodyAllowed&&s.bodyReady&&s.videoTime!==this.frames.body;
  const h=s.handAllowed&&s.handReady&&s.videoTime!==this.frames.hand;
  const bodyDue=b&&now-this.last.body>=140,handDue=h&&now-this.last.hand>=140;
  if(bodyDue&&(!handDue||(now-this.last.body>=280&&this.last.body<=this.last.hand)))return 'body';
  if(handDue)return 'hand';
  return bodyDue?'body':null;
 }
 started(kind,now,videoTime){if(this.active)throw new Error('Inference overlap');this.active=kind;this.start=now;this.last[kind]=now;this.frames[kind]=videoTime;this.count[kind]++;}
 finished(kind,now){if(this.active!==kind)return;this.cost[kind]=.75*this.cost[kind]+.25*(now-this.start);this.active=null;}
 snapshot(){return {serialized:true,counts:{...this.count},meanCostMs:{...this.cost},active:this.active,duplicateDecodedFramesSkipped:true};}
}
export function renderProfile(quality,live=true){if(quality==='economica')return {fps:30,pixelRatio:1};if(quality==='auto'&&live)return {fps:60,pixelRatio:1};return {fps:60,pixelRatio:1.5};}
export function videoFrameStamp(video){
 const n=video.getVideoPlaybackQuality?.().totalVideoFrames;
 if(Number.isFinite(n)&&n>0)return {key:n,source:'decoded-counter'};
 if(Number.isFinite(video.webkitDecodedFrameCount)&&video.webkitDecodedFrameCount>0)return {key:video.webkitDecodedFrameCount,source:'webkit-decoded-counter'};
 return {key:Math.floor(video.currentTime*30),source:'30hz-clock-fallback'};
}
