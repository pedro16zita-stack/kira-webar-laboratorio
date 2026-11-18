let pose,segmenter,bodySnapshot,lastTime=0;
self.onmessage=async({data:d})=>{
 const start=performance.now();let transferred=false;
 try{
  if(d.type==='dispose'){pose?.close();segmenter?.close();self.postMessage({type:'disposed'});return;}
  if(d.type==='init'){
   const {FilesetResolver,PoseLandmarker,ImageSegmenter}=await import('./vision_bundle.mjs');
   ({bodySnapshot}=await import('./body-tracking-v023.js'));
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   pose=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./pose_landmarker_lite.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5,outputSegmentationMasks:false});
   segmenter=await ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./selfie_segmenter.tflite',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false});
   self.postMessage({type:'ready'});return;
  }
  lastTime=Math.max(lastTime+1,d.timestamp);const r=pose.detectForVideo(d.bitmap,lastTime),body=bodySnapshot(r.landmarks[0]);
  let alpha,width,height,mean=0;
  segmenter.segmentForVideo(d.bitmap,lastTime,r=>{const m=r.confidenceMasks.at(-1),v=m.getAsFloat32Array();width=m.width;height=m.height;alpha=new Uint8ClampedArray(v.length);for(let i=0;i<v.length;i++){mean+=v[i];const t=Math.max(0,Math.min(1,(v[i]-.2)/.6));alpha[i]=Math.round(t*t*(3-2*t)*255)}mean/=v.length;});
  if(mean<.003)body.present=false;
  self.postMessage({type:'result',id:d.id,bitmap:d.bitmap,body,alpha,width,height,mean,ms:performance.now()-start},[d.bitmap,alpha.buffer]);transferred=true;
 }catch(e){self.postMessage({type:'error',id:d.id,message:e.message})}
 finally{if(!transferred)d.bitmap?.close()}
};
