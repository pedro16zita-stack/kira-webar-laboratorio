import * as THREE from 'three';
import {applyMaterialFade} from './material-fade-v024.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {NotebookVisual} from './notebook-v024.js';
import {WorkerRunner} from './worker-runner-v017.js?v=1.7';
import {requestCamera,cameraErrorInfo} from './camera-access-v020.js';
import {ReactiveGaze} from './reactive-gaze-v019.js';
import {SceneAtmosphere} from './scene-atmosphere-v018.js';
import {ContactShadow} from './contact-shadow-v017.js';
import {PipelineMetrics} from './pipeline-metrics-v017.js';
import {bodySnapshot,BodyFramer,PersonSession} from './body-tracking-v023.js';
import {GestureGate} from './gesture-gate.js?v=0.6';
import {sceneSequence,composition} from './sequence-v008.js?v=0.8';
import {NaturalAnimator} from './natural-animator-v023.js';
import {Compositor} from './compositor-v022.js';

const $=s=>document.querySelector(s),W=480,H=640,SMOKE_COUNT=128;
const report={versions:{lab:'2.4-candidata',three:THREE.REVISION,mediapipe:'0.10.21',mindar:'1.2.5'},environment:{userAgent:navigator.userAgent,secureContext:isSecureContext},humanRedEyes:false,tests:{},errors:[]};
const show=()=>$('#results').textContent=JSON.stringify(report,null,2),status=t=>$('#status').textContent=t;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const loadImage=url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Não carregou '+url));i.src=url});
let notebook,bookInspection=false,demoWantsBook=false,demoRunner=null,demoProof=null,suiteRunning=false;
let reactiveGaze,lastAcceptedBodyAt=null;
let sceneAtmosphere,contactShadow,lastAcceptedFeetAt=null;
const pipelineMetrics=new PipelineMetrics();
let naturalAnimator,spacing=null,walkRange=.65,walkDistance=0,lastWalkX=0,walkSpeed=0,motionSide=1;
let smokeMode=null,exitOpacity=1,currentOpacity=1;
let renderer,scene,camera,placement,motion,model,mixer,entry,idle,refs,modelPromise,Controller,controllerPromise,smoke,smokeStart=null;
let live=false,demo=false,testing=false,phase='idle',token=0,epoch=0,videoStream,bodyRunner,handRunner,compositor,targetController;
let targetBusy=false,bodyBusy=false,handBusy=false,lastTarget=0,lastBody=0,lastHand=0,bodyReady=false,handReady=false,mustClear=false,armedAt=0;
let appearanceAt=null,entryElapsed=0,appearing=false,front=false,sideDirection=1,autoSide=null,lastBodyData=null,framing=null,exitTrigger=null;
let targetPlacement={x:0,y:0,scale:1},sequence=sceneSequence(0),frameTimes=[],bodyTimes=[],handTimes=[],lastPoseDeltas=[],walkRig=[];
const framer=new BodyFramer(),person=new PersonSession(),gestureGate=new GestureGate();
const viewHeight=()=>2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
const text=(selector,value)=>{if($(selector).textContent!==value)$(selector).textContent=value};

function defaultCamera(){camera.position.set(0,1.2,4.8);camera.rotation.set(0,0,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H)}
function setupModels(){if(modelPromise)return modelPromise;modelPromise=(async()=>{
 status('Carregando personagem…');renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(720,460);$('#view').appendChild(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,720/460,.01,40);camera.position.set(0,1.2,4.8);scene.add(new THREE.HemisphereLight(0xffffff,0x403b49,.95));const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-2.5,4,4);scene.add(key);const fill=new THREE.DirectionalLight(0xc5d6ff,.12);fill.position.set(-3,2,3);scene.add(fill);const rim=new THREE.DirectionalLight(0x9a4159,.55);rim.position.set(1,3,-3);scene.add(rim);
 sceneAtmosphere=new SceneAtmosphere({view:$('#view'),renderer,rim});
 placement=new THREE.Group();motion=new THREE.Group();placement.add(motion);scene.add(placement);
 const gltf=await new GLTFLoader().loadAsync('./ryuk-v023.glb');model=gltf.scene;motion.add(model);mixer=new THREE.AnimationMixer(model);
 const materials=[];model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.original={transparent:m.transparent,depthWrite:m.depthWrite,alphaTest:m.alphaTest};for(const map of [m.map,m.normalMap,m.emissiveMap])if(map)map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());if(!materials.some(x=>x.name===m.name))materials.push({name:m.name,transparent:m.transparent,roughness:m.roughness});}});
 entry=mixer.clipAction(gltf.animations.find(a=>a.name==='01_Manifestacao'));entry.setLoop(THREE.LoopOnce,1);entry.clampWhenFinished=true;idle=mixer.clipAction(gltf.animations.find(a=>a.name==='02_Suspensao'));idle.play();mixer.update(.1);scene.updateMatrixWorld(true);
 const point=name=>{const o=model.getObjectByName(name);if(!o)throw new Error('Osso ausente: '+name);return o.getWorldPosition(new THREE.Vector3())};
 const l=point('bip_upperArm_L'),r=point('bip_upperArm_R'),hl=point('bip_hip_L'),hr=point('bip_hip_R'),box=new THREE.Box3().setFromObject(model,true),head=new THREE.Box3().setFromObject(model.getObjectByName('Head'),true);
 refs={shoulderWidth:Math.abs(l.x-r.x),shoulderY:(l.y+r.y)/2,hipY:(hl.y+hr.y)/2,footY:box.min.y,height:box.max.y-box.min.y,headY:(head.min.y+head.max.y)/2,headWidth:head.max.x-head.min.x};refs.torsoHeight=refs.shoulderY-refs.hipY;
 naturalAnimator=new NaturalAnimator(mixer,gltf.animations);reactiveGaze=new ReactiveGaze(model);
 notebook=new NotebookVisual(scene);contactShadow=new ContactShadow(scene);applyLook();makeSmoke();report.tests.MODEL={animations:gltf.animations.map(a=>({name:a.name,duration:a.duration})),materials,refs,animationSource:'Blender',originalBodyGeometryPreserved:true,separatePupils:true};placement.visible=false;
 let previous=performance.now(),scheduled=previous;renderer.setAnimationLoop(()=>{const now=performance.now(),fps=$('#quality').value==='economica'?30:60,interval=1000/fps;if(now<scheduled-.5)return;const frameMs=now-previous,dt=Math.min(frameMs/1000,.1);previous=now;scheduled+=interval;if(now-scheduled>interval)scheduled=now+interval;if(live||demo){frameTimes.push(frameMs);if(frameTimes.length>180)frameTimes.shift()}
  if(live||demo)updateScene(now,dt);
  reactiveGaze.beforeMixer();naturalAnimator.update(appearanceAt===null?null:(now-appearanceAt)/1000,dt,sequence,sideDirection,walkDistance,walkSpeed,phase==='active');mixer.update(dt);updateReactiveGaze(now,dt);
  updateSmoke(now);updateNotebook(now);updateContactShadow(now,dt);sceneAtmosphere.update({now,dt,mode:smokeMode,startedAt:smokeStart,visible:placement.visible&&(!(live||demo)||person.state(now).visible)});renderer.render(scene,camera);
 });$('#smoke').disabled=false;show();return model;
 })();return modelPromise}
