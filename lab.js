import {paintRedEyes} from './eye-effects.js?v=0.5';
import {sceneSequence} from './sequence.js?v=0.5';
import {personFraming,rootYForHead} from './framing.js?v=0.5';
import {GestureGate} from './gesture-gate.js?v=0.5';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FilesetResolver, GestureRecognizer, FaceLandmarker, ImageSegmenter } from './vision_bundle.mjs';

const $=s=>document.querySelector(s), report={versions:{mindar:'1.2.5',three:THREE.REVISION,mediapipe:'0.10.21',lab:'0.5'},environment:{userAgent:navigator.userAgent,secureContext:window.isSecureContext},tests:{},errors:[]};
let model,mixer,scene,camera,renderer,gesture,face,segmenter,Controller,controller,liveStream,liveBusy=false,liveRunning=false;
let followTargetScale=1,followTargetHeadY=.32,assetHeadY=2.2,assetHeadHeight=.3,currentHeadY=.32,lastFaceBox=null;
let followTargetX=.35,followSide=null,currentClip='02_Suspensao',exitTrigger='manual';
let renderTimes=[],demoRunning=false,appearanceAt=null,sequenceState=sceneSequence(0),followDirection=1,walkRig=[],walkApplied=[],exitAtPerf=null;
let appearing=false,latched=false,smokeStart=null,smokePoints,modelStart=0,modelElapsed=0,entryAction,idleAction;
const status=t=>{$('#status').textContent=t}, output=()=>{$('#results').textContent=JSON.stringify(report,null,2)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const timed=async f=>{let t=performance.now();const value=await f();return {value,ms:performance.now()-t}};
const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
async function persist(){output();if(!['localhost','127.0.0.1'].includes(location.hostname))return;try{await fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)})}catch{}}
function restoreOpacity(){model.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.opacity=1;m.transparent=m.userData.kiraOriginalTransparent??m.transparent;m.depthWrite=m.userData.kiraOriginalDepthWrite??m.depthWrite}})}
function reveal(){if(liveRunning||demoRunning){appearanceAt=performance.now();exitAtPerf=null;}currentClip='01_Manifestacao';restoreOpacity();latched=true;model.visible=true;modelElapsed=0;entryAction?.reset().play();idleAction?.stop();appearing=true;}
function makeRenderer(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(720,460);$('#view').appendChild(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,720/460,.01,30);camera.position.set(0,1.2,4.8);scene.add(camera);
 scene.add(new THREE.HemisphereLight(0xffffff,0x5a5263,2));let light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,4,5);scene.add(light);
 const positions=new Float32Array(64*3);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const sprite=document.createElement('canvas');sprite.width=sprite.height=128;const ctx=sprite.getContext('2d'),pixels=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const dx=(x-64)/64,dy=(y-64)/64,r=Math.hypot(dx,dy),cloud=.63+.19*Math.sin(x*.13+Math.sin(y*.12)*2)+.13*Math.sin(y*.17+x*.06)+.05*Math.sin(x*.39-y*.31);const a=Math.max(0,1-r)**1.7*Math.max(0,cloud);const i=(y*128+x)*4;pixels.data[i]=63;pixels.data[i+1]=57;pixels.data[i+2]=71;pixels.data[i+3]=Math.round(Math.min(1,a)*220)}ctx.putImageData(pixels,0,0);
 smokePoints=new THREE.Points(geometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(sprite),color:0xffffff,size:.8,transparent:true,depthWrite:false,opacity:0}));smokePoints.visible=false;scene.add(smokePoints);
 let last=performance.now();renderer.setAnimationLoop(()=>{const now=performance.now();if(now-last<1000/30-1)return;const frameMs=now-last,delta=Math.min(frameMs/1000,.1);last=now;if(liveRunning||demoRunning){renderTimes.push(frameMs);if(renderTimes.length>180)renderTimes.shift();}clearWalk();mixer?.update(delta);if(appearing){modelElapsed+=delta;if(modelElapsed>entryAction.getClip().duration){entryAction.stop();idleAction.reset().play();currentClip='02_Suspensao';appearing=false}}
  if((liveRunning||demoRunning)&&latched&&!exited){
   const a=1-Math.exp(-delta*4),elapsed=appearanceAt===null?0:(now-appearanceAt)/1000;sequenceState=sceneSequence(elapsed);
   const height=2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
   model.position.x+=(followTargetX+sequenceState.x*height*camera.aspect-model.position.x)*a;
   const next=model.scale.x+(followTargetScale-model.scale.x)*a;model.scale.setScalar(next);currentHeadY+=(followTargetHeadY-currentHeadY)*a;
   model.position.y=rootYForHead(currentHeadY-sequenceState.lift,next,assetHeadY,camera.position.y,height);
   const yaw=sequenceState.stage==='caminhada'?sequenceState.yaw:-followDirection*.45*sequenceState.eyes;model.rotation.y+=(yaw-model.rotation.y)*a;
   applyWalk(elapsed-10,sequenceState.walk);
   if(sequenceState.stage==='encarar'||sequenceState.stage==='flutuacao'){const head=model.getObjectByName('bip_head');if(head){const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-followDirection*.22);head.quaternion.multiply(q);walkApplied.push({bone:head,q})}}
  }
  if(smokeStart!==null){const u=Math.min((now-smokeStart)/2600,1);smokePoints.visible=u<1;smokePoints.material.opacity=Math.sin(Math.PI*u)*.95;smokePoints.material.size=(.65+.7*u)*smokePoints.scale.x;
   const p=smokePoints.geometry.attributes.position;for(let i=0;i<64;i++){const angle=i*2.39996+u*.7,r=(.2+.55*Math.sin(i*4.3)**2)*(1+u*.7);p.setXYZ(i,Math.cos(angle)*r+.12*Math.sin(i+u*3),(i/63)*2.5+u*.45,Math.sin(angle)*r)}p.needsUpdate=true;
   model.traverse(o=>{if(o.isMesh){for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.transparent=true;m.depthWrite=false;m.opacity=1-THREE.MathUtils.smoothstep(u,.18,.78)}}});if(u===1){model.visible=false;smokeStart=null;report.tests.F={status:'Fumaça de teste concluída neste navegador',trigger:exitTrigger,particles:64,seconds:2.6,modelHidden:!model.visible,smokeHidden:!smokePoints.visible};persist();}}
  renderer.render(scene,camera);
 });
}
async function setupModels(){
 if(model)return;status('Carregando GLB e verificando animações…');makeRenderer();
 const gltf=await new GLTFLoader().loadAsync('./ryuk.glb');model=gltf.scene;scene.add(model);model.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.userData.kiraOriginalTransparent=m.transparent;m.userData.kiraOriginalDepthWrite=m.depthWrite}});mixer=new THREE.AnimationMixer(model);setupWalk();entryAction=mixer.clipAction(gltf.animations.find(a=>a.name==='01_Manifestacao'));entryAction.setLoop(THREE.LoopOnce,1);entryAction.clampWhenFinished=true;idleAction=mixer.clipAction(gltf.animations.find(a=>a.name==='02_Suspensao'));idleAction.play();
 report.tests.G={status:'APROVADO carregamento Three.js; inspeção visual necessária',animations:gltf.animations.map(a=>({name:a.name,duration:a.duration})),skinnedMeshes:0,renderedFrames:0};model.traverse(o=>{if(o.isSkinnedMesh)report.tests.G.skinnedMeshes++});$('#smoke').disabled=false;
 await sleep(600);report.tests.G.renderedFrames=renderer.info.render.frame;const headMesh=model.getObjectByName('Head');if(headMesh){const b=new THREE.Box3().setFromObject(headMesh,true);assetHeadY=(b.min.y+b.max.y)/2;assetHeadHeight=(b.max.y-b.min.y)*.85;report.tests.G.framingReference={headY:assetHeadY,headHeight:assetHeadHeight};}const head=model.getObjectByName('bip_head');if(head){const before=head.quaternion.clone();await sleep(500);report.tests.G.headMotionRadians=before.angleTo(head.quaternion);report.tests.G.idlePlaying=idleAction.isRunning()}
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
 const rows=[];for(const [label,img] of [['Closed_Fist',fist],['Thumb_Up',thumb],['Sem mão de referência',portrait]]){t=performance.now();const g=gesture.recognize(img);rows.push({reference:label,prediction:g.gestures[0]?.[0]??null,ms:performance.now()-t})}report.tests.E={status:'Classificação de imagens; gesto ao vivo, falsos positivos e mão cortada NÃO TESTADOS',results:rows,proposedHoldMs:900};
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
$('#run').onclick=async()=>{if(liveRunning||demoRunning||$('#live').disabled)return;$('#run').disabled=true;try{await setupModels();await testA();await persist();await testVision();status('Ensaios concluídos. Os resultados abaixo são do computador, com imagens digitais.')}catch(e){report.errors.push({message:e.message,stack:e.stack});status('Ensaio interrompido: '+e.message)}finally{await persist();$('#run').disabled=false}};
$('#smoke').onclick=()=>{if(liveRunning||demoRunning||$('#live').disabled)return;exitTrigger='manual';restoreOpacity();model.visible=true;smokePoints.position.copy(model.position);smokePoints.scale.copy(model.scale);smokeStart=performance.now();status('F: fumaça com 64 partículas e desaparecimento sincronizado (teste visual).')};
$('#save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='KIRA_resultados_navegador.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
class VisionRunner {
 constructor(file='./vision-worker.js?v=0.5'){
  this.worker=new Worker(new URL(file,import.meta.url));this.id=0;this.pending=new Map();
  this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;this.timer=setTimeout(()=>reject(new Error('Tempo excedido ao carregar reconhecimento em segundo plano')),45000)});
  this.worker.onmessage=({data:d})=>{if(d.type==='ready'){clearTimeout(this.timer);this.resolveReady();return}if(d.type==='error'&&!d.id){clearTimeout(this.timer);this.rejectReady(new Error(d.message));return}const p=this.pending.get(d.id);if(p){this.pending.delete(d.id);d.type==='error'?p.reject(new Error(d.message)):p.resolve(d)}};
  this.worker.onerror=e=>{clearTimeout(this.timer);const error=new Error(e.message||'Reconhecimento em segundo plano indisponível');this.rejectReady(error);for(const p of this.pending.values())p.reject(error);this.pending.clear()};
  this.worker.postMessage({type:'init'});
 }
 async infer(source,kind,timestamp){await this.ready;const bitmap=await createImageBitmap(source),id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({type:'infer',id,kind,timestamp,bitmap},[bitmap])})}
 close(){clearTimeout(this.timer);for(const p of this.pending.values())p.reject(new Error('Teste encerrado'));this.pending.clear();this.worker.terminate()}
}
let liveToken=0,liveController=null,liveVision=null,liveMask=null,compositor=null,maskBusy=false,maskLast=0,maskCapture=null,exited=false,gate=new GestureGate(),resetEpoch=0;
function stopLive(){
 liveToken++;liveRunning=false;liveMask?.close();liveMask=null;compositor?.dispose();compositor=null;maskBusy=false;liveStream?.getTracks().forEach(t=>t.stop());liveVision?.close();liveVision=null;
 const oldController=liveController;liveController=null;if(oldController)setTimeout(()=>oldController.dispose(),500);
 const v=$('#video');v.srcObject=null;v.hidden=true;$('#live').disabled=false;$('#camera').disabled=false;$('#run').disabled=false;$('#smoke').disabled=!model;
 $('#liveStatus').textContent='Câmera desligada';if(report.live){report.live.endedAt=new Date().toISOString();output()}
}
function drawCover(video,ctx){const w=ctx.canvas.width,h=ctx.canvas.height,scale=Math.max(w/video.videoWidth,h/video.videoHeight),sw=w/scale,sh=h/scale;ctx.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,0,0,w,h)}
function startExit(){if(exited)return;exited=true;exitAtPerf=performance.now();exitTrigger='gesture';smokePoints.position.copy(model.position);smokePoints.scale.copy(model.scale);smokeStart=performance.now();report.live.exitTriggered=true;report.live.exitAt=new Date().toISOString()}
function liveMessage(){
 if(exited)return 'Saída por gesto acionada. Toque em reiniciar para repetir.';
 if(!latched)return 'Aponte para a imagem-alvo inteira, sem reflexos.';
 const r=report.live;
 if(r.occlusionPending)return 'Preparando recorte da pessoa…';
 if(!r.visionReady)return 'Ryuk ativado. Preparando reconhecimento da pessoa e da mão…';
 const faceText=(r.maskFailed?'Recorte indisponível: usando apenas posição lateral. ':'')+(r.faceSeen?'Rosto detectado.':'Enquadre o rosto para Ryuk acompanhar você.');
 if(!r.handSeen)return faceText+' Mão não detectada: enquadre pulso e dedos, de frente para a câmera.';
 if(!gate.armed)return faceText+' Mão detectada. Feche o punho e segure por 1 segundo.';
 if(r.gesture?.name==='Closed_Fist')return faceText+' Mão fechada: '+Math.round(gate.progress*100)+'%. Segure até confirmar.';
 return faceText+' Mão detectada. Feche a mão e segure até confirmar.';
}
$('#live').onclick=async()=>{
 if(liveRunning||demoRunning||$('#live').disabled)return;
 $('#live').disabled=true;$('#camera').disabled=true;$('#run').disabled=true;$('#smoke').disabled=true;
 const token=++liveToken;
 try{
  $('#liveStatus').textContent='Carregando personagem e câmera…';await setupModels();$('#smoke').disabled=true;await setupMindar();if(token!==liveToken)return;
  const v=$('#video'),front=$('#camera').value==='user';liveStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:front?'user':'environment'},width:{ideal:640},height:{ideal:480}}});
  if(token!==liveToken){liveStream.getTracks().forEach(t=>t.stop());return}
  v.srcObject=liveStream;await v.play();v.hidden=false;v.style.transform=front?'scaleX(-1)':'none';renderer.domElement.style.transform=front?'scaleX(-1)':'none';
  $('#view').appendChild(v);$('#view').classList.add('live');renderer.setSize(480,640);camera.aspect=.75;camera.updateProjectionMatrix();
  model.position.set(.7,.12,0);model.scale.setScalar(Number($("#size").value));followTargetX=.7;resetFraming();restoreOpacity();model.visible=false;smokeStart=null;smokePoints.visible=false;liveRunning=true;followSide=null;latched=false;exited=false;gate.reset();
  const c=document.createElement('canvas');c.width=480;c.height=640;const ctx=c.getContext('2d');let heldJob=false,lastScan=0,lastVision=0,kindIndex=0,visionStarting=false,epoch=++resetEpoch;
  const ctl=new Controller({inputWidth:480,inputHeight:640});liveController=ctl;await ctl.addImageTargets('./alvo_provisorio.mind');
  report.live={startedAt:new Date().toISOString(),camera:front?'frontal':'traseira',videoSize:[v.videoWidth,v.videoHeight],tracks:liveStream.getVideoTracks().length,detected:false,exitTriggered:false,cycles:0,processingMs:[],workerMs:[],faceSeen:false,handSeen:false,faceDetections:0,handDetections:0,gesture:null,visionReady:false,backend:'loading',worldAnchor:false,occlusionApplied:false,occlusionPending:false,maskFrames:0,maskMs:[],handSamples:0,closedFistSamples:0};output();
  compositor=new PersonCompositor(front);maskCapture=document.createElement('canvas');maskCapture.width=480;maskCapture.height=640;maskLast=0;maskBusy=false;
  const initVision=async()=>{
   if(visionStarting)return;visionStarting=true;const runner=new VisionRunner();liveVision=runner;
   try{await runner.ready;if(token!==liveToken)return;report.live.visionReady=true;report.live.backend='worker';}
   catch(e){runner.close();if(token!==liveToken)return;liveVision=null;report.errors.push({stage:'worker-fallback',message:e.message});$('#liveStatus').textContent='Modo econômico: preparando reconhecimento…';await setupVision();if(token===liveToken){report.live.visionReady=true;report.live.backend='main-fallback';}}
   output();
  };
  const loop=async()=>{
   if(!liveRunning||token!==liveToken)return;
   const now=performance.now();updateMask(v,token,now);$('#liveStatus').textContent=liveMessage();
   if(!heldJob&&v.readyState>=2){
    if(!latched&&now-lastScan>=250){
     heldJob=true;lastScan=now;const started=performance.now();
     try{drawCover(v,ctx);const d=await ctl.detect(c),m=await ctl.match(d.featurePoints,0);if(token!==liveToken)return;if(m.modelViewTransform){latched=true;model.visible=false;report.live.occlusionPending=true;initMask(token);report.live.detected=true;report.live.detectedAt=new Date().toISOString();initVision().catch(e=>{report.errors.push({stage:'vision-init',message:e.message});output()})}}
     catch(e){if(token===liveToken)report.errors.push({stage:'target',message:e.message})}finally{heldJob=false;report.live.processingMs.push(performance.now()-started);}
    }else if(latched&&!exited&&report.live.visionReady&&now-lastVision>=(report.live.backend==='worker'?140:350)){
     heldJob=true;lastVision=now;drawCover(v,ctx);const kind=report.live.maskReady?'gesture':((kindIndex++%2===0)?'face':'gesture'),started=performance.now(),jobEpoch=resetEpoch;
     try{
      let r;if(liveVision)r=await liveVision.infer(c,kind,now);else if(kind==='face'){const f=face.detect(c),pts=f.faceLandmarks[0];r={faceSeen:!!pts,nose:pts?.[1]??null,box:pts?{left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),top:Math.min(...pts.map(p=>p.y)),bottom:Math.max(...pts.map(p=>p.y))}:null}}else{const g=gesture.recognize(c),p=g.gestures[0]?.[0];r={handSeen:g.landmarks.length>0,gesture:p?{name:p.categoryName,score:p.score}:null,points:g.landmarks[0]??[]}}
      if(token!==liveToken)return;
      if(jobEpoch===resetEpoch){
      if(kind==='face'){report.live.faceSeen=r.faceSeen;if(r.nose){report.live.faceDetections++;followTargetX=sidePosition(r.nose.x,r.box,front);updateFraming(r.box);}}
      else{report.live.handSamples++;report.live.closedFistSamples+=r.gesture?.name==='Closed_Fist'?1:0;compositor?.drawHand(r.points??[]);report.live.handSeen=r.handSeen;report.live.gesture=r.gesture;report.live.handDetections+=r.handSeen?1:0;if(!report.live.occlusionPending&&gate.update(r.gesture,performance.now()))startExit();report.live.gestureArmed=gate.armed;report.live.gestureProgress=gate.progress;}
      }
      const elapsed=performance.now()-started;report.live.workerMs.push({kind,ms:elapsed});if(report.live.workerMs.length>120)report.live.workerMs.shift();
     }catch(e){if(token===liveToken)report.errors.push({stage:'vision',message:e.message})}finally{heldJob=false;}
    }
   }
   report.live.cycles++;if(report.live.processingMs.length>120)report.live.processingMs.shift();
   if(report.live.cycles%30===0){report.live.renderStats=renderStats();report.live.position={x:model.position.x,scale:model.scale.x,stage:sequenceState.stage,eyesProgress:sequenceState.eyes,side:$('#side').value,automatic:true,targetScale:followTargetScale,faceHeight:lastFaceBox?lastFaceBox.bottom-lastFaceBox.top:null};report.live.animation={clip:currentClip,time:(currentClip==='01_Manifestacao'?entryAction:idleAction).time,playing:(currentClip==='01_Manifestacao'?entryAction:idleAction).isRunning()};output()}
   if(liveRunning&&token===liveToken)requestAnimationFrame(loop);
  };loop();$('#view').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){stopLive();$('#liveStatus').textContent=e.name==='NotAllowedError'?'Permita a câmera e toque em iniciar.':'Não foi possível iniciar: '+e.message;report.errors.push({stage:'camera',message:e.message});output()}
};
$('#stop').onclick=stopLive;
$('#restart').onclick=()=>{if(!liveRunning)return;resetEpoch++;gate.reset();exited=false;latched=false;if(report.live){report.live.detected=false;report.live.exitTriggered=false;report.live.gesture=null;report.live.handSeen=false;report.live.faceSeen=false;report.live.gestureArmed=false;report.live.occlusionPending=false;compositor?.drawHand([]);}model.visible=false;model.position.set(.7,.12,0);model.scale.setScalar(Number($("#size").value));followTargetX=.7;resetFraming();restoreOpacity();smokeStart=null;smokePoints.visible=false;$('#liveStatus').textContent='Reiniciado. Apresente a imagem-alvo novamente.'};
$('#workerTest').onclick=async()=>{
 if(liveRunning||demoRunning||$('#live').disabled)return;$('#workerTest').disabled=true;let runner;
 try{status('Testando reconhecimento em segundo plano…');runner=new VisionRunner();await runner.ready;const fist=await image('./fist.jpg'),portrait=await image('./portrait.jpg');
  const g=await runner.infer(fist,'gesture',1000),f=await runner.infer(portrait,'face',2000);report.tests.WORKER={gesture:g.gesture,handSeen:g.handSeen,faceSeen:f.faceSeen,gestureMs:g.ms,faceMs:f.ms};status('Teste em segundo plano concluído.');
 }catch(e){report.errors.push({stage:'worker-test',message:e.message});status('Falha no teste em segundo plano: '+e.message)}finally{runner?.close();$('#workerTest').disabled=false;output();}
};
window.addEventListener('pagehide',stopLive);

