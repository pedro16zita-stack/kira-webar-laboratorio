export class GestureGate {
 constructor(){this.reset()}
 reset(){this.armed=false;this.since=null;this.samples=0;this.last=null;this.fired=false;this.progress=0}
 update(gesture,now){
  if(this.fired)return false;
  if(gesture?.name==='Open_Palm'&&gesture.score>=.65){this.armed=true;this.since=null;this.samples=0;this.progress=0;this.last=now;return false}
  if(!this.armed||gesture?.name!=='Closed_Fist'||gesture.score<.75){this.since=null;this.samples=0;this.progress=0;this.last=now;return false}
  if(this.last!==null&&now-this.last>900){this.since=null;this.samples=0}
  this.last=now;if(this.since===null)this.since=now;this.samples++;this.progress=Math.min(1,(now-this.since)/700);
  if(now-this.since>=700&&this.samples>=3){this.fired=true;return true}return false;
 }
}
