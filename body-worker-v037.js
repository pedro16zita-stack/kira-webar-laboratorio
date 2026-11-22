let pose,bodySnapshot,lastTime=0;
self.onmessage=async({data:d})=>{
 const start=performance.now();let transferred=false,result;
 try{
  if(d.type==='dispose'){pose?.close();self.postMessage({type:'disposed'});return;}
  if(d.type==='init'){
   const {FilesetResolver,PoseLandmarker}=await import('./vision_bundle.mjs');({bodySnapshot}=await import('./body-tracking-v023.js'));
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   pose=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./pose_landmarker_lite.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5,outputSegmentationMasks:true});
   self.postMessage({type:'ready'});return;
  }
  lastTime=Math.max(lastTime+1,d.timestamp);result=pose.detectForVideo(d.bitmap,lastTime);const body=bodySnapshot(result.landmarks[0]),mask=result.segmentationMasks?.[0];
  const width=mask?.width??256,height=mask?.height??256,alpha=new Uint8ClampedArray(width*height);let mean=0;
  if(mask){const values=mask.getAsFloat32Array();for(let i=0;i<values.length;i++){const value=values[i];mean+=value;const t=Math.max(0,Math.min(1,(value-.2)/.6));alpha[i]=Math.round(t*t*(3-2*t)*255);}mean/=values.length;}
  if(mean<.003)body.present=false;
  self.postMessage({type:'result',id:d.id,bitmap:d.bitmap,body,alpha,width,height,mean,ms:performance.now()-start,maskSource:'pose-integrated',bodyTaskCalls:1},[d.bitmap,alpha.buffer]);transferred=true;
 }catch(e){self.postMessage({type:'error',id:d.id,message:e.message});}
 finally{result?.close();if(!transferred)d.bitmap?.close();}
};
