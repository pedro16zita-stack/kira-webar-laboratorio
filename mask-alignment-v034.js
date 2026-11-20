export function illuminationOffset(current,reference,hist){
 hist.fill(0);for(let i=0;i<current.length;i+=4){const d=Math.round(((current[i]-reference[i])+(current[i+1]-reference[i+1])+(current[i+2]-reference[i+2]))/3);hist[d+255]++;}let n=0;for(let i=0;i<511;i++){n+=hist[i];if(n>=current.length/8)return Math.max(-48,Math.min(48,i-255));}return 0;
}
// Bounded image translation, not a 3D depth estimate. Sparse 64x86 samples.
export function alignMask(current,reference,offset,width=64,height=86){
 const score=(dx,dy)=>{let sum=0,count=0;for(let y=4;y<height-4;y+=3)for(let x=4;x<width-4;x+=3){const i=(y*width+x)*4,j=((y+dy)*width+x+dx)*4;sum+=Math.min(90,(Math.abs(current[j]-reference[i]-offset)+Math.abs(current[j+1]-reference[i+1]-offset)+Math.abs(current[j+2]-reference[i+2]-offset))/3);count++;}return sum/count;};
 const baseline=score(0,0);let best=baseline,dx=0,dy=0;
 if(baseline>1.5)for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){const value=score(x,y)+.015*(x*x+y*y);if(value<best){best=value;dx=x;dy=y;}}
 const accepted=best<32&&baseline-best>1.5&&best<baseline*.9;return {dx:accepted?dx:0,dy:accepted?dy:0,accepted,baseline,error:best,maxCells:3};
}
