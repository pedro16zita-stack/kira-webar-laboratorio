const clamp=x=>Number.isFinite(x)?Math.max(0,Math.min(1,x)):0;
export class BookReveal {
 constructor(duration=260){this.duration=duration;this.reset();}
 reset(){this.startedAt=null;this.value=0;}
 update({visible,ready,opacity=1,now=0,inspection=false}){
  const cap=clamp(opacity);if(!visible||!ready||cap<=.003){this.reset();return 0;}
  if(inspection){this.startedAt=now-this.duration;return this.value=cap;}
  if(this.startedAt===null||now<this.startedAt)this.startedAt=now;
  const t=clamp((now-this.startedAt)/this.duration),reveal=t*t*(3-2*t);
  return this.value=Math.min(cap,reveal);
 }
 snapshot(){return {durationMs:this.duration,startedAt:this.startedAt,opacity:this.value};}
}
