let gesture,lastTime=0;
self.onmessage=async({data:d})=>{
 const start=performance.now();
 try{
  if(d.type==='dispose'){gesture?.close();self.postMessage({type:'disposed'});return;}
  if(d.type==='init'){
   const {FilesetResolver,GestureRecognizer}=await import('./vision_bundle.mjs');
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   gesture=await GestureRecognizer.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./gesture_recognizer.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.35,minHandPresenceConfidence:.35,minTrackingConfidence:.35});self.postMessage({type:'ready'});return;
  }
  lastTime=Math.max(lastTime+1,d.timestamp);const r=gesture.recognizeForVideo(d.bitmap,lastTime),all=r.gestures.map((g,i)=>({g:g[0],i})).filter(x=>x.g);
  all.sort((a,b)=>(b.g.categoryName==='Closed_Fist'&&b.g.score>=.5?2:0)+b.g.score-((a.g.categoryName==='Closed_Fist'&&a.g.score>=.5?2:0)+a.g.score));const best=all[0],p=best?.g;
  self.postMessage({type:'result',id:d.id,handSeen:r.landmarks.length>0,gesture:p?{name:p.categoryName,score:p.score}:null,points:(r.landmarks[best?.i??0]??[]).map(p=>({x:p.x,y:p.y})),ms:performance.now()-start});
 }catch(e){self.postMessage({type:'error',id:d.id,message:e.message})}
 finally{d.bitmap?.close()}
};
