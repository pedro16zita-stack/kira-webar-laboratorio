// Gate evidence stays on capture timestamps. UI expiry must use the same clock,
// not mistake processing latency for a missing hand.
export class ObservationClock {
 constructor(){this.reset();}
 reset(){this.source=null;this.received=null;this.pending=null;this.rejected=0;this.delay=0;}
 start(captureAt){this.pending=captureAt;}
 finish(captureAt){if(this.pending===captureAt)this.pending=null;}
 accept(captureAt,receivedAt){
  this.finish(captureAt);
  if(!Number.isFinite(captureAt)||!Number.isFinite(receivedAt)||receivedAt<captureAt||receivedAt-captureAt>1000||(this.source!==null&&captureAt<=this.source)){this.rejected++;return false;}
  this.source=captureAt;this.received=receivedAt;this.delay=receivedAt-captureAt;return true;
 }
 now(wallTime){
  if(this.source===null)return wallTime;
  let sourceNow=this.source+Math.max(0,wallTime-this.received);
  // A pending capture is already an observation in progress. Wait only within
  // the existing 1000ms acceptance bound, never forever after worker failure.
  if(this.pending!==null&&wallTime-this.pending<=1000)sourceNow=Math.min(sourceNow,Math.max(this.source,this.pending));
  return sourceNow;
 }
 snapshot(now){return {expiryClock:'capture-with-receipt-anchor',lastCapture:this.source,lastReceived:this.received,processingDelayMs:this.delay,pendingAgeMs:this.pending===null?null:Math.max(0,now-this.pending),rejectedFrames:this.rejected,maxAcceptedFrameAgeMs:1000,sourceNow:this.now(now)};}
}
