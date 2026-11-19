// Tiny animated eye meshes can have stale bounds after skeletal motion.
// Keep normal depth testing and the original geometry/materials; draw only these small meshes without frustum rejection.
export function preserveAnimatedEyes(model){
 const names=new Set(['Globo_Amarelo','Iris_Vermelha','Pupila_Preta']),rows=[];
 model.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];if(!materials.some(m=>names.has(m.name)))return;o.frustumCulled=false;rows.push({mesh:o.name,materials:materials.map(m=>m.name),frustumCulled:o.frustumCulled,depthTest:materials.every(m=>m.depthTest)});});
 return {rows,geometryModified:false,animationsModified:false,depthTestPreserved:rows.every(r=>r.depthTest)};
}
