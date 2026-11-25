// Conditional temporal support only inside a shrunken, high-confidence torso.
// No contour dilation, no background fill, no stale history and no ML threshold change.
export function stabilizeTorso(current,previous,out,width,height,body,history,captureAt,strongAt=null){
 out.set(current);const pts=body?.points,center=body?.center;
 if(!body?.present||!center||!history?.center||history.mode!=='refined'||history.width!==width||history.height!==height||previous?.length!==current.length)return 0;
 const age=captureAt-history.captureAt,mx=center.x-history.center.x,my=center.y-history.center.y;
 if(!(age>0&&age<=450)||Math.abs(mx)>.1||Math.abs(my)>.1)return 0;
 const vertices=[11,12,24,23].map(i=>pts?.[i]);if(vertices.some(p=>!p||p.visibility<.75||(p.presence??1)<.8||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))return 0;
 const cx=vertices.reduce((n,p)=>n+p.x,0)/4,cy=vertices.reduce((n,p)=>n+p.y,0)/4,poly=vertices.map(p=>({x:(cx+(p.x-cx)*.65)*width,y:(cy+(p.y-cy)*.65)*height}));
 let area=0;for(let i=0;i<4;i++)area+=poly[i].x*poly[(i+1)%4].y-poly[(i+1)%4].x*poly[i].y;if(Math.abs(area)<width*height*.004)return 0;
 const dx=Math.round(mx*width),dy=Math.round(my*height),x0=Math.max(0,Math.floor(Math.min(...poly.map(p=>p.x)))),x1=Math.min(width,Math.ceil(Math.max(...poly.map(p=>p.x)))),y0=Math.max(0,Math.floor(Math.min(...poly.map(p=>p.y)))),y1=Math.min(height,Math.ceil(Math.max(...poly.map(p=>p.y))));let held=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const i=y*width+x;if(current[i]<96||current[i]>=160)continue;const px=x-dx,py=y-dy;if(px<0||px>=width||py<0||py>=height||previous[py*width+px]<200)continue;const stamp=strongAt?.[py*width+px];if(strongAt&&(!(stamp>0)||captureAt-stamp>450||captureAt<stamp))continue;let positive=false,negative=false;for(let k=0;k<4;k++){const a=poly[k],b=poly[(k+1)%4],cross=(b.x-a.x)*(y+.5-a.y)-(b.y-a.y)*(x+.5-a.x);positive||=cross>0;negative||=cross<0;}if(positive&&negative)continue;out[i]=255;held++;
 }return held;
}
export function advanceTorsoTrust(raw,from,to,width,height,body,history,at){
 const a=body?.center,b=history?.center,valid=a&&b&&history.width===width&&history.height===height&&Math.abs(a.x-b.x)<=.1&&Math.abs(a.y-b.y)<=.1,dx=valid?Math.round((a.x-b.x)*width):0,dy=valid?Math.round((a.y-b.y)*height):0;
 for(let y=0,i=0;y<height;y++)for(let x=0;x<width;x++,i++){const sx=x-dx,sy=y-dy;to[i]=raw[i]>=200?at:valid&&sx>=0&&sx<width&&sy>=0&&sy<height?from[sy*width+sx]:0;}
}