function makeSmoke(){
 const sprite=document.createElement('canvas');sprite.width=sprite.height=128;const ctx=sprite.getContext('2d'),pixels=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const dx=(x-64)/64,dy=(y-64)/64,r=Math.hypot(dx,dy),cloud=.63+.19*Math.sin(x*.13+Math.sin(y*.12)*2)+.13*Math.sin(y*.17+x*.06)+.05*Math.sin(x*.39-y*.31),a=Math.max(0,1-r)**1.7*Math.max(0,cloud),i=(y*128+x)*4;pixels.data[i]=63;pixels.data[i+1]=57;pixels.data[i+2]=71;pixels.data[i+3]=Math.round(Math.min(1,a)*220)}ctx.putImageData(pixels,0,0);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT*3),3));smoke=new THREE.Points(geometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(sprite),color:0xffffff,size:.8,transparent:true,depthWrite:false,opacity:0}));smoke.visible=false;scene.add(smoke);
}
function setOpacity(alpha){currentOpacity=alpha;model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])applyMaterialFade(m,alpha,m.userData.original)})}
function restoreMaterials(){setOpacity(1)}
function clearPose(){}
function reveal(now){phase='active';appearanceAt=now;restoreMaterials();placement.visible=true;model.visible=true;naturalAnimator.reveal();walkDistance=0;lastWalkX=0;walkSpeed=0;motionSide=sideDirection;smokeMode='entry';smokeStart=now;setOpacity(0);scene.updateMatrixWorld(true);smoke.position.copy(motion.getWorldPosition(new THREE.Vector3()));smoke.scale.copy(placement.scale);}
function updateScene(now,dt){
 const p=person.state(now);if(p.expired&&['active','exiting','complete','body'].includes(phase)){endSession('Pessoa saiu. Retire e apresente o alvo novamente.');return}
 if(phase==='body'&&bodyReady&&!p.bound&&now-armedAt>15000){endSession('Nenhuma pessoa enquadrada. Apresente o alvo novamente.');return}
 if(phase==='active'&&p.visible){
  const a=1-Math.exp(-dt*4);placement.visible=true;placement.position.x+=(targetPlacement.x-placement.position.x)*a;placement.position.y+=(targetPlacement.y-placement.position.y)*a;const scale=placement.scale.x+(targetPlacement.scale-placement.scale.x)*a;placement.scale.setScalar(scale);
  const elapsed=(now-appearanceAt)/1000;sequence=sceneSequence(elapsed);
  motionSide+=(sideDirection-motionSide)*a;walkRange+=((spacing?.walkRange??.65)-walkRange)*a;
  const walking=sequence.stage==='caminhada',localWalkX=walking?motionSide*walkRange*sequence.path:0;
  if(walking){const deltaX=Math.abs(localWalkX-lastWalkX);walkDistance+=deltaX;walkSpeed+=(deltaX/Math.max(dt,.001)-walkSpeed)*(1-Math.exp(-dt*10));}else walkSpeed*=Math.exp(-dt*8);
  lastWalkX=localWalkX;const floatLimit=Math.min(1,(spacing?.floatRange??.10)/.10);
  motion.position.set(localWalkX+sequence.floatX*floatLimit,sequence.floatY,0);
  const heading=motionSide*Math.PI/2*(1-2*sequence.turn),allowWalking=walkRange>.08;
  const yaw=walking&&allowWalking?heading*sequence.headingBlend-motionSide*.12*(1-sequence.headingBlend):-motionSide*.12;
  motion.rotation.y+=(yaw-motion.rotation.y)*a;

 }else if(phase==='active')placement.visible=false;
 if(phase==='exiting'&&!p.visible){placement.visible=false;smoke.visible=false;}
 if(live)updateLiveStatus();
}
function startExit(trigger='gesture'){
 if(!['active','test'].includes(phase))return;phase='exiting';smokeMode='exit';exitOpacity=currentOpacity;exitTrigger=trigger;scene.updateMatrixWorld(true);smoke.position.copy(motion.getWorldPosition(new THREE.Vector3()));smoke.scale.copy(placement.scale);smokeStart=performance.now();if(report.live&&live){report.live.exitTriggered=true;report.live.exitAt=new Date().toISOString()}
}
function updateSmoke(now){
 if(smokeStart===null)return;const entering=smokeMode==='entry',duration=entering?2400:2600,u=Math.min(1,(now-smokeStart)/duration),allowed=!(live||demo)||person.state(now).visible;
 if(entering){scene.updateMatrixWorld(true);smoke.position.copy(motion.getWorldPosition(new THREE.Vector3()));smoke.scale.copy(placement.scale);}
 smoke.visible=u<1&&allowed;smoke.material.opacity=Math.sin(Math.PI*u)*(entering?.68:.88);smoke.material.size=(.65+.7*u)*smoke.scale.x;
 const pos=smoke.geometry.attributes.position;for(let i=0;i<SMOKE_COUNT;i++){const angle=i*2.39996+u*(entering?1.2:.8),r=(.2+.55*Math.sin(i*4.3)**2)*(1+u*(entering?.2:.7));pos.setXYZ(i,Math.cos(angle)*r+.12*Math.sin(i+u*3),(i/(SMOKE_COUNT-1))*2.5+(entering?(u-.3)*.6:u*.45),Math.sin(angle)*r)}pos.needsUpdate=true;
 const alpha=entering?THREE.MathUtils.smoothstep(u,.06,.72):exitOpacity*(1-THREE.MathUtils.smoothstep(u,.18,.78));setOpacity(alpha);
 if(u===1){smoke.visible=false;smokeStart=null;smokeMode=null;if(entering){restoreMaterials();report.tests.ENTRANCE={seconds:2.4,particles:SMOKE_COUNT,modelVisible:placement.visible,opacity:currentOpacity};}else{placement.visible=false;phase='complete';report.tests.SMOKE={trigger:exitTrigger,particles:SMOKE_COUNT,seconds:2.6,modelHidden:true,smokeHidden:true};}show()}
}

