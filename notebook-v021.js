import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export class NotebookVisual {
 constructor(scene){this.scene=scene;this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);this.promise=null;this.loaded=false;this.error=null;this.materials=[];this.audit={};}
 load(){if(this.promise)return this.promise;this.promise=(async()=>{
  const gltf=await new GLTFLoader().loadAsync('./death-note-v021.glb'),model=gltf.scene;model.rotation.x=Math.PI/2;this.group.add(model);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());model.position.sub(center);
  let triangles=0,meshes=0;const textures=new Set();model.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material]){this.materials.push({material:m,transparent:m.transparent,depthWrite:m.depthWrite});if(m.map)textures.add(m.map.uuid)}});
  this.audit={meshes,triangles,textures:textures.size,dimensions:size.toArray(),originalAsset:true};this.loaded=true;return this;
 })().catch(e=>{this.error=e.message;this.group.visible=false;throw e});return this.promise;}
 update({visible,opacity=1,x,y,z,scale,side=1,now=0,inspection=false}){
  if(!visible||opacity<=.003){this.group.visible=false;return;}
  if(!this.loaded){if(!this.promise)this.load().catch(()=>{});return;}
  this.group.position.set(x,y,z);this.group.scale.setScalar(scale);this.group.rotation.set(0,(inspection?.25:-side*.2)+.035*Math.sin(now*.0006),-.06);this.group.visible=true;
  for(const {material,transparent,depthWrite} of this.materials){material.opacity=opacity;material.transparent=transparent||opacity<.999;material.depthWrite=opacity<.999?false:depthWrite;}
 }
 reset(){this.group.visible=false;}
 snapshot(){return {...this.audit,loaded:this.loaded,visible:this.group.visible,opacity:this.materials[0]?.material.opacity??0,error:this.error,virtual:true,physicalRecognition:false}}
}
