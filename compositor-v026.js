// Remove low-confidence foreground spill while preserving fully detected people.
export function cleanAlpha(value){const t=Math.max(0,Math.min(1,(value-64)/160));return Math.round(t*t*(3-2*t)*255)}
export class Compositor {
 constructor(view,front){
  this.layers=['cameraBackground','personForeground','guides'].map(name=>{const c=document.createElement('canvas');c.width=480;c.height=640;c.className=name;c.style.transform=front?'scaleX(-1)':'none';view.appendChild(c);return c});this.matte=document.createElement('canvas');this.body=null;this.hand=[];this.mode='refined';this.liveVideo=false;this.maskReady=false;this.previewFrames=0;this.previewFirst=null;this.previewLast=null;this.maskAt=null;this.foregroundDrawn=false;
 }
 paint(r){
  const [bg,fg]=this.layers,bc=bg.getContext('2d'),fc=fg.getContext('2d');bc.clearRect(0,0,480,640);if(!this.liveVideo)bc.drawImage(r.bitmap,0,0,480,640);
  const m=this.matte;if(!this.maskImage||m.width!==r.width||m.height!==r.height){m.width=r.width;m.height=r.height;this.maskImage=m.getContext('2d').createImageData(m.width,m.height);for(let i=0;i<this.maskImage.data.length;i+=4)this.maskImage.data[i]=this.maskImage.data[i+1]=this.maskImage.data[i+2]=255;}const im=this.maskImage;for(let i=0;i<r.alpha.length;i++)im.data[i*4+3]=this.mode==='off'?0:this.mode==='original'?r.alpha[i]:cleanAlpha(r.alpha[i]);m.getContext('2d').putImageData(im,0,0);
  this.maskReady=true;this.maskAt=performance.now();if(this.liveVideo){r.bitmap.close();this.body=r.body;return;}
  fc.globalCompositeOperation='source-over';fc.clearRect(0,0,480,640);fc.drawImage(r.bitmap,0,0,480,640);fc.globalCompositeOperation='destination-in';fc.drawImage(m,0,0,480,640);fc.globalCompositeOperation='source-over';r.bitmap.close();this.body=r.body;
 }
 paintVideo(video,visible,now=performance.now()){
  if(!this.liveVideo)return;this.previewFrames++;this.previewFirst??=now;this.previewLast=now;
  const fg=this.layers[1],ctx=fg.getContext('2d');
  if(!visible||!this.maskReady||now-this.maskAt>650||this.mode==='off'){if(this.foregroundDrawn)ctx.clearRect(0,0,480,640);this.foregroundDrawn=false;return;}
  const vw=video.videoWidth??video.width,vh=video.videoHeight??video.height,scale=Math.max(480/vw,640/vh),sw=480/scale,sh=640/scale;
  ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,480,640);ctx.drawImage(video,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,480,640);
  ctx.globalCompositeOperation='destination-in';ctx.drawImage(this.matte,0,0,480,640);ctx.globalCompositeOperation='source-over';this.foregroundDrawn=true;
 }
 previewStats(now=performance.now()){return {source:'decoded-video',frames:this.previewFrames,fps:this.previewLast>this.previewFirst?(this.previewFrames-1)*1000/(this.previewLast-this.previewFirst):null,maskAgeMs:this.maskAt===null?null:now-this.maskAt};}
 drawGuides(enabled){
  const ctx=this.layers[2].getContext('2d');ctx.clearRect(0,0,480,640);if(!enabled)return;
  ctx.strokeStyle='#58d8ff';ctx.lineWidth=2;const p=this.body?.points??[];
  for(const [a,b] of [[11,12],[11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28],[27,29],[29,31],[28,30],[30,32]]){if(!p[a]||!p[b]||p[a].visibility<.55||p[b].visibility<.55)continue;ctx.beginPath();ctx.moveTo(p[a].x*480,p[a].y*640);ctx.lineTo(p[b].x*480,p[b].y*640);ctx.stroke()}
  for(const [i,q] of p.entries()){if(q.visibility<.55||q.x<0||q.x>1||q.y<0||q.y>1)continue;ctx.fillStyle=i>=27?'#ffe174':'#58d8ff';ctx.beginPath();ctx.arc(q.x*480,q.y*640,i>=27?5:3,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='#63ffb1';for(const q of this.hand){ctx.beginPath();ctx.arc(q.x*480,q.y*640,3,0,Math.PI*2);ctx.fill()}
 }
 clear(){this.maskReady=false;this.foregroundDrawn=false;for(const c of this.layers)c.getContext('2d').clearRect(0,0,480,640);this.body=null;this.hand=[]}
 dispose(){for(const c of this.layers)c.remove()}
}