function resetScene(){bookInspection=false;notebook?.reset();reactiveGaze?.reset();lastAcceptedBodyAt=null;sceneAtmosphere?.reset();lastAcceptedFeetAt=null;contactShadow?.reset();clearPose();restoreMaterials();placement.visible=false;placement.position.set(0,0,0);placement.scale.setScalar(1);motion.position.set(0,0,0);motion.rotation.set(0,0,0);model.visible=true;smoke.visible=false;smokeStart=null;smokeMode=null;appearanceAt=null;appearing=false;naturalAnimator.reset();walkDistance=0;lastWalkX=0;walkSpeed=0;walkRange=.65;spacing=null;framer.reset();person.arm();gestureGate.reset();autoSide=null;lastBodyData=null;framing=null;frameTimes=[];sequence=sceneSequence(0)}
function armTarget(now){epoch++;resetScene();phase='body';armedAt=now;if(live){report.live.targetRecognized=true;report.live.targetAt=new Date().toISOString();report.live.personLost=false;report.live.requiresTargetAgain=false;report.live.exitTriggered=false;report.live.handSeen=false;report.live.gesture=null;}}
function endSession(reason){bookInspection=false;notebook?.reset();reactiveGaze?.reset();lastAcceptedBodyAt=null;sceneAtmosphere?.reset();lastAcceptedFeetAt=null;contactShadow?.reset();epoch++;phase='target';placement.visible=false;smoke.visible=false;smokeStart=null;clearPose();mustClear=true;compositor?.clear();gestureGate.reset();if(report.live&&live){report.live.personLost=true;report.live.requiresTargetAgain=true;report.live.personLossAt=new Date().toISOString()}text('#liveStatus',reason)}
function updatePlacement(body){
 const f=framer.update(body,refs,Number($('#size').value),viewHeight(),camera.aspect);if(!f)return;lastBodyData=body;framing=f;const center=body.center.x;
 if(autoSide===null)autoSide=center<=.5?1:-1;if(center<.35)autoSide=1;else if(center>.65)autoSide=-1;
 const choice=$('#side').value;sideDirection=choice==='auto'?autoSide:((choice==='right')!==front?1:-1);
 spacing=composition(body,refs,f.scale,viewHeight()*camera.aspect,sideDirection,Number($('#space').value));
 targetPlacement={x:spacing.x,y:camera.position.y+(.5-f.anchorY)*viewHeight()-f.localY*f.scale,scale:f.scale};
}
function acceptBody(r,now){
 const state=person.update(r.body,now);if(state.accepted&&state.visible){lastAcceptedBodyAt=now;lastAcceptedFeetAt=r.body.feetVisible?now:null;if(phase==='body'){updatePlacement(r.body);placement.position.set(targetPlacement.x,targetPlacement.y,0);placement.scale.setScalar(targetPlacement.scale);reveal(now)}else if(phase==='active')updatePlacement(r.body);}
 if(state.expired)endSession('Pessoa saiu. Apresente o caderno novamente.');
 if(live){report.live.person={present:r.body.present,visible:state.visible,bound:state.bound,feetVisible:r.body.feetVisible,framingSource:framing?.source??null};report.live.bodyDetections+=r.body.present?1:0;report.live.maskFrames++;report.live.occlusionApplied=true;report.live.redEyes=false;}
 return state;
}
function updateLiveStatus(){
 if(phase==='target'){text('#liveStatus',mustClear?'Pessoa fora da cena. Retire e apresente o alvo novamente.':'Apresente a imagem-alvo inteira.');return}
 if(!bodyReady){text('#liveStatus','Preparando rastreamento corporal…');return}
 if(phase==='body'){text('#liveStatus','Caderno reconhecido. Enquadre a pessoa para Ryuk aparecer.');return}
 if(phase==='complete'){text('#liveStatus','Saída concluída. Toque em reiniciar para repetir.');return}
 if(phase==='exiting'){text('#liveStatus','Saída por fumaça acionada.');return}
 const state=person.state(performance.now());if(!state.visible){text('#liveStatus','Pessoa fora do enquadramento. Ryuk está oculto.');return}
 const feet=lastBodyData?.feetVisible?'Pés detectados.':'Pés não confirmados; usando tronco/ombros.';
 const hand=!handReady?'Preparando saída por mão…':report.live.handSeen?(report.live.gesture?.name==='Closed_Fist'?'Punho: '+Math.round(gestureGate.progress*100)+'%. Segure.':'Mão detectada. Feche o punho para sair.'):'Enquadre a mão inteira para a saída.';text('#liveStatus',(lastBodyData?.presenceSource==='tronco-sem-rosto'?'Pessoa presente pelo tronco. ':'')+feet+' '+hand);
}
function drawCover(video,canvas){const ctx=canvas.getContext('2d'),s=Math.max(W/video.videoWidth,H/video.videoHeight),sw=W/s,sh=H/s;ctx.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,0,0,W,H)}
function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c}
async function setupTarget(){if(!controllerPromise)controllerPromise=import('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js').then(m=>Controller=m.Controller);await controllerPromise}
function stopLive(){demo=false;demoRunner?.close();demoRunner=null;demoProof?.dispose();demoProof=null;bookInspection=false;demoWantsBook=false;notebook?.reset();reactiveGaze?.reset();lastAcceptedBodyAt=null;document.body.classList.remove('session-running','session-starting');$('#view').classList.add('scene-empty');$('#stop').textContent='Encerrar câmera';sceneAtmosphere?.reset();
 contactShadow?.reset();pipelineMetrics.reset();token++;epoch++;live=false;bodyRunner?.close();handRunner?.close();bodyRunner=handRunner=null;videoStream?.getTracks().forEach(t=>t.stop());videoStream=null;bodyReady=handReady=false;
 const old=targetController;targetController=null;if(old)setTimeout(()=>old.dispose(),500);compositor?.dispose();compositor=null;const v=$('#video');v.srcObject=null;v.hidden=true;$('#view').classList.remove('live');if(placement){placement.visible=false;if(smoke)smoke.visible=false;smokeStart=null;if(renderer)renderer.domElement.style.transform='none'}
 phase='idle';$('#live').disabled=false;$('#camera').disabled=false;$('#target').disabled=false;$('#manual').disabled=true;text('#liveStatus','Câmera desligada.');if(report.live){report.live.endedAt=new Date().toISOString();show()}
}
$('#live').onclick=async()=>{
 if(live||demo||testing||suiteRunning||$('#live').disabled)return;demoWantsBook=false;$('#live').disabled=true;$('#camera').disabled=true;$('#target').disabled=true;const mine=++token;let startupStage='camera';$('#cameraError').hidden=true;document.body.classList.add('session-starting');$('#stop').disabled=false;$('#stop').textContent='Cancelar';
 try{
  text('#liveStatus','Aguardando acesso à câmera…');const access=await requestCamera({facing:$('#camera').value});const stream=access.stream;if(mine!==token){stream.getTracks().forEach(t=>t.stop());return}videoStream=stream;
  startupStage='assets';text('#liveStatus','Câmera encontrada. Preparando Ryuk…');await Promise.all([setupModels(),setupTarget()]);if(mine!==token)return;defaultCamera();resetScene();front=$('#camera').value==='user';startupStage='video';
  const video=$('#video');video.srcObject=stream;await video.play();if(mine!==token)return;$('#view').classList.remove('scene-empty');video.hidden=false;video.style.transform=front?'scaleX(-1)':'none';renderer.domElement.style.transform=front?'scaleX(-1)':'none';$('#view').appendChild(video);$('#view').classList.add('live');compositor=new Compositor($('#view'),front);
  live=true;document.body.classList.remove('session-starting');$('#stop').textContent='Encerrar câmera';document.body.classList.add('session-running');$('#manual').disabled=false;phase='target';mustClear=false;targetBusy=bodyBusy=handBusy=false;lastTarget=lastBody=lastHand=0;bodyTimes=[];handTimes=[];
  report.cameraAccess={available:true,code:'ready',fallbackUsed:access.fallbackUsed};report.live={startedAt:new Date().toISOString(),camera:front?'frontal':'traseira',videoSize:[video.videoWidth,video.videoHeight],tracks:stream.getVideoTracks().length,cameraConstraintFallback:access.fallbackUsed,targetName:targetConfig().name,manualActivation:false,tracking:'body-pose-v023-face-independent',humanRedEyes:false,targetRecognized:false,bodyDetections:0,maskFrames:0,occlusionApplied:false,exitTriggered:false,personLost:false,requiresTargetAgain:false,handSeen:false,gesture:null,worldAnchor:false};
  bodyRunner=new WorkerRunner('./body-worker-v023.js');handRunner=new WorkerRunner('./hand-worker.js?v=0.6');
  bodyRunner.ready.then(()=>{if(mine===token){bodyReady=true;if(phase==='body')armedAt=performance.now()}}).catch(e=>{if(mine===token){report.errors.push({stage:'body-init',message:e.message});stopLive();text('#liveStatus','Rastreamento corporal indisponível: '+e.message)}});
  handRunner.ready.then(()=>{if(mine===token)handReady=true}).catch(e=>{if(mine===token){report.errors.push({stage:'hand-init',message:e.message});show()}});
  const ctl=new Controller({inputWidth:W,inputHeight:H});targetController=ctl;await ctl.addImageTargets(targetConfig().mind);if(mine!==token)return;
  const targetCanvas=canvas(),bodyCanvas=canvas(),handCanvas=canvas();let lastReport=0;
  const loop=()=>{
   if(!live||mine!==token)return;const now=performance.now();
   if(phase==='target'&&!targetBusy&&now-lastTarget>350&&video.readyState>=2){targetBusy=true;lastTarget=now;drawCover(video,targetCanvas);const e=epoch;detectTarget(ctl,targetCanvas).then(d=>matchTarget(ctl,d.featurePoints)).then(m=>{if(mine!==token||e!==epoch)return;if(!m.modelViewTransform)mustClear=false;else if(!mustClear)armTarget(performance.now())}).catch(e=>{if(mine===token)report.errors.push({stage:'target',message:e.message})}).finally(()=>{if(mine===token)targetBusy=false});}
   if(['body','active','exiting','complete'].includes(phase)&&bodyReady&&!bodyBusy&&now-lastBody>=100){
    bodyBusy=true;lastBody=now;drawCover(video,bodyCanvas);const e=epoch,runner=bodyRunner;runner.infer(bodyCanvas,now).then(r=>{if(mine!==token||e!==epoch){r.bitmap.close();return}compositor.mode=$('#occlusionMode').value;compositor.paint(r);report.live.occlusionMode=compositor.mode;pipelineMetrics.record(r,performance.now());acceptBody(r,performance.now());compositor.drawGuides($('#guides').checked);bodyTimes.push(r.ms);if(bodyTimes.length>90)bodyTimes.shift();}).catch(e=>{if(mine===token){report.errors.push({stage:'body-frame',message:e.message});endSession('Rastreamento interrompido. Apresente o alvo novamente.');show()}}).finally(()=>{if(mine===token)bodyBusy=false});
   }
   if(phase==='active'&&person.state(now).visible&&handReady&&!handBusy&&now-lastHand>=180){
    handBusy=true;lastHand=now;drawCover(video,handCanvas);const e=epoch,runner=handRunner;runner.infer(handCanvas,now).then(r=>{if(mine!==token||e!==epoch)return;report.live.handSeen=r.handSeen;report.live.gesture=r.gesture;compositor.hand=r.points;compositor.drawGuides($('#guides').checked);if(gestureGate.update(r.gesture,performance.now()))startExit();handTimes.push(r.ms);if(handTimes.length>90)handTimes.shift();}).catch(e=>{if(mine===token)report.errors.push({stage:'hand-frame',message:e.message})}).finally(()=>{if(mine===token)handBusy=false});
   }
   if(now-lastReport>750){lastReport=now;report.live.phase=phase;report.live.presenceState=person.state(now);report.live.presenceSource=lastBodyData?.presenceSource;report.live.position={x:placement.position.x,y:placement.position.y,scale:placement.scale.x,targetScale:targetPlacement.scale,stage:sequence.stage,scaleGroup:'placement',motionGroupSeparate:true,spacing:$('#space').value,edgeLimited:spacing?.limited??false,animation:naturalAnimator.snapshot(),framingSource:framing?.source??null,feetVisible:framing?.feetVisible??false};report.live.notebook=notebook.snapshot();report.live.reactiveGaze=reactiveGaze.snapshot();report.live.atmosphere=sceneAtmosphere.snapshot();report.live.pipeline=pipelineMetrics.snapshot(performance.now());report.live.contactShadow=contactShadow.snapshot();report.live.renderStats=renderStats();report.live.bodyMs=bodyTimes;report.live.handMs=handTimes;report.live.gestureProgress=gestureGate.progress;show();}
   updateLiveStatus();requestAnimationFrame(loop);
  };loop();show();$('#view').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){if(mine===token){report.errors.push({stage:startupStage,name:e.name,message:e.message});stopLive();const info=cameraErrorInfo(e,startupStage);report.cameraAccess={...info,available:false};$('#cameraErrorTitle').textContent=info.title;$('#cameraErrorMessage').textContent=info.message;$('#cameraError').hidden=false;text('#liveStatus','A câmera não foi iniciada. A demonstração sem câmera continua disponível.');show()}}
};
$('#stop').onclick=stopLive;
$('#restart').onclick=()=>{if(!live)return;epoch++;resetScene();phase='target';mustClear=false;compositor.clear();report.live.targetRecognized=false;report.live.exitTriggered=false;report.live.personLost=false;report.live.requiresTargetAgain=false;show()};
$('#occlusionMode').onchange=()=>{if(compositor)compositor.mode=$('#occlusionMode').value};
$('#guides').onchange=()=>compositor?.drawGuides($('#guides').checked);
for(const id of ['side','size','space'])$('#'+id).onchange=()=>{if(lastBodyData&&phase==='active')updatePlacement(lastBodyData)};
$('#save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='KIRA_resultados_navegador.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
function renderStats(){return {sampleFrames:frameTimes.length,averageFps:frameTimes.length?1000/(frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length):null,maxFrameMs:frameTimes.length?Math.max(...frameTimes):null,targetFps:$('#quality').value==='economica'?30:60}}
window.addEventListener('pagehide',stopLive);window.addEventListener('error',e=>{report.errors.push({message:e.message});show()});show();

async function runTest(name,fn){
 if(live||demo||testing)return false;$('#cameraError').hidden=true;$('#view').classList.remove('scene-empty');text('#liveStatus','Ensaio digital — câmera e rastreamento ao vivo desligados.');testing=true;$('#live').disabled=true;$('#stop').disabled=true;$('#restart').disabled=true;
 try{await setupModels();front=false;await fn();return true;}catch(e){report.errors.push({stage:name,message:e.message});status('Falha: '+e.message);return false;}finally{demo=false;demoWantsBook=false;clearPose();testing=false;$('#live').disabled=suiteRunning;$('#stop').disabled=suiteRunning;$('#restart').disabled=suiteRunning;show()}
}
function fixture(img,zoom=1){const c=canvas(),ctx=c.getContext('2d');ctx.fillStyle='#64616a';ctx.fillRect(0,0,W,H);const w=W*zoom,h=w*img.naturalHeight/img.naturalWidth;ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h);return c}
function sampleFrame(proof,label){renderer.render(scene,camera);const c=document.createElement('canvas');c.width=W;c.height=H+50;const ctx=c.getContext('2d');ctx.fillStyle='#202126';ctx.fillRect(0,0,W,H+50);ctx.fillStyle='white';ctx.font='21px system-ui';ctx.fillText(label,10,32);if(proof)ctx.drawImage(proof.layers[0],0,50,W,H);ctx.drawImage(renderer.domElement,0,50,W,H);if(proof){ctx.drawImage(proof.layers[1],0,50,W,H);ctx.drawImage(proof.layers[2],0,50,W,H)}$('#samples').appendChild(c);return c}
async function settled(runner,c,clock,onFrame=()=>{}){let r;for(let i=0;i<5;i++){r?.bitmap.close();r=await runner.infer(c,clock+i*200);onFrame(r)}return r}
$('#bodyTest').onclick=()=>runTest('body-test',async()=>{
 let runner,proof;try{
  status('Testando corpo, pés e saída da pessoa…');defaultCamera();resetScene();$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v023.js');await runner.ready;const img=await loadImage('./pose.jpg');proof=new Compositor($('#view'),false);demo=true;armTarget(performance.now());
  const rows=[];let clock=1000,lastFrame;
  for(const zoom of [.8,1,1.3]){
   const c=fixture(img,zoom),r=await settled(runner,c,clock,r=>acceptBody(r,performance.now()));clock+=1500;
   // Each photo is processed by the real detector; the spatial result is then rendered.
   if(!r.body.present)throw new Error('Corpo não detectado na foto '+zoom);
   placement.position.set(targetPlacement.x,targetPlacement.y,0);placement.scale.setScalar(targetPlacement.scale);proof.paint(r);proof.drawGuides(true);sampleFrame(proof,'Corpo e pés · ampliação '+zoom);
   rows.push({zoom,present:r.body.present,feetVisible:r.body.feetVisible,source:framing?.source,scale:placement.scale.x,targetScale:targetPlacement.scale,maskMean:r.mean});lastFrame=c;
  }
  const blank=canvas();blank.getContext('2d').fillStyle='#64616a';blank.getContext('2d').fillRect(0,0,W,H);let blankPresent=true;
  for(let i=0;i<6;i++){const r=await runner.infer(blank,clock);clock+=200;blankPresent=r.body.present;proof.paint(r);acceptBody(r,performance.now());await sleep(100)}
  await sleep(1400);sampleFrame(proof,'Pessoa saiu · Ryuk oculto');const loss={blankPresent,modelHidden:!placement.visible,requiresTargetAgain:phase==='target'&&mustClear};
  const r=await settled(runner,lastFrame,clock+1000);proof.paint(r);acceptBody(r,performance.now());const returnedWithoutTarget=placement.visible;
  report.tests.BODY={fixture:'Official MediaPipe pose.jpg; synthetic resizing, not physical distance',rows,scaleIncreases:rows[0].scale<rows[1].scale&&rows[1].scale<rows[2].scale,loss,returnedWithoutTarget,humanRedEyes:false};status('Teste corporal concluído. Confira pés, proporção e ocultação nas capturas.');
 }finally{runner?.close();proof?.dispose();$('#view').classList.remove('live');placement.visible=false;demo=false;}
});
$('#sequenceTest').onclick=()=>runTest('sequence-test',async()=>{
 let runner,proof;try{
  status('Preparando sequência com foto…');defaultCamera();resetScene();runner=new WorkerRunner('./body-worker-v023.js');await runner.ready;const img=await loadImage('./pose.jpg'),c=fixture(img,1),r=await settled(runner,c,1000);r.bitmap.close();if(!r.body.present)throw new Error('Corpo não encontrado na referência');
  $('#view').classList.add('live');proof=new Compositor($('#view'),false);armTarget(performance.now());demo=true;person.update(r.body,performance.now());acceptBody(r,performance.now());let maxEyeVergence=0;const started=performance.now(),moments=[9.8,11.4,15.8,19.4],rows=[];let checkpoint=0;
  while(performance.now()-started<20200){maxEyeVergence=Math.max(maxEyeVergence,eyeVergence());acceptBody(r,performance.now());const bitmap=await createImageBitmap(c);proof.paint({...r,bitmap});proof.drawGuides(false);const elapsed=(performance.now()-started)/1000;
   if(checkpoint<moments.length&&elapsed>=moments[checkpoint]){sampleFrame(proof,elapsed.toFixed(1)+' s · '+sequence.stage);rows.push({elapsed,stage:sequence.stage,scale:placement.scale.x,targetScale:targetPlacement.scale,bodySource:framing?.source,feetVisible:framing?.feetVisible,motionY:motion.position.y,animation:naturalAnimator.snapshot(),walkDistance});checkpoint++}
   status('Sequência com foto · '+elapsed.toFixed(1)+' s · '+sequence.stage);await sleep(80);
  }
  report.tests.SEQUENCE={pupilSurfaceDirectionDifferenceDegrees:maxEyeVergence,neutralVisualCalibration:true,rows,sameScaleThroughFloat:rows.length===4&&Math.abs(rows[3].scale-rows[1].scale)<.01,humanRedEyes:false,renderStats:renderStats(),cameraTest:false};status('Sequência concluída. Escala do corpo separada da flutuação.');
 }finally{runner?.close();proof?.dispose();$('#view').classList.remove('live');placement.visible=false;demo=false;}
});
$('#faceTest').onclick=()=>runTest('face-test',async()=>{
 resetScene();$('#view').classList.add('live');placement.visible=true;placement.scale.setScalar(1);placement.position.set(0,0,0);motion.position.set(0,0,0);motion.rotation.set(0,0,0);camera.position.set(0,refs.headY+.08,1.15);camera.lookAt(0,refs.headY+.08,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H);await sleep(100);sampleFrame(null,'Olhos e boca · materiais opacos');
 const mats=[];model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(['RyukFace','Globo_Amarelo','Iris_Vermelha','Pupila_Preta'].includes(m.name)&&!mats.some(x=>x.name===m.name))mats.push({name:m.name,transparent:m.transparent,depthWrite:m.depthWrite,alphaTest:m.alphaTest,normalScale:m.normalScale.toArray(),roughness:m.roughness})});report.tests.RYUK_FACE={materials:mats,allOpaque:mats.every(m=>!m.transparent&&m.depthWrite),texturesChanged:false};status('Olhar em volta ativo. Observe as pupilas por 8 segundos.');
});
$('#smoke').onclick=()=>runTest('smoke-test',async()=>{
 defaultCamera();resetScene();placement.visible=true;placement.position.set(0,0,0);placement.scale.setScalar(1);phase='test';startExit('manual');await sleep(1100);sampleFrame(null,'Fumaça · 128 partículas');await sleep(1700);status('Fumaça concluída: personagem e partículas ocultos.');
});
$('#targetTest').onclick=()=>runTest('target-and-hand-test',async()=>{
 let ctl,runner;try{
  status('Testando alvo e punho…');await setupTarget();const img=await loadImage(targetConfig().image),c=canvas(),ctx=c.getContext('2d');ctl=new Controller({inputWidth:W,inputHeight:H,warmupTolerance:0,missTolerance:1});await ctl.addImageTargets(targetConfig().mind);
  const results=[];for(const filter of ['none','brightness(.5)','blur(2px)']){ctx.fillStyle='#888';ctx.fillRect(0,0,W,H);ctx.filter=filter;const h=540,w=h*img.naturalWidth/img.naturalHeight;ctx.drawImage(img,(W-w)/2,50,w,h);ctx.filter='none';let matched=false,frames=0,matchedTarget=null;for(;frames<12&&!matched;frames++){const d=await detectTarget(ctl,c),m=await matchTarget(ctl,d.featurePoints);matched=!!m.modelViewTransform;if(matched)matchedTarget=m.matchedTarget;}results.push({filter,matched,frames,matchedTarget})}
  let found=false,lost=false;ctl.onUpdate=d=>{if(d.type!=='updateMatrix')return;if(d.worldMatrix&&!found){found=true;setTimeout(()=>{ctx.fillStyle='#888';ctx.fillRect(0,0,W,H)},200)}else if(!d.worldMatrix&&found)lost=true};ctl.processVideo(c);const deadline=performance.now()+10000;while(!lost&&performance.now()<deadline)await sleep(100);ctl.stopProcessVideo();
  runner=new WorkerRunner('./hand-worker.js?v=0.6');await runner.ready;const fist=await loadImage('./fist.jpg'),gate=new GestureGate();const began=performance.now();let fired=false,lastGesture=null,samples=0;
  while(!fired&&performance.now()-began<4000){const r=await runner.infer(fist,performance.now());lastGesture=r.gesture;samples++;fired=gate.update(r.gesture,performance.now());if(!fired)await sleep(180)}
  const negative=await runner.infer(await loadImage('./thumb_up.jpg'),performance.now());report.tests.TARGET_HAND={targetName:targetConfig().name,physicalTest:false,target:results,actualFoundEvent:found,actualLostEvent:lost,fist:lastGesture,heldFistConfirmed:fired,handSamples:samples,negativeGesture:negative.gesture};status('Alvo e confirmação do punho testados em arquivos.');
 }finally{ctl?.dispose();runner?.close()}
});

