// Isolate the shared Pants material on the actual lower-body mesh. Book/chain
// materials, texture bytes, geometry, skin weights and animation clips stay intact.
export function refineGarment(model,renderer){
 const report={meshes:0,geometryChanged:false,texturesChanged:false,clipsChanged:false,sharedAccessoriesPreserved:true,alphaCutoff:.5,alphaToCoverage:false,panelColor:'neutral-charcoal'};
 model.traverse(mesh=>{
  if(!mesh.isMesh||mesh.name!=='Pants'||mesh.material?.name!=='Pants'||mesh.material.userData.kiraGarmentRefined)return;
  const original=mesh.material,material=original.clone();material.userData={...original.userData,kiraGarmentRefined:true};
  material.alphaToCoverage=!!renderer.getContext().getContextAttributes()?.antialias;
  material.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    #ifdef USE_MAP
     // Ragged cloth islands in the original atlas; belt, legs and accessories
     // use other regions. Keep diffuse alpha and the original cutout untouched.
     vec2 garmentUv=fract(vMapUv);if(garmentUv.x>.55&&garmentUv.x<.93&&garmentUv.y>.31&&garmentUv.y<.99){float gray=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(gray)*vec3(.94,.97,1.0),.92);}
    #endif`);
  };
  material.customProgramCacheKey=()=> 'kira-garment-038';mesh.material=material;report.meshes++;report.alphaToCoverage=material.alphaToCoverage;
 });return report;
}

