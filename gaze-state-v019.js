const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class GazeState {
 constructor(){this.reset()}
 reset(){this.yaw=0;this.pitch=0;this.weight=0}
 update({yaw=0,pitch=0,enabled,elapsed,stage,dt}){
  if(!enabled){this.reset();return this.snapshot()}
  const wanted=elapsed<3||stage==='caminhada'?0:stage==='encarar'?1:stage==='flutuacao'?.8:.65;
  const blend=1-Math.exp(-clamp(dt,0,.1)/.35);
  this.weight+=(wanted-this.weight)*blend;
  this.yaw+=(clamp(yaw,-.32,.32)*this.weight-this.yaw)*blend;
  this.pitch+=(clamp(pitch,-.13,.13)*this.weight-this.pitch)*blend;
  return this.snapshot();
 }
 snapshot(){return {yaw:this.yaw,pitch:this.pitch,weight:this.weight,headFraction:.78,eyeFraction:.22,maxCombinedYaw:.32,maxCombinedPitch:.13}}
}
