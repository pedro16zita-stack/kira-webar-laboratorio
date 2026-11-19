import * as THREE from 'three';
import {applyMaterialFade} from './material-fade-v024.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BookReveal} from './book-reveal-v030.js';
export class NotebookVisual {
 constructor(scene,loadModel=()=>new GLTFLoader().loadAsync('./death-note-v021.glb')){this.scene=scene;this.loadModel=loadModel;this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);this.promise=null;this.loaded=false;this.error=null;this.materials=[];this.audit={};this.reveal=new BookReveal();this.attempts=0;this.disposed=false;}
 load({retry=false}={}){
  if(this.disposed)return Promise.reject(new Error('Caderno encerrado'));
  if(this.loaded||this.promise&&!this.error)return this.promise;
  if(this.error&&!retry)return this.promise;
  this.error=null;this.attempts++;this.promise=(async()=>{
   const gltf=await this.loadModel();if(this.disposed)return this;const model=gltf.scene;model.rotation.x=Math.PI/2;model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());model.position.sub(center);
   let triangles=0,meshes=0;const textures=new Set(),staged=[];model.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material]){staged.push({material:m,transparent:m.transparent,depthWrite:m.depthWrite,alphaTest:m.alphaTest});if(m.map)textures.add(m.map.uuid)}});
   if(!meshes||!size.toArray().every(Number.isFinite))throw new Error('Caderno sem geometria válida');
   this.group.add(model);this.materials=staged;this.audit={meshes,triangles,textures:textures.size,dimensions:size.toArray(),originalAsset:true};this.loaded=true;return this;
  })().catch(e=>{this.error=e.message;this.group.visible=false;this.reveal.reset();throw e;});return this.promise;
 }
 update({visible,opacity=1,x,y,z,scale,side=1,now=0,inspection=false}){
  if(visible&&!this.loaded&&!this.promise)this.load().catch(()=>{});
  const alpha=this.reveal.update({visible,ready:this.loaded,opacity,now,inspection});if(alpha<=.003){this.group.visible=false;return;}
  this.group.position.set(x,y,z);this.group.scale.setScalar(scale);this.group.rotation.set(0,(inspection?.25:-side*.2)+.035*Math.sin(now*.0006),-.06);this.group.visible=true;
  for(const {material,transparent,depthWrite,alphaTest} of this.materials)applyMaterialFade(material,alpha,{transparent,depthWrite,alphaTest});
 }
 reset(){this.group.visible=false;this.reveal.reset();}
 snapshot(){return {...this.audit,loaded:this.loaded,loading:!!this.promise&&!this.loaded&&!this.error,visible:this.group.visible,opacity:this.group.visible?(this.materials[0]?.material.opacity??0):0,error:this.error,attempts:this.attempts,reveal:this.reveal.snapshot(),virtual:true,physicalRecognition:false};}
 dispose(){this.disposed=true;this.reset();this.scene.remove(this.group);const geometries=new Set(),materials=new Set(),textures=new Set();this.group.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.group.clear();}
}
