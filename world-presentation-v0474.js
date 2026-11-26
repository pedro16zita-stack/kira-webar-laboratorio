import * as THREE from 'three';
export function makePlacementArrow(){
 const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(-.16,.2);shape.lineTo(-.065,.2);shape.lineTo(-.065,.4);shape.lineTo(.065,.4);shape.lineTo(.065,.2);shape.lineTo(.16,.2);shape.closePath();
 const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
 const arrow=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xe9c1cc,side:THREE.DoubleSide,depthTest:false}));arrow.name='KIRA_PLACEMENT_ARROW';arrow.visible=false;arrow.renderOrder=10;return arrow;
}
export function renderBudget(width,height,dpr=1){
 const ratio=Math.min(dpr,1,Math.sqrt(900000/(width*height)),1280/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio)),ratio};
}
// A uniform crop of the already composited camera+3D canvas, never a different 3D FOV.
export function setNaturalFraming(canvas,natural=true){canvas.style.setProperty('width','100%','important');canvas.style.setProperty('height','100%','important');canvas.style.transform=natural?'scale(1.15)':'none';canvas.style.transformOrigin='center center';}
