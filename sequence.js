const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export function sceneSequence(elapsed){
 const eyes=smooth((elapsed-10)/1.2);
 if(elapsed<10)return {stage:'suspensao',eyes,x:0,lift:0,walk:0,yaw:0};
 if(elapsed<15){const t=elapsed-10,envelope=smooth(t/.5)*smooth((5-t)/.5);return {stage:'caminhada',eyes,x:.15*Math.sin(t*Math.PI*2/5),lift:0,walk:envelope,yaw:Math.cos(t*Math.PI*2/5)*.9*envelope};}
 if(elapsed<17)return {stage:'encarar',eyes,x:0,lift:0,walk:0,yaw:0};
 const t=elapsed-17,a=smooth(t/2);return {stage:'flutuacao',eyes,x:.09*Math.sin(t*.8)*a,lift:(.045+.012*Math.sin(t*1.4))*a,walk:0,yaw:0};
}
