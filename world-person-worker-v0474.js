let segmenter,lastTime=0;
self.onmessage=async({data:d})=>{let result,transferred=false;const start=performance.now();try{
 if(d.type==='dispose'){segmenter?.close();self.postMessage({type:'disposed'});return;}
 if(d.type==='init'){const {FilesetResolver,ImageSegmenter}=await import('./vision_bundle.mjs');const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');segmenter=await ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./selfie_segmenter.tflite',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false});self.postMessage({type:'ready'});return;}
 lastTime=Math.max(lastTime+1,d.timestamp);let alpha,width,height,mean=0,cx=0,cy=0,weight=0;
 segmenter.segmentForVideo(d.bitmap,lastTime,r=>{const m=r.confidenceMasks.at(-1),v=m.getAsFloat32Array();width=m.width;height=m.height;alpha=new Uint8ClampedArray(v.length);for(let i=0;i<v.length;i++){mean+=v[i];const t=Math.max(0,Math.min(1,(v[i]-.2)/.6));alpha[i]=Math.round(t*t*(3-2*t)*255);if(alpha[i]>=200){weight++;cx+=i%width;cy+=Math.floor(i/width);}}mean/=v.length;});
 const body={present:mean>=.003,center:weight?{x:cx/weight/width,y:cy/weight/height}:null,points:[]};self.postMessage({type:'result',id:d.id,bitmap:d.bitmap,alpha,width,height,mean,body,ms:performance.now()-start},[d.bitmap,alpha.buffer]);transferred=true;
 }catch(e){self.postMessage({type:'error',id:d.id,message:e.message});}finally{result?.close();if(!transferred)d.bitmap?.close();}};
