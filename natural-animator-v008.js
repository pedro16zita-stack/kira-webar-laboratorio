import * as THREE from 'three';
import {smooth} from './sequence-v008.js?v=0.8';
export class NaturalAnimator {
 constructor(mixer,clips){
  const get=name=>{const clip=clips.find(c=>c.name===name);if(!clip)throw new Error('Animação ausente: '+name);return mixer.clipAction(clip)};
  this.entry=get('01_Manifestacao');this.entry.setLoop(THREE.LoopOnce,1);this.entry.clampWhenFinished=true;this.oldIdle=get('02_Suspensao');
  this.actions=['03_Presenca_Suave','04_Olhar_Esquerda','05_Olhar_Direita','06_Caminhada_Calma'].map(get);this.reset();
 }
 reset(){this.entry.stop();this.oldIdle.stop();this.weights=[1,0,0,0];for(const a of this.actions){a.stop().reset().setLoop(THREE.LoopRepeat,Infinity).play();a.setEffectiveWeight(0)}this.actions[3].paused=true;this.actions[0].setEffectiveWeight(1);this.entryWeight=0;}
 reveal(){this.reset();this.entry.reset().setEffectiveWeight(1).play();for(const a of this.actions)a.setEffectiveWeight(0);}
 update(elapsed,dt,sequence,side,distance,speed,active){
  let wanted=[1,0,0,0];const look=side>0?1:2;
  if(elapsed!==null){
   if(sequence.stage==='caminhada'){const w=smooth(Math.min(1,speed/.22));wanted=[1-w,0,0,w];}
   else if(sequence.stage==='encarar'){wanted=[0,0,0,0];wanted[look]=1;}
   else if(sequence.stage==='flutuacao'){wanted=[.3,0,0,0];wanted[look]=.7;}
  }
  if(active||elapsed===null){const a=1-Math.exp(-dt/0.22);for(let i=0;i<4;i++)this.weights[i]+=(wanted[i]-this.weights[i])*a;}
  this.entryWeight=elapsed===null?0:1-smooth((elapsed-(this.entry.getClip().duration-.35))/.7);
  this.entry.setEffectiveWeight(this.entryWeight);if(this.entryWeight===0)this.entry.stop();
  this.actions[3].time=(distance/.34*this.actions[3].getClip().duration)%this.actions[3].getClip().duration;
  for(let i=0;i<4;i++)this.actions[i].setEffectiveWeight(this.weights[i]*(1-this.entryWeight));
 }
 snapshot(){return {source:'Blender',entryWeight:this.entryWeight,clips:this.actions.map((a,i)=>({name:a.getClip().name,weight:this.weights[i]*(1-this.entryWeight),time:a.time})),walkDrivenByDistance:true};}
}
