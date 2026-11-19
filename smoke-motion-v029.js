const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const rand=(i,k)=>{const x=Math.sin((i+1)*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};
export class SmokeMotion {
 constructor(capacity=128){this.capacity=capacity;this.puffs=Array.from({length:capacity},(_,i)=>({height:(i+.5)/capacity,phase:rand(i,1)*Math.PI*2,radius:Math.sqrt(rand(i,2)),speed:.65+rand(i,3)*.8,size:.36+rand(i,4)*.3,strength:.3+rand(i,5)*.22,tone:rand(i,6),x:0,y:0,z:0,alpha:0,angle:0,diameter:0}));for(const p of this.puffs)p.bandRadius=(.18+.25*Math.sin(p.height*Math.PI)+.42*Math.exp(-(((p.height-.68)/.19)**2)))*p.radius;this.order=Array.from({length:capacity},(_,i)=>i);this.active=capacity;this.mode=null;this.progress=0;}
 update(progress,mode='entry',quality='auto'){
  const u=clamp(progress),entry=mode==='entry';this.mode=mode;this.progress=u;this.active=quality==='economica'?96:this.capacity;
  for(let i=0;i<this.capacity;i++){
   const p=this.puffs[i],h=p.height,delay=entry?h*.1:(1-h)*.055,t=clamp((u-delay)/(1-delay)),envelope=smooth(t/.16)*(1-smooth((t-(entry?.53:.58))/(entry?.47:.42)));
   const radius=p.bandRadius;
   const expansion=entry?1.15-.35*smooth(t/.45)+.4*smooth((t-.55)/.45):.75+.35*smooth(t/.4)+.5*smooth((t-.55)/.45);
   const theta=p.phase+(entry?1:-1)*t*(1.1+p.speed*.65)+h*2.1,drift=.07*Math.sin(p.phase*1.7+t*4);
   p.x=Math.cos(theta)*radius*expansion+drift;p.z=Math.sin(theta)*radius*.62*expansion;
   p.y=h*2.55+(entry?-.26*(1-t)+t*.2:t*t*.55)+.06*Math.sin(theta*1.3+t*2);
   const wispy=i%4===0;p.diameter=p.size*(wispy?.72:1)*(entry?.8+.35*smooth(t/.45):.72+.53*smooth(t/.5))*(1+.2*t);
   p.alpha=p.strength*envelope*(wispy?.66:1);p.angle=p.phase*.7+t*(i%2?1:-1)*(.35+.2*p.speed);
  }
  // Camera faces -Z in the experience: back-to-front order for alpha compositing.
  this.order.sort((a,b)=>this.puffs[a].z-this.puffs[b].z);
  return this;
 }
 snapshot(){let peak=0;const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const p of this.puffs){peak=Math.max(peak,p.alpha);for(const [j,x] of [p.x,p.y,p.z].entries()){bounds.min[j]=Math.min(bounds.min[j],x);bounds.max[j]=Math.max(bounds.max[j],x);}}return {capacity:this.capacity,active:this.active,mode:this.mode,progress:this.progress,peakAlpha:peak,bounds,sortedBackToFront:this.order.every((i,n)=>!n||this.puffs[this.order[n-1]].z<=this.puffs[i].z)};}
}
