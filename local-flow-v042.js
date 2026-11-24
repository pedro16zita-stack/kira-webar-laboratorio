const W=64,H=86,N=W*H;
const error=(a,i,b,j,ex)=>(Math.abs(a[i]-b[j]-ex)+Math.abs(a[i+1]-b[j+1]-ex)+Math.abs(a[i+2]-b[j+2]-ex))/3;
// Bounded inverse patch correspondence. A displacement needs current texture,
// a confident captured person pixel, and independently agreeing neighbors.
export class LocalFlow {
 constructor(){this.pixels=new Uint8Array(N*4);this.dx=new Int8Array(N);this.dy=new Int8Array(N);this.valid=new Uint8Array(N);this.votes=new Uint8Array(49);this.clear();}
 clear(){this.pixels.fill(0);this.valid.fill(0);this.accepted=0;this.searched=0;this.comparisons=0;this.costMs=0;}
 snapshot(){return {accepted:this.accepted,searched:this.searched,comparisons:this.comparisons,costMs:this.costMs,grid:[W,H],maxDisplacementCells:3,maxAgeMs:300,bytes:this.pixels.byteLength+this.dx.byteLength+this.dy.byteLength+this.valid.byteLength+this.votes.byteLength};}
 update(current,reference,mask,global,ex=0,age=0,enabled=true){
  const start=performance.now();this.clear();if(!enabled||!mask||age<0||age>300)return;
  const gx=global?.dx??0,gy=global?.dy??0;
  for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){
   const p=y*W+x,rx=x-gx,ry=y-gy,base=ry*W+rx;if(rx<0||rx>=W||ry<0||ry>=H)continue;
   if(mask[base]>=200&&error(current,p*4,reference,base*4,ex)<18)continue;
   let near=false;for(let oy=-3;oy<=3&&!near;oy++)for(let ox=-3;ox<=3;ox++){const qx=x-ox,qy=y-oy;if(qx>=0&&qx<W&&qy>=0&&qy<H&&mask[qy*W+qx]>=200){near=true;break;}}if(!near)continue;
   if(this.comparisons>=60000)continue;this.searched++;let best=Infinity,second=Infinity,bx=0,by=0;
   for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const sx=x-dx,sy=y-dy,q=sy*W+sx;if(mask[q]<200||error(current,p*4,reference,q*4,ex)>24)continue;
    let sum=0,lo=255,hi=0;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const ci=((y+oy)*W+x+ox)*4,ri=((sy+oy)*W+sx+ox)*4;sum+=Math.min(70,error(current,ci,reference,ri,ex));const v=(current[ci]+current[ci+1]+current[ci+2])/3;lo=Math.min(lo,v);hi=Math.max(hi,v);this.comparisons++;}
    if(hi-lo<12)continue;const cost=sum/9+.05*((dx-gx)**2+(dy-gy)**2);if(cost<best){second=best;best=cost;bx=dx;by=dy;}else second=Math.min(second,cost);
   }
   if(best<16&&second-best>1.0&&(bx!==gx||by!==gy)){this.valid[p]=1;this.dx[p]=bx;this.dy[p]=by;}
  }
  for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){const p=y*W+x;if(!this.valid[p])continue;let support=0;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;const q=(y+oy)*W+x+ox;if(this.valid[q]&&Math.abs(this.dx[q]-this.dx[p])<=1&&Math.abs(this.dy[q]-this.dy[p])<=1)support++;}if(support>=3){this.pixels[p*4]=128+this.dx[p];this.pixels[p*4+1]=128+this.dy[p];this.pixels[p*4+3]=255;this.accepted++;}}
  // One non-recursive consensus pass can follow low-texture skin/clothes only
  // from independent patch matches and a matching current foreground color.
  for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){const p=y*W+x;if(this.pixels[p*4+3])continue;this.votes.fill(0);let total=0,best=0,code=0;for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const q=(y+oy)*W+x+ox;if(!this.valid[q])continue;const n=(this.dy[q]+3)*7+this.dx[q]+3,v=++this.votes[n];total++;if(v>best){best=v;code=n;}}if(best<4||best<total*.7)continue;const dx=code%7-3,dy=Math.floor(code/7)-3,sx=x-dx,sy=y-dy,q=sy*W+sx;if(mask[q]<200||error(current,p*4,reference,q*4,ex)>=24)continue;let sum=0;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)sum+=error(current,((y+oy)*W+x+ox)*4,reference,((sy+oy)*W+sx+ox)*4,ex);if(sum/9>=24)continue;this.pixels[p*4]=128+dx;this.pixels[p*4+1]=128+dy;this.pixels[p*4+3]=255;this.accepted++;}
  this.costMs=performance.now()-start;
 }
}
