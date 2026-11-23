// Binary foreground evidence: never blend the person's interior with the model.
// Every held pixel still needs positive confidence in the new capture.
export function stableAlpha(current,previous,out,width,height,{age=Infinity,dx=0,dy=0}={}){
 const history=previous?.length===current.length&&age>0&&age<=450;let held=0;
 for(let y=0,i=0;y<height;y++)for(let x=0;x<width;x++,i++){
  if(current[i]>=200){out[i]=255;continue;}
  const px=x-dx,py=y-dy;
  if(history&&current[i]>=160&&px>=0&&px<width&&py>=0&&py<height&&previous[py*width+px]>=200){out[i]=255;held++;}else out[i]=0;
 }return held;
}
const difference=(a,i,b,j,offset)=>(Math.abs(a[i]-b[j]-offset)+Math.abs(a[i+1]-b[j+1]-offset)+Math.abs(a[i+2]-b[j+2]-offset))/3;
export class ForegroundMatcher {
 constructor(){this.indices=new Uint16Array(64*86);this.count=0;}
 clear(){this.count=0;}
 setMask(mask){this.count=0;if(!mask)return;for(let y=1;y<85;y++)for(let x=1;x<63;x++){const p=y*64+x;if(mask[p]>=200&&(!(x%2)&&!(y%2)||mask[p-1]<200||mask[p+1]<200||mask[p-64]<200||mask[p+64]<200))this.indices[this.count++]=p;}}
 align(current,reference,offset=0){
  if(this.count<18)return null;
  const score=(dx,dy)=>{let sum=0;for(let n=0;n<this.count;n++){const p=this.indices[n],x=p%64+dx,y=Math.floor(p/64)+dy;sum+=x<0||x>=64||y<0||y>=86?90:Math.min(90,difference(current,(y*64+x)*4,reference,p*4,offset));}return sum/this.count;};
  const baseline=score(0,0);let best=baseline,dx=0,dy=0;
  if(baseline>1.5)for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){const cost=score(x,y)+.08*(x*x+y*y);if(cost<best){best=cost;dx=x;dy=y;}}
  const error=score(dx,dy);let matched=0;for(let n=0;n<this.count;n++){const p=this.indices[n],x=p%64+dx,y=Math.floor(p/64)+dy;if(x>=0&&x<64&&y>=0&&y<86&&difference(current,(y*64+x)*4,reference,p*4,offset)<32)matched++;}
  const agreement=matched/this.count,accepted=error<24&&baseline-error>2&&error<baseline*.8&&agreement>=.72;
  const stable=baseline<18&&agreement>=.72;
  return {dx:accepted?dx:0,dy:accepted?dy:0,accepted,stable,personSupported:accepted||stable,baseline,error,agreement,samples:this.count,maxCells:3,source:'foreground'};
 }
}
// Larger texture changes need both a matching foreground color and stable
// surrounding person samples. Background/contour pixels cannot authorize repair.
export function repairSupportedInterior(current,reference,gate,mask,alignment,offset=0,age=0){
 if(!alignment?.personSupported||age<0||age>450)return 0;const {dx,dy}=alignment;let repaired=0;
 for(let y=2;y<84;y++)for(let x=2;x<62;x++){
  const p=y*64+x;if(gate[p])continue;const sx=x-dx,sy=y-dy;if(sx<2||sx>61||sy<2||sy>83)continue;
  let inside=true;for(let oy=-1;oy<=1&&inside;oy++)for(let ox=-1;ox<=1;ox++)if(mask[(sy+oy)*64+sx+ox]<200){inside=false;break;}if(!inside)continue;
  let sameColor=false;for(let oy=-2;oy<=2&&!sameColor;oy++)for(let ox=-2;ox<=2;ox++){const q=(sy+oy)*64+sx+ox;if(mask[q]>=200&&difference(current,p*4,reference,q*4,offset)<24){sameColor=true;break;}}if(!sameColor)continue;
  let support=0,matched=0;for(let oy=-3;oy<=3;oy+=3)for(let ox=-3;ox<=3;ox+=3){const cx=x+ox,cy=y+oy,rx=sx+ox,ry=sy+oy;if(cx<0||cx>=64||cy<0||cy>=86||rx<0||rx>=64||ry<0||ry>=86)continue;const q=ry*64+rx;if(mask[q]<200)continue;support++;if(difference(current,(cy*64+cx)*4,reference,q*4,offset)<32)matched++;}
  if(support>=6&&matched*4>=support*3){gate[p]=255;repaired++;}
 }return repaired;
}
