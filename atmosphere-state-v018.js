export class AtmosphereState {
 constructor(){this.preset='original';this.reset()}
 reset(){this.pulse=0}
 setPreset(preset){this.preset=['original','kira','cinema'].includes(preset)?preset:'original';this.reset()}
 update({now,dt,mode,startedAt,visible}){
  const duration=mode==='entry'?2400:2600,u=startedAt===null?1:Math.max(0,Math.min(1,(now-startedAt)/duration));
  const target=this.preset==='cinema'&&visible&&['entry','exit'].includes(mode)?Math.sin(Math.PI*u):0;
  if(!visible||this.preset!=='cinema')this.pulse=0;
  else this.pulse+=(target-this.pulse)*(1-Math.exp(-Math.max(0,Math.min(.1,dt))*8));
  return this.snapshot();
 }
 snapshot(){const cinema=this.preset==='cinema';return {preset:this.preset,pulse:this.pulse,exposure:this.preset==='original'?1:cinema?1.08+.07*this.pulse:1.15,edgeAlpha:cinema?.19+.10*this.pulse:0,rimMultiplier:cinema?1.15+.28*this.pulse:1,realLightEstimation:false}}
}