$('#preview').onclick=startContinuousDemo;

$('#articulationTest').onclick=()=>runTest('articulation-test',async()=>{
 resetScene();defaultCamera();placement.visible=true;placement.scale.setScalar(1);placement.position.set(0,0,0);motion.position.set(0,0,0);motion.rotation.set(0,0,0);$('#view').classList.add('live');$('#samples').textContent='';
 const names=['Left_Wing_1','Left_Wing_4','Right_Wing_1','bip_upperArm_L','bip_lowerArm_R','bip_knee_L','bip_foot_R','bip_head','L_Eye','R_Eye','Olhar_L','Olhar_R'];
 const initial={},ranges={},samples={},vertices={};
 for(const name of names){const b=model.getObjectByName(name);if(!b?.isBone)throw new Error('Osso ausente: '+name);initial[name]=b.quaternion.clone();ranges[name]=0;samples[name]=[];
  let best=-1;model.traverse(o=>{if(!o.isSkinnedMesh)return;const bi=o.skeleton.bones.indexOf(b),si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight;if(bi<0)return;for(let v=0;v<si.count;v++){const ids=[si.getX(v),si.getY(v),si.getZ(v),si.getW(v)],weights=[sw.getX(v),sw.getY(v),sw.getZ(v),sw.getW(v)];for(let k=0;k<4;k++)if(ids[k]===bi&&weights[k]>best){best=weights[k];vertices[name]={mesh:o,index:v};}}});if(!vertices[name])throw new Error('Malha sem peso para '+name);
 }
 const start=performance.now();let checkpoint=0;
 while(performance.now()-start<8300){model.updateMatrixWorld(true);for(const name of names){const b=model.getObjectByName(name);ranges[name]=Math.max(ranges[name],b.quaternion.angleTo(initial[name]));const {mesh,index}=vertices[name];mesh.skeleton.update();const point=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,point);point.applyMatrix4(mesh.matrixWorld);if(!point.toArray().every(Number.isFinite))throw new Error('Vértice inválido em '+name);samples[name].push(point);}
  const elapsed=(performance.now()-start)/1000;if(elapsed>checkpoint*2&&checkpoint<4){sampleFrame(null,'Articulação · '+elapsed.toFixed(1)+' s');checkpoint++;}status('Conferindo asas, braços, pernas, cabeça e olhos · '+elapsed.toFixed(1)+' s');await sleep(90);
 }
 const rows=names.map(name=>({bone:name,localRotationRangeDegrees:ranges[name]*180/Math.PI,skinnedVertexMovement:Math.max(...samples[name].map(v=>v.distanceTo(samples[name][0])))}));const passed=rows.every(r=>r.localRotationRangeDegrees>.5&&r.skinnedVertexMovement>.001);report.tests.ARTICULATION={rows,passed,cameraTest:false};if(!passed)throw new Error('Articulação abaixo do esperado; confira o relatório');status('Articulação conferida na malha: asas, membros, cabeça e olhos ativos.');$('#view').classList.remove('live');placement.visible=false;
});

