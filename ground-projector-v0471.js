import * as THREE from 'three';
// Ray selection of the SDK's y=0 ground estimate, not a measured physical plane.
// Requires accepted live SLAM tracking at the caller. No screen-space billboard.
export class GroundProjector {
 constructor(){this.ray=new THREE.Raycaster();this.point=new THREE.Vector3();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.ndc=new THREE.Vector2(0,-.4);this.last={valid:false,reason:'not-projected'};}
 project(camera){
  this.ray.setFromCamera(this.ndc,camera);const {origin,direction}=this.ray.ray;
  const fail=reason=>{this.last={valid:false,reason};return null;};
  if(![...origin.toArray(),...direction.toArray()].every(Number.isFinite))return fail('invalid-pose');
  if(origin.y<.25)return fail('camera-height-unavailable');
  if(direction.y>-.12)return fail('aim-down');
  const point=this.ray.ray.intersectPlane(this.plane,this.point);if(!point)return fail('no-ground-intersection');
  const distance=origin.distanceTo(point);if(distance<.4||distance>8)return fail('outside-placement-range');
  this.last={valid:true,reason:'ground-estimate',distance,planeY:0,physicalFloorMeasured:false};
  return {type:'SLAM_GROUND_ESTIMATE',position:{x:point.x,y:0,z:point.z},rotation:{x:0,y:0,z:0,w:1},distance};
 }
 snapshot(){return {...this.last};}
}
