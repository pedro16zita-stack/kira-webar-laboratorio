import {GestureGate} from './gesture-gate.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FilesetResolver, GestureRecognizer, FaceLandmarker, ImageSegmenter } from './vision_bundle.mjs';

const $=s=>document.querySelector(s), report={versions:{mindar:'1.2.5',three:THREE.REVISION,mediapipe:'0.10.21',lab:'0.3'},environment:{userAgent:navigator.userAgent,secureContext:window.isSecureContext},tests:{},errors:[]};
let model,mixer,scene,camera,renderer,gesture,face,segmenter,Controller,controller,liveStream,liveBusy=false,liveRunning=false;
let followTargetX=.35,currentClip='02_Suspensao',exitTrigger='manual';
let appearing=false,latched=false,smokeStart=null,smokePoints,modelStart=0,modelElapsed=0,entryAction,idleAction;
const status=t=>{$('#status').textContent=t}, output=()=>{$('#results').textContent=JSON.stringify(report,null,2)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const timed=async f=>{let t=performance.now();const value=await f();return {value,ms:performance.now()-t}};
const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
async function persist(){output();if(!['localhost','127.0.0.1'].includes(location.hostname))return;try{await fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)})}catch{}}
function restoreOpacity(){model.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.opacity=1;m.transparent=m.userData.kiraOriginalTransparent??m.transparent}})}
function reveal(){currentClip='01_Manifestacao';restoreOpacity();latched=true;model.visible=true;modelElapsed=0;entryAction?.reset().play();idleAction?.stop();appearing=true;}
function makeRenderer(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(720,460);$('#view').appendChild(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,720/460,.01,30);camera.position.set(0,1.2,4.8);scene.add(camera);
 scene.add(new THREE.HemisphereLight(0xffffff,0x5a5263,2));let light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,4,5);scene.add(light);
 const positions=new Float32Array(64*3);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const sprite=document.createElement('canvas');sprite.width=sprite.height=64;let ctx=sprite.getContext('2d'),gradient=ctx.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(70,65,85,.75)');gradient.addColorStop(.5,'rgba(35,30,45,.5)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 smokePoints=new THREE.Points(geometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(sprite),color:0x777080,size:.8,transparent:true,depthWrite:false,opacity:0}));smokePoints.visible=false;scene.add(smokePoints);
 let last=performance.now();renderer.setAnimationLoop(()=>{const now=performance.now();if(now-last<1000/30)return;const delta=Math.min((now-last)/1000,.1);last=now;mixer?.update(delta);if(appearing){modelElapsed+=delta;if(modelElapsed>entryAction.getClip().duration){entryAction.stop();idleAction.reset().play();currentClip='02_Suspensao';appearing=false}}
  if(liveRunning&&latched&&!exited)model.position.x+=(followTargetX-model.position.x)*(1-Math.exp(-delta*5));
  if(smokeStart!==null){const u=Math.min((now-smokeStart)/1800,1);smokePoints.visible=u<1;smokePoints.material.opacity=Math.sin(Math.PI*u)*.9;
   const p=smokePoints.geometry.attributes.position;for(let i=0;i<64;i++){const angle=i*2.39996+u*2,r=.35+.55*Math.sin(i*4.3+u*2)**2;p.setXYZ(i,Math.cos(angle)*r,(i/63)*2.5+u*.2,Math.sin(angle)*r)}p.needsUpdate=true;
   model.traverse(o=>{if(o.isMesh){for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.transparent=true;m.opacity=Math.max(0,1-u*1.5)}}});if(u===1){model.visible=false;smokeStart=null;report.tests.F={status:'Fumaça de teste concluída neste navegador',trigger:exitTrigger,particles:64,seconds:1.8,modelHidden:!model.visible,smokeHidden:!smokePoints.visible};persist();}}
  renderer.render(scene,camera);
 });
}
async function setupModels(){
 if(model)return;status('Carregando GLB e verificando animações…');makeRenderer();
 const gltf=await new GLTFLoader().loadAsync('./ryuk.glb');model=gltf.scene;scene.add(model);model.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.userData.kiraOriginalTransparent=m.transparent});mixer=new THREE.AnimationMixer(model);entryAction=mixer.clipAction(gltf.animations.find(a=>a.name==='01_Manifestacao'));entryAction.setLoop(THREE.LoopOnce,1);entryAction.clampWhenFinished=true;idleAction=mixer.clipAction(gltf.animations.find(a=>a.name==='02_Suspensao'));idleAction.play();
 report.tests.G={status:'APROVADO carregamento Three.js; inspeção visual necessária',animations:gltf.animations.map(a=>({name:a.name,duration:a.duration})),skinnedMeshes:0,renderedFrames:0};model.traverse(o=>{if(o.isSkinnedMesh)report.tests.G.skinnedMeshes++});$('#smoke').disabled=false;
 await sleep(600);report.tests.G.renderedFrames=renderer.info.render.frame;const head=model.getObjectByName('bip_head');if(head){const before=head.quaternion.clone();await sleep(500);report.tests.G.headMotionRadians=before.angleTo(head.quaternion);report.tests.G.idlePlaying=idleAction.isRunning()}
}
async function setupVision(){
 if(gesture)return;status('Carregando MediaPipe (três tarefas independentes)…');const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
 gesture=await GestureRecognizer.createFromOptions(vision,{baseOptions:{modelAssetPath:'./gesture_recognizer.task',delegate:'CPU'},runningMode:'IMAGE',numHands:1});
 face=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'./face_landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numFaces:1});
 segmenter=await ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:'./selfie_segmenter.tflite',delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:false,outputConfidenceMasks:true});
}
async function setupMindar(){if(Controller)return;({Controller}=await import('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js'))}
function segmentation(input,display=true){let stats;segmenter.segment(input,r=>{const mask=r.confidenceMasks.at(-1),v=mask.getAsFloat32Array();let sum=0,max=0;for(const x of v){sum+=x;max=Math.max(max,x)}stats={width:mask.width,height:mask.height,mean:sum/v.length,max};
 if(display){const c=document.createElement('canvas');c.width=mask.width;c.height=mask.height;const ctx=c.getContext('2d'),im=ctx.createImageData(c.width,c.height);for(let i=0;i<v.length;i++){const a=Math.round(v[i]*255);im.data.set([a,a,a,255],i*4)}ctx.putImageData(im,0,0);$('#samples').appendChild(c)}
 });return stats}
