export const eyeDepthSettings={Iris_Vermelha:-2,Pupila_Preta:-4};
export function stabilizeEyes(model){
 const rows=[];model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!(m.name in eyeDepthSettings))continue;m.polygonOffset=true;m.polygonOffsetFactor=0;m.polygonOffsetUnits=eyeDepthSettings[m.name];m.depthTest=true;m.depthWrite=true;m.needsUpdate=true;if(!rows.some(x=>x.material===m.name))rows.push({material:m.name,units:m.polygonOffsetUnits,textured:!!m.map,imageSize:m.map?[m.map.image?.width??0,m.map.image?.height??0]:null});}});
 return {rows,geometryModified:false,animationsModified:false,depthTestPreserved:true};
}
