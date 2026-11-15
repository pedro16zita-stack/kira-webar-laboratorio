const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export function sceneSequence(elapsed){
 if(elapsed<10)return {stage:'suspensao',x:0,lift:0,walk:0,yaw:0};
 if(elapsed<15){const t=elapsed-10,e=smooth(t/.5)*smooth((5-t)/.5);return {stage:'caminhada',x:.10*Math.sin(t*Math.PI*2/5)*e,lift:0,walk:e,yaw:Math.cos(t*Math.PI*2/5)*.7*e};}
 if(elapsed<17)return {stage:'encarar',x:0,lift:0,walk:0,yaw:0};
 const t=elapsed-17,a=smooth(t/2);return {stage:'flutuacao',x:.065*Math.sin(t*.8)*a,lift:(.04+.01*Math.sin(t*1.4))*a,walk:0,yaw:0};
}
