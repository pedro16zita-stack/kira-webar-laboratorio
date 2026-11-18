export function applyMaterialFade(material,alpha,original){
 const opacity=Number.isFinite(alpha)?Math.max(0,Math.min(1,alpha)):0;
 const transparent=opacity<.999||original.transparent;
 if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
 material.opacity=opacity;material.alphaTest=(original.alphaTest??0)*Math.max(opacity,.001);
 material.depthWrite=opacity<.999?false:original.depthWrite;
}