window.addEventListener('error',e=>{report.errors.push({message:e.message});output()});
output();

// The background and person foreground use the SAME captured frame and mask.
// This prevents a stale silhouette being painted over a newer video frame.
class PersonCompositor {
 constructor(front){
  this.layers=['cameraBackground','personForeground','handGuide'].map(name=>{const c=document.createElement('canvas');c.width=480;c.height=640;c.className=name;c.style.transform=front?'scaleX(-1)':'none';$('#view').appendChild(c);return c});
  this.matte=document.createElement('canvas');
 }
 paint(r){
  const [bg,fg]=this.layers,bc=bg.getContext('2d'),fc=fg.getContext('2d');
  bc.clearRect(0,0,480,640);bc.drawImage(r.bitmap,0,0,480,640);
  const m=this.matte;m.width=r.width;m.height=r.height;const mc=m.getContext('2d'),im=mc.createImageData(r.width,r.height);
  for(let i=0;i<r.alpha.length;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=r.alpha[i]}mc.putImageData(im,0,0);
  fc.globalCompositeOperation='source-over';fc.clearRect(0,0,480,640);fc.drawImage(r.bitmap,0,0,480,640);fc.globalCompositeOperation='destination-in';fc.drawImage(m,0,0,480,640);fc.globalCompositeOperation='source-over';if((liveRunning||demoRunning)&&appearanceAt!==null){const amount=sceneSequence((performance.now()-appearanceAt)/1000).eyes*(exitAtPerf===null?1:Math.max(0,1-(performance.now()-exitAtPerf)/2600));const applied=paintRedEyes(fc,r.face?.eyes,amount);const eyeReport=liveRunning?report.live:report.tests.SEQUENCE_DEMO;eyeReport.redEyes={elapsedSeconds:(performance.now()-appearanceAt)/1000,enabled:amount>0,eyesDrawn:applied,faceSeen:r.face?.faceSeen??false};}r.bitmap.close();
 }
 drawHand(points){const ctx=this.layers[2].getContext('2d');ctx.clearRect(0,0,480,640);ctx.fillStyle='#63ffb1';for(const p of points){ctx.beginPath();ctx.arc(p.x*480,p.y*640,3,0,Math.PI*2);ctx.fill()}}
 dispose(){for(const c of this.layers)c.remove()}
}
function sidePosition(nose,box,front){
 const choice=$('#side').value,center=box?(box.left+box.right)/2:nose;
 // Choice is in screen space; all camera layers are mirrored together for selfie.
 if(followSide===null)followSide=center<=.5?1:-1;
 if(center<.38)followSide=1;else if(center>.62)followSide=-1;
 const direction=choice==='auto'?followSide:((choice==='right')!==front?1:-1);followDirection=direction;
 const offset=Math.max(.27,(box?box.right-box.left:.16)*.6+.18);
 const x=Math.max(.18,Math.min(.82,center+direction*offset));
 const width=2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect;
 return (x-.5)*width;
}
async function initMask(token){
 if(liveMask)return;
 const runner=new VisionRunner('./mask-worker.js?v=0.5');liveMask=runner;
 try{await runner.ready;if(token!==liveToken)return;report.live.maskReady=true;}
 catch(e){runner.close();if(token!==liveToken)return;liveMask=null;report.live.maskFailed=true;report.live.occlusionPending=false;report.errors.push({stage:'person-mask',message:e.message});reveal();output()}
}
function updateMask(video,token,now){
 if(!latched||!liveMask||!report.live.maskReady||maskBusy||now-maskLast<100)return;
 maskBusy=true;maskLast=now;const epoch=resetEpoch,runner=liveMask;
 drawCover(video,maskCapture.getContext('2d'));
 runner.infer(maskCapture,'mask',now).then(r=>{
  if(token!==liveToken||epoch!==resetEpoch){r.bitmap?.close();return}
  compositor.paint(r);if(r.face){report.live.faceSeen=r.face.faceSeen;if(r.face.nose){report.live.faceDetections++;followTargetX=sidePosition(r.face.nose.x,r.face.box,report.live.camera==='frontal');updateFraming(r.face.box)}}report.live.occlusionApplied=true;report.live.maskFrames++;report.live.maskMean=r.mean;report.live.maskMs.push(r.ms);if(report.live.maskMs.length>60)report.live.maskMs.shift();
  if(report.live.occlusionPending){report.live.occlusionPending=false;reveal()}
 }).catch(e=>{if(token===liveToken){report.errors.push({stage:'mask-frame',message:e.message});report.live.occlusionApplied=false;report.live.occlusionPending=false;report.live.maskFailed=true;report.live.maskReady=false;runner.close();liveMask=null;compositor?.dispose();compositor=null;reveal();output()}}).finally(()=>{if(token===liveToken)maskBusy=false});
}
$('#occlusionTest').onclick=async()=>{
 if(liveRunning||demoRunning||$('#live').disabled)return;$('#occlusionTest').disabled=true;let runner,proof;
 try{
  status('Testando recorte em segundo plano e composição sobre o personagem…');await setupModels();
  runner=new VisionRunner('./mask-worker.js?v=0.5');await runner.ready;
  const portrait=await image('./portrait.jpg');const c=document.createElement('canvas');c.width=480;c.height=640;c.getContext('2d').drawImage(portrait,0,0,480,640);
  const frames=[];proof=new PersonCompositor(false);
  $('#view').classList.add('live');renderer.setSize(480,640);camera.aspect=.75;camera.updateProjectionMatrix();model.position.set(.84,.12,0);model.scale.setScalar(Number($("#size").value));restoreOpacity();model.visible=true;idleAction.reset().play();entryAction.stop();
  for(let i=0;i<5;i++){const r=await runner.infer(c,'mask',1000+i*200);frames.push({ms:r.ms,mean:r.mean});proof.paint(r)}
  report.tests.LIVE_MASK_WORKER={status:'Cinco quadros de foto processados pelo mesmo worker e compositor usados na câmera; celular NÃO VALIDADO',frames,layers:proof.layers.map(c=>c.className),modelVisible:model.visible};
  // Keep the proof in samples; restore main viewport for subsequent camera use.
  renderer.render(scene,camera);const sample=document.createElement('canvas');sample.id='maskWorkerProof';sample.width=480;sample.height=640;const ctx=sample.getContext('2d');ctx.drawImage(proof.layers[0],0,0);ctx.drawImage(renderer.domElement,0,0);ctx.drawImage(proof.layers[1],0,0);$('#samples').appendChild(sample);
  status('Recorte e posição processados sobre foto. Ainda é necessário testar a câmera no celular.');
 }catch(e){report.errors.push({stage:'mask-test',message:e.message});status('Falha no recorte: '+e.message)}
 finally{runner?.close();proof?.dispose();$('#view').classList.remove('live');if(renderer){renderer.setSize(720,460);camera.aspect=720/460;camera.updateProjectionMatrix();model.position.set(0,0,0);model.scale.setScalar(1)}$('#occlusionTest').disabled=false;output()}
};


