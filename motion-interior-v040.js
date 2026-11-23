// Repairs texture motion strictly inside a confident silhouette, never its outline.
// Reuses the existing 64 x 86 probe and does not infer new body pixels.
const samples=[[.25,.25],[.75,.25],[.5,.5],[.25,.75],[.75,.75]];
export const createMotionScratch=()=>({seen:new Uint8Array(64*86),queue:new Uint16Array(64*86)});
export function maskConfidenceGrid(alpha,width,height,out=new Uint8Array(64*86)){
 for(let y=0;y<86;y++)for(let x=0;x<64;x++){
  let confident=true;for(const [fx,fy] of samples){const sx=Math.min(width-1,Math.floor((x+fx)*width/64)),sy=Math.min(height-1,Math.floor((y+fy)*height/86));if(alpha[sy*width+sx]<200){confident=false;break;}}
  out[y*64+x]=confident?255:0;
 }return out;
}
export function repairMotionInterior(current,reference,gate,mask,{dx=0,dy=0,exposure=0,age=0}={},scratch=createMotionScratch()){
 if(!mask||age<0||age>220)return 0;let repaired=0;const {seen,queue}=scratch;seen.fill(0);
 for(let y=2;y<84;y++)for(let x=2;x<62;x++){
  const i=y*64+x;if(gate[i]||seen[i])continue;let tail=1,inside=true;queue[0]=i;seen[i]=1;
  for(let head=0;head<tail;head++){
   const q=queue[head],qx=q%64,qy=Math.floor(q/64),sx=qx-dx,sy=qy-dy;
   if(sx<1||sx>62||sy<1||sy>84){inside=false;continue;}
   for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)if(mask[(sy+oy)*64+sx+ox]<200)inside=false;
   for(let direction=0;direction<4;direction++){const nx=qx+(direction===0?-1:direction===1?1:0),ny=qy+(direction===2?-1:direction===3?1:0);if(nx<1||nx>62||ny<1||ny>84)continue;const n=ny*64+nx,msx=nx-dx,msy=ny-dy;if(msx<0||msx>63||msy<0||msy>85||mask[msy*64+msx]<200)continue;if(!gate[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
  }
  // A larger rejected area can be real motion/background: never repaint it.
  if(!inside||tail>12)continue;
  for(let index=0;index<tail;index++){
   const q=queue[index],sx=q%64-dx,sy=Math.floor(q/64)-dy,a=q*4;let matched=false;
   for(let oy=-1;oy<=1&&!matched;oy++)for(let ox=-1;ox<=1;ox++){
    if(!ox&&!oy)continue;const b=((sy+oy)*64+sx+ox)*4;
    if((Math.abs(current[a]-reference[b]-exposure)+Math.abs(current[a+1]-reference[b+1]-exposure)+Math.abs(current[a+2]-reference[b+2]-exposure))/3<24){matched=true;break;}
   }
   if(matched){gate[q]=255;repaired++;}
  }
 }return repaired;
}
