let FilesetResolver,FaceLandmarker,GestureRecognizer;
let face,gesture,lastFace=0,lastGesture=0;
self.onmessage=async({data:d})=>{
 const start=performance.now();
 try{
  if(d.type==='init'){
   ({FilesetResolver,FaceLandmarker,GestureRecognizer}=await import('./vision_bundle.mjs'));
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   face=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./face_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numFaces:1});
   gesture=await GestureRecognizer.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./gesture_recognizer.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1});
   self.postMessage({type:'ready'});return;
  }
  let result;
  if(d.kind==='face'){
   lastFace=Math.max(d.timestamp,lastFace+1);const r=face.detectForVideo(d.bitmap,lastFace),nose=r.faceLandmarks[0]?.[1];
   result={faceSeen:!!nose,nose:nose?{x:nose.x,y:nose.y}:null};
  }else{
   lastGesture=Math.max(d.timestamp,lastGesture+1);const r=gesture.recognizeForVideo(d.bitmap,lastGesture),p=r.gestures[0]?.[0];
   result={handSeen:r.landmarks.length>0,gesture:p?{name:p.categoryName,score:p.score}:null};
  }
  self.postMessage({type:'result',id:d.id,kind:d.kind,...result,ms:performance.now()-start});
 }catch(e){self.postMessage({type:'error',id:d.id,message:e.message});}
 finally{d.bitmap?.close();}
};
