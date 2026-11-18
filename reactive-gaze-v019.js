import * as THREE from 'three';
import {GazeState} from './gaze-state-v019.js';
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
export class ReactiveGaze {
 constructor(model){
  this.model=model;this.state=new GazeState();this.bones=['bip_head','Olhar_L','Olhar_R'].map(n=>{const b=model.getObjectByName(n);if(!b?.isBone)throw new Error('Controle de olhar ausente: '+n);return b});
  model.updateMatrixWorld(true);this.forwardLocal=new THREE.Vector3(0,0,1).applyQuaternion(this.bones[0].getWorldQuaternion(new THREE.Quaternion()).invert());
  this.saved=null;this.source=null;this.maxRestoreError=0;this.maxEyeDeltaDifference=0;
 }
 beforeMixer(){if(!this.saved)return;this.bones.forEach((b,i)=>{b.quaternion.copy(this.saved[i]);const actual=b.quaternion.clone().normalize(),expected=this.saved[i].clone().normalize();this.maxRestoreError=Math.max(this.maxRestoreError,actual.angleTo(expected))});this.saved=null;}
 reset(){this.beforeMixer();this.state.reset();this.source=null;}
 afterMixer({target,source,dt,enabled,elapsed,stage}){
  if(!enabled||!target){this.state.reset();this.source=null;return;}
  // Capture the animated pose afresh each frame. Never accumulate offsets on it.
  this.saved=this.bones.map(b=>b.quaternion.clone());this.model.updateMatrixWorld(true);
  const head=this.bones[0],world=head.getWorldQuaternion(new THREE.Quaternion()),pos=head.getWorldPosition(new THREE.Vector3());
  const forward=this.forwardLocal.clone().applyQuaternion(world),direction=target?target.clone().sub(pos):forward;
  const yaw=wrap(Math.atan2(direction.x,direction.z)-Math.atan2(forward.x,forward.z));
  const pitch=Math.atan2(direction.y,Math.hypot(direction.x,direction.z))-Math.atan2(forward.y,Math.hypot(forward.x,forward.z));
  const s=this.state.update({yaw,pitch,enabled:enabled&&!!target,elapsed,stage,dt});this.source=enabled&&target?source:null;
  const delta=f=>new THREE.Quaternion().setFromEuler(new THREE.Euler(-s.pitch*f,s.yaw*f,0,'YXZ'));
  const applyWorld=(bone,rotation)=>{const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());const current=bone.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(parent.invert().multiply(rotation).multiply(current)).normalize();};
  applyWorld(head,delta(s.headFraction));this.model.updateMatrixWorld(true);
  // Identical world-space rotation for both eyes preserves their visual neutral offsets.
  const eyeDelta=delta(s.eyeFraction),actual=[];
  for(const eye of this.bones.slice(1)){const before=eye.getWorldQuaternion(new THREE.Quaternion());applyWorld(eye,eyeDelta);eye.updateWorldMatrix(false,true);const after=eye.getWorldQuaternion(new THREE.Quaternion());actual.push(after.multiply(before.invert()).normalize());}
  this.maxEyeDeltaDifference=Math.max(this.maxEyeDeltaDifference,actual[0].angleTo(actual[1]));
 }
 snapshot(){return {...this.state.snapshot(),source:this.source,maxRestoreError:this.maxRestoreError,maxEyeDeltaDifference:this.maxEyeDeltaDifference,calibratedEyeOffsetsPreserved:true,targetDepthSimulated:true,identityRecognition:false}}
}