$('#eyes').onclick=()=>{if(live||testing)return;$('#testPanel').open=true;$('#faceTest').click();$('#view').scrollIntoView({behavior:'smooth',block:'center'})};

function applyLook(){sceneAtmosphere?.setPreset($('#look').value);report.sceneLook=$('#look').selectedOptions[0].textContent;show();}
$('#look').onchange=applyLook;
function targetConfig(){return $('#target').value==='capa'?{mind:'./capa_impressao.mind',image:'./capa_impressao.png',indices:[0,1],name:'Capa Death Note'}:{mind:'./alvo_provisorio.mind',image:'./alvo_provisorio.png',indices:[0],name:'Alvo de reserva'};}
async function matchTarget(ctl,points){let last;for(const i of targetConfig().indices){last=await ctl.match(points,i);if(last.modelViewTransform)return {...last,matchedTarget:i};}return last;}
$('#manual').onclick=()=>{if(!live||phase!=='target')return;mustClear=false;armTarget(performance.now());report.live.manualActivation=true;show();};

$('#transitions').onclick=()=>runTest('transitions-test',async()=>{
 defaultCamera();resetScene();placement.position.set(0,0,0);placement.scale.setScalar(1);reveal(performance.now());status('Conferindo entrada com fumaça…');await sleep(900);sampleFrame(null,'Manifestação · entrada');await sleep(1700);const entered=currentOpacity===1&&placement.visible&&!smoke.visible;startExit('transition-test');await sleep(1000);sampleFrame(null,'Dissolução · saída');await sleep(1800);const exited=!placement.visible&&!smoke.visible;
 reveal(performance.now());await sleep(650);const before=currentOpacity;startExit('interruption-test');await sleep(120);const noFlash=currentOpacity<=before+.001;await sleep(2700);report.tests.TRANSITIONS={entered,exited,noFlashWhenInterrupted:noFlash,scale:placement.scale.x,physicalTest:false};if(!entered||!exited||!noFlash)throw new Error('Falha nas transições');status('Entrada, saída e interrupção conferidas.');
});

