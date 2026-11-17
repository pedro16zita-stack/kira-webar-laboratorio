import * as THREE from 'three';
import {ShadowState} from './contact-shadow-state-v017.js';
export class ContactShadow {
 constructor(scene){
  this.state=new ShadowState();
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(0,0,0,.9)');g.addColorStop(.35,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  this.sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,opacity:0,toneMapped:false}));
  this.sprite.visible=false;scene.add(this.sprite);
 }
 update(input){const s=this.state.update(input);this.sprite.visible=s.visible;if(s.position)this.sprite.position.set(s.position.x,s.position.y,-.02);this.sprite.scale.set(s.width,s.height,1);this.sprite.material.opacity=s.opacity??0;}
 reset(){this.state.reset();this.sprite.visible=false;this.sprite.material.opacity=0}
 snapshot(){return this.state.snapshot()}
}
