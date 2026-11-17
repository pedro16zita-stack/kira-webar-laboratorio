const summary=values=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b);return {mean:a.reduce((a,b)=>a+b,0)/a.length,p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)}};
export class PipelineMetrics {
 constructor(){this.reset()}
 reset(){this.rows=[];this.lastPaintAt=null;this.lastCaptureAt=null}
 record(result,paintedAt){
  if(!Number.isFinite(result.captureAt)||!Number.isFinite(result.receivedAt))return;
  this.rows.push({paintedAt,inferenceMs:result.ms,ageMs:Math.max(0,paintedAt-result.captureAt),deliveryMs:Math.max(0,result.receivedAt-result.captureAt-result.ms)});
  if(this.rows.length>90)this.rows.shift();this.lastPaintAt=paintedAt;this.lastCaptureAt=result.captureAt;
 }
 snapshot(now){const r=this.rows,span=r.length>1?r.at(-1).paintedAt-r[0].paintedAt:0;return {samples:r.length,compositeUpdatesPerSecond:span>0?(r.length-1)*1000/span:null,captureToPaintMs:summary(r.map(r=>r.ageMs)),inferenceMs:summary(r.map(r=>r.inferenceMs)),deliveryOverheadMs:summary(r.map(r=>r.deliveryMs)),currentMaskAgeMs:this.lastCaptureAt===null?null:Math.max(0,now-this.lastCaptureAt),renderFpsIsNotCameraFps:true,physicalCameraTestRequired:true}}
}