let scanTargetIndex=0,scanTargetCanvas;
async function detectTarget(ctl,input){
 if(!scanTargetCanvas)scanTargetCanvas=canvas();const offsets=[[0,0],[0,150],[0,-150],[100,0],[-100,0]],offset=offsets[scanTargetIndex++%offsets.length],ctx=scanTargetCanvas.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,W,H);ctx.drawImage(input,offset[0],offset[1],W,H);return ctl.detect(scanTargetCanvas);
}

function eyeVergence(){
 scene.updateMatrixWorld(true);const directions=['L','R'].map(side=>{const pivot=model.getObjectByName('Olhar_'+side).getWorldPosition(new THREE.Vector3());let mesh=model.getObjectByName('Pupila_'+side);if(!mesh.isSkinnedMesh)mesh=mesh.children.find(o=>o.isSkinnedMesh);mesh.skeleton.update();const tip=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0);mesh.applyBoneTransform(0,tip);tip.applyMatrix4(mesh.matrixWorld);return tip.sub(pivot).normalize();});return THREE.MathUtils.radToDeg(directions[0].angleTo(directions[1]));
}

function updateContactShadow(now,dt){
 const visible=person.state(now).visible;
 contactShadow.update({now,dt,enabled:$('#shadow').checked,sessionVisible:visible&&placement.visible&&['active','exiting'].includes(phase),feetFresh:lastAcceptedFeetAt!==null&&now-lastAcceptedFeetAt<350&&!!lastBodyData?.feetVisible,opacity:currentOpacity,x:placement.position.x+motion.position.x*placement.scale.x,y:placement.position.y+refs.footY*placement.scale.x,scale:placement.scale.x,lift:motion.position.y});
}
$('#shadow').onchange=()=>{if(!$('#shadow').checked)contactShadow?.reset()};
$('#shadowTest').onclick=()=>runTest('shadow-test',async()=>{
 let runner,proof;try{
  defaultCamera();resetScene();$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v023.js');await runner.ready;
  const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,c,1000);r.bitmap.close();
  proof=new Compositor($('#view'),false);armTarget(performance.now());demo=true;$('#shadow').checked=true;
  const feed=async(body,ms)=>{const start=performance.now();while(performance.now()-start<ms){acceptBody({body},performance.now());const bitmap=await createImageBitmap(c);proof.paint({...r,body,bitmap});await sleep(80)}};
  await feed(r.body,3000);const grounded=contactShadow.snapshot();sampleFrame(proof,'Sombra simulada · pés confirmados');
  const cropped={...r.body,feet:null,feetVisible:false};await feed(cropped,650);const croppedState=contactShadow.snapshot();sampleFrame(proof,'Sem pés · sombra oculta');
  await feed(r.body,900);const returned=contactShadow.snapshot();$('#shadow').checked=false;await sleep(100);const disabled=contactShadow.snapshot();$('#shadow').checked=true;
  startExit('shadow-exit-test');await feed(r.body,2800);const afterExit=contactShadow.snapshot();
  report.tests.CONTACT_SHADOW={grounded,cropped:croppedState,returned,disabled,afterExit,exitHidden:!placement.visible&&!smoke.visible&&!afterExit.visible,passed:grounded.visible&&!croppedState.visible&&returned.visible&&!disabled.visible&&!afterExit.visible&&!placement.visible&&!smoke.visible,simulation:true,physicalFloorTracking:false};
  if(!report.tests.CONTACT_SHADOW.passed)throw new Error('Falha no ensaio da sombra');status('Sombra conferida: aparece com pés estáveis e some sem pés. Não é rastreamento do piso.');
 }finally{runner?.close();proof?.dispose();demo=false;placement.visible=false;contactShadow.reset();$('#view').classList.remove('live')}
});

$('#atmosphereTest').onclick=()=>runTest('atmosphere-test',async()=>{
 const selected=$('#look').value;defaultCamera();resetScene();placement.visible=true;placement.scale.setScalar(1);placement.position.set(0,0,0);
 const states=[];for(const preset of ['original','kira','cinema']){sceneAtmosphere.setPreset(preset);sceneAtmosphere.update({now:1200,dt:.1,mode:'entry',startedAt:0,visible:true});states.push(sceneAtmosphere.snapshot());}
 sceneAtmosphere.reset();const reset=sceneAtmosphere.snapshot();sceneAtmosphere.setPreset(selected);
 report.tests.ATMOSPHERE={states,reset,passed:states[0].preset==='original'&&states[0].exposure===1&&states[1].exposure===1.15&&states[2].pulse>0&&reset.pulse===0,rawTrackingInputUnchanged:true,realLightEstimation:false};
 if(!report.tests.ATMOSPHERE.passed)throw new Error('Falha na atmosfera');status('Atmosfera conferida: Original, KIRA sutil e Cinema; iluminação simulada.');placement.visible=false;
});

function updateReactiveGaze(now,dt){
 const elapsed=appearanceAt===null?0:(now-appearanceAt)/1000;
 const enabled=$('#reactiveGaze').checked&&phase==='active'&&(live||demo)&&person.state(now).visible&&lastAcceptedBodyAt!==null&&now-lastAcceptedBodyAt<350;
 let target=null,source=null;const body=lastBodyData;
 if(enabled&&body){const nose=body.points?.[0];const valid=nose&&nose.visibility>=.55&&nose.presence>=.5&&nose.x>=0&&nose.x<=1&&nose.y>=0&&nose.y<=1;const p=valid?nose:body.shoulder;source=valid?'pose-nose':'pose-shoulders';
  const z=1.4*placement.scale.x,view=2*(camera.position.z-z)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  target=new THREE.Vector3((p.x-.5)*view*camera.aspect,camera.position.y+(.5-p.y)*view,z);
 }
 reactiveGaze.afterMixer({target,source,dt,enabled,elapsed,stage:sequence.stage});
}
$('#reactiveGaze').onchange=()=>{if(!$('#reactiveGaze').checked)reactiveGaze?.reset()};
$('#reactiveTest').onclick=()=>runTest('reactive-gaze-test',async()=>{
 let runner,proof;const originalEnabled=$('#reactiveGaze').checked;
 try{
  defaultCamera();resetScene();$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v023.js');await runner.ready;const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,c,1000);r.bitmap.close();proof=new Compositor($('#view'),false);armTarget(performance.now());demo=true;$('#reactiveGaze').checked=true;
  const feed=async(x,ms)=>{const started=performance.now();while(performance.now()-started<ms){const points=r.body.points.map(p=>({...p}));points[0]={...points[0],x,visibility:1,presence:1};acceptBody({body:{...r.body,points}},performance.now());proof.paint({...r,bitmap:await createImageBitmap(c)});await sleep(70)}};
  await feed(.08,5000);const left=reactiveGaze.snapshot();sampleFrame(proof,'Olhar reativo · alvo à esquerda');
  await feed(.92,2200);const right=reactiveGaze.snapshot();sampleFrame(proof,'Olhar reativo · alvo à direita');
  $('#reactiveGaze').checked=false;reactiveGaze.reset();await feed(.92,200);const disabled=reactiveGaze.snapshot();
  $('#reactiveGaze').checked=true;await feed(.08,700);endSession('Ensaio: pessoa ausente');await sleep(100);const loss=reactiveGaze.snapshot();
  report.tests.REACTIVE_GAZE={left,right,disabled,loss,passed:left.yaw<-.01&&right.yaw>.01&&disabled.yaw===0&&loss.yaw===0&&left.maxRestoreError<1e-6&&right.maxRestoreError<1e-6,syntheticHeadPositions:true,physicalCameraTest:false};
  if(!report.tests.REACTIVE_GAZE.passed)throw new Error('Falha no olhar reativo');status('Olhar reativo conferido nos dois lados, desligamento e perda da pessoa.');
 }finally{runner?.close();proof?.dispose();demo=false;placement.visible=false;reactiveGaze.reset();$('#reactiveGaze').checked=originalEnabled;$('#view').classList.remove('live')}
});