$('#size').onchange=()=>{if(liveRunning&&model){if(lastFaceBox)updateFraming(lastFaceBox);else followTargetScale=Number($('#size').value)}};


function resetFraming(){renderTimes=[];appearanceAt=null;exitAtPerf=null;sequenceState=sceneSequence(0);model.rotation.set(0,0,0);clearWalk();lastFaceBox=null;followTargetScale=Number($('#size').value);followTargetHeadY=.32;const h=2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));currentHeadY=.5-(model.position.y+assetHeadY*model.scale.x-camera.position.y)/h;}
function updateFraming(box){const f=personFraming(box,Number($('#size').value),assetHeadHeight/(2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))));if(!f)return;lastFaceBox=box;followTargetScale=f.scale;followTargetHeadY=f.headY;}

$('#framingTest').onclick=async()=>{
 if(liveRunning||demoRunning||$('#live').disabled)return;$('#framingTest').disabled=true;let visionRunner,maskRunner,proof;
 try{
  status('Comparando aproximação e afastamento com fotos de referência…');await setupModels();visionRunner=new VisionRunner();maskRunner=new VisionRunner('./mask-worker.js?v=0.5');await Promise.all([visionRunner.ready,maskRunner.ready]);
  const portrait=await image('./portrait.jpg'),frame=document.createElement('canvas');frame.width=480;frame.height=640;const ctx=frame.getContext('2d');const rows=[];
  renderer.setSize(480,640);camera.aspect=.75;camera.updateProjectionMatrix();model.visible=true;restoreOpacity();entryAction.stop();idleAction.reset().play();appearing=false;proof=new PersonCompositor(false);followSide=null;
  for(const [i,h] of [420,750,1100].entries()){
   const w=h*portrait.naturalWidth/portrait.naturalHeight;ctx.fillStyle='#46434b';ctx.fillRect(0,0,480,640);ctx.drawImage(portrait,(480-w)/2,640*.32-h*.26,w,h);
   let r;for(let settle=0;settle<5;settle++)r=await visionRunner.infer(frame,'face',1000+i*1500+settle*200);if(!r.box)throw new Error('Rosto não encontrado na foto de '+h+' px');updateFraming(r.box);
   model.scale.setScalar(followTargetScale);model.position.set(sidePosition(r.nose.x,r.box,false),rootYForHead(followTargetHeadY,followTargetScale,assetHeadY,camera.position.y,2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))),0);
   const m=await maskRunner.infer(frame,'mask',1000+i*500);proof.paint(m);renderer.render(scene,camera);
   const out=document.createElement('canvas');out.width=480;out.height=690;const oc=out.getContext('2d');oc.fillStyle='#202126';oc.fillRect(0,0,480,690);oc.fillStyle='white';oc.font='22px system-ui';oc.fillText(['Longe — mais corpo visível','Distância intermediária','Perto — corpo fora do enquadramento'][i],12,32);oc.drawImage(proof.layers[0],0,50);oc.drawImage(renderer.domElement,0,50);oc.drawImage(proof.layers[1],0,50);$('#samples').appendChild(out);
   rows.push({photoHeight:h,faceHeight:r.box.bottom-r.box.top,scale:model.scale.x,headScreenY:followTargetHeadY,rootY:model.position.y});
  }
  report.tests.FRAMING={status:'Comparação de três fotos ampliadas; movimento real da câmera ainda precisa ser testado',rows,increasesWithFace:rows[0].scale<rows[1].scale&&rows[1].scale<rows[2].scale,headReference:{y:assetHeadY,height:assetHeadHeight}};
  status('Comparação de distâncias concluída. Escala acompanha o tamanho do rosto.');
 }catch(e){report.errors.push({stage:'framing-test',message:e.message});status('Falha: '+e.message)}
 finally{visionRunner?.close();maskRunner?.close();proof?.dispose();if(renderer){renderer.setSize(720,460);camera.aspect=720/460;camera.updateProjectionMatrix();model.scale.setScalar(1);model.position.set(0,0,0)}$('#framingTest').disabled=false;output()}
};

