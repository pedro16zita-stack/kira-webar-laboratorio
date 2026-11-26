import * as THREE from 'three';
// Normalize against the actual animated neutral pose, never the imported bind pose.
// The mount alone carries the offset, outside every animation binding.
export function prepareWorldModel(asset){
 const clip=asset.animations.find(x=>x.name==='03_Presenca_Suave');if(!clip)throw Error('Pose de referência ausente');
 const mixer=new THREE.AnimationMixer(asset.scene),action=mixer.clipAction(clip).reset().play();mixer.setTime(0);asset.scene.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(asset.scene,true),height=box.max.y-box.min.y;if(!(height>0&&Number.isFinite(height)))throw Error('Dimensões inválidas');
 const scale=2.4/height,mount=new THREE.Group();mount.name='KIRA_WORLD_MODEL_FOOTING';mount.scale.setScalar(scale);mount.position.y=-box.min.y*scale;mount.add(asset.scene);
 const proof={referenceClip:clip.name,referenceTime:0,originalBottom:box.min.y,originalHeight:height,normalizedHeight:2.4,soleY:0,physicalFloorMeasured:false};
 action.stop();mixer.uncacheRoot(asset.scene);mount.updateMatrixWorld(true);return {mount,scale,bottom:box.min.y,proof};
}
