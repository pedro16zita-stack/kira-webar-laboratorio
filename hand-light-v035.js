const percentile=(hist,n,q)=>{let count=0;for(let i=0;i<256;i++){count+=hist[i];if(count>=n*q)return i;}return 255;};
export function exposurePlan(data,hist=new Uint32Array(256)){
 hist.fill(0);for(let i=0;i<data.length;i+=4)hist[Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])]++;
 const n=data.length/4,p10=percentile(hist,n,.1),p35=percentile(hist,n,.35),p90=percentile(hist,n,.9);let gamma=1;
 if(p35<105&&p90>5)gamma=Math.max(.55,Math.min(1,Math.log(105/255)/Math.log(Math.max(12,p35)/255)));
 else if(p35>195&&p10>150)gamma=1+.25*Math.max(0,Math.min(1,(p35-195)/50,(p10-150)/50));
 gamma=Math.round(gamma*50)/50;return {p10,p35,p90,gamma,adjusted:gamma!==1,signalLimited:p90<16||p90-p10<6,highlightLimited:p10>245};
}
export class HandLight {
 constructor(Canvas=globalThis.OffscreenCanvas){this.supported=typeof Canvas==='function';if(!this.supported)return;this.histogram=new Uint32Array(256);this.probe=new Canvas(32,32);this.pc=this.probe.getContext('2d',{willReadFrequently:true});this.canvas=new Canvas(480,640);this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});this.lut=new Uint8Array(256);this.gamma=null;}
 prepare(bitmap){
  if(!this.supported)return {source:bitmap,light:{gamma:1,adjusted:false,supported:false,ms:0,modelPasses:1}};
  const started=performance.now(),w=bitmap.width,h=bitmap.height;this.pc.drawImage(bitmap,w*.15,h*.15,w*.7,h*.7,0,0,32,32);const plan=exposurePlan(this.pc.getImageData(0,0,32,32).data,this.histogram);
  if(!plan.adjusted)return {source:bitmap,light:{...plan,ms:performance.now()-started,modelPasses:1}};
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  if(this.gamma!==plan.gamma){for(let i=0;i<256;i++)this.lut[i]=Math.round(255*(i/255)**plan.gamma);this.gamma=plan.gamma;}
  this.ctx.drawImage(bitmap,0,0);const im=this.ctx.getImageData(0,0,w,h),d=im.data;for(let i=0;i<d.length;i+=4){d[i]=this.lut[d[i]];d[i+1]=this.lut[d[i+1]];d[i+2]=this.lut[d[i+2]];}this.ctx.putImageData(im,0,0);
  return {source:this.canvas,light:{...plan,ms:performance.now()-started,modelPasses:1}};
 }
}