function setupWalk(){walkRig=[];for(const side of ['L','R'])for(const [part,amp] of [['hip',.28],['knee',.35],['foot',.12],['upperArm',.10]]){const bone=model.getObjectByName('bip_'+part+'_'+side);if(bone)walkRig.push({bone,part,amp,phase:side==='L'?0:Math.PI})}}
function clearWalk(){for(const {bone,q} of walkApplied)bone.quaternion.multiply(q.clone().invert());walkApplied=[]}
function applyWalk(t,amount){if(amount<=0)return;for(const joint of walkRig){const wave=Math.sin(t*Math.PI*2*.9+joint.phase);const angle=(joint.part==='knee'?Math.max(0,-wave):joint.part==='upperArm'?-wave:wave)*joint.amp*amount;const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle);joint.bone.quaternion.multiply(q);walkApplied.push({bone:joint.bone,q})}}

$('#sequenceTest').onclick=async()=>{
 if(liveRunning||demoRunning||$('#live').disabled)return;$('#sequenceTest').disabled=true;$('#live').disabled=true;let runner,proof;
 try{
  status('Preparando demonstração com foto, sem câmera…');await setupModels();runner=new VisionRunner('./mask-worker.js?v=0.5');await runner.ready;
  const portrait=await image('./portrait.jpg'),frame=document.createElement('canvas');frame.width=480;frame.height=640;const fc=frame.getContext('2d');fc.fillStyle='#58535d';fc.fillRect(0,0,480,640);const h=480,w=h*portrait.naturalWidth/portrait.naturalHeight;fc.drawImage(portrait,(480-w)/2,640*.32-h*.26,w,h);
  let mask;for(let i=0;i<5;i++){mask?.bitmap.close();mask=await runner.infer(frame,'mask',1000+i*200)}mask.bitmap.close();
  if(!mask.face.faceSeen)throw new Error('Rosto da foto não foi encontrado');
  $('#view').classList.add('live');renderer.setSize(480,640);camera.aspect=.75;camera.updateProjectionMatrix();proof=new PersonCompositor(false);
  resetFraming();updateFraming(mask.face.box);model.scale.setScalar(followTargetScale);currentHeadY=followTargetHeadY;followSide=null;followTargetX=sidePosition(mask.face.nose.x,mask.face.box,false);model.position.x=followTargetX;exited=false;smokeStart=null;smokePoints.visible=false;
  report.tests.SEQUENCE_DEMO={status:'Demonstração de 20 s em foto de referência, sem câmera',walkJoints:walkRig.length,samples:[]};demoRunning=true;reveal();const started=performance.now();let checkpoint=0;const moments=[9.8,11.4,15.8,19.4];
  while(performance.now()-started<20200){
   const elapsed=(performance.now()-started)/1000;const bitmap=await createImageBitmap(frame);proof.paint({...mask,bitmap});
   if(checkpoint<moments.length&&elapsed>=moments[checkpoint]){
    renderer.render(scene,camera);const sample=document.createElement('canvas');sample.width=480;sample.height=690;const sc=sample.getContext('2d');sc.fillStyle='#202126';sc.fillRect(0,0,480,690);sc.font='22px system-ui';sc.fillStyle='white';sc.fillText(elapsed.toFixed(1)+' s · '+sequenceState.stage,12,32);sc.drawImage(proof.layers[0],0,50);sc.drawImage(renderer.domElement,0,50);sc.drawImage(proof.layers[1],0,50);$('#samples').appendChild(sample);
    report.tests.SEQUENCE_DEMO.samples.push({elapsed,stage:sequenceState.stage,eyesProgress:sequenceState.eyes,eyesDrawn:report.tests.SEQUENCE_DEMO.redEyes?.eyesDrawn,walkAmount:sequenceState.walk,x:model.position.x,rootY:model.position.y,yaw:model.rotation.y,activeJointDeltas:walkApplied.length});checkpoint++;
   }
   status('Demonstração com foto: '+elapsed.toFixed(1)+' s · '+sequenceState.stage);await sleep(80);
  }
  report.tests.SEQUENCE_DEMO.completed=true;report.tests.SEQUENCE_DEMO.renderStats=renderStats();status('Sequência de 20 s concluída com foto. Movimento no celular ainda precisa ser avaliado.');
 }catch(e){report.errors.push({stage:'sequence-demo',message:e.message});status('Falha: '+e.message)}
 finally{demoRunning=false;clearWalk();runner?.close();proof?.dispose();$('#view').classList.remove('live');if(renderer){renderer.setSize(720,460);camera.aspect=720/460;camera.updateProjectionMatrix();model.position.set(0,0,0);model.scale.setScalar(1);model.rotation.set(0,0,0)}$('#sequenceTest').disabled=false;$('#live').disabled=false;output()}
};

function renderStats(){return {sampleFrames:renderTimes.length,averageFps:renderTimes.length?1000/(renderTimes.reduce((a,b)=>a+b,0)/renderTimes.length):null,maxFrameMs:renderTimes.length?Math.max(...renderTimes):null,targetFps:30}}
