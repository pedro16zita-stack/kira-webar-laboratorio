let lightNormalizer;
let recognizer,handShape,resolveGesture;
self.onmessage=async({data:d})=>{
 const start=performance.now();try{
  if(d.type==='dispose'){recognizer?.close();self.postMessage({type:'disposed'});return;}
  if(d.type==='init'){
   const {HandLight}=await import('./hand-light-v035.js');lightNormalizer=new HandLight();
   ({handShape,resolveGesture}=await import('./hand-evidence-v0341.js'));
   const {FilesetResolver,GestureRecognizer}=await import('./vision_bundle.mjs');const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   // Each search/crop is a different coordinate system: do not reuse VIDEO ROIs.
   recognizer=await GestureRecognizer.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./gesture_recognizer.task',self.location.href).href,delegate:'CPU'},runningMode:'IMAGE',numHands:2,minHandDetectionConfidence:.35,minHandPresenceConfidence:.35,minTrackingConfidence:.35});self.postMessage({type:'ready'});return;
  }
  const prepared=lightNormalizer.prepare(d.bitmap);const r=recognizer.recognize(prepared.source),hands=r.landmarks.map((points,i)=>{const world=r.worldLandmarks?.[i],shape=handShape(world??points.map(p=>({...p,x:p.x*d.bitmap.width/d.bitmap.height,z:p.z*d.bitmap.width/d.bitmap.height}))),rawGesture=r.gestures[i]?.[0]??null;return {points:points.map(p=>({x:p.x,y:p.y,z:p.z})),shape,rawGesture:rawGesture?{name:rawGesture.categoryName,score:rawGesture.score}:null,gesture:resolveGesture(rawGesture,shape)};});
  hands.sort((a,b)=>((b.gesture?.name==='Closed_Fist'?2:0)+(b.gesture?.score??0))-((a.gesture?.name==='Closed_Fist'?2:0)+(a.gesture?.score??0)));const best=hands[0];
  self.postMessage({type:'result',id:d.id,handSeen:hands.length>0,gesture:best?.gesture??null,points:best?.points??[],shape:best?.shape??null,rawGesture:best?.rawGesture??null,hands,mode:'independent-image-crops',lighting:prepared.light,ms:performance.now()-start});
 }catch(e){self.postMessage({type:'error',id:d.id,message:e.message});}finally{d.bitmap?.close();}
};
