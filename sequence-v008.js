export const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export function sceneSequence(elapsed){
 if(elapsed<10)return {stage:'suspensao',path:0,floatX:0,floatY:0,turn:0,headingBlend:0};
 if(elapsed<15){const t=elapsed-10,u=t/5;return {stage:'caminhada',path:Math.sin(Math.PI*u)**2,floatX:0,floatY:0,turn:smooth((t-2)/1),headingBlend:smooth(t/.75)*smooth((5-t)/.75)};}
 if(elapsed<17)return {stage:'encarar',path:0,floatX:0,floatY:0,turn:1,headingBlend:0};
 const t=elapsed-17,a=smooth(t/2);return {stage:'flutuacao',path:0,floatX:.10*Math.sin(t*.7)*a,floatY:.035*(1-Math.cos(t*.8))*a,turn:1,headingBlend:0};
}
export function composition(body,refs,scale,viewWidth,direction,gapFactor){
 const actorX=(body.center.x-.5)*viewWidth;
 const halfActor=body.shoulderWidth*viewWidth/2,halfRyuk=refs.shoulderWidth*scale/2;
 const gap=refs.shoulderWidth*scale*gapFactor;
 const margin=Math.min(viewWidth*.28,refs.headWidth*scale*.55)+viewWidth*.035;
 const limit=Math.max(viewWidth*.12,viewWidth/2-margin);
 const desired=actorX+direction*(halfActor+halfRyuk+gap),x=Math.max(-limit,Math.min(limit,desired));
 const room=Math.max(0,(limit-direction*x)/scale);
 return {x,walkRange:Math.min(.65,room),floatRange:Math.min(.10,room),gapModelUnits:refs.shoulderWidth*gapFactor,limited:Math.abs(x-desired)>.001};
}
