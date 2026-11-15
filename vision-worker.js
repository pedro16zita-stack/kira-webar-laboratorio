let faceSnapshot;
let FilesetResolver,FaceLandmarker,GestureRecognizer;
let face,gesture,lastFace=0,lastGesture=0;
self.onmessage=async({data:d})=>{
 const start=performance.now();
 try{
  if(d.type==='init'){
   ({FilesetResolver,FaceLandmarker,GestureRecognizer}=await import('./vision_bundle.mjs'));({faceSnapshot}=await import('./face-data.js?v=0.5'));
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   face=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./face_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numFaces:1});
   gesture=await GestureRecognizer.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./gesture_recognizer.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.35,minHandPresenceConfidence:.35,minTrackingConfidence:.35});
   self.postMessage({type:'ready'});return;
  }
  let result;
  if(d.kind==='face'){
   lastFace=Math.max(d.timestamp,lastFace+1);const r=face.detectForVideo(d.bitmap,lastFace),nose=r.faceLandmarks[0]?.[1];
   result=faceSnapshot(r.faceLandmarks[0]);
  }else{
   lastGesture=Math.max(d.timestamp,lastGesture+1);const r=gesture.recognizeForVideo(d.bitmap,lastGesture),all=r.gestures.map((g,i)=>({g:g[0],i})).filter(x=>x.g); all.sort((a,b)=>(b.g.categoryName==='Closed_Fist'&&b.g.score>=.75?2:0)+b.g.score-((a.g.categoryName==='Closed_Fist'&&a.g.score>=.75?2:0)+a.g.score)); const best=all[0],p=best?.g;
   result={handSeen:r.landmarks.length>0,gesture:p?{name:p.categoryName,score:p.score}:null,points:(r.landmarks[best?.i??0]??[]).map(p=>({x:p.x,y:p.y}))};
  }
  self.postMessage({type:'result',id:d.id,kind:d.kind,...result,ms:performance.now()-start});
 }catch(e){self.postMessage({type:'error',id:d.id,message:e.message});}
 finally{d.bitmap?.close();}
};
