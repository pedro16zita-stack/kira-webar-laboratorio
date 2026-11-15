let segmenter,lastTime=0;
self.onmessage=async({data:d})=>{
 const start=performance.now();let transferred=false;
 try{
  if(d.type==='init'){
   const {FilesetResolver,ImageSegmenter}=await import('./vision_bundle.mjs');
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   segmenter=await ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./selfie_segmenter.tflite',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',outputCategoryMask:false,outputConfidenceMasks:true});
   self.postMessage({type:'ready'});return;
  }
  lastTime=Math.max(d.timestamp,lastTime+1);
  let alpha,width,height,mean=0;
  segmenter.segmentForVideo(d.bitmap,lastTime,r=>{
   const mask=r.confidenceMasks.at(-1),v=mask.getAsFloat32Array();width=mask.width;height=mask.height;alpha=new Uint8ClampedArray(v.length);
   for(let i=0;i<v.length;i++){mean+=v[i];const t=Math.max(0,Math.min(1,(v[i]-.2)/.6));alpha[i]=Math.round(t*t*(3-2*t)*255)}mean/=v.length;
  });
  self.postMessage({type:'result',id:d.id,bitmap:d.bitmap,alpha,width,height,mean,ms:performance.now()-start},[d.bitmap,alpha.buffer]);transferred=true;
 }catch(e){self.postMessage({type:'error',id:d.id,message:e.message})}
 finally{if(!transferred)d.bitmap?.close()}
};