async function testA(){
 status('A: reconhecendo alvo digital e variações sintéticas…');await setupMindar();const target=await image('./alvo_provisorio.png'),c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');controller=new Controller({inputWidth:640,inputHeight:480,warmupTolerance:0,missTolerance:1});await controller.addImageTargets('./alvo_provisorio.mind');let rows=[];
 const targetHeight=400,targetWidth=targetHeight*target.naturalWidth/target.naturalHeight;
 for(const filter of ['none','brightness(0.45)','brightness(1.6)','blur(3px)']){ctx.filter='none';ctx.fillStyle='#888';ctx.fillRect(0,0,640,480);ctx.filter=filter;ctx.drawImage(target,(640-targetWidth)/2,40,targetWidth,targetHeight);ctx.filter='none';let t=performance.now();const {featurePoints}=await controller.detect(c),match=await controller.match(featurePoints,0);rows.push({variation:filter,matched:!!match.modelViewTransform,features:featurePoints.length,ms:performance.now()-t});}
 report.tests.A={status:'Somente alvo digital; impressão e capa NÃO TESTADAS',results:rows};
 // A real controller loss event is tested with a changing canvas, not a fabricated event.
 let found=false,lost=false;const states=[];ctx.filter='none';ctx.fillStyle='#888';ctx.fillRect(0,0,640,480);ctx.drawImage(target,(640-targetWidth)/2,40,targetWidth,targetHeight);model.visible=false;latched=false;
 controller.onUpdate=d=>{if(d.type!=='updateMatrix')return;const visible=!!d.worldMatrix;if(visible&&!found){found=true;reveal();states.push('target_found');setTimeout(()=>{ctx.fillStyle='#888';ctx.fillRect(0,0,640,480)},300)}if(!visible&&found){lost=true;states.push('target_lost')}};
 controller.processVideo(c);const end=performance.now()+14000;while(performance.now()<end&&!lost)await sleep(100);controller.stopProcessVideo();
 report.tests.B={status:found&&lost&&model.visible?'APROVADO no ensaio digital; permanência relativa à câmera':'NÃO APROVADO neste ensaio',actualFoundEvent:found,actualLostEvent:lost,modelVisibleAfterLoss:model.visible,states,spatialWorldAnchor:false};controller.dispose();controller=null;
}
async function testVision(){
 await setupVision();const portrait=await image('./portrait.jpg'),fist=await image('./fist.jpg'),thumb=await image('./thumb_up.jpg');
 status('C/D/E: inferência sobre imagens oficiais de teste…');let t=performance.now(),f=face.detect(portrait);report.tests.C={status:f.faceLandmarks.length?'APROVADO sobre imagem estática; acompanhamento móvel NÃO TESTADO':'NÃO APROVADO',faces:f.faceLandmarks.length,landmarks:f.faceLandmarks[0]?.length??0,ms:performance.now()-t,worldTracking:false};
 t=performance.now();report.tests.D={status:'Máscara de pessoa calculada; oclusão 3D em vídeo NÃO TESTADA',mask:segmentation(portrait),ms:performance.now()-t};
 // Foreground alpha compositing of an actual Three.js render, on a static reference photo.
 segmenter.segment(portrait,r=>{const mask=r.confidenceMasks.at(-1),values=mask.getAsFloat32Array(),matte=document.createElement('canvas');matte.width=mask.width;matte.height=mask.height;const mc=matte.getContext('2d'),mi=mc.createImageData(mask.width,mask.height);for(let i=0;i<values.length;i++)mi.data.set([255,255,255,Math.round(values[i]*255)],i*4);mc.putImageData(mi,0,0);
 const fg=document.createElement('canvas');fg.width=640;fg.height=800;const fc=fg.getContext('2d');fc.drawImage(portrait,0,0,640,800);fc.globalCompositeOperation='destination-in';fc.drawImage(matte,0,0,640,800);
 renderer.setSize(640,800);camera.aspect=.8;camera.updateProjectionMatrix();model.visible=true;model.position.x=1;entryAction.stop();idleAction.reset().play();mixer.update(.05);renderer.render(scene,camera);const composite=document.createElement('canvas');composite.id='occlusionProof';composite.width=640;composite.height=800;const cc=composite.getContext('2d');cc.drawImage(portrait,0,0,640,800);cc.drawImage(renderer.domElement,0,0);cc.drawImage(fg,0,0);$('#samples').appendChild(composite);
 model.position.x=0;camera.aspect=720/460;camera.updateProjectionMatrix();renderer.setSize(720,460);
 report.tests.D.staticComposite=true;report.tests.D.status='Composição de silhueta sobre renderização Three.js executada; avaliar captura. Oclusão em vídeo NÃO TESTADA';
 });
 const shifts=[];for(const x of [-90,90]){const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');ctx.fillStyle='#777';ctx.fillRect(0,0,640,480);ctx.drawImage(portrait,x,0,640,480);const f=face.detect(c);shifts.push({imageShiftPixels:x,faces:f.faceLandmarks.length,noseX:f.faceLandmarks[0]?.[1]?.x??null})}report.tests.C.syntheticMotion=shifts;
 const rows=[];for(const [label,img] of [['Closed_Fist',fist],['Thumb_Up',thumb],['Sem mão de referência',portrait]]){t=performance.now();const g=gesture.recognize(img);rows.push({reference:label,prediction:g.gestures[0]?.[0]??null,ms:performance.now()-t})}report.tests.E={status:'Classificação de imagens; gesto ao vivo, falsos positivos e mão cortada NÃO TESTADOS',results:rows,proposedHoldMs:700};
 // Shared HTMLCanvasElement proves interoperability of inputs; it does not prove camera sharing performance.
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d').drawImage(portrait,0,0,640,480);const timings=[];
 await setupMindar();const sharedController=new Controller({inputWidth:640,inputHeight:480});await sharedController.addImageTargets('./alvo_provisorio.mind');
 const outcomes=[];for(let i=0;i<5;i++){let t=performance.now();let a=await sharedController.detect(canvas);const f=face.detect(canvas),g=gesture.recognize(canvas),s=segmentation(canvas,false);renderer.render(scene,camera);timings.push(performance.now()-t);outcomes.push({targetFeatures:a.featurePoints.length,faces:f.faceLandmarks.length,gesture:g.gestures[0]?.[0]?.categoryName??null,segmentationMean:s.mean})}sharedController.dispose();
 report.tests.INTEGRACAO={status:'Mesmo canvas processado sequencialmente pelas bibliotecas e renderização; fluxo de câmera e desempenho móvel NÃO TESTADOS',cyclesMs:timings,averageCycleMs:timings.reduce((a,b)=>a+b)/timings.length,outcomes,videoStreamsOpened:0};
 await persist();status('Integração: verificando um único fluxo de vídeo sintético…');
 const stream=canvas.captureStream(15),video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
 const ticker=setInterval(()=>canvas.getContext('2d').drawImage(portrait,0,0,640,480),60);
 try{await Promise.race([video.play(),sleep(5000).then(()=>{throw new Error('Tempo excedido ao iniciar vídeo sintético')})]);await sleep(150)}finally{clearInterval(ticker)}
 const vc=new Controller({inputWidth:640,inputHeight:480});await vc.addImageTargets('./alvo_provisorio.mind');const vf=await vc.detect(video),ff=face.detect(video),gg=gesture.recognize(video),ss=segmentation(video,false);renderer.render(scene,camera);report.tests.INTEGRACAO.syntheticVideo={tracks:stream.getVideoTracks().length,targetFeatures:vf.featurePoints.length,faces:ff.faceLandmarks.length,gesture:gg.gestures[0]?.[0]?.categoryName??null,segmentationMean:ss.mean,input:'Mesmo HTMLVideoElement de canvas.captureStream, não é câmera física'};vc.dispose();stream.getTracks().forEach(t=>t.stop());video.srcObject=null;
}
$('#run').onclick=async()=>{if(liveRunning||$('#live').disabled)return;$('#run').disabled=true;try{await setupModels();await testA();await persist();await testVision();status('Ensaios concluídos. Os resultados abaixo são do computador, com imagens digitais.')}catch(e){report.errors.push({message:e.message,stack:e.stack});status('Ensaio interrompido: '+e.message)}finally{await persist();$('#run').disabled=false}};
$('#smoke').onclick=()=>{if(liveRunning||$('#live').disabled)return;exitTrigger='manual';restoreOpacity();model.visible=true;smokePoints.position.copy(model.position);smokeStart=performance.now();status('F: fumaça com 64 partículas e desaparecimento sincronizado (teste visual).')};
$('#save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='KIRA_resultados_navegador.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
class VisionRunner {
 constructor(){
  this.worker=new Worker(new URL('./vision-worker.js',import.meta.url));this.id=0;this.pending=new Map();
  this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;this.timer=setTimeout(()=>reject(new Error('Tempo excedido ao carregar reconhecimento em segundo plano')),45000)});
  this.worker.onmessage=({data:d})=>{if(d.type==='ready'){clearTimeout(this.timer);this.resolveReady();return}if(d.type==='error'&&!d.id){clearTimeout(this.timer);this.rejectReady(new Error(d.message));return}const p=this.pending.get(d.id);if(p){this.pending.delete(d.id);d.type==='error'?p.reject(new Error(d.message)):p.resolve(d)}};
  this.worker.onerror=e=>{clearTimeout(this.timer);const error=new Error(e.message||'Reconhecimento em segundo plano indisponível');this.rejectReady(error);for(const p of this.pending.values())p.reject(error);this.pending.clear()};
  this.worker.postMessage({type:'init'});
 }
 async infer(source,kind,timestamp){await this.ready;const bitmap=await createImageBitmap(source),id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({type:'infer',id,kind,timestamp,bitmap},[bitmap])})}
 close(){clearTimeout(this.timer);for(const p of this.pending.values())p.reject(new Error('Teste encerrado'));this.pending.clear();this.worker.terminate()}
}
let liveToken=0,liveController=null,liveVision=null,exited=false,gate=new GestureGate(),resetEpoch=0;
function stopLive(){
 liveToken++;liveRunning=false;liveStream?.getTracks().forEach(t=>t.stop());liveVision?.close();liveVision=null;
 const oldController=liveController;liveController=null;if(oldController)setTimeout(()=>oldController.dispose(),500);
 const v=$('#video');v.srcObject=null;v.hidden=true;$('#live').disabled=false;$('#camera').disabled=false;$('#run').disabled=false;$('#smoke').disabled=!model;
 $('#liveStatus').textContent='Câmera desligada';if(report.live){report.live.endedAt=new Date().toISOString();output()}
}
function drawCover(video,ctx){const w=ctx.canvas.width,h=ctx.canvas.height,scale=Math.max(w/video.videoWidth,h/video.videoHeight),sw=w/scale,sh=h/scale;ctx.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,0,0,w,h)}
function startExit(){if(exited)return;exited=true;exitTrigger='gesture';smokePoints.position.copy(model.position);smokeStart=performance.now();report.live.exitTriggered=true;report.live.exitAt=new Date().toISOString()}
function liveMessage(){
 if(exited)return 'Saída por gesto acionada. Toque em reiniciar para repetir.';
 if(!latched)return 'Aponte para a imagem-alvo inteira, sem reflexos.';
 const r=report.live;
 if(!r.visionReady)return 'Ryuk ativado. Preparando reconhecimento da pessoa e da mão…';
 const faceText=r.faceSeen?'Rosto detectado.':'Enquadre o rosto para Ryuk acompanhar você.';
 if(!r.handSeen)return faceText+' Mostre a mão inteira, com a palma aberta.';
 if(!gate.armed)return faceText+' Abra a palma para preparar a saída.';
 if(r.gesture?.name==='Closed_Fist')return faceText+' Mão fechada: '+Math.round(gate.progress*100)+'%. Segure até confirmar.';
 return faceText+' Saída preparada. Feche a mão e segure até confirmar.';
}
$('#live').onclick=async()=>{
 if(liveRunning||$('#live').disabled)return;
 $('#live').disabled=true;$('#camera').disabled=true;$('#run').disabled=true;$('#smoke').disabled=true;
 const token=++liveToken;
 try{
  $('#liveStatus').textContent='Carregando personagem e câmera…';await setupModels();$('#smoke').disabled=true;await setupMindar();if(token!==liveToken)return;
  const v=$('#video'),front=$('#camera').value==='user';liveStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:front?'user':'environment'},width:{ideal:640},height:{ideal:480}}});
  if(token!==liveToken){liveStream.getTracks().forEach(t=>t.stop());return}
  v.srcObject=liveStream;await v.play();v.hidden=false;v.style.transform=front?'scaleX(-1)':'none';renderer.domElement.style.transform=front?'scaleX(-1)':'none';
  $('#view').appendChild(v);$('#view').classList.add('live');renderer.setSize(480,640);camera.aspect=.75;camera.updateProjectionMatrix();
  model.position.set(.35,0,0);followTargetX=.35;restoreOpacity();smokeStart=null;smokePoints.visible=false;liveRunning=true;latched=false;exited=false;gate.reset();
  const c=document.createElement('canvas');c.width=480;c.height=640;const ctx=c.getContext('2d');let heldJob=false,lastScan=0,lastVision=0,kindIndex=0,visionStarting=false,epoch=++resetEpoch;
  const ctl=new Controller({inputWidth:480,inputHeight:640});liveController=ctl;await ctl.addImageTargets('./alvo_provisorio.mind');
  report.live={startedAt:new Date().toISOString(),camera:front?'frontal':'traseira',videoSize:[v.videoWidth,v.videoHeight],tracks:liveStream.getVideoTracks().length,detected:false,exitTriggered:false,cycles:0,processingMs:[],workerMs:[],faceSeen:false,handSeen:false,faceDetections:0,handDetections:0,gesture:null,visionReady:false,backend:'loading',worldAnchor:false,occlusionApplied:false};output();
  const initVision=async()=>{
   if(visionStarting)return;visionStarting=true;const runner=new VisionRunner();liveVision=runner;
   try{await runner.ready;if(token!==liveToken)return;report.live.visionReady=true;report.live.backend='worker';}
   catch(e){runner.close();if(token!==liveToken)return;liveVision=null;report.errors.push({stage:'worker-fallback',message:e.message});$('#liveStatus').textContent='Modo econômico: preparando reconhecimento…';await setupVision();if(token===liveToken){report.live.visionReady=true;report.live.backend='main-fallback';}}
   output();
  };
  const loop=async()=>{
   if(!liveRunning||token!==liveToken)return;
   const now=performance.now();$('#liveStatus').textContent=liveMessage();
   if(!heldJob&&v.readyState>=2){
    if(!latched&&now-lastScan>=250){
     heldJob=true;lastScan=now;const started=performance.now();
     try{drawCover(v,ctx);const d=await ctl.detect(c),m=await ctl.match(d.featurePoints,0);if(token!==liveToken)return;if(m.modelViewTransform){reveal();report.live.detected=true;report.live.detectedAt=new Date().toISOString();initVision().catch(e=>{report.errors.push({stage:'vision-init',message:e.message});output()})}}
     catch(e){if(token===liveToken)report.errors.push({stage:'target',message:e.message})}finally{heldJob=false;report.live.processingMs.push(performance.now()-started);}
    }else if(latched&&!exited&&report.live.visionReady&&now-lastVision>=(report.live.backend==='worker'?140:350)){
     heldJob=true;lastVision=now;drawCover(v,ctx);const kind=(kindIndex++%2===0)?'face':'gesture',started=performance.now(),jobEpoch=resetEpoch;
     try{
      let r;if(liveVision)r=await liveVision.infer(c,kind,now);else if(kind==='face'){const f=face.detect(c);r={faceSeen:!!f.faceLandmarks[0],nose:f.faceLandmarks[0]?.[1]??null}}else{const g=gesture.recognize(c),p=g.gestures[0]?.[0];r={handSeen:g.landmarks.length>0,gesture:p?{name:p.categoryName,score:p.score}:null}}
      if(token!==liveToken)return;
      if(jobEpoch===resetEpoch){
      if(kind==='face'){report.live.faceSeen=r.faceSeen;if(r.nose){report.live.faceDetections++;followTargetX=Math.max(-.4,Math.min(.5,(r.nose.x-.5)*1.2+.3));}}
      else{report.live.handSeen=r.handSeen;report.live.gesture=r.gesture;report.live.handDetections+=r.handSeen?1:0;if(gate.update(r.gesture,performance.now()))startExit();report.live.gestureArmed=gate.armed;report.live.gestureProgress=gate.progress;}
      }
      const elapsed=performance.now()-started;report.live.workerMs.push({kind,ms:elapsed});if(report.live.workerMs.length>120)report.live.workerMs.shift();
     }catch(e){if(token===liveToken)report.errors.push({stage:'vision',message:e.message})}finally{heldJob=false;}
    }
   }
   report.live.cycles++;if(report.live.processingMs.length>120)report.live.processingMs.shift();
   if(report.live.cycles%30===0){report.live.animation={clip:currentClip,time:(currentClip==='01_Manifestacao'?entryAction:idleAction).time,playing:(currentClip==='01_Manifestacao'?entryAction:idleAction).isRunning()};output()}
   if(liveRunning&&token===liveToken)requestAnimationFrame(loop);
  };loop();$('#view').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){stopLive();$('#liveStatus').textContent=e.name==='NotAllowedError'?'Permita a câmera e toque em iniciar.':'Não foi possível iniciar: '+e.message;report.errors.push({stage:'camera',message:e.message});output()}
};
$('#stop').onclick=stopLive;
$('#restart').onclick=()=>{if(!liveRunning)return;resetEpoch++;gate.reset();exited=false;latched=false;if(report.live){report.live.detected=false;report.live.exitTriggered=false;report.live.gesture=null;report.live.handSeen=false;report.live.faceSeen=false;report.live.gestureArmed=false;}model.visible=false;model.position.set(.35,0,0);followTargetX=.35;restoreOpacity();smokeStart=null;smokePoints.visible=false;$('#liveStatus').textContent='Reiniciado. Apresente a imagem-alvo novamente.'};
$('#workerTest').onclick=async()=>{
 if(liveRunning||$('#live').disabled)return;$('#workerTest').disabled=true;let runner;
 try{status('Testando reconhecimento em segundo plano…');runner=new VisionRunner();await runner.ready;const fist=await image('./fist.jpg'),portrait=await image('./portrait.jpg');
  const g=await runner.infer(fist,'gesture',1000),f=await runner.infer(portrait,'face',2000);report.tests.WORKER={gesture:g.gesture,handSeen:g.handSeen,faceSeen:f.faceSeen,gestureMs:g.ms,faceMs:f.ms};status('Teste em segundo plano concluído.');
 }catch(e){report.errors.push({stage:'worker-test',message:e.message});status('Falha no teste em segundo plano: '+e.message)}finally{runner?.close();$('#workerTest').disabled=false;output();}
};
window.addEventListener('pagehide',stopLive);

window.addEventListener('error',e=>{report.errors.push({message:e.message});output()});
output();