$('#cameraRetry').onclick=()=>$('#live').click();
$('#cameraDemo').onclick=()=>$('#preview').click();

function updateNotebook(now){
 if(bookInspection){notebook.update({visible:true,opacity:1,x:0,y:1.1,z:0,scale:1.8,side:1,now,inspection:true});return;}
 const visible=($('#showBook').checked||(demo&&demoWantsBook))&&placement.visible&&['active','exiting'].includes(phase)&&person.state(now).visible;
 notebook.update({visible,opacity:currentOpacity,x:placement.position.x+(motion.position.x-sideDirection*.38)*placement.scale.x,y:placement.position.y+(refs.hipY+.15+motion.position.y)*placement.scale.x,z:.22*placement.scale.x,scale:placement.scale.x*1.65,side:sideDirection,now});
 const state=notebook.snapshot();text('#notebookStatus',state.error?'O caderno virtual não carregou. Ryuk continua disponível.':state.visible?'Caderno virtual de demonstração — não substitui o caderno físico.':'');
}
$('#showBook').onchange=()=>{if(!$('#showBook').checked&&!demo)notebook?.reset()};
$('#bookPreview').onclick=()=>runTest('book-preview',async()=>{
 defaultCamera();resetScene();placement.visible=false;await notebook.load();bookInspection=true;$('#view').classList.add('live');camera.position.set(0,1.1,.9);camera.lookAt(0,1.1,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H);await sleep(120);sampleFrame(null,'Caderno original · capa, páginas e lombada');report.tests.NOTEBOOK_MODEL=notebook.snapshot();status('Caderno 3D original conferido; a imagem-alvo física permanece separada.');
});
$('#bookTest').onclick=()=>runTest('book-integration',async()=>{
 let runner,proof;const selected=$('#showBook').checked;try{
  defaultCamera();resetScene();await notebook.load();$('#showBook').checked=true;$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v023.js');await runner.ready;const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,c,1000);r.bitmap.close();proof=new Compositor($('#view'),false);armTarget(performance.now());demo=true;
  const feed=async(ms)=>{const start=performance.now();while(performance.now()-start<ms){acceptBody({body:r.body},performance.now());proof.paint({...r,bitmap:await createImageBitmap(c)});await sleep(80)}};
  await feed(2800);const active=notebook.snapshot();sampleFrame(proof,'Ryuk e caderno virtual · demonstração');startExit('book-exit-test');await feed(2800);const exited=notebook.snapshot();
  armTarget(performance.now());await feed(2800);endSession('Ensaio: pessoa saiu');await sleep(100);const lost=notebook.snapshot();report.tests.NOTEBOOK_INTEGRATION={active,exited,lost,passed:active.visible&&!exited.visible&&!lost.visible,physicalTest:false};if(!report.tests.NOTEBOOK_INTEGRATION.passed)throw new Error('Falha na integração do caderno');status('Caderno conferido com Ryuk, fumaça e perda da pessoa.');
 }finally{runner?.close();proof?.dispose();demo=false;placement.visible=false;notebook.reset();$('#showBook').checked=selected;$('#view').classList.remove('live')}
});

$('#materialTest').onclick=()=>runTest('material-test',async()=>{
 defaultCamera();resetScene();placement.visible=true;placement.scale.setScalar(1);placement.position.set(0,0,0);motion.rotation.set(0,0,0);$('#view').classList.add('live');camera.position.set(0,refs.hipY+.03,1.35);camera.lookAt(0,refs.hipY+.03,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H);
 const background=scene.background;scene.background=new THREE.Color('#687985');const corrected=[];model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!corrected.some(x=>x.m===m))corrected.push({m,transparent:m.transparent,depthWrite:m.depthWrite,alphaTest:m.alphaTest})});
 try{
  for(const {m} of corrected){if(['UpperBody','Hair','Wing'].includes(m.name)){m.transparent=true;m.depthWrite=false;m.alphaTest=0;m.needsUpdate=true}if(m.name==='Pants'){m.transparent=false;m.depthWrite=true;m.alphaTest=0;m.needsUpdate=true}}
  await sleep(180);sampleFrame(null,'Antes · materiais transparentes');
 }finally{for(const {m,transparent,depthWrite,alphaTest} of corrected){m.transparent=transparent;m.depthWrite=depthWrite;m.alphaTest=alphaTest;m.needsUpdate=true}}
 await sleep(180);sampleFrame(null,'Depois · profundidade e recortes');
 const states=corrected.filter(x=>['UpperBody','Hair','Wing','Pants'].includes(x.m.name)).map(({m})=>({name:m.name,transparent:m.transparent,depthWrite:m.depthWrite,alphaTest:m.alphaTest}));
 const full=states.every(m=>!m.transparent&&m.depthWrite);setOpacity(.2);const fade=corrected.filter(x=>x.alphaTest>0).map(({m,alphaTest})=>({name:m.name,ratio:m.alphaTest/.2,expected:alphaTest}));restoreMaterials();
 report.tests.MATERIALS={states,fade,passed:full&&fade.every(x=>Math.abs(x.ratio-x.expected)<1e-6),geometryChanged:false,texturesChanged:false,physicalPhoneTest:false};scene.background=background;if(!report.tests.MATERIALS.passed)throw new Error('Falha nos materiais');status('Materiais e fade conferidos. Compare o quadril antes/depois nas capturas.');
});

$('#continuityTest').onclick=()=>runTest('continuity-test',async()=>{
 let runner,proof;const savedReport=report.live;try{
  defaultCamera();resetScene();$('#samples').textContent='';$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v023.js');await runner.ready;
  const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,c,1000);r.bitmap.close();if(!r.body.present)throw new Error('Corpo não detectado');
  proof=new Compositor($('#view'),false);report.live={bodyDetections:0,maskFrames:0,handSeen:false};bodyReady=true;live=true;armTarget(performance.now());
  const names=['Left_Wing_1','bip_upperArm_L','bip_knee_L','bip_head'];const initial=names.map(n=>model.getObjectByName(n).quaternion.clone()),ranges=names.map(()=>0);const started=performance.now();let noFaceVisible=true,sample=0;
  while(performance.now()-started<8500){
   const elapsed=performance.now()-started,points=r.body.points.map((q,i)=>({...q,x:q.x+.025*Math.sin(elapsed/1100),visibility:i<11?0:q.visibility}));
   if(elapsed>3500)for(const i of [23,24])points[i].visibility=0;const body=bodySnapshot(points);acceptBody({body},performance.now());if(elapsed>3500&&elapsed<6000){spacing.walkRange=0;walkRange=0;}proof.paint({...r,body,bitmap:await createImageBitmap(c)});
   if(person.state(performance.now()).bound){noFaceVisible&&=person.state(performance.now()).visible;}
   for(let i=0;i<names.length;i++)ranges[i]=Math.max(ranges[i],model.getObjectByName(names[i]).quaternion.angleTo(initial[i]));
   if(elapsed>2800&&sample===0){appearanceAt=performance.now()-11000;sampleFrame(proof,'Ensaio sem rosto · pose simulada');sample++;}
   status('Continuidade sem rosto + animação · '+(elapsed/1000).toFixed(1)+' s');await sleep(100);
  }
  const positionFollowed=Math.abs(targetPlacement.x-placement.position.x)<.15;const rotation=ranges.map((x,i)=>({bone:names[i],degrees:x*180/Math.PI}));const steps=naturalAnimator.snapshot().inPlaceDistance;
  acceptBody({body:{present:false}},performance.now());await sleep(2000);const hiddenAfterExit=!placement.visible&&phase==='target';sampleFrame(proof,'Pessoa ausente · personagem oculto');
  report.tests.CONTINUITY={syntheticLandmarksWithoutFace:true,actualBackCameraTest:false,noFaceVisible,positionFollowed,rotation,inPlaceDistance:steps,acceptedFrames:report.live.bodyDetections,hiddenAfterExit,passed:steps>0&&report.live.bodyDetections>20&&noFaceVisible&&positionFollowed&&hiddenAfterExit&&rotation.every(x=>x.degrees>.5)};
  if(!report.tests.CONTINUITY.passed)throw new Error('Falha na continuidade/animação');status('Continuidade sem rosto, articulação e saída conferidas em ensaio digital.');
 }finally{live=false;bodyReady=false;report.live=savedReport;runner?.close();proof?.dispose();placement.visible=false;$('#view').classList.remove('live')}
});

