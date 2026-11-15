export function paintRedEyes(ctx,eyes,strength){
 if(strength<=0)return 0;let applied=0;const w=ctx.canvas.width,h=ctx.canvas.height;
 for(const eye of eyes??[]){
  if(eye.iris.length!==4||eye.contour.length<6)continue;
  const x=eye.iris.reduce((a,p)=>a+p.x,0)/4*w,y=eye.iris.reduce((a,p)=>a+p.y,0)/4*h;
  const radius=Math.max(...eye.iris.map(p=>Math.hypot(p.x*w-x,p.y*h-y)));
  if(radius<1||!Number.isFinite(radius))continue;
  ctx.save();ctx.beginPath();eye.contour.forEach((p,i)=>i?ctx.lineTo(p.x*w,p.y*h):ctx.moveTo(p.x*w,p.y*h));ctx.closePath();ctx.clip();ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(1,strength)*.85;
  const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,'rgba(210,6,14,0)');g.addColorStop(.25,'rgba(210,6,14,0)');g.addColorStop(.42,'rgba(210,6,14,.85)');g.addColorStop(.8,'rgba(235,8,18,.85)');g.addColorStop(1,'rgba(120,0,8,.2)');ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);ctx.restore();applied++;
 }
 return applied;
}