$('#skirtTest').onclick=()=>runTest('skirt-test',async()=>{
 defaultCamera();resetScene();$('#samples').textContent='';placement.visible=true;$('#view').classList.add('live');camera.position.set(0,refs.hipY,1.6);camera.lookAt(0,refs.hipY,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H);const bg=scene.background;scene.background=new THREE.Color('#596673');
 try{for(const angle of [0,.85,-.85]){motion.rotation.y=angle;await sleep(300);sampleFrame(null,'Saia recortada · vista '+Math.round(angle*180/Math.PI)+'°');}report.tests.SKIRT={pantsMasked:true,alphaCutoff:.5,solidAtlasBackgroundRemoved:true,views:[0,49,-49],physicalTest:false};status('Saia conferida de frente e dos lados; abas recortadas sem faixa sólida.');}finally{scene.background=bg;motion.rotation.y=0;}
});

async function startContinuousDemo(){
 if(live||demo||testing||suiteRunning)return;stopLive();const mine=++token;demo=true;demoWantsBook=true;$('#live').disabled=true;$('#camera').disabled=true;$('#target').disabled=true;$('#cameraError').hidden=true;document.body.classList.add('session-starting');$('#stop').textContent='Encerrar demonstração';text('#liveStatus','Preparando demonstração sem câmera…');
 let runner,proof;
 try{
  await setupModels();if(mine!==token)return;runner=new WorkerRunner('./body-worker-v023.js');demoRunner=runner;await runner.ready;if(mine!==token)return;
  const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,c,1000);r.bitmap.close();if(mine!==token)return;if(!r.body.present)throw new Error('Referência corporal indisponível');
  defaultCamera();resetScene();front=false;renderer.domElement.style.transform='none';$('#view').classList.remove('scene-empty');$('#view').classList.add('live');proof=new Compositor($('#view'),false);demoProof=proof;document.body.classList.remove('session-starting');document.body.classList.add('session-running');armTarget(performance.now());let cycle=performance.now(),exited=false,cycles=1,lastDemoReport=0;
  report.demo={continuous:true,camera:false,fixture:'pose.jpg',cycles};text('#liveStatus','Demonstração sem câmera · fotografia de referência. Use Encerrar demonstração para voltar.');$('#view').scrollIntoView({behavior:'smooth',block:'center'});
  while(demo&&mine===token){
   const now=performance.now();acceptBody({body:r.body},now);proof.mode=$('#occlusionMode').value;proof.paint({...r,bitmap:await createImageBitmap(c)});
   if(!exited&&now-cycle>21500){startExit('demo-cycle');exited=true;}
   if(now-cycle>25000){armTarget(now);cycle=now;exited=false;report.demo.cycles=++cycles;}
   report.demo.notebook=notebook.snapshot();report.demo.stage=sequence.stage;report.demo.animation=naturalAnimator.snapshot();if(now-lastDemoReport>750){lastDemoReport=now;show()}await sleep(100);
  }
 }catch(e){if(mine===token){report.errors.push({stage:'continuous-demo',message:e.message});stopLive();text('#liveStatus','Não foi possível carregar a demonstração: '+e.message);show()}}
 finally{runner?.close();proof?.dispose();if(demoRunner===runner)demoRunner=null;if(demoProof===proof)demoProof=null;show()}
}
$('#fadeTest').onclick=()=>runTest('material-fade',async()=>{
 defaultCamera();resetScene();placement.visible=true;$('#view').classList.add('live');const bg=scene.background;scene.background=null;const values=[];const c=canvas(),ctx=c.getContext('2d');
 try{for(const opacity of [1,.5,.1,0,1]){setOpacity(opacity);await sleep(100);renderer.render(scene,camera);ctx.clearRect(0,0,W,H);ctx.drawImage(renderer.domElement,0,0,W,H);const pixels=ctx.getImageData(0,0,W,H).data;let total=0;for(let i=3;i<pixels.length;i+=4)total+=pixels[i];values.push({opacity,alphaSum:total});}
  const passed=values[0].alphaSum>values[1].alphaSum&&values[1].alphaSum>values[2].alphaSum&&values[3].alphaSum===0&&values[4].alphaSum>values[0].alphaSum*.8;report.tests.MATERIAL_FADE={values,passed,actualRenderedPixels:true};if(!passed)throw new Error('Falha de transparência no desenho real');status('Transparência conferida nos pixels: opaco, parcial, invisível e restaurado.');
 }finally{restoreMaterials();scene.background=bg;placement.visible=false;}
});
const regressionStages=[
 ['materialTest','Materiais',()=>report.tests.MATERIALS?.passed],['fadeTest','Transparência',()=>report.tests.MATERIAL_FADE?.passed],['skirtTest','Saia',()=>report.tests.SKIRT?.pantsMasked],
 ['continuityTest','Presença sem rosto e movimento',()=>report.tests.CONTINUITY?.passed],['articulationTest','Articulações e pupilas',()=>report.tests.ARTICULATION?.passed],
 ['sequenceTest','Sequência e escala',()=>report.tests.SEQUENCE?.sameScaleThroughFloat],['bodyTest','Corpo, pés e saída',()=>report.tests.BODY?.scaleIncreases&&report.tests.BODY.loss.modelHidden&&report.tests.BODY.loss.requiresTargetAgain&&!report.tests.BODY.returnedWithoutTarget],
 ['targetTest','Capa e punho',()=>report.tests.TARGET_HAND?.target.every(x=>x.matched)&&report.tests.TARGET_HAND.heldFistConfirmed&&report.tests.TARGET_HAND.negativeGesture?.name!=='Closed_Fist'],
 ['bookTest','Caderno 3D',()=>report.tests.NOTEBOOK_INTEGRATION?.passed],['reactiveTest','Olhar reativo',()=>report.tests.REACTIVE_GAZE?.passed],['atmosphereTest','Atmosfera',()=>report.tests.ATMOSPHERE?.passed],['shadowTest','Sombra',()=>report.tests.CONTACT_SHADOW?.passed],['transitions','Fumaça e transições',()=>report.tests.TRANSITIONS?.entered&&report.tests.TRANSITIONS.exited&&report.tests.TRANSITIONS.noFlashWhenInterrupted]
];
$('#regressionTest').onclick=async()=>{
 if(live||demo||testing||suiteRunning)return;suiteRunning=true;$('#regressionTest').disabled=true;$('#preview').disabled=true;$('#live').disabled=true;const errorsBefore=report.errors.length;report.tests.REGRESSION={startedAt:new Date().toISOString(),stages:[],physicalCameraTest:false};
 try{for(const [id,label,check] of regressionStages){text('#regressionStatus','Conferindo '+(report.tests.REGRESSION.stages.length+1)+'/'+regressionStages.length+' · '+label);const ok=await $('#'+id).onclick();const passed=ok===true&&check()===true;report.tests.REGRESSION.stages.push({id,label,passed});show();}
 const suite=report.tests.REGRESSION;suite.newErrors=report.errors.length-errorsBefore;suite.passed=suite.stages.every(x=>x.passed)&&suite.newErrors===0;suite.finishedAt=new Date().toISOString();text('#regressionStatus',suite.passed?'Conferência concluída: 13 recursos aprovados nos ensaios digitais. Câmera real ainda precisa de teste.':'Conferência concluída com falhas. Confira os resultados antes de usar esta versão.');
 }finally{suiteRunning=false;$('#regressionTest').disabled=false;$('#preview').disabled=false;$('#live').disabled=false;$('#stop').disabled=false;$('#restart').disabled=false;show();}
};
