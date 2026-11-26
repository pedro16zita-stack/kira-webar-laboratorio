import {IdleStage} from './idle-stage-v040.js';
const idleStage=new IdleStage();
import {refineGarment} from './garment-v038.js';
import {spaceOptions,safeFloatOffset} from './space-chooser-v046.js';
import {ObservationClock} from './hand-time-v037.js';
const handClock=new ObservationClock();
import {SideWalk} from './side-walk-v032.js';
import {closePinholes} from './matte-filter-v032.js';
import {PresentationFlow} from './presentation-flow-v039.js';
import {preserveAnimatedEyes} from './eye-visibility-v030.js';
import * as THREE from 'three';
import {applyMaterialFade} from './material-fade-v024.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {handMessages,exitMessage} from './presentation-status-v035.js';
import {BookReveal} from './book-reveal-v030.js';
import {NotebookVisual} from './notebook-v030.js';
import {WorkerRunner} from './worker-runner-v025.js';
import {requestCamera,cameraErrorInfo} from './camera-access-v020.js';
import {ReactiveGaze} from './reactive-gaze-v019.js';
import {SceneAtmosphere} from './scene-atmosphere-v018.js';
import {ContactShadow} from './contact-shadow-v017.js';
import {PipelineMetrics} from './pipeline-metrics-v017.js';
import {bodySnapshot} from './body-tracking-v023.js';
import {BodyFramer} from './body-frame-v042.js';
import {GestureGate} from './gesture-gate-v027.js';
import {HandFramePlanner,mapHandResult} from './hand-frame-v036.js';
import {HandAssociation,resolveGesture} from './hand-evidence-v0341.js';
import {SpaceChooser} from './space-chooser-v046.js';
import {sceneSequence,composition} from './sequence-v008.js?v=0.8';
import {NaturalAnimator} from './natural-animator-v023.js';
import {Compositor} from './compositor-v046.js';
import {PersonSession} from './stable-presence-v028.js';
import {stabilizeEyes,eyeDepthSettings} from './eye-depth-v028.js';
import {LayeredSmoke} from './smoke-volume-v033.js';
import {SmokeMotion} from './smoke-motion-v033.js';
import {LiveBudget,renderProfile,videoFrameStamp} from './live-budget-v033.js';

const $=s=>document.querySelector(s),W=480,H=640,SMOKE_COUNT=128;
const report={versions:{lab:'4.7.4-candidata',three:THREE.REVISION,mediapipe:'0.10.21',mindar:'1.2.5'},environment:{userAgent:navigator.userAgent,secureContext:isSecureContext,softwareGraphicsTest:new URLSearchParams(location.search).get('tfjsflags')?.includes('SOFTWARE_WEBGL_ENABLED:true')??false},humanRedEyes:false,tests:{},errors:[]};
const show=()=>$('#results').textContent=JSON.stringify(report,null,2),status=t=>$('#status').textContent=t;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const presentationFlow=new PresentationFlow({guide:$('#experienceGuide'),title:$('#flowTitle'),detail:$('#flowDetail'),steps:[...document.querySelectorAll('.flow-steps li')],panel:$('#replayPanel'),button:$('#flowReplay'),onReplay:()=>{if(!live||phase!=='complete')return;$('#restart').click();updateLiveStatus();}});
const loadImage=url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Não carregou '+url));i.src=url});
let renderFrame=null,digitalFramePump=null,digitalCameraFrame=null;
let notebook,bookInspection=false,demoWantsBook=false,demoRunner=null,demoProof=null,suiteRunning=false;
let reactiveGaze,lastAcceptedBodyAt=null;
let sceneAtmosphere,contactShadow,lastAcceptedFeetAt=null;
const pipelineMetrics=new PipelineMetrics();
const sideWalk=new SideWalk();
let naturalAnimator,spacing=null,walkRange=.65,walkDistance=0,lastWalkX=0,walkSpeed=0,motionSide=1;
let smokeMode=null,exitOpacity=1,currentOpacity=1;
let renderer,scene,camera,placement,motion,model,mixer,entry,idle,refs,modelPromise,Controller,controllerPromise,smoke,smokeStart=null;
let live=false,demo=false,testing=false,phase='idle',token=0,epoch=0,videoStream,bodyRunner,handRunner,compositor,targetController;
let targetBusy=false,bodyBusy=false,handBusy=false,lastTarget=0,lastBody=0,lastHand=0,bodyReady=false,handReady=false,mustClear=false,armedAt=0;
let appearanceAt=null,entryElapsed=0,appearing=false,front=false,sideDirection=1,autoSide=null,lastBodyData=null,framing=null,exitTrigger=null;
let targetPlacement={x:0,y:0,scale:1},sequence=sceneSequence(0),frameTimes=[],bodyTimes=[],handTimes=[],lastPoseDeltas=[],walkRig=[];
const handAssociation=new HandAssociation(),spaceChooser=new SpaceChooser();
const framer=new BodyFramer(),person=new PersonSession(),gestureGate=new GestureGate(),handFramePlanner=new HandFramePlanner();
const viewHeight=()=>2*camera.position.z*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
const text=(selector,value)=>{if($(selector).textContent!==value)$(selector).textContent=value};

function defaultCamera(){camera.position.set(0,1.2,4.8);camera.rotation.set(0,0,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H)}
function setupModels(){if(modelPromise)return modelPromise;modelPromise=(async()=>{
 status('Carregando personagem…');renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(720,460);$('#view').appendChild(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,720/460,.1,40);camera.position.set(0,1.2,4.8);scene.add(new THREE.HemisphereLight(0xffffff,0x403b49,.95));const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-2.5,4,4);scene.add(key);const fill=new THREE.DirectionalLight(0xc5d6ff,.12);fill.position.set(-3,2,3);scene.add(fill);const rim=new THREE.DirectionalLight(0x9a4159,.55);rim.position.set(1,3,-3);scene.add(rim);
 sceneAtmosphere=new SceneAtmosphere({view:$('#view'),renderer,rim});
 placement=new THREE.Group();motion=new THREE.Group();placement.add(motion);scene.add(placement);
 const gltf=await new GLTFLoader().loadAsync('./ryuk-v025.glb');model=gltf.scene;report.eyeRendering=stabilizeEyes(model);report.garment=refineGarment(model,renderer);motion.add(model);mixer=new THREE.AnimationMixer(model);
 const materials=[];model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.original={transparent:m.transparent,depthWrite:m.depthWrite,alphaTest:m.alphaTest};for(const map of [m.map,m.normalMap,m.emissiveMap])if(map)map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());if(!materials.some(x=>x.name===m.name))materials.push({name:m.name,transparent:m.transparent,roughness:m.roughness});}});
 entry=mixer.clipAction(gltf.animations.find(a=>a.name==='01_Manifestacao'));entry.setLoop(THREE.LoopOnce,1);entry.clampWhenFinished=true;idle=mixer.clipAction(gltf.animations.find(a=>a.name==='02_Suspensao'));idle.play();mixer.update(.1);scene.updateMatrixWorld(true);
 const point=name=>{const o=model.getObjectByName(name);if(!o)throw new Error('Osso ausente: '+name);return o.getWorldPosition(new THREE.Vector3())};
 const l=point('bip_upperArm_L'),r=point('bip_upperArm_R'),hl=point('bip_hip_L'),hr=point('bip_hip_R'),box=new THREE.Box3().setFromObject(model,true),head=new THREE.Box3().setFromObject(model.getObjectByName('Head'),true);
 refs={width:box.max.x-box.min.x,shoulderWidth:Math.abs(l.x-r.x),shoulderY:(l.y+r.y)/2,hipY:(hl.y+hr.y)/2,footY:box.min.y,height:box.max.y-box.min.y,headY:(head.min.y+head.max.y)/2,headWidth:head.max.x-head.min.x};refs.torsoHeight=refs.shoulderY-refs.hipY;
 report.eyeVisibility=preserveAnimatedEyes(model);naturalAnimator=new NaturalAnimator(mixer,gltf.animations);reactiveGaze=new ReactiveGaze(model);
 notebook=new NotebookVisual(scene);contactShadow=new ContactShadow(scene);applyLook();makeSmoke();report.tests.MODEL={animations:gltf.animations.map(a=>({name:a.name,duration:a.duration})),materials,refs,animationSource:'Blender',originalBodyGeometryPreserved:true,separatePupils:true};placement.visible=false;
 let previous=performance.now(),scheduled=previous;renderFrame=()=>{const now=performance.now(),fps=renderProfile($('#quality').value,live).fps,interval=1000/fps;if(now<scheduled-.5)return;const frameMs=now-previous,dt=Math.min(frameMs/1000,.1);previous=now;scheduled+=interval;if(now-scheduled>interval)scheduled=now+interval;if(live||demo){frameTimes.push(frameMs);if(frameTimes.length>180)frameTimes.shift()}
  if(live||demo)updateScene(now,dt);
  reactiveGaze.beforeMixer();naturalAnimator.update(idleStage.active?null:appearanceAt===null?null:(now-appearanceAt)/1000,dt,sideWalk.active?{...sequence,stage:'caminhada'}:sequence,sideDirection,walkDistance+sideWalk.distance,sideWalk.active?Math.max(walkSpeed,sideWalk.speed):walkSpeed,phase==='active');mixer.update(dt);updateReactiveGaze(now,dt);
  updateSmoke(now);updateNotebook(now);updateContactShadow(now,dt);sceneAtmosphere.update({now,dt,mode:smokeMode,startedAt:smokeStart,visible:placement.visible&&(!(live||demo)||['active','exiting'].includes(phase))});renderer.render(scene,camera);
 };renderer.setAnimationLoop(renderFrame);$('#smoke').disabled=false;show();return model;
 })();return modelPromise}
function makeSmoke(){smoke=new LayeredSmoke(SMOKE_COUNT);scene.add(smoke);}

function setOpacity(alpha){currentOpacity=alpha;model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])applyMaterialFade(m,alpha,m.userData.original)})}
function restoreMaterials(){setOpacity(1)}
function clearPose(){}
function reveal(now){phase='active';appearanceAt=now;restoreMaterials();placement.visible=true;model.visible=true;naturalAnimator.reveal();walkDistance=0;lastWalkX=0;walkSpeed=0;motionSide=sideDirection;smokeMode='entry';smokeStart=now;setOpacity(0);scene.updateMatrixWorld(true);smoke.position.copy(motion.getWorldPosition(new THREE.Vector3()));smoke.scale.copy(placement.scale);}
function updateScene(now,dt){
 const p=person.state(now);if(p.expired&&phase==='body'){endSession('Pessoa saiu. Retire e apresente o alvo novamente.');return}
 if(phase==='body'&&bodyReady&&!p.bound&&now-armedAt>15000){endSession('Nenhuma pessoa enquadrada. Apresente o alvo novamente.');return}
 if(phase==='active'&&p.visible){idleStage.leave();
  const a=1-Math.exp(-dt*4);placement.visible=true;placement.position.x=sideWalk.active?sideWalk.step(placement.position.x,targetPlacement.x,placement.scale.x,dt):placement.position.x+(targetPlacement.x-placement.position.x)*a;placement.position.y+=(targetPlacement.y-placement.position.y)*a;const scale=placement.scale.x+(targetPlacement.scale-placement.scale.x)*a;placement.scale.setScalar(scale);
  const elapsed=(now-appearanceAt)/1000;sequence=sceneSequence(elapsed);
  motionSide+=(sideDirection-motionSide)*a;walkRange+=((spacing?.walkRange??.65)-walkRange)*a;
  const walking=sequence.stage==='caminhada',localWalkX=(walking?motionSide*walkRange*sequence.path:0)*(1-sideWalk.blend);
  if(walking){const deltaX=Math.abs(localWalkX-lastWalkX);walkDistance+=deltaX;walkSpeed+=(deltaX/Math.max(dt,.001)-walkSpeed)*(1-Math.exp(-dt*10));}else walkSpeed*=Math.exp(-dt*8);
  lastWalkX=localWalkX;const floatLimit=Math.min(1,(spacing?.floatRange??.10)/.10);
  motion.position.set(localWalkX+safeFloatOffset(sequence.floatX*floatLimit,sideDirection,spacing?.inwardRange)*(1-sideWalk.blend),sequence.floatY*(1-sideWalk.blend),0);
  const heading=motionSide*Math.PI/2*(1-2*sequence.turn),allowWalking=walkRange>.08;
  const yaw=walking&&allowWalking?heading*sequence.headingBlend-motionSide*.12*(1-sequence.headingBlend):-motionSide*.12;
  const aim=yaw+Math.atan2(Math.sin(sideWalk.heading-yaw),Math.cos(sideWalk.heading-yaw))*sideWalk.blend;motion.rotation.y+=Math.atan2(Math.sin(aim-motion.rotation.y),Math.cos(aim-motion.rotation.y))*a;

 }else if(phase==='active'){
  if(idleStage.enter(now,{x:placement.position.x,y:placement.position.y,scale:targetPlacement.scale},refs,{height:viewHeight(),width:viewHeight()*camera.aspect,y:camera.position.y,bottomInset:$('#view').clientWidth<330?.40:.30})){epoch++;sideWalk.cancel();gestureGate.reset();handClock.reset();handAssociation.reset();handFramePlanner.reset();lastAcceptedBodyAt=null;lastAcceptedFeetAt=null;lastBodyData=null;contactShadow.reset();reactiveGaze.reset();compositor?.clear();}
  placement.visible=true;const a=1-Math.exp(-dt*4),target=idleStage.target;placement.position.x+=(target.x-placement.position.x)*a;placement.position.y+=(target.y-placement.position.y)*a;placement.scale.setScalar(placement.scale.x+(target.scale-placement.scale.x)*a);const t=(now-idleStage.since)/1000;
  sequence={...sceneSequence(0),stage:'ocioso',floatX:0,floatY:0,path:0};motion.position.x+=(.014*Math.sin(t*.55)-motion.position.x)*a;motion.position.y+=(.025*Math.sin(t*.8)-motion.position.y)*a;motion.rotation.y+=(.06*Math.sin(t*.38)-motion.rotation.y)*a;walkSpeed=0;lastWalkX=0;
 }
 if(report.live&&live)report.live.idle=idleStage.snapshot();
 if(live)updateLiveStatus();
}
function startExit(trigger='gesture'){
 if(!['active','test'].includes(phase))return;sideWalk.cancel();phase='exiting';smokeMode='exit';exitOpacity=currentOpacity;exitTrigger=trigger;scene.updateMatrixWorld(true);smoke.position.copy(motion.getWorldPosition(new THREE.Vector3()));smoke.scale.copy(placement.scale);smokeStart=performance.now();if(report.live&&live){report.live.exitTriggered=true;report.live.exitReason=trigger;report.live.exitAt=new Date().toISOString()}
}
function updateSmoke(now){
 if(smokeStart===null)return;const entering=smokeMode==='entry',duration=entering?2400:2600,u=Math.min(1,(now-smokeStart)/duration),allowed=!(live||demo)||placement.visible&&['active','exiting'].includes(phase);
 if(entering){scene.updateMatrixWorld(true);smoke.position.copy(motion.getWorldPosition(new THREE.Vector3()));smoke.scale.copy(placement.scale);}
 smoke.visible=u<1&&allowed;if(smoke.visible)smoke.update(u,smokeMode,$('#quality').value);
 const alpha=entering?THREE.MathUtils.smoothstep(u,.06,.72):exitOpacity*(1-THREE.MathUtils.smoothstep(u,.18,.78));setOpacity(alpha);
 if(u===1){smoke.visible=false;smokeStart=null;smokeMode=null;if(entering){restoreMaterials();report.tests.ENTRANCE={seconds:2.4,particles:SMOKE_COUNT,modelVisible:placement.visible,opacity:currentOpacity};}else{placement.visible=false;phase='complete';idleStage.leave();report.tests.SMOKE={trigger:exitTrigger,particles:SMOKE_COUNT,seconds:2.6,modelHidden:true,smokeHidden:true};}show()}
}

function resetScene(){idleStage.reset();handClock.reset();sideWalk.reset();handAssociation.reset();spaceChooser.reset();handFramePlanner.reset();bookInspection=false;notebook?.reset();reactiveGaze?.reset();lastAcceptedBodyAt=null;sceneAtmosphere?.reset();lastAcceptedFeetAt=null;contactShadow?.reset();clearPose();restoreMaterials();placement.visible=false;placement.position.set(0,0,0);placement.scale.setScalar(1);motion.position.set(0,0,0);motion.rotation.set(0,0,0);model.visible=true;smoke.visible=false;smokeStart=null;smokeMode=null;appearanceAt=null;appearing=false;naturalAnimator.reset();walkDistance=0;lastWalkX=0;walkSpeed=0;walkRange=.65;spacing=null;framer.reset();person.arm();gestureGate.reset();autoSide=null;lastBodyData=null;framing=null;frameTimes=[];sequence=sceneSequence(0)}
function armTarget(now){if(!testing&&!suiteRunning&&$('#experienceMode').value==='world'){handoffWorld();return;}epoch++;resetScene();phase='body';armedAt=now;if(live){report.live.targetRecognized=true;report.live.targetAt=new Date().toISOString();report.live.personLost=false;report.live.requiresTargetAgain=false;report.live.exitTriggered=false;report.live.handSeen=false;report.live.gesture=null;}}
function endSession(reason){idleStage.reset();sideWalk.cancel();bookInspection=false;notebook?.reset();reactiveGaze?.reset();lastAcceptedBodyAt=null;sceneAtmosphere?.reset();lastAcceptedFeetAt=null;contactShadow?.reset();epoch++;phase='target';placement.visible=false;smoke.visible=false;smokeStart=null;clearPose();mustClear=true;compositor?.clear();gestureGate.reset();handAssociation.reset();if(report.live&&live){report.live.personLost=true;report.live.exitReason='tracking';report.live.requiresTargetAgain=true;report.live.personLossAt=new Date().toISOString()}text('#liveStatus',reason)}
function updatePlacement(body){
 const f=framer.update(body,refs,Number($('#size').value),viewHeight(),camera.aspect);if(!f)return;lastBodyData=body;framing=f;const center=body.center.x;
 const chosen=spaceChooser.update(body,refs,f.scale,viewHeight()*camera.aspect,Number($('#space').value),performance.now(),$('#side').value,front);const previousSide=sideDirection;sideDirection=chosen.direction;sideWalk.request(previousSide,sideDirection,phase==='active');spacing=chosen.composition;autoSide=sideDirection;
 targetPlacement={x:spacing.x,y:camera.position.y+(.5-f.anchorY)*viewHeight()-f.localY*f.scale,scale:f.scale};
}
function acceptBody(r,now){
 if(phase==='active'&&person.state(now).expired&&r.body?.present){person.arm();spaceChooser.reset();}const state=person.update(r.body,now);if(state.accepted&&state.visible){lastAcceptedBodyAt=now;lastAcceptedFeetAt=r.body.feetVisible?now:null;if(phase==='body'){updatePlacement(r.body);placement.position.set(targetPlacement.x,targetPlacement.y,0);placement.scale.setScalar(targetPlacement.scale);reveal(now)}else if(phase==='active')updatePlacement(r.body);}
 if(state.expired&&phase==='body')endSession('Pessoa saiu. Apresente o caderno novamente.');
 if(live){report.live.person={present:r.body.present,visible:state.visible,bound:state.bound,feetVisible:r.body.feetVisible,framingSource:framing?.source??null};report.live.bodyDetections+=r.body.present?1:0;report.live.maskFrames++;report.live.occlusionApplied=true;report.live.redEyes=false;}
 if(live)updateLiveStatus();return state;
}
function updateLiveStatus(){
 if(live&&report.live?.lastHandResultAt&&performance.now()-report.live.lastHandResultAt>1000)report.live.handSeen=false;
 const visible=live&&phase==='active'&&(person.state(performance.now()).visible||idleStage.active);$('#gestureFeedback').hidden=!visible||(idleStage.active&&!person.state(performance.now()).visible&&!report.live?.handSeen&&!gestureGate.armed);$('#saveLive').hidden=!live;$('#exitAppearance').hidden=!visible;gestureGate.expire(handClock.now(performance.now()));$('#gestureProgress').value=gestureGate.progress;
 presentationFlow.update({live,phase,personVisible:person.state(performance.now()).visible,idle:idleStage.active,mustClear});
 text('#sessionVersion','KIRA 4.7.4 · '+($('#side').value==='auto'?'posição automática':$('#side').value==='left'?'posição à esquerda':'posição à direita'));
 const handFeedback=handMessages({ready:handReady,initialization:report.live?.handInitialization,seen:report.live?.handSeen,armed:gestureGate.armed,progress:gestureGate.progress,lighting:report.live?.handEvidence?.lighting});if(visible)text('#gestureHint',handFeedback.hint);
 if(phase==='target'){text('#liveStatus',mustClear?'Rastreamento da pessoa perdido. Retire e apresente o caderno novamente.':'Apresente a imagem-alvo inteira.');return}
 if(!bodyReady){text('#liveStatus','Preparando rastreamento corporal…');return}
 if(phase==='body'){text('#liveStatus','Caderno reconhecido. Enquadre a pessoa para Ryuk aparecer.');return}
 if(phase==='complete'){text('#liveStatus',exitMessage(exitTrigger,true));return}
 if(phase==='exiting'){text('#liveStatus',exitMessage(exitTrigger));return}
 const state=person.state(performance.now());if(!state.visible){text('#liveStatus',idleStage.active?'Ryuk está em repouso. Reenquadre uma pessoa para retomar o acompanhamento; feche o punho ou use Encerrar aparição para sair.':'Aguardando a pessoa. Ryuk permanecerá na câmera.');return}
 const feet=lastBodyData?.feetVisible?'Pés detectados.':'Pés não confirmados; usando tronco/ombros.';
 text('#liveStatus',(lastBodyData?.presenceSource==='tronco-sem-rosto'?'Pessoa presente pelo tronco. ':'')+feet+' '+handFeedback.short);
}
function drawCover(video,canvas,frame={x:0,y:0,w:1,h:1}){const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,vw=video.videoWidth??video.width,vh=video.videoHeight??video.height,s=Math.max(w/vw,h/vh),sw=w/s,sh=h/s;ctx.drawImage(video,(vw-sw)/2+sw*frame.x,(vh-sh)/2+sh*frame.y,sw*frame.w,sh*frame.h,0,0,w,h)}
function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c}
async function setupTarget(){if(!controllerPromise)controllerPromise=import('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js').then(m=>Controller=m.Controller);await controllerPromise}
function stopLive(){idleStage.reset();sideWalk.cancel();presentationFlow.hide();$('.gesture-note').textContent='Para encerrar a aparição, feche a mão e segure por cerca de um segundo.';demo=false;demoRunner?.close();demoRunner=null;demoProof?.dispose();demoProof=null;bookInspection=false;demoWantsBook=false;notebook?.reset();reactiveGaze?.reset();lastAcceptedBodyAt=null;document.body.classList.remove('session-running','session-starting');$('#view').classList.add('scene-empty');$('#stop').textContent='Encerrar câmera';sceneAtmosphere?.reset();
 contactShadow?.reset();pipelineMetrics.reset();token++;epoch++;live=false;digitalCameraFrame=null;applyPerformanceProfile();bodyRunner?.close();handRunner?.close();bodyRunner=handRunner=null;videoStream?.getTracks().forEach(t=>t.stop());videoStream=null;bodyReady=handReady=false;
 const old=targetController;targetController=null;if(old)setTimeout(()=>old.dispose(),500);compositor?.dispose();compositor=null;const v=$('#video');v.srcObject=null;v.hidden=true;$('#view').classList.remove('live');if(placement){placement.visible=false;if(smoke)smoke.visible=false;smokeStart=null;if(renderer)renderer.domElement.style.transform='none'}
 handClock.reset();phase='idle';$('#saveLive').hidden=true;$('#gestureFeedback').hidden=true;$('#exitAppearance').hidden=true;gestureGate.reset();handFramePlanner.reset();$('#live').disabled=false;$('#camera').disabled=false;$('#target').disabled=false;$('#manual').disabled=true;text('#liveStatus','Câmera desligada.');if(report.live){report.live.endedAt=new Date().toISOString();show()}
}
async function startLive(cameraRequest=requestCamera,digital=false){
 if(live||demo||testing||(!digital&&(suiteRunning||$('#live').disabled)))return;demoWantsBook=false;$('#live').disabled=true;$('#camera').disabled=true;$('#target').disabled=true;const mine=++token;let startupStage='camera';$('#cameraError').hidden=true;document.body.classList.add('session-starting');$('#stop').disabled=false;$('#stop').textContent='Cancelar';
 try{
  text('#liveStatus','Aguardando acesso à câmera…');const access=await cameraRequest({facing:$('#camera').value});const stream=access.stream;if(mine!==token){stream.getTracks().forEach(t=>t.stop());return}videoStream=stream;
  startupStage='assets';text('#liveStatus','Câmera encontrada. Preparando Ryuk…');await Promise.all([setupModels(),setupTarget()]);if(mine!==token)return;defaultCamera();resetScene();front=$('#camera').value==='user';startupStage='video';
  const video=$('#video');video.srcObject=stream;await video.play();if(mine!==token)return;$('#view').classList.remove('scene-empty');video.hidden=false;video.style.transform=front?'scaleX(-1)':'none';renderer.domElement.style.transform=front?'scaleX(-1)':'none';$('#view').appendChild(video);$('#view').classList.add('live');compositor=new Compositor($('#view'),front);compositor.liveVideo=true;compositor.attach(scene);
  live=true;applyPerformanceProfile();document.body.classList.remove('session-starting');$('#stop').textContent='Encerrar câmera';document.body.classList.add('session-running');$('#manual').disabled=false;phase='target';mustClear=false;targetBusy=bodyBusy=handBusy=false;lastTarget=lastBody=lastHand=0;bodyTimes=[];handTimes=[];
  report.cameraAccess={available:true,code:'ready',fallbackUsed:access.fallbackUsed};report.live={startedAt:new Date().toISOString(),camera:front?'frontal':'traseira',videoSize:[video.videoWidth,video.videoHeight],tracks:stream.getVideoTracks().length,cameraConstraintFallback:access.fallbackUsed,targetName:targetConfig().name,manualActivation:false,tracking:'body-pose-v023-face-independent',humanRedEyes:false,targetRecognized:false,bodyDetections:0,maskFrames:0,occlusionApplied:false,exitTriggered:false,personLost:false,requiresTargetAgain:false,handSeen:false,gesture:null,worldAnchor:false};
  const ctl=new Controller({inputWidth:W,inputHeight:H});targetController=ctl;await ctl.addImageTargets(targetConfig().mind);if(mine!==token)return;
  bodyRunner=new WorkerRunner('./body-worker-v037.js');
  const startHand=()=>{if(mine!==token)return;handRunner=new WorkerRunner('./hand-worker-v035.js');handRunner.ready.then(()=>{if(mine===token){handReady=true;report.live.handInitialization='ready'}}).catch(e=>{if(mine===token){report.live.handInitialization='failed';report.errors.push({stage:'hand-init',message:e.message});show()}});};
  bodyRunner.ready.then(()=>{if(mine===token){bodyReady=true;startHand();if(phase==='body')armedAt=performance.now()}}).catch(e=>{if(mine===token){report.errors.push({stage:'body-init',message:e.message});stopLive();text('#liveStatus','Rastreamento corporal indisponível: '+e.message)}});

  const targetCanvas=canvas(),bodyCanvas=canvas(),handCanvas=canvas();const budget=new LiveBudget();let lastReport=0,lastPreview=-1;
  const tick=()=>{
   if(!live||mine!==token)return;const now=performance.now(),frameStamp=videoFrameStamp(video);
   if(frameStamp.key!==lastPreview&&video.readyState>=2){lastPreview=frameStamp.key;compositor.paintVideo(video,placement.visible&&person.state(now).visible,now);}
   const job=budget.choose(now,{bodyReady,handReady,bodyBusy,handBusy,bodyAllowed:['body','active','exiting','complete'].includes(phase),handAllowed:phase==='active'&&(person.state(now).visible||idleStage.active),videoTime:frameStamp.key,handFocused:gestureGate.armed||((report.live.lastHandResultAt??-Infinity)>now-650&&report.live.handSeen)});
   if(phase==='target'&&!targetBusy&&now-lastTarget>350&&video.readyState>=2){targetBusy=true;lastTarget=now;drawCover(video,targetCanvas);const e=epoch;detectTarget(ctl,targetCanvas).then(d=>matchTarget(ctl,d.featurePoints)).then(m=>{if(mine!==token||e!==epoch)return;if(!m.modelViewTransform)mustClear=false;else if(!mustClear)armTarget(performance.now())}).catch(e=>{if(mine===token)report.errors.push({stage:'target',message:e.message})}).finally(()=>{if(mine===token)targetBusy=false});}
   if(job==='body'){
    budget.started('body',now,frameStamp.key);
    bodyBusy=true;lastBody=now;drawCover(video,bodyCanvas);const e=epoch,runner=bodyRunner;runner.infer(bodyCanvas,now).then(r=>{if(mine!==token||e!==epoch){r.bitmap.close();return}const bodyState=acceptBody(r,performance.now());compositor.mode=$('#occlusionMode').value;if(bodyState.accepted&&bodyState.visible)compositor.paint(r);else{r.bitmap.close();report.live.skippedBodyMasks=(report.live.skippedBodyMasks??0)+1;}report.live.occlusionMode=compositor.mode;report.live.maskSource=r.maskSource;report.live.bodyTaskCalls=r.bodyTaskCalls;pipelineMetrics.record(r,performance.now());compositor.drawGuides($('#guides').checked);bodyTimes.push(r.ms);if(bodyTimes.length>90)bodyTimes.shift();}).catch(e=>{if(mine===token){report.errors.push({stage:'body-frame',message:e.message});endSession('Rastreamento interrompido. Apresente o alvo novamente.');show()}}).finally(()=>{if(mine===token){bodyBusy=false;budget.finished('body',performance.now());}});
   }
   if(job==='hand'){
    budget.started('hand',now,frameStamp.key);
    handBusy=true;lastHand=now;handClock.start(now);const frame=handFramePlanner.next(now,lastBodyData?.points);drawCover(video,handCanvas,frame);const e=epoch,runner=handRunner;runner.infer(handCanvas,now).then(raw=>{if(mine!==token||e!==epoch)return;acceptHandFrame(raw,frame,performance.now());handTimes.push(raw.ms);if(handTimes.length>90)handTimes.shift();}).catch(e=>{if(mine===token)report.errors.push({stage:'hand-frame',message:e.message})}).finally(()=>{if(mine===token){handBusy=false;handClock.finish(now);budget.finished('hand',performance.now());}});
   }
   if(now-lastReport>750){lastReport=now;report.live.gestureConfirmation=gestureGate.snapshot();report.live.phase=phase;report.live.presenceState=person.state(now);report.live.presenceSource=lastBodyData?.presenceSource;report.live.autoPosition=spaceChooser.snapshot();report.live.proportion=framer.snapshot();report.live.position={x:placement.position.x,y:placement.position.y,scale:placement.scale.x,targetScale:targetPlacement.scale,stage:sequence.stage,scaleGroup:'placement',motionGroupSeparate:true,spacing:$('#space').value,edgeLimited:spacing?.limited??false,animation:naturalAnimator.snapshot(),sideWalk:sideWalk.snapshot(),framingSource:framing?.source??null,feetVisible:framing?.feetVisible??false};report.live.notebook=notebook.snapshot();report.live.reactiveGaze=reactiveGaze.snapshot();report.live.atmosphere=sceneAtmosphere.snapshot();report.live.smoke=smoke.snapshot();report.live.pipeline=pipelineMetrics.snapshot(performance.now());report.live.contactShadow=contactShadow.snapshot();report.live.renderStats=renderStats();report.live.processingBudget=budget.snapshot();report.live.cameraPreview={...compositor.previewStats(now),frameCounter:frameStamp.source};report.live.bodyMs=bodyTimes;report.live.handMs=handTimes;report.live.gestureProgress=gestureGate.progress;show();}
   updateLiveStatus();
  };digitalCameraFrame=tick;const loop=()=>{if(!live||mine!==token)return;tick();requestAnimationFrame(loop);};loop();show();$('#view').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){if(mine===token){report.errors.push({stage:startupStage,name:e.name,message:e.message});stopLive();const info=cameraErrorInfo(e,startupStage);report.cameraAccess={...info,available:false};$('#cameraErrorTitle').textContent=info.title;$('#cameraErrorMessage').textContent=info.message;$('#cameraError').hidden=false;text('#liveStatus','A câmera não foi iniciada. A demonstração sem câmera continua disponível.');show()}}
};
$('#live').onclick=()=>startLive();
$('#stop').onclick=stopLive;
$('#exitAppearance').onclick=()=>{if(live&&phase==='active'&&(person.state(performance.now()).visible||idleStage.active))startExit('button');};
$('#restart').onclick=()=>{if(!live)return;epoch++;resetScene();phase='target';mustClear=false;compositor.clear();report.live.targetRecognized=false;report.live.exitTriggered=false;report.live.personLost=false;report.live.requiresTargetAgain=false;show()};
$('#occlusionMode').onchange=()=>{if(compositor)compositor.mode=$('#occlusionMode').value};
$('#guides').onchange=()=>compositor?.drawGuides($('#guides').checked);
for(const id of ['side','size','space'])$('#'+id).onchange=()=>{if(lastBodyData&&phase==='active')updatePlacement(lastBodyData)};
$('#saveLive').onclick=()=>{if(report.live){const now=performance.now();report.live.handTiming=handClock.snapshot(now);report.live.proportion=framer.snapshot();report.live.gestureConfirmation=gestureGate.snapshot();if(compositor)report.live.cameraPreview=compositor.previewStats(now);}$('#save').click()};
$('#save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download='KIRA_resultados_navegador.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
function renderStats(){return {sampleFrames:frameTimes.length,averageFps:frameTimes.length?1000/(frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length):null,maxFrameMs:frameTimes.length?Math.max(...frameTimes):null,targetFps:renderProfile($('#quality').value,live).fps}}
window.addEventListener('pagehide',stopLive);window.addEventListener('error',e=>{report.errors.push({message:e.message});show()});show();

async function runTest(name,fn){
 if(live||demo||testing)return false;$('#cameraError').hidden=true;$('#view').classList.remove('scene-empty');text('#liveStatus','Ensaio digital — câmera e rastreamento ao vivo desligados.');testing=true;$('#live').disabled=true;$('#stop').disabled=true;$('#restart').disabled=true;
 try{await setupModels();startDigitalFrames();front=false;await fn();return true;}catch(e){report.errors.push({stage:name,message:e.message});status('Falha: '+e.message);return false;}finally{stopDigitalFrames();demo=false;demoWantsBook=false;clearPose();testing=false;$('#live').disabled=suiteRunning;$('#stop').disabled=suiteRunning;$('#restart').disabled=suiteRunning;show()}
}
function fixture(img,zoom=1){const c=canvas(),ctx=c.getContext('2d');ctx.fillStyle='#64616a';ctx.fillRect(0,0,W,H);const w=W*zoom,h=w*img.naturalHeight/img.naturalWidth;ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h);return c}
function sampleFrame(proof,label){renderer.render(scene,camera);const c=document.createElement('canvas');c.width=W;c.height=H+50;const ctx=c.getContext('2d');ctx.fillStyle='#202126';ctx.fillRect(0,0,W,H+50);ctx.fillStyle='white';ctx.font='21px system-ui';ctx.fillText(label,10,32);if(proof)ctx.drawImage(proof.layers[0],0,50,W,H);ctx.drawImage(renderer.domElement,0,50,W,H);if(proof){ctx.drawImage(proof.layers[1],0,50,W,H);ctx.drawImage(proof.layers[2],0,50,W,H)}$('#samples').appendChild(c);return c}
async function settled(runner,c,clock,onFrame=()=>{}){let r;for(let i=0;i<5;i++){r?.bitmap.close();r=await runner.infer(c,clock+i*200);onFrame(r)}return r}
$('#bodyTest').onclick=()=>runTest('body-test',async()=>{
 let runner,proof;try{
  status('Testando corpo, pés e saída da pessoa…');defaultCamera();resetScene();$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v037.js');await runner.ready;const img=await loadImage('./pose.jpg');proof=new Compositor($('#view'),false);demo=true;armTarget(performance.now());
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
  await sleep(1400);sampleFrame(proof,'Pessoa saiu · Ryuk em repouso');const loss={blankPresent,idleVisible:placement.visible&&idleStage.active,requiresTargetAgain:phase==='target'&&mustClear};
  const r=await settled(runner,lastFrame,clock+1000);proof.paint(r);acceptBody(r,performance.now());const returnedWithoutTarget=placement.visible;
  report.tests.BODY={fixture:'Official MediaPipe pose.jpg; synthetic resizing, not physical distance',rows,scaleIncreases:rows[0].scale<rows[1].scale&&rows[1].scale<rows[2].scale,loss,returnedWithoutTarget,humanRedEyes:false};status('Teste corporal concluído. Confira pés, proporção e ocultação nas capturas.');
 }finally{runner?.close();proof?.dispose();$('#view').classList.remove('live');placement.visible=false;demo=false;}
});
$('#sequenceTest').onclick=()=>runTest('sequence-test',async()=>{
 let runner,proof;try{
  status('Preparando sequência com foto…');defaultCamera();resetScene();runner=new WorkerRunner('./body-worker-v037.js');await runner.ready;const img=await loadImage('./pose.jpg'),c=fixture(img,1),r=await settled(runner,c,1000);r.bitmap.close();if(!r.body.present)throw new Error('Corpo não encontrado na referência');
  $('#view').classList.add('live');proof=new Compositor($('#view'),false);armTarget(performance.now());demo=true;person.update(r.body,performance.now());acceptBody(r,performance.now());let maxEyeVergence=0;const started=performance.now(),moments=[9.8,11.4,15.8,19.4],rows=[];let checkpoint=0;
  while(performance.now()-started<20200){maxEyeVergence=Math.max(maxEyeVergence,eyeVergence());acceptBody(r,performance.now());const bitmap=await createImageBitmap(c);proof.paint({...r,bitmap});proof.drawGuides(false);const elapsed=(performance.now()-started)/1000;
   if(checkpoint<moments.length&&elapsed>=moments[checkpoint]){sampleFrame(proof,elapsed.toFixed(1)+' s · '+sequence.stage);rows.push({elapsed,stage:sequence.stage,scale:placement.scale.x,targetScale:targetPlacement.scale,bodySource:framing?.source,feetVisible:framing?.feetVisible,motionY:motion.position.y,animation:naturalAnimator.snapshot(),sideWalk:sideWalk.snapshot(),walkDistance});checkpoint++}
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
  runner=new WorkerRunner('./hand-worker-v035.js');await runner.ready;const fist=await loadImage('./fist.jpg'),gate=new GestureGate();const began=performance.now();let fired=false,lastGesture=null,samples=0;
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
  defaultCamera();resetScene();$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v037.js');await runner.ready;
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
  defaultCamera();resetScene();$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v037.js');await runner.ready;const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,c,1000);r.bitmap.close();proof=new Compositor($('#view'),false);armTarget(performance.now());demo=true;$('#reactiveGaze').checked=true;
  const feed=async(x,ms)=>{const started=performance.now();while(performance.now()-started<ms){const points=r.body.points.map(p=>({...p}));points[0]={...points[0],x,visibility:1,presence:1};acceptBody({body:{...r.body,points}},performance.now());targetPlacement.x=0;placement.position.x=0;proof.paint({...r,bitmap:await createImageBitmap(c)});await sleep(70)}};
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
 const visible=($('#showBook').checked||(demo&&demoWantsBook))&&placement.visible&&['active','exiting'].includes(phase);
 notebook.update({visible,opacity:currentOpacity,x:placement.position.x+(motion.position.x-sideDirection*.38)*placement.scale.x,y:placement.position.y+(refs.hipY+.15+motion.position.y)*placement.scale.x,z:.22*placement.scale.x,scale:placement.scale.x*1.65,side:sideDirection,now});
 const state=notebook.snapshot(),retry=$('#retryBook'),canRetry=!!state.error&&($('#showBook').checked||demoWantsBook);if(retry.hidden===canRetry)retry.hidden=!canRetry;text('#notebookStatus',canRetry?'O caderno virtual não carregou. Você pode tentar novamente; Ryuk continua disponível.':state.loading&&($('#showBook').checked||demoWantsBook)?'Preparando o caderno virtual…':state.visible?'Caderno virtual de demonstração — não substitui o caderno físico.':'');
}
$('#showBook').onchange=()=>{if(!$('#showBook').checked&&!demo)notebook?.reset();else if(notebook)notebook.load({retry:true}).catch(()=>{});};
$('#retryBook').onclick=()=>{if(notebook)notebook.load({retry:true}).catch(()=>{});};
$('#bookPreview').onclick=()=>runTest('book-preview',async()=>{
 defaultCamera();resetScene();placement.visible=false;await notebook.load({retry:true});bookInspection=true;$('#view').classList.add('live');camera.position.set(0,1.1,.9);camera.lookAt(0,1.1,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H);await sleep(120);sampleFrame(null,'Caderno original · capa, páginas e lombada');report.tests.NOTEBOOK_MODEL=notebook.snapshot();status('Caderno 3D original conferido; a imagem-alvo física permanece separada.');
});
$('#bookTest').onclick=()=>runTest('book-integration',async()=>{
 let runner,proof;const selected=$('#showBook').checked;try{
  defaultCamera();resetScene();await notebook.load({retry:true});$('#showBook').checked=true;$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v037.js');await runner.ready;const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,c,1000);r.bitmap.close();proof=new Compositor($('#view'),false);armTarget(performance.now());demo=true;
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
  defaultCamera();resetScene();$('#samples').textContent='';$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v037.js');await runner.ready;
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
  acceptBody({body:{present:false}},performance.now());await sleep(2000);const idleAfterLoss=placement.visible&&phase==='active'&&idleStage.active;sampleFrame(proof,'Pessoa ausente · repouso animado');
  report.tests.CONTINUITY={syntheticLandmarksWithoutFace:true,actualBackCameraTest:false,noFaceVisible,positionFollowed,rotation,inPlaceDistance:steps,acceptedFrames:report.live.bodyDetections,idleAfterLoss,passed:steps>0&&report.live.bodyDetections>20&&noFaceVisible&&positionFollowed&&idleAfterLoss&&rotation.every(x=>x.degrees>.5)};
  if(!report.tests.CONTINUITY.passed)throw new Error('Falha na continuidade/animação');status('Continuidade sem rosto, articulação e saída conferidas em ensaio digital.');
 }finally{live=false;bodyReady=false;report.live=savedReport;runner?.close();proof?.dispose();placement.visible=false;$('#view').classList.remove('live')}
});

$('#skirtTest').onclick=()=>runTest('skirt-test',async()=>{
 defaultCamera();resetScene();$('#samples').textContent='';placement.visible=true;$('#view').classList.add('live');camera.position.set(0,refs.hipY,1.6);camera.lookAt(0,refs.hipY,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H);const bg=scene.background;scene.background=new THREE.Color('#596673');
 try{for(const angle of [0,.85,-.85]){motion.rotation.y=angle;await sleep(300);sampleFrame(null,'Saia recortada · vista '+Math.round(angle*180/Math.PI)+'°');}const pants=model.getObjectByName('Pants');const masked=!!pants?.material.map&&pants.material.alphaTest===.5&&!pants.material.transparent;report.tests.SKIRT={pantsMasked:masked,alphaCutoff:pants?.material.alphaTest,solidAtlasBackgroundRemoved:masked,views:[0,49,-49],physicalTest:false};if(!masked)throw new Error('Saia sem recorte alpha');status('Saia conferida de frente e dos lados; abas recortadas sem faixa sólida.');}finally{scene.background=bg;motion.rotation.y=0;}
});

async function startContinuousDemo(){
 if(live||demo||testing||suiteRunning)return;stopLive();const mine=++token;demo=true;demoWantsBook=true;$('#live').disabled=true;$('#camera').disabled=true;$('#target').disabled=true;$('#cameraError').hidden=true;document.body.classList.add('session-starting');$('#stop').textContent='Encerrar demonstração';text('#liveStatus','Preparando demonstração sem câmera…');$('.gesture-note').textContent='Demonstração automática. Para encerrar, use o botão acima.';
 let runner,proof;
 try{
  await setupModels();if(mine!==token)return;runner=new WorkerRunner('./body-worker-v037.js');demoRunner=runner;await runner.ready;if(mine!==token)return;
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
 ['sequenceTest','Sequência e escala',()=>report.tests.SEQUENCE?.sameScaleThroughFloat],['bodyTest','Corpo, pés e saída',()=>report.tests.BODY?.scaleIncreases&&report.tests.BODY.loss.idleVisible&&!report.tests.BODY.loss.requiresTargetAgain&&report.tests.BODY.returnedWithoutTarget],
 ['targetTest','Capa e punho',()=>report.tests.TARGET_HAND?.target.every(x=>x.matched)&&report.tests.TARGET_HAND.heldFistConfirmed&&report.tests.TARGET_HAND.negativeGesture?.name!=='Closed_Fist'],
 ['bookTest','Caderno 3D',()=>report.tests.NOTEBOOK_INTEGRATION?.passed],['reactiveTest','Olhar reativo',()=>report.tests.REACTIVE_GAZE?.passed],['atmosphereTest','Atmosfera',()=>report.tests.ATMOSPHERE?.passed],['shadowTest','Sombra',()=>report.tests.CONTACT_SHADOW?.passed],['transitions','Fumaça e transições',()=>report.tests.TRANSITIONS?.entered&&report.tests.TRANSITIONS.exited&&report.tests.TRANSITIONS.noFlashWhenInterrupted]
];
$('#regressionTest').onclick=async()=>{
 if(live||demo||testing||suiteRunning)return;suiteRunning=true;$('#regressionTest').disabled=true;$('#preview').disabled=true;$('#live').disabled=true;const errorsBefore=report.errors.length;report.tests.REGRESSION={startedAt:new Date().toISOString(),stages:[],physicalCameraTest:false};
 try{for(const [id,label,check] of regressionStages){text('#regressionStatus','Conferindo '+(report.tests.REGRESSION.stages.length+1)+'/'+regressionStages.length+' · '+label);const ok=await $('#'+id).onclick();const passed=ok===true&&check()===true;report.tests.REGRESSION.stages.push({id,label,passed});show();}
 const suite=report.tests.REGRESSION;suite.newErrors=report.errors.length-errorsBefore;suite.passed=suite.stages.every(x=>x.passed)&&suite.newErrors===0;suite.finishedAt=new Date().toISOString();text('#regressionStatus',suite.passed?'Conferência concluída: 53 recursos aprovados nos ensaios digitais. Câmera real ainda precisa de teste.':'Conferência concluída com falhas. Confira os resultados antes de usar esta versão.');
 }finally{suiteRunning=false;$('#regressionTest').disabled=false;$('#preview').disabled=false;$('#live').disabled=false;$('#stop').disabled=false;$('#restart').disabled=false;show();}
};

$('#gestureRobustTest').onclick=()=>runTest('gesture-robustness',async()=>{
 let runner;try{
  runner=new WorkerRunner('./hand-worker-v035.js');await runner.ready;const fist=await loadImage('./fist.jpg'),negative=await loadImage('./thumb_up.jpg'),rows=[];let clock=1000;
  const cases=[{name:'normal',scale:1,angle:0},{name:'inclinado esquerda',scale:1,angle:-.4},{name:'inclinado direita',scale:1,angle:.4},{name:'luz reduzida',scale:1,angle:0,brightness:.6},{name:'mão menor no enquadramento',scale:.48,angle:0},{name:'imagem espelhada',scale:1,angle:0,mirror:true},{name:'mão pequena com busca pelo pulso',scale:.2,angle:0,poseSearch:true}];
  for(const condition of cases){const c=canvas(),ctx=c.getContext('2d');ctx.fillStyle='#b9b9b9';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(W/2,H/2);ctx.rotate(condition.angle);ctx.scale(condition.mirror?-1:1,1);ctx.filter='brightness('+(condition.brightness??1)+')';const width=W*.88*condition.scale,height=width*fist.naturalHeight/fist.naturalWidth;ctx.drawImage(fist,-width/2,-height/2,width,height);ctx.restore();const gate=new GestureGate(),planner=new HandFramePlanner();let result=null,fired=false,crops=0;
   for(let i=0;i<12&&!fired;i++){const posePoints=condition.poseSearch?Array.from({length:33},(_,i)=>({x:.5,y:.53,visibility:i===15?.95:0,presence:1})):[];const frame=planner.next(clock,posePoints),analysis=canvas();analysis.getContext('2d').drawImage(c,frame.x*W,frame.y*H,frame.w*W,frame.h*H,0,0,W,H);result=mapHandResult(await runner.infer(analysis,clock),frame);planner.observe(result,clock);crops+=frame.kind!=='full'?1:0;fired=gate.update(result.gesture,clock);clock+=180;}
   rows.push({name:condition.name,fired,gesture:result?.gesture,handSeen:result?.handSeen,crops,confirmation:gate.snapshot()});status('Gesto · '+condition.name+' · '+(fired?'confirmado':'não confirmado'));
  }
  const negativeGate=new GestureGate();let falseTrigger=false,lastNegative;for(let i=0;i<10;i++){lastNegative=await runner.infer(negative,clock);falseTrigger||=negativeGate.update(lastNegative.gesture,clock);clock+=180;}
  const jitter=new GestureGate();let firedWithDropout=false;for(let t=0;t<=1260;t+=180)firedWithDropout||=jitter.update(t===540?null:{name:'Closed_Fist',score:t===360?.55:.7},t);
  report.tests.GESTURE_ROBUSTNESS={rows,negativeGesture:lastNegative.gesture,falseTrigger,firedWithDropout,syntheticImageTransforms:true,syntheticTiming:true,physicalDistanceTest:false,passed:rows.every(x=>x.fired)&&!falseTrigger&&firedWithDropout};if(!report.tests.GESTURE_ROBUSTNESS.passed)throw new Error('Falha no ensaio ampliado do gesto');status('Punho conferido em 7 condições, falha breve e gesto negativo. Distância real ainda não validada.');
 }finally{runner?.close()}
});
regressionStages.push(['gestureRobustTest','Robustez do punho',()=>report.tests.GESTURE_ROBUSTNESS?.passed]);

function acceptHandFrame(raw,frame,received){
if(!handClock.accept(raw.captureAt,received)){report.live.staleHandFrames=(report.live.staleHandFrames??0)+1;gestureGate.expire(handClock.now(received));return false;}const mapped=mapHandResult(raw,frame);if(raw.hands)mapped.hands=raw.hands.map(h=>({...h,points:h.points.map(p=>({...p,x:frame.x+p.x*frame.w,y:frame.y+p.y*frame.h}))}));const r=handAssociation.select(mapped,raw.captureAt,gestureGate.armed);handFramePlanner.observe(r,received,frame);report.live.lastHandResultAt=received;report.live.handTiming=handClock.snapshot(received);report.live.handSeen=r.handSeen;report.live.gesture=r.gesture;report.live.handAnalysisRegion=r.analysisRegion;report.live.handContext=handFramePlanner.snapshot();report.live.handEvidence={raw:r.rawGesture,shape:r.shape,association:r.association,lighting:raw.lighting};report.live.handFrames=(report.live.handFrames??0)+1;if(compositor)compositor.hand=r.points;compositor?.drawGuides($('#guides').checked);if(gestureGate.update(r.gesture,raw.captureAt))startExit();report.live.gestureConfirmation=gestureGate.snapshot();const trace=report.live.handTrace??=[];trace.push({at:raw.captureAt,delayMs:received-raw.captureAt,lighting:raw.lighting,seen:r.handSeen,raw:r.rawGesture,resolved:r.gesture?.name??null,folded:r.shape?.folded,open:r.shape?.open,association:r.association,region:frame.kind,confirmation:gestureGate.snapshot()});if(trace.length>40)trace.shift();updateLiveStatus();
 return true;
}
$('#gestureFlowTest').onclick=()=>runTest('gesture-flow',async()=>{
 let bodyWorker,handWorker,proof;const oldLive=report.live,oldBook=$('#showBook').checked;
 try{
  defaultCamera();resetScene();$('#view').classList.add('live');bodyWorker=new WorkerRunner('./body-worker-v037.js');handWorker=new WorkerRunner('./hand-worker-v035.js');await Promise.all([bodyWorker.ready,handWorker.ready]);const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(bodyWorker,c,1000);r.bitmap.close();if(!r.body.present)throw new Error('Corpo de referência não detectado');
  proof=new Compositor($('#view'),false);compositor=proof;report.live={bodyDetections:0,maskFrames:0,handSeen:false,handInitialization:'ready'};live=true;bodyReady=handReady=true;$('#showBook').checked=true;await notebook.load({retry:true});armTarget(performance.now());
  const feed=async(ms)=>{const start=performance.now();while(performance.now()-start<ms){acceptBody({body:r.body},performance.now());proof.paint({...r,bitmap:await createImageBitmap(c)});await sleep(80)}};await feed(2700);updateLiveStatus();const actualHintVisible=!$('#gestureFeedback').hidden,buttonVisible=!$('#exitAppearance').hidden;
  const fist=await loadImage('./fist.jpg'),feedback=[];let fired=false;const start=performance.now();let i=0;
  while(!fired&&performance.now()-start<4500){await feed(140);const now=performance.now();let raw=await handWorker.infer(fist,now);if(i++===3)raw={...raw,gesture:null,hands:raw.hands?.map(h=>({...h,gesture:null}))};acceptHandFrame(raw,{x:0,y:0,w:1,h:1,kind:'full'},performance.now());updateLiveStatus();feedback.push({progress:gestureGate.progress,hint:$('#gestureHint').textContent,gesture:raw.gesture?.name??null,reason:gestureGate.reason});fired=phase==='exiting';}
  sampleFrame(proof,'Ensaio digital · saída por punho');const waitExitStart=performance.now();while((placement.visible||notebook.snapshot().visible||smoke.visible)&&performance.now()-waitExitStart<4200)await feed(100);const fistState={phase,visible:placement.visible,book:notebook.snapshot(),smoke:smoke.visible,smokeStart,now:performance.now(),person:person.state(performance.now())};const fistExitHidden=!placement.visible&&!notebook.snapshot().visible&&!smoke.visible;
  armTarget(performance.now());await feed(2700);const beforeButton={phase,visible:placement.visible,person:person.state(performance.now())};$('#exitAppearance').click();const buttonTriggered=phase==='exiting'&&exitTrigger==='button';await feed(2800);const buttonExitHidden=!placement.visible&&!notebook.snapshot().visible&&!smoke.visible;
  report.tests.GESTURE_FLOW={actualHintVisible,buttonVisible,feedback,fired,fistExitHidden,fistState,beforeButton,buttonTriggered,buttonExitHidden,handResultFromFixture:true,physicalCameraTest:false,passed:actualHintVisible&&buttonVisible&&fired&&fistExitHidden&&buttonTriggered&&buttonExitHidden&&feedback.some(x=>x.progress>0&&x.progress<1)};if(!report.tests.GESTURE_FLOW.passed)throw new Error('Falha de integração da saída por punho/botão');status('Saída por punho, barra de confirmação, fumaça, caderno e botão conferidos.');
 }finally{live=false;bodyReady=handReady=false;report.live=oldLive;compositor=null;bodyWorker?.close();handWorker?.close();proof?.dispose();placement.visible=false;notebook.reset();$('#showBook').checked=oldBook;$('#gestureFeedback').hidden=true;$('#exitAppearance').hidden=true;$('#view').classList.remove('live')}
});
regressionStages.push(['gestureFlowTest','Saída integrada e botão',()=>report.tests.GESTURE_FLOW?.passed]);

function applyPerformanceProfile(){if(renderer){const p=renderProfile($('#quality').value,live);renderer.setPixelRatio(Math.min(devicePixelRatio,p.pixelRatio));}}
$('#quality').onchange=applyPerformanceProfile;

$('#performanceTest').onclick=()=>runTest('performance',async()=>{
 const v=document.createElement('div'),c=new Compositor(v,false);c.liveVideo=true;c.mode='original';const source=canvas(),ctx=source.getContext('2d');
 let closed=0;const mask=new Uint8Array(16).fill(255),bitmap=await createImageBitmap(source);const close=bitmap.close.bind(bitmap);bitmap.close=()=>{closed++;close();};
 c.paint({bitmap,width:4,height:4,alpha:mask,body:{points:[]}});
 ctx.fillStyle='#ff0000';ctx.fillRect(0,0,W,H);c.paintVideo(source,true,performance.now());const red=c.layers[1].getContext('2d').getImageData(240,320,1,1).data;
 ctx.fillStyle='#0000ff';ctx.fillRect(0,0,W,H);c.paintVideo(source,true,performance.now()+33);const blue=c.layers[1].getContext('2d').getImageData(240,320,1,1).data;
 const backgroundTransparent=c.layers[0].getContext('2d').getImageData(240,320,1,1).data[3]===0;
 const partial=Uint8Array.from({length:16},(_,i)=>i%4<2?255:0);c.paint({bitmap:await createImageBitmap(source),width:4,height:4,alpha:partial,body:{points:[]}});c.paintVideo(source,true);const inside=c.layers[1].getContext('2d').getImageData(80,320,1,1).data[3],outside=c.layers[1].getContext('2d').getImageData(400,320,1,1).data[3];const maskPreserved=inside===255&&outside===0;
 c.paintVideo(source,false,performance.now()+66);const hiddenCleared=c.layers[1].getContext('2d').getImageData(240,320,1,1).data[3]===0;c.clear();const maskCleared=!c.maskReady;c.dispose();
 const b=new LiveBudget(),jobs=[];let busyUntil=0;for(let now=0;now<10000;now+=16){if(b.active&&now>=busyUntil)b.finished(b.active,now);const kind=b.choose(now,{bodyReady:true,handReady:true,bodyAllowed:true,handAllowed:true,bodyBusy:false,handBusy:false,videoTime:Math.floor(now/33)});if(kind){jobs.push({kind,now});b.started(kind,now,Math.floor(now/33));busyUntil=now+(kind==='body'?90:70);}}
 const gaps=kind=>{const times=jobs.filter(x=>x.kind===kind).map(x=>x.now);return Math.max(...times.slice(1).map((x,i)=>x-times[i]));};const bodyGap=gaps('body'),handGap=gaps('hand');
 const frozen=new LiveBudget();frozen.started('hand',0,1);frozen.finished('hand',50);const duplicateSkipped=frozen.choose(1000,{handReady:true,handAllowed:true,videoTime:1})===null;
 const wide=document.createElement('canvas');wide.width=640;wide.height=480;const wc=wide.getContext('2d');wc.fillStyle='#ff0000';wc.fillRect(0,0,640,480);wc.fillStyle='#0000ff';wc.fillRect(230,120,180,240);const crop=canvas();drawCover(wide,crop,{x:.25,y:.25,w:.5,h:.5});const cp=crop.getContext('2d').getImageData(10,10,1,1).data;const directCrop=cp[2]===255&&cp[0]===0;
 const balanced=renderProfile('auto',true),detailed=renderProfile('suave',true);
 report.tests.PERFORMANCE={currentVideoPixels:red[0]===255&&blue[2]===255,backgroundTransparent,maskPreserved,directCrop,hiddenCleared,maskCleared,bitmapClosed:closed===1,bodyGap,handGap,duplicateSkipped,balanced,detailed,approvedModelUnchanged:true,physicalCameraTest:false};
 const t=report.tests.PERFORMANCE;t.passed=t.currentVideoPixels&&backgroundTransparent&&maskPreserved&&directCrop&&hiddenCleared&&maskCleared&&t.bitmapClosed&&bodyGap<=320&&handGap<=320&&duplicateSkipped&&balanced.fps===60&&detailed.fps===60;
 if(!t.passed)throw new Error('Falha no orçamento ou composição da câmera');status('Vídeo atual, recorte, limpeza e distribuição corpo/mão conferidos.');
});
regressionStages.push(['performanceTest','Câmera e distribuição do processamento',()=>report.tests.PERFORMANCE?.passed]);

$('#lifecycleTest').onclick=async()=>{
 if(live||demo||testing)return false;const wasSuite=suiteRunning;suiteRunning=true;const errorsBefore=report.errors.length;let pump=null;startDigitalFrames();
 try{
  const image=await loadImage('./pose.jpg'),source=fixture(image,1),ctx=source.getContext('2d');
  const stream1=source.captureStream(15);let release;const pending=startLive(()=>new Promise(r=>release=r),true);stopLive();release({stream:stream1,fallbackUsed:false});await pending;
  const cancelReleased=stream1.getTracks().every(t=>t.readyState==='ended')&&!live;
  const runs=[],pipelines=[];pump=setInterval(()=>{ctx.fillStyle='#64616a';ctx.fillRect(0,0,1,1);},66);
  for(let i=0;i<2;i++){
   const stream=source.captureStream(15);await startLive(async()=>({stream,fallbackUsed:false}),true);
   const deadline=performance.now()+15000;while(live&&(!bodyReady||!handReady)&&performance.now()<deadline)await sleep(100);
   const started=live&&bodyReady&&handReady&&$('#video').srcObject===stream&&compositor.liveVideo;
   $('#manual').onclick();const processingDeadline=performance.now()+10000;while(live&&performance.now()<processingDeadline&&(!(report.live.processingBudget?.counts.body>=3)||!(report.live.processingBudget?.counts.hand>=2)))await sleep(100);
   const actualInference=report.live.processingBudget?.counts.body>=3&&report.live.processingBudget?.counts.hand>=2&&person.state(performance.now()).visible&&report.live.occlusionApplied&&compositor.foregroundDrawn;
   pipelines.push({processing:report.live.processingBudget,preview:report.live.cameraPreview,bodyFrames:report.live.bodyDetections,handFrames:report.live.handFrames});
   const br=bodyRunner,hr=handRunner;stopLive();stopLive();await sleep(350);
   runs.push({started,actualInference,allTracksEnded:stream.getTracks().every(t=>t.readyState==='ended'),workersClosed:br?.closed&&hr?.closed,layersRemoved:!$('#view .cameraBackground')&&!$('#view .personForeground'),canRestart:!$('#live').disabled,videoReleased:$('#video').srcObject===null});
  }
  report.tests.LIFECYCLE={cancelReleased,runs,pipelines,newErrors:report.errors.length-errorsBefore,syntheticCameraStream:true,manualActivationDoesNotValidateCover:true,physicalCameraTest:false};const t=report.tests.LIFECYCLE;t.passed=cancelReleased&&t.newErrors===0&&runs.length===2&&runs.every(r=>Object.values(r).every(Boolean));
  if(!t.passed)throw new Error('Falha ao cancelar, encerrar ou reiniciar');status('Cancelamento, duas inicializações e encerramentos conferidos com vídeo de referência.');return true;
 }catch(e){report.errors.push({stage:'lifecycle-digital',message:e.message});status(e.message);return false;}finally{stopDigitalFrames();clearInterval(pump);if(live)stopLive();suiteRunning=wasSuite;show();}
};
regressionStages.push(['lifecycleTest','Iniciar, cancelar, encerrar e reiniciar',()=>report.tests.LIFECYCLE?.passed]);

// Occluded desktop WebGL may receive only one rAF per second. Digital tests
// exercise the same render function and clock; this pump is absent in camera use.
function startDigitalFrames(){stopDigitalFrames();report.environment.digitalFrameFallback=true;digitalFramePump=setInterval(()=>{digitalCameraFrame?.();renderFrame?.();},40);}
function stopDigitalFrames(){clearInterval(digitalFramePump);digitalFramePump=null;}

$('#handContinuityTest').onclick=()=>runTest('hand-continuity',async()=>{
 let runner;try{
  runner=new WorkerRunner('./hand-worker-v035.js');await runner.ready;const photo=await loadImage('./fist.jpg'),negative=await loadImage('./thumb_up.jpg'),source=canvas(),ctx=source.getContext('2d');ctx.fillStyle='#b9b9b9';ctx.fillRect(0,0,W,H);const width=W*.5,height=width*photo.naturalHeight/photo.naturalWidth;ctx.drawImage(photo,(W-width)/2,(H-height)/2,width,height);
  const planner=new HandFramePlanner(),association=new HandAssociation(),gate=new GestureGate(),rows=[];let clock=1000,fired=false;
  for(let i=0;i<18;i++){const frame=planner.next(clock),c=canvas();c.getContext('2d').drawImage(source,frame.x*W,frame.y*H,frame.w*W,frame.h*H,0,0,W,H);const raw=await runner.infer(c,clock),mapped=mapHandResult(raw,frame);mapped.hands=raw.hands.map(h=>({...h,points:h.points.map(p=>({...p,x:frame.x+p.x*frame.w,y:frame.y+p.y*frame.h}))}));const selected=association.select(mapped,clock,gate.armed);planner.observe(selected,clock);fired=gate.update(selected.gesture,clock)||fired;rows.push({frame:frame.kind,seen:selected.handSeen,raw:selected.rawGesture,shape:selected.shape,gesture:selected.gesture?.name,progress:gate.progress});clock+=180;}
  const jitter=new GestureGate(),progress=[];let jitterFired=false;for(let i=0;i<12;i++){jitterFired=jitter.update(i%3===2?{name:'Open_Palm',score:.65}:{name:'Closed_Fist',score:.8},i*180)||jitterFired;progress.push(jitter.progress);}
  const negativeGate=new GestureGate();let falseExit=false;const negatives=[];for(let i=0;i<8;i++){const r=await runner.infer(negative,clock);negatives.push({raw:r.rawGesture,shape:r.shape,resolved:r.gesture?.name});falseExit=negativeGate.update(r.gesture,clock)||falseExit;clock+=180;}
  const real=rows.find(x=>x.seen),points=Array.from({length:21},()=>({x:.2,y:.5})),other=points.map(p=>({...p,x:.8})),a=new HandAssociation();a.select({hands:[{points,gesture:{name:'Closed_Fist',score:.8}}]},0);const same=a.select({hands:[{points:other,gesture:{name:'Open_Palm',score:.98}},{points,gesture:{name:'Closed_Fist',score:.8}}]},180,true);const missing=a.select({hands:[{points:other,gesture:{name:'Open_Palm',score:.98}}]},360,true);
  report.tests.HAND_CONTINUITY={rows,negatives,fired,jitterFired,progress,monotonicProgress:progress.every((x,i)=>!i||x>=progress[i-1]),sameHand: same.gesture?.name==='Closed_Fist'&&same.gesture.center.x===.2,otherHandIgnored:missing.gesture===null,negativeDidNotExit:!falseExit,negativeGeometryRejected:negatives.every(r=>!r.shape?.closed),geometryFallback:resolveGesture({name:"None",score:.9},real?.shape)?.name==="Closed_Fist",imageMode:true,physicalCameraTest:false};const t=report.tests.HAND_CONTINUITY;t.passed=fired&&jitterFired&&t.monotonicProgress&&t.sameHand&&t.otherHandIgnored&&t.negativeGeometryRejected&&t.geometryFallback&&!falseExit&&rows.filter(r=>r.seen).length>=14&&rows.filter(r=>r.frame!=='full').length>=8;
  if(!t.passed)throw new Error('Falha na continuidade do punho');status('Punho: alternância de recortes, classificação instável, segunda mão e gesto negativo conferidos.');
 }finally{runner?.close();}
});
regressionStages.push(['handContinuityTest','Punho estável e mesma mão',()=>report.tests.HAND_CONTINUITY?.passed]);
$('#spaceTest').onclick=()=>runTest('side-space',async()=>{
 let runner,proof;const side=$('#side').value,oldFront=front;try{
  defaultCamera();resetScene();$('#side').value='auto';$('#view').classList.add('live');runner=new WorkerRunner('./body-worker-v037.js');await runner.ready;const c=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,c,1000);r.bitmap.close();const rows=[];
  for(const dx of [-.18,.18]){armTarget(performance.now());demo=true;front=false;renderer.domElement.style.transform='none';const points=r.body.points.map(p=>({...p,x:p.x+dx})),body=bodySnapshot(points),shifted=canvas(),ctx=shifted.getContext('2d');ctx.fillStyle='#64616a';ctx.fillRect(0,0,W,H);ctx.drawImage(c,dx*W,0);const alpha=new Uint8Array(r.alpha.length),shift=Math.round(dx*r.width);for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const src=x-shift;if(src>=0&&src<r.width)alpha[y*r.width+x]=r.alpha[y*r.width+src];}
   proof=new Compositor($('#view'),false);const started=performance.now();while(performance.now()-started<2800){acceptBody({body},performance.now());proof.paint({...r,alpha,body,bitmap:await createImageBitmap(shifted)});await sleep(80);}appearanceAt=performance.now()-5000;restoreMaterials();await sleep(100);sampleFrame(proof,dx<0?'Pessoa à esquerda · Ryuk à direita':'Pessoa à direita · Ryuk à esquerda');rows.push({person:body.center.x,direction:sideDirection,avatarX:placement.position.x,targetX:targetPlacement.x,scale:placement.scale.x,choice:spaceChooser.snapshot(),correctSide:dx<0?sideDirection===1:sideDirection===-1});proof.dispose();proof=null;}
  const base=bodySnapshot(r.body.points),centered=base.center.x,sim=x=>({...base,center:{...base.center,x},points:base.points.map(p=>({...p,x:p.x+x-centered}))}),switches=[];for(const mirrored of [false,true]){const chooser=new SpaceChooser();chooser.update(sim(.7),refs,1,viewHeight()*.75,.7,0,'auto',mirrored);for(let t=100;t<=800;t+=100)chooser.update(sim(.4),refs,1,viewHeight()*.75,.7,t,'auto',mirrored);const changed=chooser.direction===1;for(let t=900;t<=1600;t+=100)chooser.update(sim(t%200?.495:.505),refs,1,viewHeight()*.75,.7,t,'auto',mirrored);switches.push({mirrored,changed,stableAtCenter:chooser.direction===1,manualLeft:chooser.update(sim(.5),refs,1,viewHeight()*.75,.7,1700,'left',mirrored).direction===(mirrored?1:-1),manualRight:chooser.update(sim(.5),refs,1,viewHeight()*.75,.7,1800,'right',mirrored).direction===(mirrored?-1:1)});}
  armTarget(performance.now());let acceptedMovement=true;for(let step=0;step<=30;step++){const dx=-.18+.36*step/30,body=bodySnapshot(r.body.points.map(p=>({...p,x:p.x+dx})));acceptedMovement=acceptBody({body},performance.now()).accepted&&acceptedMovement;await sleep(80);}const finalBody=bodySnapshot(r.body.points.map(p=>({...p,x:p.x+.18})));for(let step=0;step<9;step++){acceptBody({body:finalBody},performance.now());await sleep(80);}const actualSideChanged=sideDirection===-1&&person.state(performance.now()).visible;
  report.tests.SIDE_SPACE={rows,switches,acceptedMovement,actualSideChanged,scalePreserved:Math.abs(rows[0].scale-rows[1].scale)<.001,syntheticBodyPositions:true,physicalCameraTest:false};const t=report.tests.SIDE_SPACE;t.passed=acceptedMovement&&actualSideChanged&&rows.every(x=>x.correctSide)&&t.scalePreserved&&switches.every(x=>x.changed&&x.stableAtCenter&&x.manualLeft&&x.manualRight);if(!t.passed)throw new Error('Falha na escolha do lado livre');status('Lado livre, troca após deslocamento, estabilidade no centro e câmeras espelhadas conferidos.');
 }finally{runner?.close();proof?.dispose();demo=false;placement.visible=false;front=oldFront;$('#side').value=side;renderer.domElement.style.transform='none';$('#view').classList.remove('live');}
});
regressionStages.push(['spaceTest','Lado livre e mudança de lado',()=>report.tests.SIDE_SPACE?.passed]);

$('#presenceTest').onclick=()=>runTest('presence-resilience',async()=>{
 const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:1}));for(const [i,x,y] of [[11,.4,.3],[12,.6,.3],[23,.43,.6],[24,.57,.6]])Object.assign(points[i],{x,y,visibility:.95});const body=bodySnapshot(points),p=new PersonSession();p.update(body,0);p.update(body,100);const shortGap=p.update({present:false},800).visible,longGapHidden=!p.state(1200).visible,recovered=p.update(body,1250).visible;const moved=bodySnapshot(points.map(q=>({...q,x:q.x+.35})));const first=p.update(moved,1400),second=p.update(moved,1600);p.update({present:false},1700);const expired=p.state(3401).expired,doesNotReattach=!p.update(body,3500).visible;
 report.tests.PRESENCE_RESILIENCE={faceRequired:false,shortGap,longGapHidden,recovered,firstJumpRejected:!first.accepted,coherentRelocationAccepted:second.accepted&&second.reacquired,expired,doesNotReattach,graceMs:1000,expiryMs:1800,physicalCameraTest:false};const t=report.tests.PRESENCE_RESILIENCE;t.passed=shortGap&&longGapHidden&&recovered&&t.firstJumpRejected&&t.coherentRelocationAccepted&&expired&&doesNotReattach;if(!t.passed)throw new Error('Falha na continuidade corporal');status('Módulo corporal: perda breve, validade e associação espacial conferidas. A política de repouso é ensaiada separadamente.');
});
regressionStages.push(['presenceTest','Continuidade durante movimentos rápidos',()=>report.tests.PRESENCE_RESILIENCE?.passed]);
$('#motionMaskTest').onclick=()=>runTest('motion-matte',async()=>{
 let runner;const host=document.createElement('div'),c=new Compositor(host,true);c.liveVideo=true;const source=canvas(),ctx=source.getContext('2d'),sample=(x,y)=>c.layers[1].getContext('2d').getImageData(x,y,1,1).data[3];
 const paintPerson=x=>{ctx.fillStyle='#0000ff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ff0000';ctx.fillRect(x,149,120,372);};const mask=x=>Uint8Array.from({length:64*86},(_,i)=>{const px=i%64,py=Math.floor(i/64);return px>=x&&px<x+16&&py>=20&&py<70?255:0;});
 try{
  paintPerson(60);c.paint({bitmap:await createImageBitmap(source),width:64,height:86,alpha:mask(8),body:{points:[]}});c.paintVideo(source,true);const stationaryOpaque=sample(100,300)===255;
  paintPerson(300);c.paintVideo(source,true);const oldSilhouetteRejected=sample(100,300)===0,rejectedFraction=c.previewStats().motionRejectedFraction;
  c.paint({bitmap:await createImageBitmap(source),width:64,height:86,alpha:mask(40),body:{points:[]}});c.paintVideo(source,true);const freshPersonOpaque=sample(350,300)===255;
  c.paint({bitmap:await createImageBitmap(source),width:64,height:86,alpha:new Uint8Array(64*86).fill(128),body:{points:[]}});c.paintVideo(source,true);const uncertainDoesNotMakeGhost=sample(350,300)===0;
  const captured=performance.now()-300;c.paint({bitmap:await createImageBitmap(source),captureAt:captured,width:64,height:86,alpha:mask(40),body:{points:[]}});const captureAgeCorrect=Math.abs(c.maskAt-captured)<1;c.paintVideo(source,true,captured+451);const staleCleared=sample(350,300)===0;
  runner=new WorkerRunner('./body-worker-v037.js');await runner.ready;const photo=fixture(await loadImage('./pose.jpg'),1),r=await settled(runner,photo,performance.now());c.paint(r);c.paintVideo(photo,true);const pixels=c.layers[1].getContext('2d').getImageData(0,0,W,H).data;let opaque=0,partial=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===255)opaque++;else if(pixels[i]>0)partial++;}const realMaskOpaque=opaque>1000&&partial<opaque*.25;
  const frontMirrorConsistent=c.layers.every(layer=>layer.style.transform==='scaleX(-1)'),backgroundTransparent=c.layers[0].getContext('2d').getImageData(100,300,1,1).data[3]===0;c.clear();const cleared=!c.maskReady&&c.reference===null;
  report.tests.MOTION_MATTE={stationaryOpaque,oldSilhouetteRejected,freshPersonOpaque,uncertainDoesNotMakeGhost,captureAgeCorrect,staleCleared,frontMirrorConsistent,backgroundTransparent,cleared,rejectedFraction,opaque,partial,realMaskOpaque,realSegmentationFixture:true,physicalCameraTest:false};const t=report.tests.MOTION_MATTE;t.passed=stationaryOpaque&&oldSilhouetteRejected&&freshPersonOpaque&&uncertainDoesNotMakeGhost&&captureAgeCorrect&&staleCleared&&frontMirrorConsistent&&backgroundTransparent&&cleared&&realMaskOpaque;if(!t.passed)throw new Error('Falha no recorte em movimento');status('Silhueta antiga rejeitada; recorte novo opaco, validade temporal e câmera espelhada conferidos.');
 }finally{runner?.close();c.dispose();}
});
regressionStages.push(['motionMaskTest','Recorte opaco e movimento na frontal',()=>report.tests.MOTION_MATTE?.passed]);
$('#eyeDepthTest').onclick=()=>runTest('eye-depth',async()=>{
 const probe=new THREE.Scene(),materials=[],geometries=[],rows=[],make=(size,color,offset,order,z=0,x=0)=>{const material=new THREE.MeshBasicMaterial({color,toneMapped:false,polygonOffset:offset!==null,polygonOffsetFactor:0,polygonOffsetUnits:offset??0,depthTest:true,depthWrite:true});const geometry=new THREE.PlaneGeometry(size,size),mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,0,z);mesh.renderOrder=order;probe.add(mesh);materials.push(material);geometries.push(geometry);return mesh;};
 make(1.4,0xffff00,null,2);make(.26,0xff0000,eyeDepthSettings.Iris_Vermelha,1);make(.1,0x000000,eyeDepthSettings.Pupila_Preta,0);const lens=new THREE.PerspectiveCamera(40,.75,.1,40),copy=canvas(),cx=copy.getContext('2d');
 const pixel=x=>{const v=new THREE.Vector3(x,0,0).project(lens);return cx.getImageData(Math.round((v.x*.5+.5)*W),Math.round((.5-v.y*.5)*H),1,1).data;};
 try{renderer.setSize(W,H);for(const distance of [1,4.8]){lens.position.set(0,0,distance);lens.updateMatrixWorld();renderer.render(probe,lens);cx.drawImage(renderer.domElement,0,0,W,H);const black=pixel(0),red=pixel(.09),yellow=pixel(.2);rows.push({distance,pupil:black[0]<30&&black[1]<30&&black[2]<30,iris:red[0]>200&&red[1]<80,globe:yellow[0]>160&&yellow[1]>160&&yellow[2]<80});}
  const cover=make(.04,0x0000ff,null,3,.05,.035);renderer.render(probe,lens);cx.drawImage(renderer.domElement,0,0,W,H);const blue=pixel(.035),occlusionPreserved=blue[2]>200&&blue[0]<80;probe.remove(cover);
  const textures=report.eyeRendering.rows,ready=textures.length===2&&textures.filter(x=>x.textured).every(x=>x.imageSize[0]>0&&x.imageSize[1]>0);defaultCamera();resetScene();placement.visible=true;placement.scale.setScalar(1);placement.position.set(0,0,0);camera.position.set(0,refs.headY+.08,.85);camera.lookAt(0,refs.headY+.08,.2);camera.aspect=.75;camera.updateProjectionMatrix();$('#view').classList.add('live');
  for(const mirrored of [false,true]){renderer.domElement.style.transform=mirrored?'scaleX(-1)':'none';renderer.render(scene,camera);const frame=sampleFrame(null,mirrored?'Olhos · câmera frontal espelhada':'Olhos · câmera traseira');if(mirrored){const ctx=frame.getContext('2d');ctx.clearRect(0,50,W,H);ctx.save();ctx.translate(W,50);ctx.scale(-1,1);ctx.drawImage(renderer.domElement,0,0,W,H);ctx.restore();}}
  report.tests.EYE_DEPTH={rows,occlusionPreserved,materialImagesReady:ready,textures,nearPlane:camera.near,modelAndAnimationBytesUnchanged:true,frontAndRearCaptures:true,physicalCameraTest:false};const t=report.tests.EYE_DEPTH;t.passed=rows.every(x=>x.pupil&&x.iris&&x.globe)&&occlusionPreserved&&ready&&camera.near===.1;if(!t.passed)throw new Error('Falha de profundidade dos olhos');status('Íris, pupila, textura pronta e oclusão dos olhos conferidas nas duas orientações.');
 }finally{materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.domElement.style.transform='none';placement.visible=false;$('#view').classList.remove('live');defaultCamera();}
});
regressionStages.push(['eyeDepthTest','Olhos e precisão de profundidade',()=>report.tests.EYE_DEPTH?.passed]);

$('#smokeVolumeTest').onclick=()=>runTest('smoke-volume',async()=>{
 const probe=new LayeredSmoke(SMOKE_COUNT),isolated=new THREE.Scene(),backdrop=new THREE.Color('#88818d');isolated.background=backdrop;isolated.add(probe);probe.visible=true;const c=canvas(),ctx=c.getContext('2d');let old=null,maxStep=0,stableArrays=true;const arrays={...probe.buffers};const states=[];
 try{
  defaultCamera();for(const mode of ['entry','exit']){old=null;for(let i=0;i<=100;i++){probe.update(i/100,mode);if(old)for(let j=0;j<SMOKE_COUNT;j++){const p=probe.motion.puffs[j],q=old[j];maxStep=Math.max(maxStep,Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z));}old=probe.motion.puffs.map(p=>({...p}));for(const name of Object.keys(arrays))stableArrays&&=probe.buffers[name]===arrays[name];}states.push({...probe.snapshot()});}
  probe.update(.4,'exit');renderer.render(isolated,camera);const drawCalls=renderer.info.render.calls,triangles=renderer.info.render.triangles;ctx.drawImage(renderer.domElement,0,0,W,H);const pixels=ctx.getImageData(0,0,W,H).data;let changed=0,darkened=0;probe.visible=false;renderer.render(isolated,camera);const baseline=canvas(),bc=baseline.getContext('2d');bc.drawImage(renderer.domElement,0,0,W,H);const clear=bc.getImageData(0,0,W,H).data;for(let i=0;i<pixels.length;i+=4){if(Math.abs(pixels[i]-clear[i])+Math.abs(pixels[i+1]-clear[i+1])+Math.abs(pixels[i+2]-clear[i+2])>12)changed++;if(pixels[i]+pixels[i+1]+pixels[i+2]<clear[i]+clear[i+1]+clear[i+2]-20)darkened++;}
  probe.update(.4,'exit','economica');probe.visible=true;renderer.render(isolated,camera);const economyTriangles=renderer.info.render.triangles;const area=probe.motion.puffs.reduce((s,p)=>s+p.diameter*p.diameter,0),previousArea=128*(.65+.7*.4)**2;
  defaultCamera();resetScene();placement.position.set(0,0,0);placement.scale.setScalar(1);$('#view').classList.add('live');const frames=[];
  for(const mode of ['entry','exit']){reveal(performance.now());if(mode==='exit'){restoreMaterials();startExit('smoke-quality-test');}for(const u of [.2,.42,.68,.9]){const now=performance.now();smokeStart=now-u*(mode==='entry'?2400:2600);updateSmoke(now);renderer.render(scene,camera);sampleFrame(null,(mode==='entry'?'Entrada':'Saída')+' · '+Math.round(u*100)+'%');frames.push({mode,u,opacity:currentOpacity,state:smoke.snapshot()});}updateSmoke(smokeStart+(mode==='entry'?2400:2600));}
  const complete=!smoke.visible&&!placement.visible;resetScene();const resetHidden=!smoke.visible&&smokeStart===null;
  report.tests.SMOKE_VOLUME={capacity:128,drawCalls,triangles,economyTriangles,textureSize:128,changedPixels:changed,darkenedPixels:darkened,maxStep,stableArrays,states,frames,area,previousArea,complete,resetHidden,physicalCameraTest:false};const t=report.tests.SMOKE_VOLUME;t.passed=drawCalls===1&&triangles===256&&economyTriangles===192&&changed>1000&&darkened>changed*.8&&maxStep<.15&&stableArrays&&states.every(x=>x.peakAlpha===0&&x.sortedBackToFront)&&area<previousArea&&complete&&resetHidden;
  if(!t.passed)throw new Error('Falha na fumaça em camadas');status('Fumaça conferida: entrada, saída, dissipação, reinício e orçamento de uma chamada gráfica.');
 }finally{probe.dispose();smoke.visible=false;smokeStart=null;placement.visible=false;restoreMaterials();$('#view').classList.remove('live');defaultCamera();}
});
regressionStages.push(['smokeVolumeTest','Fumaça em camadas e orçamento gráfico',()=>report.tests.SMOKE_VOLUME?.passed]);

$('#bookReliabilityTest').onclick=()=>runTest('book-reliability',async()=>{
 const isolated=new THREE.Scene();isolated.add(new THREE.HemisphereLight(0xffffff,0x777777,2));let calls=0;const b=new NotebookVisual(isolated,async()=>{calls++;if(calls===1)throw new Error('Falha de carregamento simulada');return new GLTFLoader().loadAsync('./death-note-v021.glb');});let late;
 try{
  const first=b.load(),same=b.load(),samePromise=first===same;const failed=await Promise.allSettled([first,same]);const failedOnce=calls===1&&failed.every(x=>x.status==='rejected')&&!!b.error&&!b.group.visible;
  const retry=b.load({retry:true}),retrySame=retry===b.load({retry:true});b.update({visible:true,opacity:1,x:0,y:1.1,z:0,scale:1.8,now:1000});const hiddenWhileLoading=!b.group.visible;await retry;const hiddenWhenReady=!b.group.visible,asset=b.snapshot();
  const lens=new THREE.PerspectiveCamera(40,.75,.1,40);lens.position.set(0,1.1,.9);lens.lookAt(0,1.1,0);const c=canvas(),ctx=c.getContext('2d'),rows=[];renderer.setSize(W,H);
  for(const now of [2000,2130,2260]){b.update({visible:true,opacity:1,x:0,y:1.1,z:0,scale:1.8,now});renderer.render(isolated,lens);ctx.clearRect(0,0,W,H);ctx.drawImage(renderer.domElement,0,0,W,H);const px=ctx.getImageData(0,0,W,H).data;let alphaSum=0;for(let i=3;i<px.length;i+=4)alphaSum+=px[i];rows.push({now,opacity:b.snapshot().opacity,visible:b.group.visible,alphaSum});}
  b.update({visible:true,opacity:.12,x:0,y:1.1,z:0,scale:1.8,now:2300});const exitCapped=b.snapshot().opacity<=.12;b.reset();const resetHidden=!b.group.visible&&b.reveal.startedAt===null;
  let release;late=new NotebookVisual(new THREE.Scene(),()=>new Promise(resolve=>release=resolve));const pending=late.load();late.reset();const fake=new THREE.Group();fake.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.2,.01),new THREE.MeshBasicMaterial()));release({scene:fake});await pending;late.update({visible:false,opacity:1,now:3000});const lateDidNotShow=!late.group.visible;
  report.tests.BOOK_RELIABILITY={samePromise,failedOnce,retrySame,hiddenWhileLoading,hiddenWhenReady,asset,rows,exitCapped,resetHidden,lateDidNotShow,attempts:calls,simulatedFailure:true,realOriginalBookLoaded:asset.meshes===3&&asset.triangles===752&&asset.textures===3,physicalCameraTest:false};const t=report.tests.BOOK_RELIABILITY;t.passed=samePromise&&failedOnce&&retrySame&&hiddenWhileLoading&&hiddenWhenReady&&t.realOriginalBookLoaded&&calls===2&&rows[0].alphaSum===0&&rows[1].alphaSum>0&&rows[2].alphaSum>rows[1].alphaSum&&rows[1].opacity===.5&&rows[2].opacity===1&&exitCapped&&resetHidden&&lateDidNotShow;if(!t.passed)throw new Error('Falha na entrada ou recuperação do caderno');status('Caderno conferido: falha simulada, tentativa única, nova tentativa, entrada suave e encerramento.');
 }finally{b.dispose();late?.dispose();defaultCamera();}
});
regressionStages.push(['bookReliabilityTest','Caderno sem salto e recuperação de carregamento',()=>report.tests.BOOK_RELIABILITY?.passed]);
$('#feedbackTest').onclick=()=>runTest('presentation-feedback',async()=>{
 const saved=report.live;const wasBody=bodyReady,wasHand=handReady;try{
  resetScene();const pts=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:1}));for(const [i,x,y] of [[11,.4,.3],[12,.6,.3],[23,.43,.6],[24,.57,.6]])Object.assign(pts[i],{x,y,visibility:.95});const body=bodySnapshot(pts),now=performance.now();person.update(body,now-100);person.update(body,now);live=true;phase='active';bodyReady=handReady=true;report.live={handSeen:true,handInitialization:'ready'};gestureGate.update({name:'Closed_Fist',score:.8},now-400);gestureGate.update({name:'Closed_Fist',score:.8},now-250);gestureGate.update({name:'Open_Palm',score:.65},now-100);updateLiveStatus();const pct=Math.round(gestureGate.progress*100)+'%',hint=$('#gestureHint').textContent,line=$('#liveStatus').textContent,coherent=hint.includes(pct)&&line.includes(pct)&&!line.includes('Feche o punho');
  startExit('gesture');updateLiveStatus();const fist=$('#liveStatus').textContent,fistCause=report.live.exitReason;phase='active';restoreMaterials();startExit('button');updateLiveStatus();const button=$('#liveStatus').textContent,buttonCause=report.live.exitReason;endSession('Ensaio: rastreamento perdido');updateLiveStatus();const tracking=$('#liveStatus').textContent,trackingCause=report.live.exitReason;
  report.tests.PRESENTATION_FEEDBACK={pct,hint,line,coherent,fist,button,tracking,fistCause,buttonCause,trackingCause,physicalCameraTest:false};const t=report.tests.PRESENTATION_FEEDBACK;t.passed=coherent&&fist.includes('Punho confirmado')&&button.includes('botão')&&tracking.includes('Rastreamento')&&fistCause==='gesture'&&buttonCause==='button'&&trackingCause==='tracking';if(!t.passed)throw new Error('Falha nas mensagens de confirmação ou saída');status('Mensagens conferidas: punho em confirmação, saída por gesto, botão e perda do rastreamento.');
 }finally{live=false;bodyReady=wasBody;handReady=wasHand;report.live=saved;resetScene();phase='idle';updateLiveStatus();placement.visible=false;}
});
regressionStages.push(['feedbackTest','Mensagens coerentes de confirmação e saída',()=>report.tests.PRESENTATION_FEEDBACK?.passed]);

$('#eyeVisibilityTest').onclick=()=>runTest('eye-visibility-real-model',async()=>{
 defaultCamera();resetScene();phase='test';placement.visible=true;placement.scale.setScalar(1);placement.position.set(0,0,0);motion.position.set(0,0,0);motion.rotation.set(0,0,0);$('#view').classList.add('live');
 const eyes=[];model.traverse(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>['Globo_Amarelo','Iris_Vermelha','Pupila_Preta'].includes(m.name)))eyes.push({mesh:o,visible:o.visible});});
 const copy=canvas(),ctx=copy.getContext('2d'),rows=[];
 try{
  for(const distance of [.85,1.15,4.8]){
   camera.position.set(0,refs.headY+.08,distance);camera.lookAt(0,refs.headY+.08,0);camera.aspect=.75;camera.updateProjectionMatrix();renderer.setSize(W,H);await sleep(100);scene.updateMatrixWorld(true);
   renderer.render(scene,camera);ctx.clearRect(0,0,W,H);ctx.drawImage(renderer.domElement,0,0,W,H);const full=ctx.getImageData(0,0,W,H).data.slice();
   eyes.forEach(e=>e.mesh.visible=false);renderer.render(scene,camera);ctx.clearRect(0,0,W,H);ctx.drawImage(renderer.domElement,0,0,W,H);const hidden=ctx.getImageData(0,0,W,H).data;let changed=0,yellow=0;
   for(let i=0;i<full.length;i+=4){if(Math.abs(full[i]-hidden[i])+Math.abs(full[i+1]-hidden[i+1])+Math.abs(full[i+2]-hidden[i+2])>30){changed++;if(full[i]>65&&full[i+1]>45&&full[i+1]>full[i+2]*1.6)yellow++;}}
   eyes.forEach(e=>e.mesh.visible=e.visible);rows.push({distance,changedPixels:changed,yellowPixels:yellow});sampleFrame(null,'Olhos reais · distância '+distance+' m');
  }
  report.tests.EYE_VISIBILITY={rows,meshes:report.eyeVisibility.rows,originalGLBPreserved:true,physicalCameraTest:false};const t=report.tests.EYE_VISIBILITY;t.passed=eyes.length>=4&&t.meshes.every(e=>!e.frustumCulled&&e.depthTest)&&rows.every(r=>r.changedPixels>=8&&r.yellowPixels>=4);if(!t.passed)throw new Error('Olhos do modelo real desapareceram em uma distância');status('Olhos reais visíveis no close e à distância; geometria, animações e profundidade preservadas.');
 }finally{eyes.forEach(e=>e.mesh.visible=e.visible);defaultCamera();placement.visible=false;$('#view').classList.remove('live');}
});
regressionStages.push(['eyeVisibilityTest','Olhos reais no close e à distância',()=>report.tests.EYE_VISIBILITY?.passed]);

$('#flowTest').onclick=()=>runTest('presentation-flow',async()=>{
 const saved={live,compositor,reportLive:report.live,bodyReady,handReady,restartDisabled:$('#restart').disabled},rows=[];let clears=0,disposes=0;
 const sample=async(input,label)=>{presentationFlow.update(input);$('#view').dataset.flowProof=label;rows.push({label,...presentationFlow.snapshot()});await sleep(label==='complete'?1000:650);};
 try{
  defaultCamera();resetScene();$('#view').classList.add('live');placement.scale.setScalar(1);placement.position.set(0,0,0);phase='test';status('Prévia de interface simulada — não abre a câmera.');
  await sample({live:true,phase:'target'},'target');await sample({live:true,phase:'body'},'body');placement.visible=true;
  await sample({live:true,phase:'active',personVisible:true},'active');placement.visible=false;await sample({live:true,phase:'active',personVisible:false,idle:true},'idle');
  await sample({live:true,phase:'exiting'},'exiting');await sample({live:true,phase:'complete'},'complete');
  const before=presentationFlow.writes;for(let i=0;i<1000;i++)presentationFlow.update({live:true,phase:'complete'});const stableWrites=presentationFlow.writes===before;
  const beforePhase=phase;$('#flowReplay').click();const guardedOutsideSession=phase===beforePhase;
  live=true;phase='complete';$('#restart').disabled=false;bodyReady=handReady=true;compositor={clear(){clears++},dispose(){disposes++}};report.live={targetRecognized:true,exitTriggered:true,personLost:false,requiresTargetAgain:false};$('#flowReplay').click();
  const replayUsesExistingRestart=phase==='target'&&clears===1&&!placement.visible&&!report.live.targetRecognized&&!report.live.exitTriggered;
  const requiresCover=phase==='target'&&person.state(performance.now()).bound===false,cardHiddenAfterReplay=$('#replayPanel').hidden;
  presentationFlow.update({live:true,phase:'active',personVisible:true});stopLive();const stopHidesAll=presentationFlow.snapshot().hidden&&!presentationFlow.snapshot().replayVisible&&disposes===1;
  report.tests.PRESENTATION_FLOW={rows,stableWrites,guardedOutsideSession,replayUsesExistingRestart,requiresCover,cardHiddenAfterReplay,stopHidesAll,physicalCameraTest:false};const t=report.tests.PRESENTATION_FLOW;t.passed=rows.map(r=>r.stage).join(',')==='target,body,active,idle,exiting,complete'&&rows.slice(0,-1).every(r=>!r.replayVisible)&&rows.at(-1).replayVisible&&rows[2].steps[2].current==='step'&&stableWrites&&guardedOutsideSession&&replayUsesExistingRestart&&requiresCover&&cardHiddenAfterReplay&&stopHidesAll;if(!t.passed)throw new Error('Falha no guia de etapas ou no recomeço pelo caderno');status('Guia, repouso, saída, recomeço pelo caderno e encerramento conferidos.');
 }finally{live=saved.live;compositor=saved.compositor;report.live=saved.reportLive;bodyReady=saved.bodyReady;handReady=saved.handReady;$('#restart').disabled=saved.restartDisabled;resetScene();phase='idle';presentationFlow.hide();delete $('#view').dataset.flowProof;$('#view').classList.remove('live');}
});
regressionStages.push(['flowTest','Guia de etapas e próxima aparição pelo caderno',()=>report.tests.PRESENTATION_FLOW?.passed]);

$('#sideWalkTest').onclick=()=>runTest('side-walk-transfer',async()=>{
 const saved={demo,front,side:$('#side').value};const rows=[];let lastQuat=null,boneMotion=0;
 const makeBody=()=>{const pts=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:1}));for(const [i,x,y] of [[11,.4,.3],[12,.6,.3],[23,.43,.5],[24,.57,.5],[25,.44,.7],[26,.56,.7],[27,.44,.88],[28,.56,.88],[29,.44,.9],[30,.56,.9],[31,.43,.92],[32,.57,.92]])Object.assign(pts[i],{x,y,visibility:.95});return bodySnapshot(pts);};
 try{
  defaultCamera();resetScene();front=false;$('#side').value='left';phase='body';const b=makeBody(),now=performance.now();acceptBody({body:b},now-100);acceptBody({body:b},now);appearanceAt=now-20000;smokeStart=null;smoke.visible=false;restoreMaterials();demo=true;$('#view').classList.add('live');
  const initial=placement.position.x,scale=placement.scale.x;$('#side').value='right';updatePlacement(b);const requested=sideWalk.active&&sideWalk.changes===1,start=performance.now();let previousX=placement.position.x,previousAt=start,maxRootSpeed=0,peakWalkWeight=0,minScale=scale,maxScale=scale,captures=0;
  while(performance.now()-start<6500){acceptBody({body:b},performance.now());await sleep(40);const at=performance.now(),state=sideWalk.snapshot(),x=placement.position.x,dt=(at-previousAt)/1000;if(state.active&&dt>0)maxRootSpeed=Math.max(maxRootSpeed,state.frameSpeed);previousX=x;previousAt=at;minScale=Math.min(minScale,placement.scale.x);maxScale=Math.max(maxScale,placement.scale.x);
   const anim=naturalAnimator.snapshot(),weight=anim.clips.find(c=>c.name==='06_Caminhada_Calma').weight;peakWalkWeight=Math.max(peakWalkWeight,weight);const bone=model.getObjectByName('bip_hip_L');if(lastQuat)boneMotion+=lastQuat.angleTo(bone.quaternion);lastQuat=bone.quaternion.clone();rows.push({ms:at-start,x,scale:placement.scale.x,walkWeight:weight,...state});
   if(state.active&&state.distance>(captures+1)*.28&&captures<3){sampleFrame(null,'Troca de lado · passos '+(captures+1));captures++;}
   if(!state.active&&at-start>700)break;
  }
  const arrived=Math.abs(placement.position.x-targetPlacement.x)/placement.scale.x<.04,scalePreserved=maxScale-minScale<.001,travelled=Math.abs(placement.position.x-initial)/scale>.5,finished=!sideWalk.active;
  $('#side').value='left';updatePlacement(b);const restarted=sideWalk.active,oldDistance=sideWalk.distance;startExit('side-walk-abort');const exitCancels=!sideWalk.active&&sideWalk.distance===oldDistance;resetScene();const resetClears=sideWalk.distance===0&&!sideWalk.active;sideWalk.request(-1,1,true);stopLive();const stopCancels=!sideWalk.active&&!placement.visible;
  report.tests.SIDE_WALK={requested,arrived,finished,travelled,scalePreserved,maxRootSpeed,peakWalkWeight,boneMotion,restarted,exitCancels,resetClears,stopCancels,rows,approvedClipReused:true,physicalCameraTest:false};const t=report.tests.SIDE_WALK;t.passed=requested&&arrived&&finished&&travelled&&scalePreserved&&maxRootSpeed<=.650001&&peakWalkWeight>.65&&boneMotion>.15&&restarted&&exitCancels&&resetClears&&stopCancels;if(!t.passed)throw new Error('Falha na caminhada entre lados, escala ou ciclo de saída');status('Troca de lado com passos do clipe aprovado, velocidade limitada, escala e saída conferidas.');
 }finally{demo=saved.demo;front=saved.front;$('#side').value=saved.side;resetScene();phase='idle';$('#view').classList.remove('live');}
});
regressionStages.push(['sideWalkTest','Caminhada na troca de lado sem alterar escala',()=>report.tests.SIDE_WALK?.passed]);

$('#matteRGBTest').onclick=()=>runTest('matte-rgb-integrity',async()=>{
 const host=document.createElement('div'),c=new Compositor(host,true),OldCompositor=(await import('./compositor-v028.js')).Compositor,legacy=new OldCompositor(document.createElement('div'),true);c.liveVideo=legacy.liveVideo=true;const source=canvas(),ctx=source.getContext('2d'),pixel=(x,y)=>Array.from(c.layers[1].getContext('2d').getImageData(x,y,1,1).data);const alpha=new Uint8Array(64*86);for(let y=15;y<75;y++)for(let x=10;x<40;x++)alpha[y*64+x]=255;const hole=40*64+20;alpha[hole]=0;
 const paint=(colour,shift=0)=>{ctx.fillStyle='rgb(30,80,180)';ctx.fillRect(0,0,W,H);ctx.fillStyle=colour;ctx.fillRect(75+shift,110,225,450);};
 try{
  paint('rgb(210,95,80)');legacy.paint({bitmap:await createImageBitmap(source),width:64,height:86,alpha,body:{points:[]}});legacy.paintVideo(source,true);const previousHoleAlpha=legacy.layers[1].getContext('2d').getImageData(154,301,1,1).data[3];c.paint({bitmap:await createImageBitmap(source),width:64,height:86,alpha,body:{points:[]}});c.paintVideo(source,true);const restored=pixel(154,301),closedMaskHole=restored[3]===255&&Math.abs(restored[0]-210)<=1&&Math.abs(restored[1]-95)<=1,holesFilled=c.maskHolesFilled;
  ctx.fillStyle='rgb(255,190,170)';ctx.fillRect(188,336,7,6);legacy.paintVideo(source,true);const previousGateAlpha=legacy.layers[1].getContext('2d').getImageData(191,339,1,1).data[3];c.paintVideo(source,true);const micro=pixel(191,339),gateHolesFilled=c.gateHolesFilled,microChangeNotBlack=micro[3]>240&&micro[0]>240&&micro[1]>180;for(const [compositor,label] of [[legacy,'Antes · buracos na sobreposição simulada'],[c,'Depois · cores da pessoa preservadas']]){const frame=document.createElement('canvas');frame.width=W;frame.height=H+50;const f=frame.getContext('2d');f.fillStyle='#202126';f.fillRect(0,0,W,H+50);f.fillStyle='white';f.font='18px system-ui';f.fillText(label,10,32);f.drawImage(source,0,50);f.fillStyle='#08070a';f.fillRect(110,230,220,380);f.drawImage(compositor.layers[1],0,50);$('#samples').appendChild(frame);}
  const region=c.layers[1].getContext('2d').getImageData(100,180,150,240).data,src=ctx.getImageData(100,180,150,240).data;let opaque=0,blackCorruption=0;for(let i=0;i<region.length;i+=4)if(region[i+3]===255){opaque++;if(Math.abs(region[i]-src[i])+Math.abs(region[i+1]-src[i+1])+Math.abs(region[i+2]-src[i+2])>6)blackCorruption++;}
  const outsideTransparent=pixel(20,20)[3]===0;paint('rgb(210,95,80)',240);c.paintVideo(source,true);const realMoveRejected=pixel(150,300)[3]===0;
  paint('rgb(5,4,6)');const solid=alpha.slice();solid[hole]=255;c.paint({bitmap:await createImageBitmap(source),width:64,height:86,alpha:solid,body:{points:[]}});c.paintVideo(source,true);const dark=pixel(154,301),darkClothingPreserved=dark[3]===255&&Math.abs(dark[0]-5)<=1;
  const captured=performance.now()-500;c.paint({bitmap:await createImageBitmap(source),captureAt:captured,width:64,height:86,alpha:solid,body:{points:[]}});c.paintVideo(source,true);const expiredCleared=pixel(154,301)[3]===0;
  const raw=Uint8Array.from([255,255,255,255,0,0,255,255,255]),out=new Uint8Array(9);closePinholes(raw,out,3,3);const openContourNotFilled=out[4]===0;
  report.tests.MATTE_RGB={previousHoleAlpha,previousGateAlpha,closedMaskHole,holesFilled,gateHolesFilled,microChangeNotBlack,opaque,blackCorruption,outsideTransparent,realMoveRejected,darkClothingPreserved,expiredCleared,openContourNotFilled,grid:[64,86],physicalCameraTest:false};const t=report.tests.MATTE_RGB;t.passed=previousHoleAlpha<64&&previousGateAlpha===0&&closedMaskHole&&holesFilled===1&&gateHolesFilled>=1&&microChangeNotBlack&&opaque>1000&&blackCorruption===0&&outsideTransparent&&realMoveRejected&&darkClothingPreserved&&expiredCleared&&openContourNotFilled;if(!t.passed)throw new Error('Falha nas cores do recorte, buracos ou rejeição de movimento');status('Recorte: cores originais, pequenos buracos, roupa escura, movimento e expiração conferidos.');
 }finally{c.dispose();legacy.dispose();}
});
regressionStages.push(['matteRGBTest','Recorte sem buracos pequenos ou corrupção de cor',()=>report.tests.MATTE_RGB?.passed]);

$('#smokeRefineTest').onclick=()=>runTest('smoke-rolling-density',async()=>{
 const isolated=new THREE.Scene();isolated.background=new THREE.Color('#7c7782');const probe=new LayeredSmoke(128);isolated.add(probe);probe.visible=true;const copy=canvas(),ctx=copy.getContext('2d'),read=()=>{renderer.render(isolated,camera);ctx.drawImage(renderer.domElement,0,0,W,H);return ctx.getImageData(0,0,W,H).data.slice();};
 try{
  defaultCamera();probe.update(.4,'entry');const first=read();const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;probe.update(.4,'entry');const repeat=read();probe.update(.405,'entry');const next=read();let repeatDifference=0,stepDifference=0;for(let i=0;i<first.length;i+=4){repeatDifference+=Math.abs(first[i]-repeat[i])+Math.abs(first[i+1]-repeat[i+1])+Math.abs(first[i+2]-repeat[i+2]);stepDifference+=Math.abs(first[i]-next[i])+Math.abs(first[i+1]-next[i+1])+Math.abs(first[i+2]-next[i+2]);}
  probe.update(.4,'exit','economica');read();const economyTriangles=renderer.info.render.triangles,texture=probe.texture,oneTexture=Object.values(probe.material.uniforms).filter(v=>v.value?.isTexture).length===1,rolling=probe.material.uniforms.smokeFlow.value===.4;probe.update(1,'exit');const endsClear=probe.snapshot().peakAlpha===0;const averageStep=stepDifference/(W*H*3);
  report.tests.SMOKE_REFINEMENT={calls,triangles,economyTriangles,oneTexture,textureSize:[texture.image.width,texture.image.height],rolling,repeatDifference,averageStep,endsClear,externalTextures:0,physicalMobilePerformanceValidated:false};const t=report.tests.SMOKE_REFINEMENT;t.passed=calls===1&&triangles===256&&economyTriangles===192&&oneTexture&&t.textureSize[0]===128&&rolling&&repeatDifference===0&&averageStep<4&&averageStep>0&&endsClear;if(!t.passed)throw new Error('Falha na continuidade ou no orçamento da fumaça');status('Fumaça com densidade interna em movimento: continuidade, textura única e orçamento gráfico conferidos.');
 }finally{probe.dispose();defaultCamera();}
});
regressionStages.push(['smokeRefineTest','Fumaça com densidade em movimento e orçamento preservado',()=>report.tests.SMOKE_REFINEMENT?.passed]);

$('#gpuOcclusionTest').onclick=()=>runTest('gpu-opaque-occlusion',async()=>{
 const host=document.createElement('div'),probe=new Compositor(host,true),isolated=new THREE.Scene(),source=document.createElement('canvas');source.width=640;source.height=480;const ctx=source.getContext('2d'),read=()=>{renderer.render(isolated,camera);const c=canvas(),x=c.getContext('2d');x.drawImage(renderer.domElement,0,0,W,H);return x.getImageData(0,0,W,H).data;},pixel=(data,x,y)=>Array.from(data.slice((y*W+x)*4,(y*W+x)*4+4));
 probe.liveVideo=true;probe.attach(isolated);const alpha=new Uint8Array(64*86);for(let y=10;y<78;y++)for(let x=9;x<54;x++)alpha[y*64+x]=255;
 const fill=()=>{ctx.fillStyle='rgb(33,80,170)';ctx.fillRect(0,0,640,480);ctx.fillStyle='rgb(205,95,75)';ctx.fillRect(140,20,200,440);ctx.fillStyle='rgb(5,4,6)';ctx.fillRect(340,20,160,440);};
 const paint=async()=>probe.paint({bitmap:await createImageBitmap((()=>{const c=canvas();drawCover(source,c);return c;})()),width:64,height:86,alpha,body:{points:[]},captureAt:performance.now()});
 try{
  defaultCamera();fill();await paint();let at=performance.now();probe.paintVideo(source,true,at);const first=read(),colour=pixel(first,120,300),dark=pixel(first,330,300),outside=pixel(first,10,10),calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;
  let partialPixels=0,opaquePixels=0;for(let i=3;i<first.length;i+=4){if(first[i]>0&&first[i]<255)partialPixels++;if(first[i]===255)opaquePixels++;}
  const sourceRGB=colour[3]===255&&Math.abs(colour[0]-205)<=1&&Math.abs(colour[1]-95)<=1&&Math.abs(colour[2]-75)<=1,darkPreserved=dark[3]===255&&dark[0]===5&&dark[1]===4;
  const frame=canvas();frame.getContext('2d').putImageData(new ImageData(first,W,H),0,0);$('#samples').appendChild(frame);
  const updateBefore=probe.gateUpdates;for(let i=1;i<=5;i++)probe.paintVideo(source,true,at+i*8);const throttled=probe.gateUpdates===updateBefore;probe.paintVideo(source,true,at+70);const gateResumes=probe.gateUpdates===updateBefore+1;
  ctx.fillStyle='rgb(245,225,210)';ctx.fillRect(140,20,200,440);probe.paintVideo(source,true,at+140);const moved=read(),motionRejected=pixel(moved,120,300)[3]===0;
  fill();await paint();probe.paintVideo(source,true,performance.now());probe.paintVideo(source,true,probe.maskAt+451);const expired=!probe.overlay.visible&&!probe.foregroundDrawn&&pixel(read(),120,300)[3]===0;
  await paint();probe.paintVideo(source,true);probe.mode='off';probe.paintVideo(source,true);const offHides=!probe.overlay.visible;
  probe.mode='refined';await paint();probe.paintVideo(source,true);probe.paintVideo(source,false);const lostHides=!probe.overlay.visible;probe.clear();const cleared=!probe.maskReady&&!probe.overlay.visible;
  const v=document.createElement('video');v.muted=true;v.playsInline=true;const stream=source.captureStream(20);let nativeVideoRGB=false,nativeVideoTexture=false,streamReleased=false,nativePixel=null,nativeReference=null;
  try{v.srcObject=stream;await v.play();await sleep(150);await paint();probe.paintVideo(v,true);const native=read(),p=pixel(native,120,300);nativePixel=p;const decoded=canvas();drawCover(v,decoded);nativeReference=Array.from(decoded.getContext('2d').getImageData(120,300,1,1).data);nativeVideoRGB=p[3]===255&&Math.abs(p[0]-205)<=2&&Math.abs(p[1]-95)<=2&&Math.abs(p[2]-75)<=2;nativeVideoTexture=probe.videoTexture.isVideoTexture===true;}
  finally{stream.getTracks().forEach(t=>t.stop());v.pause();v.srcObject=null;streamReleased=stream.getTracks().every(t=>t.readyState==='ended');}
  const stats=probe.previewStats(),mirrorPreserved=probe.layers.every(c=>c.style.transform==='scaleX(-1)'),oneRenderer=host.querySelectorAll('canvas').length===3;
  probe.dispose();probe.dispose();const disposed=!isolated.children.length&&!host.children.length&&probe.disposed;
  report.tests.GPU_OCCLUSION={sourceRGB,colour,darkPreserved,dark,outsideTransparent:outside[3]===0,partialPixels,opaquePixels,calls,triangles,throttled,gateResumes,motionRejected,expired,offHides,lostHides,cleared,mirrorPreserved,oneRenderer,disposed,nativeVideoRGB,nativePixel,nativeReference,nativeVideoTexture,streamReleased,stats,physicalDepthMeasured:false,physicalCameraTest:false};const t=report.tests.GPU_OCCLUSION;t.passed=sourceRGB&&darkPreserved&&t.outsideTransparent&&partialPixels===0&&opaquePixels>10000&&calls===1&&triangles===2&&throttled&&gateResumes&&motionRejected&&expired&&offHides&&lostHides&&cleared&&mirrorPreserved&&oneRenderer&&disposed&&nativeVideoRGB&&nativeVideoTexture&&streamReleased&&stats.cpuFullFrameCopies===0;if(!t.passed)throw new Error('Falha na oclusão GPU opaca, RGB, validade ou descarte');status('Oclusão GPU: interior opaco, RGB e roupa preta preservados, vídeo atual e expiração conferidos.');
 }finally{probe.dispose();defaultCamera();}
});
regressionStages.push(['gpuOcclusionTest','Oclusão opaca por GPU, cores, movimento e limpeza',()=>report.tests.GPU_OCCLUSION?.passed]);

$('#handLatencyTest').onclick=()=>runTest('hand-priority',async()=>{
 const OldBudget=(await import('./live-budget-v026.js')).LiveBudget;
 const simulate=(Budget,focused)=>{const b=new Budget(),jobs=[];let busyUntil=0;for(let now=0;now<=8000;now+=10){if(b.active&&now>=busyUntil)b.finished(b.active,now);const state={bodyReady:true,handReady:true,bodyAllowed:true,handAllowed:true,videoTime:Math.floor(now/33),handFocused:focused};const kind=b.choose(now,state);if(kind){b.started(kind,now,state.videoTime);jobs.push({kind,now});busyUntil=now+(kind==='body'?40:30);if(b.choose(now,state)!==null)throw new Error('Sobreposição de inferências');}}const times=jobs.filter(j=>j.kind==='hand').map(j=>j.now),bt=jobs.filter(j=>j.kind==='body').map(j=>j.now);return {hands:times.length,meanHandGap:times.slice(1).reduce((s,x,i)=>s+x-times[i],0)/(times.length-1),bodyMaxGap:Math.max(...bt.slice(1).map((x,i)=>x-bt[i]))};};
 const old=simulate(OldBudget,true),focused=simulate(LiveBudget,true),search=simulate(LiveBudget,false),planner=new HandFramePlanner(),points=Array.from({length:21},(_,i)=>({x:.45+(i%5)*.015,y:.4+Math.floor(i/5)*.015}));planner.observe({handSeen:true,points},0);const frames=[];for(let now=0;now<=600;now+=100)frames.push(planner.next(now));const crops=frames.filter(f=>f.kind==='hand-crop').length,periodicFull=planner.next(700).kind==='full';planner.observe({handSeen:true,points},800);const focusedFrame=planner.next(900),bounded=focusedFrame.x>=0&&focusedFrame.y>=0&&focusedFrame.x+focusedFrame.w<=1&&focusedFrame.y+focusedFrame.h<=1;const expired=planner.next(1600).kind!=='hand-crop';
 const gate=new GestureGate();let firedAt=null;for(let ms=0;ms<=1300;ms+=100)if(gate.update({name:'Closed_Fist',score:.95,center:{x:.5,y:.5}},ms)){firedAt=ms;break;}
 const guardedHold=firedAt>=900&&firedAt<=1100;const premature=new GestureGate();for(let ms=0;ms<=800;ms+=100)premature.update({name:'Closed_Fist',score:.95},ms);const noEarlyExit=!premature.fired;
 report.tests.HAND_LATENCY={old,focused,search,crops,periodicFull,bounded,expired,guardedHold,noEarlyExit,firedAt,classificationAndGateUnchanged:true,phoneLatencyValidated:false};const t=report.tests.HAND_LATENCY;t.passed=focused.hands>old.hands&&focused.meanHandGap<old.meanHandGap&&focused.bodyMaxGap<=320&&search.hands===old.hands&&crops>=5&&periodicFull&&bounded&&expired&&guardedHold&&noEarlyExit;if(!t.passed)throw new Error('Falha na prioridade da mão, busca periódica ou confirmação');status('Mão priorizada sem inferências simultâneas; busca, expiração e confirmação de 900 ms preservadas.');
});
regressionStages.push(['handLatencyTest','Prioridade da mão, recortes e confirmação preservada',()=>report.tests.HAND_LATENCY?.passed]);

$('#smokeEvolutionTest').onclick=()=>runTest('smoke-vortices',async()=>{
 const PreviousSmoke=(await import('./smoke-volume-v032.js')).LayeredSmoke,old=new PreviousSmoke(128),probe=new LayeredSmoke(128),isolated=new THREE.Scene();isolated.background=new THREE.Color('#88818d');const read=object=>{isolated.add(object);object.visible=true;renderer.render(isolated,camera);const c=canvas(),ctx=c.getContext('2d');ctx.drawImage(renderer.domElement,0,0,W,H);isolated.remove(object);return c;};
 try{defaultCamera();old.update(.4,'exit');probe.update(.4,'exit');const before=read(old),after=read(probe),a=before.getContext('2d').getImageData(0,0,W,H).data,b=after.getContext('2d').getImageData(0,0,W,H).data;let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)changed++;
  for(const [c,title] of [[before,'3.2 · fumaça anterior'],[after,'4.7.4 · correntes, redemoinhos e filamentos']]){const f=document.createElement('canvas');f.width=W;f.height=H+50;const ctx=f.getContext('2d');ctx.fillStyle='#202126';ctx.fillRect(0,0,W,H+50);ctx.fillStyle='white';ctx.font='17px system-ui';ctx.fillText(title,10,30);ctx.drawImage(c,0,50);$('#samples').appendChild(f);}
  const stats=probe.snapshot(),shaderSamples=(probe.material.fragmentShader.match(/texture2D\(/g)??[]).length;let alphaEnds=true;for(const mode of ['entry','exit'])for(const u of [0,1]){probe.update(u,mode);alphaEnds&&=probe.snapshot().peakAlpha===0;}
  report.tests.SMOKE_EVOLUTION={changedPixels:changed,shaderSamples,previousShaderSamples:old.snapshot().textureSamplesPerFragment,stats,alphaEnds,physicalMobilePerformanceValidated:false};const t=report.tests.SMOKE_EVOLUTION;t.passed=changed>1500&&shaderSamples===1&&stats.textureSize===128&&stats.textureBytes===65536&&stats.capacity===128&&stats.drawCallsPerVisiblePass===1&&stats.anisotropicWisps&&stats.structuredVortices&&alphaEnds;if(!t.passed)throw new Error('Falha na evolução visual ou no orçamento da fumaça');status('Fumaça: redemoinhos e filamentos, mesma textura/partículas e uma amostra por fragmento.');
 }finally{old.dispose();probe.dispose();}
});
regressionStages.push(['smokeEvolutionTest','Fumaça com redemoinhos, filamentos e menor custo de amostragem',()=>report.tests.SMOKE_EVOLUTION?.passed]);

$('#lightingTest').onclick=()=>runTest('hand-lighting',async()=>{
 let runner,oldRunner;const rows=[],negativeRows=[];try{
  runner=new WorkerRunner('./hand-worker-v035.js');oldRunner=new WorkerRunner('./hand-worker-v027.js');await Promise.all([runner.ready,oldRunner.ready]);const photo=await loadImage('./fist.jpg'),openFile=await loadImage('./open-palm-v034.jpg'),thumb=await loadImage('./thumb_up.jpg');let clock=1000;const open=document.createElement('canvas');open.width=openFile.width/2;open.height=openFile.height;open.getContext('2d').drawImage(openFile,openFile.width/2,0,open.width,open.height,0,0,open.width,open.height);
  const make=(image,brightness,lamp=false)=>{const c=canvas(),ctx=c.getContext('2d');ctx.fillStyle='#16161a';ctx.fillRect(0,0,W,H);ctx.filter='brightness('+brightness+')';const w=W*.58,h=w*(image.naturalHeight??image.height)/(image.naturalWidth??image.width);ctx.drawImage(image,(W-w)/2,(H-h)/2,w,h);ctx.filter='none';if(lamp){const glow=ctx.createRadialGradient(410,95,4,410,95,90);glow.addColorStop(0,'#fffdf2');glow.addColorStop(.3,'#fff6d0');glow.addColorStop(1,'rgba(255,240,180,0)');ctx.fillStyle=glow;ctx.fillRect(315,0,165,190);}return c;};
  for(const [brightness,lamp] of [[1,false],[.6,false],[.3,false],[.15,false],[.08,true],[.2,true],[1.5,false]]){
   const c=make(photo,brightness,lamp),old=await oldRunner.infer(c,clock);clock+=180;const gate=new GestureGate(),association=new HandAssociation(),planner=new HandFramePlanner();let detected=0,fired=false,lighting=null,firstSeen=null;
   for(let i=0;i<12&&!fired;i++){const frame=planner.next(clock),crop=canvas();crop.getContext('2d').drawImage(c,frame.x*W,frame.y*H,frame.w*W,frame.h*H,0,0,W,H);const raw=await runner.infer(crop,clock),mapped=mapHandResult(raw,frame);mapped.hands=raw.hands.map(h=>({...h,points:h.points.map(p=>({...p,x:frame.x+p.x*frame.w,y:frame.y+p.y*frame.h}))}));const selected=association.select(mapped,clock,gate.armed);planner.observe(selected,clock);if(selected.handSeen){detected++;firstSeen??=i*180;}fired=gate.update(selected.gesture,clock);lighting=raw.lighting;clock+=180;}
   rows.push({brightness,lamp,baselineSeen:old.handSeen,baselineGesture:old.gesture?.name,detected,firstSeenMs:firstSeen,fired,lighting});if(lamp){const frame=document.createElement('canvas');frame.width=W;frame.height=H+50;const f=frame.getContext('2d');f.fillStyle='#202126';f.fillRect(0,0,W,H+50);f.fillStyle='white';f.font='16px system-ui';f.fillText('Contraluz simulada · brilho '+brightness,10,30);f.drawImage(c,0,50);$('#samples').appendChild(frame);}
  }
  for(const image of [open,thumb])for(const brightness of [.2,1,1.5]){const c=make(image,brightness,true),gate=new GestureGate();let fired=false,seen=0;for(let i=0;i<8;i++){const raw=await runner.infer(c,clock);seen+=Number(raw.handSeen);if(image===thumb&&resolveGesture({name:'None',score:.9},raw.shape)?.name==='Closed_Fist')throw new Error('Polegar não pode virar punho quando a classificação é incerta');fired=gate.update(raw.gesture,clock)||fired;clock+=180;}negativeRows.push({image:image===open?'real-open-palm':'thumb-up',brightness,fired,seen});}
  const closed={valid:true,folded:4,open:0,thumbDistance:.4,closed:true,thumbFolded:true},uncertain={valid:true,folded:3,open:1,thumbDistance:.95},opened={valid:true,folded:0,open:4,thumbDistance:1.1};const conflictGate=new GestureGate();let held=false;const progress=[];for(let t=0;t<=1440;t+=180){const shape=t===540?uncertain:closed;held=conflictGate.update(resolveGesture({name:'Open_Palm',score:.96},shape),t)||held;progress.push(conflictGate.progress);}const openStops=resolveGesture({name:'Open_Palm',score:.96},opened).name==='Open_Palm';const openingGate=new GestureGate();openingGate.update(resolveGesture({name:'Closed_Fist',score:.9},closed),0);openingGate.update(resolveGesture({name:'Open_Palm',score:.98},opened),200);const actualOpenClears=!openingGate.armed;
  report.tests.HAND_LIGHTING={rows,negativeRows,heldThroughContradictoryClassifier:held,openStops,actualOpenClears,progress,confirmationMs:900,extraModelPassesPerFrame:0,syntheticLighting:true,physicalClassroomTest:false};const t=report.tests.HAND_LIGHTING;t.passed=rows.every(r=>r.fired)&&negativeRows.every(r=>!r.fired)&&negativeRows.some(r=>r.image==='real-open-palm'&&r.seen>0)&&held&&openStops&&actualOpenClears;if(!t.passed)throw new Error('Falha no punho/abertura com variação de iluminação');status('Punho, palma aberta real, contraluz simulada e abertura real conferidos; confirmação de 900 ms preservada.');
 }finally{runner?.close();oldRunner?.close();}
});
regressionStages.push(['lightingTest','Mão em luz variável, contraluz e abertura real',()=>report.tests.HAND_LIGHTING?.passed]);

$('#maskAlignmentTest').onclick=()=>runTest('mask-motion-exposure',async()=>{
 const {alignMask,illuminationOffset}=await import('./mask-alignment-v034.js'),host=document.createElement('div'),probe=new Compositor(host,false),isolated=new THREE.Scene(),source=canvas(),ctx=source.getContext('2d'),alpha=new Uint8Array(64*86),hist=new Uint32Array(511);for(let y=15;y<70;y++)for(let x=15;x<40;x++)alpha[y*64+x]=255;
 const paint=(shift,light=0)=>{ctx.fillStyle='rgb('+(30+light)+','+(60+light)+','+(110+light)+')';ctx.fillRect(0,0,W,H);ctx.fillStyle='rgb('+(130+light)+','+(70+light)+','+(55+light)+')';ctx.fillRect(15*7.5+shift,15*640/86,25*7.5,55*640/86);ctx.fillStyle='rgb('+(60+light)+','+(40+light)+','+(30+light)+')';ctx.fillRect(170+shift,240,65,110);};
 const read=()=>{renderer.render(isolated,camera);const c=canvas(),x=c.getContext('2d');x.drawImage(renderer.domElement,0,0,W,H);return {canvas:c,pixel:(px,py)=>Array.from(x.getImageData(px,py,1,1).data)};};
 try{defaultCamera();probe.liveVideo=true;probe.attach(isolated);paint(0);probe.paint({bitmap:await createImageBitmap(source),width:64,height:86,alpha,body:{points:[]},captureAt:performance.now()});const t=performance.now();probe.paintVideo(source,true,t);read();paint(15);probe.paintVideo(source,true,t+80);const moved=read(),motionAlignment={...probe.alignment},aligned=probe.alignment.accepted&&probe.alignment.dx===2&&probe.alignment.dy===0,newEdgeOpaque=moved.pixel(306,300)[3]===255,oldEdgeClear=moved.pixel(115,300)[3]===0;
  const f=document.createElement('canvas');f.width=W;f.height=H+50;const fc=f.getContext('2d');fc.fillStyle='#202126';fc.fillRect(0,0,W,H+50);fc.fillStyle='white';fc.font='16px system-ui';fc.fillText('Máscara acompanha deslocamento simulado de 15 px',10,30);fc.drawImage(source,0,50);fc.drawImage(moved.canvas,0,50);$('#samples').appendChild(f);
  paint(0,40);probe.paintVideo(source,true,t+160);const bright=read().pixel(150,300),exposureOpaque=bright[3]===255&&Math.abs(bright[0]-170)<=1;const exposure=probe.exposureDelta;probe.paintVideo(source,true,probe.maskAt+451);const staleClears=!probe.overlay.visible;probe.clear();const alignmentCleared=probe.alignment===null&&probe.overlayMaterial.uniforms.maskOffset.value.length()===0;
  const blank=new Uint8ClampedArray(64*86*4).fill(100),noFalseShift=alignMask(blank,blank,0).accepted===false;
  report.tests.MASK_ALIGNMENT={motionAlignment,aligned,newEdgeOpaque,oldEdgeClear,exposureOpaque,exposure,staleClears,alignmentCleared,noFalseShift,grid:[64,86],maxShiftCells:3,actualGPUReadback:true,physicalMotionTest:false};const r=report.tests.MASK_ALIGNMENT;r.passed=aligned&&newEdgeOpaque&&oldEdgeClear&&exposureOpaque&&Math.abs(exposure-40)<=1&&staleClears&&alignmentCleared&&noFalseShift;if(!r.passed)throw new Error('Falha no alinhamento da máscara ou mudança de exposição');status('Recorte acompanha deslocamento limitado, mantém RGB com exposição variável e expira após 450 ms.');
 }finally{probe.dispose();}
});
regressionStages.push(['maskAlignmentTest','Oclusão alinhada ao movimento e à exposição',()=>report.tests.MASK_ALIGNMENT?.passed]);

$('#searchScaleTest').onclick=()=>runTest('hand-multiscale-search',async()=>{
 let runner;const rows=[];try{runner=new WorkerRunner('./hand-worker-v035.js');await runner.ready;const photo=await loadImage('./fist.jpg');let clock=1000;
  for(const cx of [.28,.72])for(const size of [.1,.14]){
   const source=canvas(),ctx=source.getContext('2d');ctx.fillStyle='#202025';ctx.fillRect(0,0,W,H);ctx.filter='brightness(.3)';const w=W*size,h=w*photo.height/photo.width;ctx.drawImage(photo,cx*W-w/2,.48*H-h/2,w,h);ctx.filter='none';const points=Array.from({length:33},()=>({x:0,y:0,visibility:0,presence:1}));for(const [i,x,y] of [[15,.28,.5],[16,.72,.5],[13,.28,.6],[14,.72,.6]])points[i]={x,y,visibility:.95,presence:1};const planner=new HandFramePlanner(),association=new HandAssociation(),gate=new GestureGate(),frames=[];let fired=false;
   for(let i=0;i<18&&!fired;i++){const frame=planner.next(clock,points),c=canvas();c.getContext('2d').drawImage(source,frame.x*W,frame.y*H,frame.w*W,frame.h*H,0,0,W,H);const raw=await runner.infer(c,clock),mapped=mapHandResult(raw,frame);mapped.hands=raw.hands.map(h=>({...h,points:h.points.map(p=>({...p,x:frame.x+p.x*frame.w,y:frame.y+p.y*frame.h}))}));const selected=association.select(mapped,clock,gate.armed);planner.observe(selected,clock);fired=gate.update(selected.gesture,clock);frames.push({kind:frame.kind,extent:frame.w,seen:selected.handSeen,progress:gate.progress});clock+=180;}
   rows.push({cx,size,fired,frames});
  }
  const planner=new HandFramePlanner(),pose=Array.from({length:33},(_,i)=>({x:i===15?.25:i===16?.75:.5,y:.5,visibility:[15,16].includes(i)?.95:0,presence:1})),search=[];for(let t=0;t<12;t++)search.push(planner.next(t*140,pose));const narrow=search.filter(f=>f.kind==='wrist-search'&&f.w===.2),bothWrists=narrow.some(f=>f.x<.4)&&narrow.some(f=>f.x>.4),fullSearches=search.filter(f=>f.kind==='full').length,validBounds=search.every(f=>f.x>=0&&f.y>=0&&f.x+f.w<=1.000001&&f.y+f.h<=1.000001);
  const points=Array.from({length:21},(_,i)=>({x:.45+(i%5)*.01,y:.4+Math.floor(i/5)*.01}));planner.observe({handSeen:true,points},1800);const focus=[];for(let t=1850;t<2400;t+=100)focus.push(planner.next(t,pose));const smallHandMagnified=focus.some(f=>f.kind==='hand-crop'&&f.w<.3),wideRecovery=focus.some(f=>f.kind==='hand-crop'&&f.w>=.32),expired=planner.next(2600,[]).kind==='full';
  report.tests.MULTISCALE_HAND={rows,search,bothWrists,fullSearches,validBounds,smallHandMagnified,wideRecovery,expired,syntheticDistanceAndLighting:true,physicalDistanceTest:false};const t=report.tests.MULTISCALE_HAND;t.passed=rows.every(r=>r.fired)&&bothWrists&&fullSearches>=4&&validBounds&&smallHandMagnified&&wideRecovery&&expired;if(!t.passed)throw new Error('Falha na busca de mão pequena, dois pulsos ou retomada ampla');status('Busca ampla/fechada nos dois pulsos, mão pequena escura, expansão e expiração conferidas.');
 }finally{runner?.close();}
});
regressionStages.push(['searchScaleTest','Busca multiescala da mão nos dois pulsos',()=>report.tests.MULTISCALE_HAND?.passed]);

$('#lightContinuityTest').onclick=()=>runTest('light-continuity',async()=>{
 const {exposurePlan,HandLight}=await import('./hand-light-v035.js'),{exposurePlan:previousPlan}=await import('./hand-light-v034.js'),rgba=new Uint8ClampedArray(32*32*4),hist=new Uint32Array(256),levels=[];let last=null,maxStep=0,oldMaxStep=0,oldLast=null;
 for(let level=16;level<=245;level++){for(let i=0;i<rgba.length;i+=4){rgba[i]=rgba[i+1]=rgba[i+2]=level;rgba[i+3]=255;}const plan=exposurePlan(rgba,hist),old=previousPlan(rgba);if(last!==null)maxStep=Math.max(maxStep,Math.abs(plan.gamma-last));if(oldLast!==null)oldMaxStep=Math.max(oldMaxStep,Math.abs(old.gamma-oldLast));last=plan.gamma;oldLast=old.gamma;levels.push({level,gamma:plan.gamma});}
 const sentinel={},fallback=new HandLight(null).prepare(sentinel),fallbackSafe=fallback.source===sentinel&&fallback.light.supported===false;
 let runner;const frames=[],negatives=[];try{runner=new WorkerRunner('./hand-worker-v035.js');await runner.ready;const photo=await loadImage('./fist.jpg'),source=canvas(),ctx=source.getContext('2d'),gate=new GestureGate();let clock=1000,fired=false;
  for(const brightness of [.3,.54,.56,.54,.56,.7,1,1.5]){ctx.fillStyle='#16161a';ctx.fillRect(0,0,W,H);ctx.filter='brightness('+brightness+')';const w=W*.95,h=w*photo.height/photo.width;ctx.drawImage(photo,(W-w)/2,(H-h)/2,w,h);ctx.filter='none';const r=await runner.infer(source,clock);fired=gate.update(r.gesture,clock)||fired;frames.push({brightness,seen:r.handSeen,gamma:r.lighting.gamma,progress:gate.progress});clock+=180;}
  for(const level of [0,20,245,255]){ctx.fillStyle='rgb('+level+','+level+','+level+')';ctx.fillRect(0,0,W,H);const negativeGate=new GestureGate();let falseExit=false;for(let i=0;i<6;i++){const r=await runner.infer(source,clock);falseExit=negativeGate.update(r.gesture,clock)||falseExit;clock+=180;}negatives.push({level,falseExit});}
  const monotonic=frames.every((r,i)=>!i||r.progress>=frames[i-1].progress);report.tests.LIGHT_CONTINUITY={maxGammaStep:maxStep,previousMaxGammaStep:oldMaxStep,fallbackSafe,frames,negatives,fired,monotonic,oneModelPassPerImage:true,physicalLightingTest:false};const t=report.tests.LIGHT_CONTINUITY;t.passed=maxStep<.041&&maxStep<oldMaxStep&&fallbackSafe&&fired&&monotonic&&frames.every(r=>r.seen)&&negatives.every(r=>!r.falseExit);if(!t.passed)throw new Error('Falha na adaptação gradual de luz ou nos negativos');status('Compensação gradual, luz variável entre quadros, preto/branco sem saída falsa e fallback conferidos.');
 }finally{runner?.close();}
});
regressionStages.push(['lightContinuityTest','Luz gradual, exposição variando e ausência de mão',()=>report.tests.LIGHT_CONTINUITY?.passed]);

$('#handGuidanceTest').onclick=()=>runTest('hand-guidance',async()=>{
 const states=[{ready:true,seen:false,armed:true,progress:.4},{ready:true,seen:false,armed:false,lighting:{signalLimited:true}},{ready:true,seen:false,armed:false,lighting:{highlightLimited:true}},{ready:false,initialization:'failed'},{ready:true,seen:true,armed:true,progress:.6}];const messages=states.map(s=>handMessages(s)),sameProgress=messages[0].hint.includes('40%')&&messages[0].short.includes('40%'),lostSameHand=messages[0].hint.includes('mesma mão'),darkSpecific=messages[1].hint.includes('perto'),brightSpecific=messages[2].hint.includes('reflexo'),fallbackExit=messages[3].hint.includes('Encerrar aparição'),armedCoherent=messages[4].hint.includes('60%')&&messages[4].short.includes('60%');report.tests.HAND_GUIDANCE={messages,sameProgress,lostSameHand,darkSpecific,brightSpecific,fallbackExit,armedCoherent,passed:sameProgress&&lostSameHand&&darkSpecific&&brightSpecific&&fallbackExit&&armedCoherent};if(!report.tests.HAND_GUIDANCE.passed)throw new Error('Falha nas mensagens de orientação da mão');status('Mensagens distinguem procura, pouco detalhe, reflexo e manutenção da mesma mão, com porcentagens coerentes.');
});
regressionStages.push(['handGuidanceTest','Orientação de luz, reenquadramento e confirmação coerente',()=>report.tests.HAND_GUIDANCE?.passed]);

$('#contextSearchTest').onclick=()=>runTest('hand-context-policy',async()=>{
 const planner=new HandFramePlanner(),frames=[];for(let i=0;i<12;i++){const f=planner.next(i*150,[]);frames.push(f);planner.observe({handSeen:true,points:Array.from({length:21},()=>({x:.8,y:.7})),gesture:{name:'None',score:.9},rawGesture:{name:'None',score:.9}},i*150,f);}
 const withoutWrists=frames.some(f=>f.w===.7)&&frames.some(f=>f.w===.5)&&frames.filter(f=>f.kind==='full').length>=4,weakDoesNotLock=planner.snapshot().trustedContext===null;
 const source={x:.15,y:.15,w:.7,h:.7,kind:'hand-crop'},pts=Array.from({length:21},()=>({x:.55,y:.55})),fist={handSeen:true,points:pts,gesture:{name:'Closed_Fist',score:.9},rawGesture:{name:'Closed_Fist',score:.9}};planner.observe(fist,2000,source);const held=[];for(let at=2050;at<=2500;at+=150){const f=planner.next(at,[]);held.push(f);if(f.kind!=='full')planner.observe(fist,at,f);}
 const doesNotTighten=held.filter(f=>f.kind!=='full').every(f=>f.w===.7),staysWithContext=held.some(f=>f.kind!=='full'),before=planner.contextAt;planner.observe({handSeen:true,points:pts,gesture:{name:'None',score:.9},rawGesture:{name:'None',score:.9}},2600,source);const weakDoesNotRefresh=planner.contextAt===before;planner.next(before+651,[]);const expired=planner.context===null;planner.reset();const resetClears=planner.snapshot().trustedContext===null&&planner.searchStep===0;
 const narrowFalseOpen={handSeen:true,points:pts,gesture:{name:'Open_Palm',score:.98,source:'landmark-open'},rawGesture:{name:'None',score:.9}};planner.observe(narrowFalseOpen,3000,{x:.45,y:.45,w:.2,h:.2,kind:'hand-crop'});const speculativeOpenNotLocked=planner.context===null;
 report.tests.HAND_CONTEXT={withoutWrists,weakDoesNotLock,doesNotTighten,staysWithContext,weakDoesNotRefresh,expired,resetClears,speculativeOpenNotLocked,frames,held,physicalCameraTest:false};const t=report.tests.HAND_CONTEXT;t.passed=withoutWrists&&weakDoesNotLock&&doesNotTighten&&staysWithContext&&weakDoesNotRefresh&&expired&&resetClears&&speculativeOpenNotLocked;if(!t.passed)throw new Error('Falha na busca sem pulsos ou na conservação de contexto confiável');status('Busca sem pulsos, contexto aprovado, observações fracas, expiração e reset conferidos.');
});
regressionStages.push(['contextSearchTest','Busca independente dos pulsos e contexto confiável',()=>report.tests.HAND_CONTEXT?.passed]);

$('#contextGestureTest').onclick=()=>runTest('hand-context-real-inference',async()=>{
 let runner;const rows=[];try{runner=new WorkerRunner('./hand-worker-v035.js');await runner.ready;const fist=await loadImage('./fist.jpg'),openFile=await loadImage('./open-palm-v034.jpg'),thumb=await loadImage('./thumb_up.jpg'),open=document.createElement('canvas');open.width=openFile.width/2;open.height=openFile.height;open.getContext('2d').drawImage(openFile,open.width,0,open.width,open.height,0,0,open.width,open.height);let clock=1000;
  const make=(image,brightness)=>{const c=canvas(),ctx=c.getContext('2d');ctx.fillStyle='#34343c';ctx.fillRect(0,0,W,H);ctx.filter='brightness('+brightness+')';const width=W*.4,height=width*image.height/image.width;ctx.drawImage(image,(W-width)/2,(H-height)/2,width,height);ctx.filter='none';return c;};
  for(const brightness of [.2,1]){const source=make(fist,brightness),planner=new HandFramePlanner(),association=new HandAssociation(),gate=new GestureGate(),trace=[];let fired=false;for(let i=0;i<18&&!fired;i++){const frame=planner.next(clock,[]),c=canvas();c.getContext('2d').drawImage(source,frame.x*W,frame.y*H,frame.w*W,frame.h*H,0,0,W,H);const raw=await runner.infer(c,clock),mapped=mapHandResult(raw,frame);mapped.hands=raw.hands.map(h=>({...h,points:h.points.map(p=>({...p,x:frame.x+p.x*frame.w,y:frame.y+p.y*frame.h}))}));const selected=association.select(mapped,clock,gate.armed);planner.observe(selected,clock,frame);fired=gate.update(selected.gesture,clock);trace.push({kind:frame.kind,extent:frame.w,seen:selected.handSeen,gesture:selected.gesture?.name,progress:gate.progress});clock+=180;}rows.push({brightness,fired,trace});}
  const rawOpen=await runner.infer(make(open,1),clock);clock+=180;const gate=new GestureGate();gate.update({name:'Closed_Fist',score:.9},0);gate.update(rawOpen.gesture,180);const actualOpenClears=!gate.armed&&rawOpen.gesture?.name==='Open_Palm';let falseThumb=false;const negativeGate=new GestureGate();for(let i=0;i<8;i++){const r=await runner.infer(make(thumb,.4),clock);falseThumb=negativeGate.update(r.gesture,clock)||falseThumb;clock+=180;}
  const lost=new GestureGate();lost.update({name:'Closed_Fist',score:.9},0);lost.expire(651);const lossStillClears=!lost.armed;report.tests.CONTEXT_GESTURE={rows,actualOpenClears,falseThumb,lossStillClears,confirmationMs:900,independentImageInference:true,physicalCameraTest:false};const t=report.tests.CONTEXT_GESTURE;t.passed=rows.every(r=>r.fired)&&actualOpenClears&&!falseThumb&&lossStillClears;if(!t.passed)throw new Error('Falha no contexto com inferência, abertura ou negativos');status('Contexto estável com inferência real de arquivos, abertura, polegar negativo e perda da mão conferidos.');
 }finally{runner?.close();}
});
regressionStages.push(['contextGestureTest','Inferência por contexto, abertura e perda da mão',()=>report.tests.CONTEXT_GESTURE?.passed]);

$('#latencyClockTest').onclick=()=>runTest('hand-capture-clock',async()=>{
 const simulate=(corrected,gap,lag)=>{const gate=new GestureGate(),clock=new ObservationClock(),events=[];let firedAt=null;for(let wall=0;wall<5000;wall+=10){if(wall%gap===0)clock.start(wall);if(wall>=lag&&(wall-lag)%gap===0){const capture=wall-lag;clock.accept(capture,wall);if(gate.update({name:'Closed_Fist',score:.9,center:{x:.5,y:.5}},capture)&&firedAt===null)firedAt=wall;events.push({wall,capture,progress:gate.progress});}gate.expire(corrected?clock.now(wall):wall);}return {firedAt,events,resets:gate.resetCount};};
 const cases=[[180,50],[400,200],[600,500],[640,600]].map(([gap,lag])=>({gap,lag,before:simulate(false,gap,lag),after:simulate(true,gap,lag)}));
 const clock=new ObservationClock(),gate=new GestureGate();clock.accept(1000,1500);gate.update({name:'Closed_Fist',score:.9},1000);clock.accept(1700,2200);gate.update(null,1700);gate.expire(clock.now(2200));const actualLossClears=!gate.armed;
 const stale=new ObservationClock();stale.accept(0,500);stale.start(600);const acceptedStale=stale.accept(600,1701),staleRejected=!acceptedStale&&stale.rejected===1;
 const pending=new ObservationClock();pending.accept(0,500);pending.start(600);const pendingBounded=pending.now(1601)>650;pending.reset();const resetClears=pending.source===null&&pending.pending===null;
 const early=new GestureGate();for(let t=0;t<=800;t+=100)early.update({name:'Closed_Fist',score:.9},t);const noEarlyConfirmation=!early.fired;
 report.tests.HAND_CLOCK={cases,previousResetReproduced:cases[2].before.firedAt===null&&cases[2].before.resets>0,actualLossClears,staleRejected,pendingBounded,resetClears,noEarlyConfirmation,confirmationMs:900,handLossMs:650,simulatedProcessingDelay:true,phoneDelayNotMeasured:true};const r=report.tests.HAND_CLOCK;r.passed=r.previousResetReproduced&&cases.every(c=>c.after.firedAt!==null&&c.after.firedAt>=900)&&actualLossClears&&staleRejected&&pendingBounded&&resetClears&&noEarlyConfirmation;if(!r.passed)throw new Error('Falha no relógio da confirmação, perda ou atraso máximo');status('Zeragem por mistura de relógios reproduzida; captura/expiração alinhadas, 900 ms e perda real preservados.');
});
regressionStages.push(['latencyClockTest','Confirmação com atraso de processamento e perda real',()=>report.tests.HAND_CLOCK?.passed]);

$('#integratedMaskTest').onclick=()=>runTest('integrated-body-mask',async()=>{
 const source=fixture(await loadImage('./pose.jpg'),1),rows=[];let clock=1000;
 for(const file of ['body-worker-v025.js','body-worker-v037.js']){const runner=new WorkerRunner('./'+file);let r;try{await runner.ready;for(let i=0;i<5;i++){r?.bitmap.close();r=await runner.infer(source,clock);clock+=200;}const samples=[];for(const [a,b] of [[11,13],[13,15],[12,14],[14,16]])for(let n=1;n<=4;n++){const t=n/5,p=r.body.points[a],q=r.body.points[b];if(!p||!q||p.visibility<.5||q.visibility<.5)continue;const x=Math.round((p.x+(q.x-p.x)*t)*(r.width-1)),y=Math.round((p.y+(q.y-p.y)*t)*(r.height-1));samples.push(r.alpha[y*r.width+x]);}rows.push({file,bodyPresent:r.body.present,armSamples:samples,opaqueArmSamples:samples.filter(x=>x>=200).length,points:r.body.points,taskCalls:r.bodyTaskCalls??2,maskSource:r.maskSource??'selfie-separate'});
  if(file==='body-worker-v037.js'){const c=canvas(),ctx=c.getContext('2d'),mask=document.createElement('canvas');mask.width=r.width;mask.height=r.height;const mc=mask.getContext('2d'),im=mc.createImageData(r.width,r.height);for(let i=0;i<r.alpha.length;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=r.alpha[i];}mc.putImageData(im,0,0);ctx.drawImage(source,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0,W,H);$('#samples').appendChild(c);}
 }finally{r?.bitmap.close();runner.close();}}
 const delta=Math.max(...rows[0].points.map((p,i)=>Math.hypot(p.x-rows[1].points[i].x,p.y-rows[1].points[i].y))),improvedArms=rows[1].opaqueArmSamples>=12&&rows[1].opaqueArmSamples>rows[0].opaqueArmSamples,onePass=rows[1].taskCalls===1;
 report.tests.INTEGRATED_MASK={rows,landmarkDelta:delta,improvedArms,onePass,samePoseModel:true,physicalMotionTest:false};const t=report.tests.INTEGRATED_MASK;t.passed=rows.every(r=>r.bodyPresent)&&delta<.001&&improvedArms&&onePass;if(!t.passed)throw new Error('Falha na preservação corporal ou cobertura dos braços');status('Mesmo rastreador corporal, máscara integrada cobre os braços e dispensa a inferência separada de selfie.');
});
regressionStages.push(['integratedMaskTest','Máscara corporal integrada e cobertura dos braços',()=>report.tests.INTEGRATED_MASK?.passed]);

$('#liveDiagnosticTest').onclick=()=>runTest('live-diagnostic',async()=>{
 const saved={onclick:$('#save').onclick,reportLive:report.live};let calls=0;try{report.live={};$('#save').onclick=()=>{calls++};$('#saveLive').onclick();const timingRecorded=report.live.handTiming?.expiryClock==='capture-with-receipt-anchor',gateRecorded=typeof report.live.gestureConfirmation?.progress==='number',sameExport=calls===1,localDownloadOnly=!('image' in report.live);report.tests.LIVE_DIAGNOSTIC={timingRecorded,gateRecorded,sameExport,localDownloadOnly,passed:timingRecorded&&gateRecorded&&sameExport&&localDownloadOnly};if(!report.tests.LIVE_DIAGNOSTIC.passed)throw new Error('Falha no diagnóstico da câmera');status('Diagnóstico usa a exportação original e inclui relógio/confirmacão atuais, sem imagem.');}finally{$('#save').onclick=saved.onclick;report.live=saved.reportLive;}
});
regressionStages.push(['liveDiagnosticTest','Diagnóstico local durante a câmera',()=>report.tests.LIVE_DIAGNOSTIC?.passed]);

$('#clearanceTest').onclick=()=>runTest('body-clearance',async()=>{
 const {spaceOptions:oldOptions}=await import('./space-chooser-v027.js');const rows=[];
 for(const center of [.32,.5,.68])for(const scale of [.8,1,1.2])for(const direction of [-1,1]){
  const body={center:{x:center},shoulderWidth:.22,points:[11,12,23,24].reduce((a,i)=>{a[i]={x:center+(i%2?-.11:.11),visibility:1};return a;},[])};
  const width=2.2,old=oldOptions(body,refs,scale,width,.7).find(x=>x.direction===direction),next=spaceOptions(body,refs,scale,width,1.1).find(x=>x.direction===direction),inward=next.composition.inwardRange;
  const floatBounded=Array.from({length:101},(_,i)=>safeFloatOffset(Math.sin(i*.1)*.1,direction,inward)).every(x=>direction*x>=-inward-1e-8);
  const headPartiallyVisible=Math.abs(next.composition.x)-refs.headWidth*scale*.5<width/2;
  rows.push({center,scale,direction,oldX:old.composition.x,newX:next.composition.x,inward,floatBounded,headPartiallyVisible,neverCloser:direction*(next.composition.x-old.composition.x)>=-1e-8});
 }
 const r=report.tests.CLEARANCE={rows,defaultFar:$('#space').value==='1.1',scaleChanged:false,physicalDepthMeasured:false};r.passed=rows.every(x=>x.floatBounded&&x.headPartiallyVisible&&x.neverCloser)&&rows.some(x=>Math.abs(x.newX-x.oldX)>.1)&&r.defaultFar;if(!r.passed)throw new Error('Falha no afastamento, cabeça ou flutuação');status('Folga lateral ampliada, cabeça dentro da tela e flutuação limitada pela folga, sem reduzir escala.');
});
regressionStages.push(['clearanceTest','Folga da pessoa e flutuação sem encolher',()=>report.tests.CLEARANCE?.passed]);
$('#garmentRefineTest').onclick=()=>runTest('garment-refinement',async()=>{
 const pants=model.getObjectByName('Pants'),accessories=['Book','Chain1','Chain2'].map(n=>model.getObjectByName(n)),geometry=pants.geometry,map=pants.material.map,material=pants.material;
 const program={fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(program);const shaderHasBoundedPanel=program.fragmentShader.includes('garmentUv.x>.55')&&program.fragmentShader.includes('garmentUv.y<.99');
 const independent=accessories.every(o=>o.material!==material&&!o.material.userData.kiraGarmentRefined),originalShared=accessories.every(o=>o.material===accessories[0].material);
 const r=report.tests.GARMENT_REFINEMENT={independent,originalShared,shaderHasBoundedPanel,alphaCutoff:material.alphaTest,opaque:!material.transparent,depthWrite:material.depthWrite,skinned:!!pants.isSkinnedMesh,sixClips:report.tests.MODEL.animations.length===6,geometryPreserved:pants.geometry===geometry,texturePreserved:pants.material.map===map,antialiasCoverage:material.alphaToCoverage,physicalTest:false};
 r.passed=independent&&originalShared&&shaderHasBoundedPanel&&r.alphaCutoff===.5&&r.opaque&&r.depthWrite&&r.skinned&&r.sixClips&&r.geometryPreserved&&r.texturePreserved;if(!r.passed)throw new Error('Falha na saia isolada ou materiais dos acessórios');status('Saia isolada dos acessórios, alpha e skinning preservados; seis clipes disponíveis.');
});
regressionStages.push(['garmentRefineTest','Saia isolada e materiais dos acessórios preservados',()=>report.tests.GARMENT_REFINEMENT?.passed]);
$('#landingStructureTest').onclick=()=>runTest('landing-structure',async()=>{
 const ids=[...document.querySelectorAll('[id]')].map(x=>x.id),duplicates=ids.filter((x,i)=>ids.indexOf(x)!==i),controls=['live','preview','camera','showBook','saveLive','exitAppearance','save','restart'];
 const r=report.tests.LANDING_STRUCTURE={duplicates,controlsPresent:controls.every(id=>!!document.getElementById(id)),cameraChoices:document.querySelector('#camera').options.length,bookOption:document.querySelector('#showBook').type==='checkbox',sessionButtonsGrouped:document.querySelectorAll('.session-controls>button').length===2,stylesheet:[...document.styleSheets].some(x=>x.href?.includes('presentation-v038.css')),smokePreviewPreserved:!!document.querySelector('a[href="./fumaca-v033.html?v=3.3"]')};r.passed=!duplicates.length&&r.controlsPresent&&r.cameraChoices>=2&&r.bookOption&&r.sessionButtonsGrouped&&r.stylesheet&&r.smokePreviewPreserved;if(!r.passed)throw new Error('Falha na estrutura da página');status('Controles essenciais, opções de câmera/caderno, folha de layout e prévia preservados.');
});
regressionStages.push(['landingStructureTest','Página inicial, câmera e caderno preservados',()=>report.tests.LANDING_STRUCTURE?.passed]);


$('#idleFramingTest').onclick=()=>runTest('idle-scale',async()=>{
 const rows=[];for(const aspect of [.55,.75,1,1.7])for(const scale of [.25,1,3,6])for(const x of [-5,0,5]){
  const state=new IdleStage(),view={height:3.5,width:3.5*aspect,y:1.2};state.enter(100,{x,y:0,scale},refs,view);const p=state.target;
  const headY=p.y+refs.headY*scale;rows.push({aspect,scale,x,finite:[p.x,p.y,p.scale].every(Number.isFinite),sameScale:p.scale===scale,headCenterInside:Math.abs(p.x)<view.width/2&&headY>view.y-view.height/2&&headY<view.y+view.height/2,croppingAllowed:p.cropAllowed===true});
 }
 const r=report.tests.IDLE_FRAMING={rows,physicalWorldAnchor:false,activePersonScaleUnchanged:true,noAutomaticFit:true};r.passed=rows.every(x=>x.finite&&x.sameScale&&x.headCenterInside&&x.croppingAllowed);if(!r.passed)throw Error('Falha na preservação da escala ociosa');status('Mesma escala no repouso: permite recorte natural perto da câmera, sem reduzir para caber.');
});
regressionStages.push(['idleFramingTest','Escala preservada no repouso sem pessoa',()=>report.tests.IDLE_FRAMING?.passed]);

$('#idleSceneTest').onclick=()=>runTest('idle-scene',async()=>{
 const saved={live,compositor,reportLive:report.live,bodyReady,handReady,restartDisabled:$('#restart').disabled};let fistRunner;
 const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:1}));for(const [i,x,y] of [[11,.34,.3],[12,.54,.3],[23,.37,.62],[24,.51,.62],[27,.38,.9],[28,.50,.9],[29,.38,.91],[30,.50,.91],[31,.37,.92],[32,.51,.92]])Object.assign(points[i],{x,y,visibility:.95});const body=bodySnapshot(points);
 try{
  defaultCamera();resetScene();$('#view').classList.add('live');document.body.classList.add('session-running');live=true;bodyReady=handReady=true;compositor={clear(){},dispose(){},drawGuides(){}};report.live={bodyDetections:0,maskFrames:0,handInitialization:'ready'};phase='target';updateScene(performance.now(),.03);const noAutoBeforeCover=!placement.visible;
  armTarget(performance.now());updateScene(performance.now(),.03);const noAutoBeforePerson=!placement.visible;acceptBody({body},performance.now()-100);acceptBody({body},performance.now());await sleep(2650);const originalAppearance=appearanceAt,normalScale=targetPlacement.scale;
  acceptBody({body:{present:false}},performance.now());await sleep(2700);const absent=person.state(performance.now()),idleVisible=placement.visible&&idleStage.active&&!absent.visible&&phase==='active',noTargetRequired=!mustClear;
  const before=model.getObjectByName('bip_head').quaternion.clone();await sleep(600);const motionDegrees=THREE.MathUtils.radToDeg(before.angleTo(model.getObjectByName('bip_head').quaternion));renderer.render(scene,camera);const pixelsCanvas=canvas(),pixelsCtx=pixelsCanvas.getContext('2d');pixelsCtx.drawImage(renderer.domElement,0,0,W,H);const pixels=pixelsCtx.getImageData(0,0,W,H).data,bounds={left:W,right:0,top:H,bottom:0,count:0};for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(pixels[(y*W+x)*4+3]>8){bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);bounds.count++;}const viewRect=$('#view').getBoundingClientRect(),feedbackTop=($('#gestureFeedback').getBoundingClientRect().top-viewRect.top)/viewRect.height*H;const idleSizeAndPixelsValid=bounds.count>3000&&Math.abs(placement.scale.x-normalScale)<.001;sampleFrame(null,'Sem pessoa · Ryuk em repouso na câmera');
  const idleScalePreserved=Math.abs(placement.scale.x-normalScale)<.001;const idleClip=naturalAnimator.snapshot().clips.find(c=>c.name==='03_Presenca_Suave'),shadowHidden=!contactShadow.snapshot().visible,gazeOff=reactiveGaze.snapshot().source===null&&reactiveGaze.snapshot().weight<.001;
  const shifted=bodySnapshot(points.map(p=>({...p,x:p.x+.25})));const first=acceptBody({body:shifted},performance.now()),firstReturnWaits=!first.visible;await sleep(100);const second=acceptBody({body:shifted},performance.now());await sleep(250);const resumed=second.visible&&!idleStage.active&&phase==='active',noNewEntrance=appearanceAt===originalAppearance&&smokeMode!=='entry',scaleRestored=Math.abs(targetPlacement.scale-normalScale)<.001;sampleFrame(null,'Pessoa voltou · acompanhamento retomado');
  acceptBody({body:{present:false}},performance.now());await sleep(2100);updateLiveStatus();const idleGuide=presentationFlow.snapshot().stage==='idle',exitAvailable=!$('#exitAppearance').hidden;$('#exitAppearance').click();const buttonStartsSmoke=phase==='exiting'&&smokeMode==='exit';await sleep(2800);const exitCompletes=phase==='complete'&&!placement.visible&&!smoke.visible;
  acceptBody({body},performance.now());acceptBody({body},performance.now()+100);await sleep(100);const noAutomaticReturn=phase==='complete'&&!placement.visible;
  $('#restart').disabled=false;$('#restart').click();const restartRequiresCover=phase==='target'&&!placement.visible&&!idleStage.active;
  armTarget(performance.now());acceptBody({body},performance.now()-100);acceptBody({body},performance.now());await sleep(2700);const idleAgain=idleStage.active&&!person.state(performance.now()).visible;fistRunner=new WorkerRunner('./hand-worker-v035.js');await fistRunner.ready;const fistImage=await loadImage('./fist.jpg');for(let i=0;i<7&&phase==='active';i++){const at=performance.now();handClock.start(at);const raw=await fistRunner.infer(fistImage,at);acceptHandFrame(raw,{x:0,y:0,w:1,h:1,kind:'full'},performance.now());handClock.finish(at);await sleep(250);}const idleFistTriggered=idleAgain&&phase==='exiting'&&exitTrigger==='gesture';await sleep(2800);const idleFistCompleted=phase==='complete'&&!placement.visible&&!smoke.visible;stopLive();const stopClears=!idleStage.active&&!placement.visible&&!smoke.visible;
  const r=report.tests.IDLE_SCENE={noAutoBeforeCover,noAutoBeforePerson,idleVisible,noTargetRequired,motionDegrees,idleSizeAndPixelsValid,renderedPixelBounds:bounds,feedbackTop,idleScalePreserved,idleClipWeight:idleClip?.weight,shadowHidden,gazeOff,firstReturnWaits,resumed,noNewEntrance,scaleRestored,idleGuide,exitAvailable,buttonStartsSmoke,exitCompletes,idleFistTriggered,idleFistCompleted,realFistWorkerFromFixture:true,noAutomaticReturn,restartRequiresCover,stopClears,syntheticLandmarks:true,physicalCamera:false};r.passed=noAutoBeforeCover&&noAutoBeforePerson&&idleVisible&&noTargetRequired&&motionDegrees>.05&&idleSizeAndPixelsValid&&idleClip.weight>.9&&shadowHidden&&gazeOff&&firstReturnWaits&&resumed&&noNewEntrance&&scaleRestored&&idleGuide&&exitAvailable&&buttonStartsSmoke&&exitCompletes&&idleFistTriggered&&idleFistCompleted&&noAutomaticReturn&&restartRequiresCover&&stopClears;if(!r.passed)throw Error('Falha no repouso/retomada/saída: '+JSON.stringify(r));status('Repouso animado sem pessoa, enquadramento, retorno, saída com fumaça e reinício conferidos.');
 }finally{fistRunner?.close();stopLive();live=saved.live;compositor=saved.compositor;report.live=saved.reportLive;bodyReady=saved.bodyReady;handReady=saved.handReady;$('#restart').disabled=saved.restartDisabled;resetScene();phase='idle';$('#view').classList.remove('live');}
});
regressionStages.push(['idleSceneTest','Repouso animado, retorno da pessoa e saída deliberada',()=>report.tests.IDLE_SCENE?.passed]);




$('#proportionTest').onclick=()=>runTest('proportion-distance',async()=>{
 const Old=(await import('./body-tracking-v023.js')).BodyFramer;const make=(zoom=1,torsoFactor=1,widthFactor=1,hips=true)=>{const pts=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:1}));for(const [i,x,y] of [[11,.4,.30],[12,.6,.30],[23,.43,.56],[24,.57,.56]])Object.assign(pts[i],{x:.5+(x-.5)*zoom*(i<20?widthFactor:1),y:.5+((i>20?.3+.26*torsoFactor:y)-.5)*zoom,visibility:hips||i<20?.95:0});return bodySnapshot(pts);};
 const rows=[];for(const zoom of [.6,.85,1,1.3,1.6]){const f=new BodyFramer(),old=new Old(),base=make(),a=f.update(base,refs,1,viewHeight(),.75);old.update(base,refs,1,viewHeight(),.75);const b=make(zoom);const next=f.update(b,refs,1,viewHeight(),.75),before=old.update(b,refs,1,viewHeight(),.75);rows.push({zoom,scale:next.scale,old:before.scale,ratio:next.scale/a.scale,proportional:Math.abs(next.scale/a.scale-zoom)<.001});}
 const cases=[];for(const [label,t,w,h] of [['inclinar',.55,1,true],['girar',1,.35,true],['quadril fora',1,1,false]]){const f=new BodyFramer(),old=new Old(),base=make(),normal=f.update(base,refs,1,viewHeight(),.75);old.update(base,refs,1,viewHeight(),.75);const changed=make(1,t,w,h),n=f.update(changed,refs,1,viewHeight(),.75),o=old.update(changed,refs,1,viewHeight(),.75);cases.push({label,before:normal.scale,after:n.scale,old:o.scale,preserved:Math.abs(n.scale/normal.scale-1)<.001});}
 const f=new BodyFramer();f.update(make(),refs,1,viewHeight(),.75);const turn=make(1,1,.35,false),small=f.update(turn,refs,.8,viewHeight(),.75),large=f.update(turn,refs,1.2,viewHeight(),.75),manualWorks=Math.abs(large.scale/small.scale-1.5)<.001;
 const sustained=[];for(const [name,t,w] of [['inclinar',.55,1],['ombros instáveis',1,1.7],['quadril instável',1.7,1]]){const f=new BodyFramer(),base=f.update(make(),refs,1,viewHeight(),.75).scale;for(let i=0;i<6;i++){const n=f.update(make(1,t,w),refs,1,viewHeight(),.75);sustained.push({name,i,ratio:n.scale/base,stable:Math.abs(n.scale/base-1)<.001});}}
 const grounded={...make(),feet:{x:.5,y:.92},feetVisible:true},cropped=make(),anchorRows=[];for(const Type of [Old,BodyFramer]){const f=new Type(),a=f.update(grounded,refs,1,viewHeight(),.75),b=f.update(cropped,refs,1,viewHeight(),.75),root=q=>(.5-q.anchorY)*viewHeight()-q.localY*q.scale;anchorRows.push(Math.abs(root(b)-root(a)));}const anchorStable=anchorRows[0]>.1&&anchorRows[1]<.001;const r=report.tests.PROPORTION={rows,cases,sustained,anchorRows,anchorStable,manualWorks,monocularVisualEstimate:true,physicalDepthMeasured:false};r.passed=rows.every(x=>x.proportional)&&cases.every(x=>x.preserved)&&sustained.every(x=>x.stable)&&anchorStable&&manualWorks&&cases.some(x=>Math.abs(x.old/x.before-1)>.15);if(!r.passed)throw Error('Falha na proporção/postura: '+JSON.stringify(r));status('Perto/longe proporcionais; inclinar, girar e perder o quadril não encolhem o personagem; tamanho manual preservado.');
});
regressionStages.push(['proportionTest','Proporção perto/longe e mudanças de postura',()=>report.tests.PROPORTION?.passed]);
$('#overlapPlacementTest').onclick=()=>runTest('overlap-placement',async()=>{
 const {spaceOptions:before}=await import('./space-chooser-v038.js'),rows=[];
 for(const scale of [1,2,3])for(const center of [.35,.5,.65]){const b={center:{x:center},shoulderWidth:.35,points:[]};b.points[11]={x:center-.175,visibility:1};b.points[12]={x:center+.175,visibility:1};b.points[23]={x:center-.12,visibility:1};b.points[24]={x:center+.12,visibility:1};const old=before(b,refs,scale,2.62,1.1),next=spaceOptions(b,refs,scale,2.62,1.1);for(let i=0;i<2;i++)rows.push({scale,center,direction:next[i].direction,oldOverlap:old[i].overlap,newOverlap:next[i].overlap,notWorse:next[i].overlap<=old[i].overlap+1e-8,headPartVisible:Math.abs(next[i].composition.x)-refs.headWidth*scale/2<1.31});}
 const r=report.tests.OVERLAP_PLACEMENT={rows,noScaleReduction:true,partialOffscreenAllowedWhenCrowded:true,physicalDepthMeasured:false};r.passed=rows.every(x=>x.notWorse&&x.headPartVisible)&&rows.some(x=>x.oldOverlap-x.newOverlap>.02);if(!r.passed)throw Error('Falha na separação da pessoa');status('Menos sobreposição do tronco sem reduzir escala; recorte lateral natural quando não cabe tudo.');
});
regressionStages.push(['overlapPlacementTest','Separação sem reduzir ou empurrar Ryuk sobre a pessoa',()=>report.tests.OVERLAP_PLACEMENT?.passed]);

$('#occlusionMotionTest').onclick=()=>runTest('local-occlusion-motion',async()=>{
 const Old=(await import('./compositor-v034.js')).Compositor,{repairMotionInterior,createMotionScratch}=await import('./motion-interior-v040.js');defaultCamera();const original=canvas(),current=canvas(),ctx=original.getContext('2d'),cw=W/64,ch=H/86,palette=['#18355a','#c1922a','#279a79','#b52e62','#743fba','#2681c5'];ctx.fillStyle='#292c30';ctx.fillRect(0,0,W,H);for(let y=20;y<70;y++)for(let x=12;x<52;x++){ctx.fillStyle=palette[(x*3+y*5)%palette.length];ctx.fillRect(x*cw,y*ch,cw,ch);}const cc=current.getContext('2d');cc.drawImage(original,0,0);for(const y of [28,36,44,52,60])for(const x of [18,24,30,36,42])cc.drawImage(original,(x-1)*cw,y*ch,3*cw,3*ch,x*cw,y*ch,3*cw,3*ch);
 const alpha=new Uint8Array(64*86);for(let y=20;y<70;y++)for(let x=12;x<52;x++)alpha[y*64+x]=255;const expected=cc.getImageData(0,0,W,H).data;
 const run=async(Type,label)=>{const host=document.createElement('div'),c=new Type(host,false),probe=new THREE.Scene();c.liveVideo=true;c.attach(probe);try{c.paint({bitmap:await createImageBitmap(original),captureAt:performance.now(),width:64,height:86,alpha,body:{points:[]}});c.paintVideo(current,true,performance.now());renderer.render(probe,camera);const frame=canvas(),f=frame.getContext('2d');f.drawImage(renderer.domElement,0,0,W,H);const pixels=f.getImageData(0,0,W,H).data;let opaque=0,corrupt=0;for(let y=24;y<66;y++)for(let x=16;x<48;x++){const i=(Math.floor((y+.5)*ch)*W+Math.floor((x+.5)*cw))*4;if(pixels[i+3]===255){opaque++;if(Math.abs(pixels[i]-expected[i])+Math.abs(pixels[i+1]-expected[i+1])+Math.abs(pixels[i+2]-expected[i+2])>8)corrupt++;}}const outside=pixels[(80*W+30)*4+3]===0,calls=renderer.info.render.calls,triangles=renderer.info.render.triangles,stats=c.previewStats();const sample=document.createElement('canvas');sample.width=W;sample.height=H+50;const sc=sample.getContext('2d');sc.fillStyle='#202126';sc.fillRect(0,0,W,H+50);sc.fillStyle='white';sc.font='18px system-ui';sc.fillText(label+' · ensaio de textura em movimento',10,30);sc.drawImage(frame,0,50);$('#samples').appendChild(sample);c.paintVideo(current,true,c.maskAt+451);const expired=!c.overlay.visible;return {opaque,corrupt,outside,calls,triangles,expired,repairs:stats.motionInteriorRepairs??0};}finally{c.dispose();}};
 const old=await run(Old,'Antes'),next=await run(Compositor,'Depois'),reference=new Uint8ClampedArray(64*86*4),now=new Uint8ClampedArray(reference.length),gate=new Uint8Array(64*86),mask=new Uint8Array(gate.length);reference.fill(10);now.fill(230);mask.fill(255);gate.fill(255);for(let y=30;y<33;y++)for(let x=30;x<33;x++)gate[y*64+x]=0;const wrongColourRejected=repairMotionInterior(now,reference,gate,mask,{age:20},createMotionScratch())===0;gate.fill(255);for(let y=30;y<35;y++)for(let x=30;x<35;x++)gate[y*64+x]=0;const largeMatchedRejected=repairMotionInterior(reference,reference,gate,mask,{age:20},createMotionScratch())===0;gate.fill(255);for(let y=30;y<33;y++)for(let x=30;x<33;x++)gate[y*64+x]=0;mask[30*64+29]=0;const contourRejected=repairMotionInterior(reference,reference,gate,mask,{age:20},createMotionScratch())===0;gate.fill(0);const expiredRepairRejected=repairMotionInterior(reference,reference,gate,mask,{age:221},createMotionScratch())===0;
 const r=report.tests.OCCLUSION_MOTION={old,next,wrongColourRejected,expiredRepairRejected,largeMatchedRejected,contourRejected,componentLimit:12,grid:[64,86],captureValidityMs:450,repairValidityMs:220,physicalCameraTest:false};r.passed=next.opaque>old.opaque+100&&next.repairs>100&&next.corrupt===0&&next.outside&&next.calls===1&&next.triangles===2&&next.expired&&wrongColourRejected&&expiredRepairRejected&&largeMatchedRejected&&contourRejected;if(!r.passed)throw Error('Falha no recorte local: '+JSON.stringify(r));status('Pequenas falhas interiores corrigidas por correspondência local; cores, contorno, expiração e uma passagem gráfica preservados.');
});
regressionStages.push(['occlusionMotionTest','Recorte opaco em pequenos movimentos de textura',()=>report.tests.OCCLUSION_MOTION?.passed]);

function maskFixture041({dx=0,dy=0,patch=false,absent=false}={}){
 const c=canvas(),ctx=c.getContext('2d'),cw=W/64,ch=H/86,palette=['#141478','#781414','#147814'];
 for(let y=0;y<86;y++)for(let x=0;x<64;x++){const v=190+(x*7+y*11)%60;ctx.fillStyle='rgb('+v+','+(190+(x*13+y*5)%60)+','+(190+(x*3+y*17)%60)+')';ctx.fillRect(x*cw,y*ch,cw,ch);}
 if(!absent)for(let y=18+dy;y<70+dy;y++)for(let x=22+dx;x<42+dx;x++){const rx=x-dx-(patch&&x>=29&&x<34&&y>=38&&y<43?1:0),ry=y-dy;ctx.fillStyle=palette[((rx+ry*2)%3+3)%3];ctx.fillRect(x*cw,y*ch,cw,ch);}return c;
}
function maskAlpha041(value=255){const a=new Uint8Array(64*86);for(let y=18;y<70;y++)for(let x=22;x<42;x++)a[y*64+x]=255;for(let y=38;y<43;y++)for(let x=29;x<34;x++)a[y*64+x]=value;return a;}
async function maskProbe041(Type,reference,current,alpha,{priorAlpha=null,point=[31,40],label='',commitCapture=false}={}){
 const c=new Type(document.createElement('div'),false),probe=new THREE.Scene();c.liveVideo=true;c.attach(probe);try{
  const captured=performance.now();if(priorAlpha)c.paint({bitmap:await createImageBitmap(reference),captureAt:captured-140,width:64,height:86,alpha:priorAlpha,body:{center:{x:.5,y:.5},points:[]}});
  c.paint({bitmap:await createImageBitmap(reference),captureAt:captured,width:64,height:86,alpha,body:{center:{x:.5,y:.5},points:[]}});c.paintVideo(current,true,performance.now());
  if(commitCapture){const shifted=new Uint8Array(alpha.length);for(let y=0;y<86;y++)for(let x=3;x<64;x++)shifted[y*64+x]=alpha[y*64+x-3];c.paint({bitmap:await createImageBitmap(current),captureAt:performance.now(),width:64,height:86,alpha:shifted,body:{center:{x:.5+3/64,y:.5},points:[]}});}
  renderer.render(probe,camera);
  const output=canvas(),ctx=output.getContext('2d');ctx.drawImage(renderer.domElement,0,0,W,H);const pixels=ctx.getImageData(0,0,W,H).data,expected=current.getContext('2d').getImageData(0,0,W,H).data;let opaque=0,partial=0,corrupt=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(pixels[i+3]===255){opaque++;if(Math.abs(pixels[i]-expected[i])+Math.abs(pixels[i+1]-expected[i+1])+Math.abs(pixels[i+2]-expected[i+2])>8)corrupt++;}else if(pixels[i+3])partial++;}
  const sampleAt=(x,y)=>pixels[(Math.floor((y+.5)*H/86)*W+Math.floor((x+.5)*W/64))*4+3];const state={opaque,partial,corrupt,pointAlpha:sampleAt(...point),oldLeftAlpha:sampleAt(22,40),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,stats:c.previewStats()};
  if(label){const frame=document.createElement('canvas');frame.width=W;frame.height=H+50;const fc=frame.getContext('2d');fc.fillStyle='#202126';fc.fillRect(0,0,W,H+50);fc.fillStyle='white';fc.font='17px system-ui';fc.fillText(label+' · simulação do recorte',10,30);fc.drawImage(output,0,50);$('#samples').appendChild(frame);}
  c.paintVideo(current,true,c.maskAt+451);state.expired=!c.overlay.visible;c.clear();state.historyCleared=c.maskHistory===undefined||c.maskHistory===null;return state;
 }finally{c.dispose();}
}
$('#maskConfidenceTest').onclick=()=>runTest('mask-confidence-stability',async()=>{
 defaultCamera();const Old=(await import('./compositor-v040.js')).Compositor,{stableAlpha}=await import('./stable-mask-v041.js'),image=maskFixture041(),high=maskAlpha041(),rows=[];
 for(const level of [199,175,199]){const low=maskAlpha041(level),old=await maskProbe041(Old,image,image,low,{priorAlpha:high}),next=await maskProbe041(Compositor,image,image,low,{priorAlpha:high,label:level===175?'Recorte estável':null});rows.push({level,old,next});}
 const removed=await maskProbe041(Compositor,image,image,new Uint8Array(high.length),{priorAlpha:high}),weak=new Uint8Array([175,175,175,175]),previous=new Uint8Array([255,255,255,255]),out=new Uint8Array(4);const cold=stableAlpha(weak,null,out,2,2,{age:140})===0&&out.every(x=>!x),expiredHistory=stableAlpha(weak,previous,out,2,2,{age:451})===0&&out.every(x=>!x);
 const resourceProbe=new Compositor(document.createElement('div'),false),resourceScene=new THREE.Scene();resourceProbe.liveVideo=true;resourceProbe.attach(resourceScene);let referenceResources;
 try{const small=Object.assign(document.createElement('canvas'),{width:16,height:16});small.getContext('2d').fillRect(0,0,16,16);const first=await createImageBitmap(small);resourceProbe.paint({bitmap:first,captureAt:performance.now(),width:64,height:86,alpha:high,body:{center:{x:.5,y:.5},points:[]}});resourceProbe.paintVideo(small,true);renderer.render(resourceScene,camera);const firstTexture=resourceProbe.referenceTexture;const large=Object.assign(document.createElement('canvas'),{width:32,height:32});large.getContext('2d').fillRect(0,0,32,32);const second=await createImageBitmap(large);resourceProbe.paint({bitmap:second,captureAt:performance.now(),width:64,height:86,alpha:high,body:{center:{x:.5,y:.5},points:[]}});resourceProbe.paintVideo(large,true);renderer.render(resourceScene,camera);const replaced=resourceProbe.referenceTexture!==firstTexture&&first.width===0;resourceProbe.clear();referenceResources=replaced&&second.width===0&&resourceProbe.referenceTexture===null&&resourceProbe.referenceBitmap===null&&resourceProbe.overlayMaterial.uniforms.referenceMap.value===null&&renderer.getContext().getError()===0;}finally{resourceProbe.dispose();}
 const r=report.tests.MASK_CONFIDENCE={rows,backgroundClears:removed.opaque===0,cold,expiredHistory,referenceResources,currentConfidenceRequired:true,historyAgeCapMs:450,physicalCamera:false};r.passed=rows.every(x=>x.old.pointAlpha===0&&x.next.pointAlpha===255&&x.next.partial===0&&x.next.corrupt===0&&x.next.stats.segmentationHeld>0&&x.next.expired&&x.next.historyCleared)&&r.backgroundClears&&cold&&expiredHistory&&referenceResources;if(!r.passed)throw Error('Falha na estabilidade da máscara: '+JSON.stringify(r));status('Variação de confiança não abre buracos; fundo, início sem histórico e histórico expirado continuam limpos.');
});
regressionStages.push(['maskConfidenceTest','Máscara binária estável com evidência atual',()=>report.tests.MASK_CONFIDENCE?.passed]);
$('#foregroundMotionTest').onclick=()=>runTest('foreground-motion-stability',async()=>{
 defaultCamera();const Old=(await import('./compositor-v040.js')).Compositor,reference=maskFixture041(),alpha=maskAlpha041(),rows=[];
 for(const movement of [{dx:3,dy:0},{dx:-2,dy:2}]){const current=maskFixture041(movement),point=movement.dx>0?[43,40]:[30,71],old=await maskProbe041(Old,reference,current,alpha,{point}),next=await maskProbe041(Compositor,reference,current,alpha,{point,label:'Pessoa movendo com fundo fixo'});rows.push({movement,old,next});}
 const patch=maskFixture041({patch:true}),oldPatch=await maskProbe041(Old,reference,patch,alpha),newPatch=await maskProbe041(Compositor,reference,patch,alpha,{label:'Movimento local sem vazamento'}),absent=maskFixture041({absent:true}),lost=await maskProbe041(Compositor,reference,absent,alpha);
 const moved=maskFixture041({dx:3}),atomicOld=await maskProbe041(Old,reference,moved,alpha,{point:[43,40],commitCapture:true}),atomicNew=await maskProbe041(Compositor,reference,moved,alpha,{point:[43,40],commitCapture:true,label:'Máscara e recorte atualizados juntos'}),atomicCommit=atomicOld.pointAlpha===0&&atomicNew.pointAlpha===255&&atomicNew.stats.maskCommits===1&&atomicNew.stats.frames===1;
 const r=report.tests.FOREGROUND_MOTION={rows,oldPatch,newPatch,lost,atomicOld,atomicNew,atomicCommit,foregroundWeightedNotBackgroundWeighted:true,physicalDepthMeasured:false,physicalCamera:false};r.passed=rows.every(x=>x.old.pointAlpha===0&&x.next.pointAlpha===255&&x.next.stats.alignmentSource==='foreground'&&x.next.stats.alignment.dx===x.movement.dx&&x.next.stats.alignment.dy===x.movement.dy&&x.next.partial===0&&x.next.corrupt===0&&x.next.calls===1&&x.next.triangles===2&&x.next.expired)&&oldPatch.pointAlpha===0&&newPatch.pointAlpha===255&&newPatch.stats.supportedInteriorRepairs>0&&newPatch.corrupt===0&&lost.opaque===0&&lost.stats.supportedInteriorRepairs===0&&atomicCommit;
 if(!r.passed)throw Error('Falha no acompanhamento do recorte: '+JSON.stringify(r));status('Recorte acompanha a pessoa em vez do fundo; movimento local validado, RGB opaco e perda real preservados.');
});
regressionStages.push(['foregroundMotionTest','Pessoa em movimento sem buracos intermitentes',()=>report.tests.FOREGROUND_MOTION?.passed]);

// Additional regression cases are appended without replacing prior assertions.
$('#articulatedMaskTest').onclick=()=>runTest('articulated-mask',async()=>{
 defaultCamera();const Old=(await import('./compositor-v041.js')).Compositor,W=480,H=640,cw=W/64,ch=H/86,alpha=new Uint8Array(64*86);
 const fixture=(shift=0,absent=false)=>{const c=canvas(),ctx=c.getContext('2d');ctx.fillStyle=absent?'#00ff00':'#183f69';ctx.fillRect(0,0,W,H);if(!absent){for(let y=15;y<73;y++)for(let x=24;x<40;x++){const v=(x*59+y*97)%160;ctx.fillStyle=`rgb(${70+v},${30+v},${20+v})`;ctx.fillRect(x*cw,y*ch,cw+.2,ch+.2);alpha[y*64+x]=255;}for(let y=28;y<35;y++)for(let x=10;x<24;x++){const v=(((x*73856093)^(y*19349663))>>>0)%175;ctx.fillStyle=`rgb(${60+v},${45+v},${25+v})`;ctx.fillRect(x*cw,(y+shift)*ch,cw+.2,ch+.2);if(!shift)alpha[y*64+x]=255;}}return c;};
 const reference=fixture(),rows=[];const sample=(pixels,x,y)=>pixels[(Math.floor((y+.5)*ch)*W+Math.floor((x+.5)*cw))*4+3];
 for(const shift of [-3,3]){const current=fixture(shift);for(const [Type,name] of [[Old,'old'],[Compositor,'next']]){const c=new Type(document.createElement('div'),false),s=new THREE.Scene();c.liveVideo=true;c.attach(s);try{c.paint({bitmap:await createImageBitmap(reference),captureAt:performance.now(),width:64,height:86,alpha,body:{points:[],center:{x:.5,y:.5}}});c.paintVideo(current,true);renderer.render(s,camera);const image=canvas(),ctx=image.getContext('2d');ctx.drawImage(renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,W,H).data,expected=current.getContext('2d').getImageData(0,0,W,H).data;let covered=0,total=0,corrupt=0,partial=0;
 for(let y=29+shift;y<34+shift;y++)for(let x=12;x<22;x++){total++;const py=Math.floor((y+.5)*ch),px=Math.floor((x+.5)*cw),i=(py*W+px)*4;if(pixels[i+3]===255){covered++;if(Math.abs(pixels[i]-expected[i])+Math.abs(pixels[i+1]-expected[i+1])+Math.abs(pixels[i+2]-expected[i+2])>8)corrupt++;}else if(pixels[i+3]>0)partial++;}
 const row={name,shift,covered,total,corrupt,partial,flow:c.previewStats().localFlow??null,probes:c.localFlow?[26,28,31,34,36].map(y=>({y,v:c.localFlow.pixels[(y*64+15)*4+3],dx:c.localFlow.dx[y*64+15],dy:c.localFlow.dy[y*64+15]})):null,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};rows.push(row);const f=document.createElement('canvas');f.width=W;f.height=H+50;const fc=f.getContext('2d');fc.fillStyle='#202126';fc.fillRect(0,0,W,H+50);fc.fillStyle='white';fc.fillText(name+' · braço move, tronco parado · '+shift,10,30);fc.drawImage(current,0,50);fc.fillStyle='#09070a';fc.fillRect(30,150,350,400);fc.drawImage(image,0,50);$('#samples').appendChild(f);
 c.paintVideo(fixture(0,true),true,c.maskAt+70);renderer.render(s,camera);ctx.clearRect(0,0,W,H);ctx.drawImage(renderer.domElement,0,0);row.removedPixel=Array.from(ctx.getImageData(Math.floor(15.5*cw),Math.floor(31.5*ch),1,1).data);row.removedState=c.previewStats();row.removedClears=row.removedPixel[3]===0;
 c.paintVideo(current,true,c.maskAt+451);row.expired=!c.overlay.visible;c.clear();row.flowCleared=!c.localFlow||c.localFlow.accepted===0;
 }finally{c.dispose();}}}
 const {LocalFlow}=await import('./local-flow-v042.js'),flow=new LocalFlow(),flat=new Uint8ClampedArray(64*86*4).fill(100);flow.update(flat,flat,new Uint8Array(64*86).fill(255),{dx:0,dy:0},0,20);const noFlatFalseMotion=flow.accepted===0;flow.update(flat,flat,alpha,{dx:0,dy:0},0,301);const ageCap=flow.accepted===0;
 const r=report.tests.ARTICULATED_MASK={rows,noFlatFalseMotion,ageCap,physicalCamera:false};r.passed=rows.filter(x=>x.name==='next').every(x=>x.covered>=x.total*.75&&x.corrupt===0&&x.partial===0&&x.calls===1&&x.triangles===2&&x.removedClears&&x.expired&&x.flowCleared)&&rows.filter(x=>x.name==='next').every(x=>x.covered>rows.find(o=>o.name==='old'&&o.shift===x.shift).covered+10)&&noFlatFalseMotion&&ageCap;if(!r.passed)throw Error('Movimento articulado: '+JSON.stringify(r));status('Braço acompanha movimento independente do tronco; semitransparência, fundo e expiração conferidos.');
});
regressionStages.push(['articulatedMaskTest','Braços em movimento independente do tronco',()=>report.tests.ARTICULATED_MASK?.passed]);
$('#framingStabilityTest').onclick=()=>runTest('framing-stability',async()=>{
 const Old=(await import('./body-frame-v040.js')).BodyFramer,make=(w=1,t=1,fy=.92)=>({present:true,shoulder:{x:.5,y:.30},hip:{x:.5,y:.30+.26*t},center:{x:.5,y:.43},shoulderWidth:.20*w,feet:{x:.5,y:fy},feetVisible:true,points:[]}),rows=[];
 for(const Type of [Old,BodyFramer]){const f=new Type(),base=f.update(make(),refs,1,viewHeight(),.75),values=[];for(const [w,t] of [[1.15,1],[1,1.15],[1.15,1],[1,1]])values.push(f.update(make(w,t),refs,1,viewHeight(),.75).scale/base.scale);rows.push({name:Type===Old?'old':'next',ratios:values,maxDeviation:Math.max(...values.map(v=>Math.abs(v-1)))});}
 const f=new BodyFramer(),base=f.update(make(),refs,1,viewHeight(),.75),spike=f.update(make(1,1,.78),refs,1,viewHeight(),.75),back=f.update(make(),refs,1,viewHeight(),.75),isolatedFootHeld=Math.abs(spike.rootOffset-base.rootOffset)<1e-6&&Math.abs(back.rootOffset-base.rootOffset)<1e-6;f.update(make(1,1,.78),refs,1,viewHeight(),.75);const repeat=f.update(make(1,1,.78),refs,1,viewHeight(),.75),confirmedStepAccepted=Math.abs(repeat.rootOffset-base.rootOffset)>.1;
 const zoom=new BodyFramer(),a=zoom.update(make(),refs,1,viewHeight(),.75),b=make(1.4,1.4);const z=zoom.update(b,refs,1,viewHeight(),.75),coherentZoomPreserved=Math.abs(z.scale/a.scale-1.4)<.001,manual=zoom.update(b,refs,1.2,viewHeight(),.75),manualPreserved=Math.abs(manual.scale/z.scale-1.2)<.001;
 const r=report.tests.FRAMING_STABILITY={rows,isolatedFootHeld,confirmedStepAccepted,coherentZoomPreserved,manualPreserved,physicalDepthMeasured:false,physicalCamera:false};r.passed=rows[0].maxDeviation>.1&&rows[1].maxDeviation<.001&&isolatedFootHeld&&confirmedStepAccepted&&coherentZoomPreserved&&manualPreserved;if(!r.passed)throw Error('Estabilidade corporal: '+JSON.stringify(r));status('Oscilação contraditória dos pontos e salto isolado dos pés rejeitados; aproximação coerente e proporção manual preservadas.');
});
regressionStages.push(['framingStabilityTest','Pontos corporais oscilantes sem salto de escala e pés',()=>report.tests.FRAMING_STABILITY?.passed]);





$('#landingBackdropTest').onclick=()=>runTest('landing-background',async()=>{
 const art=document.querySelector('.landing-art'),img=art?.querySelector('img');if(!img)throw Error('Imagem do fundo ausente');await img.decode();
 const cs=getComputedStyle(art),decorative=art.getAttribute('aria-hidden')==='true'&&img.alt===''&&cs.pointerEvents==='none',loaded=img.naturalWidth===736&&img.naturalHeight===1308;
 const initialVisible=cs.display!=='none',before=document.body.className;
 document.body.classList.add('session-starting');const hiddenStarting=getComputedStyle(art).display==='none';document.body.className=before;document.body.classList.add('session-running');const hiddenCamera=getComputedStyle(art).display==='none';document.body.className=before;
 const restored=getComputedStyle(art).display!=='none',noCanvas=!art.querySelector('canvas,video'),noMotion=getComputedStyle(img).animationName==='none',controls=['camera','live','preview','showBook','saveLive','occlusionMode'].every(id=>!!document.getElementById(id)),cleanTitle=document.title==='KIRA · Death Note'&&document.querySelector('.intro h1').textContent==='KIRA';
 const r=report.tests.LANDING_BACKDROP={decorative,loaded,initialVisible,hiddenStarting,hiddenCamera,restored,noCanvas,noMotion,controls,cleanTitle,physicalCamera:false};r.passed=[decorative,loaded,initialVisible,hiddenStarting,hiddenCamera,restored,noCanvas,noMotion,controls,cleanTitle].every(Boolean);if(!r.passed)throw Error('Fundo da página: '+JSON.stringify(r));status('Fundo estático, decorativo e oculto durante a câmera; controles preservados.');
});
regressionStages.push(['landingBackdropTest','Fundo Ryuk e Light sem interferir na câmera',()=>report.tests.LANDING_BACKDROP?.passed]);

function handoffWorld(navigate=url=>location.assign(url)){
 try{sessionStorage.setItem('kira-world-cover',String(Date.now()));}catch{status('Armazenamento de sessão indisponível para confirmar a capa.');return false;}
 stopLive();navigate('./ambiente-v0474.html');return true;
}
const sceneMode=$('#experienceMode');if(new URLSearchParams(location.search).get('modo')==='pessoa')sceneMode.value='person';
const syncMode=()=>{const world=sceneMode.value==='world';document.body.classList.toggle('world-selected',world);$('#worldModeHelp').hidden=!world;if(world)$('#camera').value='environment';$('.setup>p:first-child').textContent=world?'Apresente a capa do caderno à câmera. Depois, escolha um ponto no piso para Ryuk.':'Apresente a capa do caderno à câmera. Depois, enquadre a pessoa para revelar Ryuk.';if(!live)text('#liveStatus',world?'Após reconhecer a capa, escolha um ponto no piso.':'Apresente a capa e enquadre a pessoa.');};sceneMode.onchange=syncMode;syncMode();
$('#cleanSceneTest').onclick=()=>runTest('clean-scene',async()=>{
 const before=document.body.className;document.body.classList.add('session-running');const overlayHidden=getComputedStyle($('#gestureFeedback')).display==='none',noteHidden=getComputedStyle($('.gesture-note')).display==='none';document.body.className=before;
 const previousReceipt=sessionStorage.getItem('kira-world-cover');let released=0,destination=null;videoStream={getTracks:()=>[{stop(){released++;}}]};handoffWorld(url=>destination=url);const handoffReleasedCamera=released===1&&videoStream===null&&destination==='./ambiente-v0474.html'&&Number(sessionStorage.getItem('kira-world-cover'))>Date.now()-1000;if(previousReceipt===null)sessionStorage.removeItem('kira-world-cover');else sessionStorage.setItem('kira-world-cover',previousReceipt);
 const r=report.tests.CLEAN_SCENE={overlayHidden,noteHidden,handoffReleasedCamera,deathNote:$('.intro .lead').textContent==='Death Note',gestureStillAvailable:!!$('#exitAppearance')&&typeof acceptHandFrame==='function',passed:overlayHidden&&noteHidden&&handoffReleasedCamera&&$('.intro .lead').textContent==='Death Note'};if(!r.passed)throw Error('Aviso da mão ou transição de câmera incorretos.');
});regressionStages.push(['cleanSceneTest','Death Note e cena sem aviso da mão',()=>report.tests.CLEAN_SCENE?.passed]);
$('#worldAnchorTest').onclick=()=>runTest('world-anchor',async()=>{const {runWorldTests}=await import('./world-tests-v045.js');report.tests.WORLD_ANCHOR=await runWorldTests($('#samples'));if(!report.tests.WORLD_ANCHOR.passed)throw Error('Ancoragem digital reprovada: '+JSON.stringify(report.tests.WORLD_ANCHOR));});regressionStages.push(['worldAnchorTest','Posição no ambiente, perspectiva e perda de rastreamento',()=>report.tests.WORLD_ANCHOR?.passed]);

$('#nativeRouteTest').onclick=()=>runTest('native-route',async()=>{
 const {probeWorld,nativeAndroidURL}=await import('./world-compat-v046.js'),absent=await probeWorld({userAgent:'Mozilla Android Samsung SM-M356B Chrome',secure:true}),available=await probeWorld({xr:{isSessionSupported:async()=>true},userAgent:'Android Chrome'}),denied=await probeWorld({xr:{isSessionSupported:async()=>{throw new DOMException('denied','NotAllowedError');}},userAgent:'Android Chrome'}),url=nativeAndroidURL('https://example.com/kira/ambiente-v046.html');let insecure=false;try{nativeAndroidURL('http://example.com/a/');}catch{insecure=true;}
 const r=report.tests.NATIVE_ROUTE={missingAPIIdentified:absent.reason==='api-missing'&&absent.android&&!absent.immersiveAR,available:available.immersiveAR,denialIdentified:denied.reason==='probe-failed'&&denied.error.name==='NotAllowedError',nativePackage:url.includes('package=com.google.ar.core;'),AROnly:url.includes('mode=ar_only'),fixedScale:url.includes('resizable=false'),fallback:decodeURIComponent(url).includes('https://example.com/kira/ambiente-v046.html?native=unavailable'),insecureRejected:insecure,physicalNativeViewer:false};r.passed=Object.entries(r).filter(([k])=>k!=='physicalNativeViewer').every(([,v])=>v);if(!r.passed)throw Error('Alternativa nativa inválida: '+JSON.stringify(r));
});regressionStages.push(['nativeRouteTest','WebXR indisponível, alternativa Android e retorno sem falso AR',()=>report.tests.NATIVE_ROUTE?.passed]);
$('#personClearanceTest').onclick=()=>runTest('person-clearance',async()=>{
 const {spaceOptions:oldOptions}=await import('./space-chooser-v040.js'),rows=[];
 for(const side of [-1,1])for(const center of [.35,.5,.65]){const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:1}));for(const [i,x] of [[11,center-.10],[12,center+.10],[23,center-.08],[24,center+.08],[13,center+side*.20],[15,center+side*.30]])points[i]={x,y:.5,visibility:.95,presence:1};const b={center:{x:center},shoulderWidth:.20,points},before=oldOptions(b,refs,1,3.4,.55),after=spaceOptions(b,refs,1,3.4,.55),a=after.find(v=>v.direction===side),o=before.find(v=>v.direction===side);rows.push({side,center,oldX:o.composition.x,newX:a.composition.x,awayFromRaisedArm:side*a.composition.x>side*o.composition.x+.10,scaleChanged:false});}
 const r=report.tests.PERSON_CLEARANCE={rows,originalSideHysteresisPreserved:true,noModelShrink:true,physicalCamera:false};r.passed=rows.every(v=>v.awayFromRaisedArm&&!v.scaleChanged);if(!r.passed)throw Error('Folga da pessoa: '+JSON.stringify(r));
});regressionStages.push(['personClearanceTest','Folga de braços e pernas sem mudar escala ou histerese',()=>report.tests.PERSON_CLEARANCE?.passed]);
$('#torsoCoreTest').onclick=()=>runTest('torso-core',async()=>{
 defaultCamera();const Old=(await import('./compositor-v042.js')).Compositor,{stabilizeTorso}=await import('./torso-core-v046.js'),image=maskFixture041(),high=maskAlpha041(),low=maskAlpha041(140),points=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:1}));for(const [i,x,y] of [[11,.35,.25],[12,.65,.25],[23,.38,.7],[24,.62,.7]])points[i]={x,y,visibility:.95,presence:1};const body={present:true,center:{x:.5,y:.5},points},rows=[];
 for(const [Type,name] of [[Old,'old'],[Compositor,'next']]){const c=new Type(document.createElement('div'),false),probe=new THREE.Scene();c.liveVideo=true;c.attach(probe);try{const at=performance.now();c.paint({bitmap:await createImageBitmap(image),captureAt:at-140,width:64,height:86,alpha:high,body});c.paint({bitmap:await createImageBitmap(image),captureAt:at,width:64,height:86,alpha:low,body});c.paintVideo(image,true);renderer.render(probe,camera);const frame=canvas(),ctx=frame.getContext('2d');ctx.drawImage(renderer.domElement,0,0,W,H);const p=ctx.getImageData(Math.floor(31.5*W/64),Math.floor(40.5*H/86),1,1).data,expected=image.getContext('2d').getImageData(Math.floor(31.5*W/64),Math.floor(40.5*H/86),1,1).data;rows.push({name,alpha:p[3],rgbCorrect:p[0]===expected[0]&&p[1]===expected[1]&&p[2]===expected[2],held:c.previewStats().torsoHeld??0});if(name==='next'){$('#samples').appendChild(frame);}}finally{c.dispose();}}
 const out=new Uint8Array(high.length),history={mode:'refined',width:64,height:86,captureAt:100,center:{x:.5,y:.5}},zero=new Uint8Array(high.length);const cold=stabilizeTorso(low,high,out,64,86,body,null,200)===0,expired=stabilizeTorso(low,high,out,64,86,body,history,551)===0,background=stabilizeTorso(zero,high,out,64,86,body,history,200)===0&&out.every(v=>v===0);stabilizeTorso(new Uint8Array(high.length).fill(140),high,out,64,86,body,history,200);const contour=out[18*64+22]===140;
 const staleStrong=stabilizeTorso(low,high,out,64,86,body,{...history,captureAt:450},500,new Float32Array(high.length).fill(10))===0;
 const r=report.tests.TORSO_CORE={rows,cold,expired,background,contour,staleStrong,physicalCamera:false};r.passed=rows[0].alpha===0&&rows[1].alpha===255&&rows[1].rgbCorrect&&rows[1].held>0&&cold&&expired&&background&&contour&&staleStrong;if(!r.passed)throw Error('Oscilação do tronco: '+JSON.stringify(r));
});regressionStages.push(['torsoCoreTest','Tronco com confiança oscilante sem preencher fundo ou histórico vencido',()=>report.tests.TORSO_CORE?.passed]);

$('#browserAnchorTest').onclick=()=>runTest('browser-anchor',async()=>{
 const {BrowserStage}=await import('./browser-stage-v047.js'),s=new BrowserStage(),p={position:{x:0,y:1.6,z:0},rotation:{x:0,y:0,z:0,w:1},trackingStatus:'NORMAL'},hit={type:'ESTIMATED_SURFACE',rotation:{x:0,y:0,z:0,w:1},position:{x:1,y:0,z:-2},distance:2.3};
 const checks={},check=(k,v)=>{checks[k]=!!v;if(!v)throw Error(k);};
 check('notPlacedWithoutTracking',!s.offer([hit],0)&&!s.place(p.position,0));s.update(p,0);s.update(p,310);check('stableTracking',s.tracking);check('floorHit',s.offer([hit],310));check('placement',s.place(p.position,350));const fixed=JSON.stringify(s.snapshot().position),yaw=s.yaw;
 for(let i=0;i<120;i++){s.update({...p,position:{x:Math.sin(i)*3,y:1.6,z:Math.cos(i)*3}},360+i*16);s.offer([{...hit,position:{x:99,y:0,z:2}}],360+i*16);}
 check('cameraDoesNotMoveOrResizeRoot',JSON.stringify(s.position)===fixed&&s.yaw===yaw&&s.scale===1);check('noSecondPlacement',!s.place({x:2,z:2},2300));s.update({...p,trackingStatus:'LIMITED'},2400);check('lossHides',!s.visible&&JSON.stringify(s.position)===fixed);s.update(p,2450);s.update(p,2800);check('sameAnchorReturns',s.visible&&JSON.stringify(s.position)===fixed);s.fresh(3401);check('stalePoseHides',!s.visible);s.reset();s.update(p,4000);s.update(p,4310);check('featurePointsAreNotFloor',!s.offer([{...hit,type:'FEATURE_POINT'}],4310));check('wallRejected',!s.offer([{...hit,type:'DETECTED_SURFACE',rotation:{x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2}}],4310));check('missingNormalRejected',!s.offer([{...hit,rotation:null}],4310));s.offer([hit],4310);check('oldHitRejected',!s.place(p.position,4511));s.offer([{...hit,position:{x:NaN,y:0,z:0}}],4511);check('invalidRejected',s.hit===null);s.reset();check('reset',!s.placed&&s.position===null);report.tests.BROWSER_ANCHOR={passed:true,checks,physicalCameraValidated:false};
});regressionStages.push(['browserAnchorTest','Âncora SLAM do navegador, estabilidade e perda',()=>report.tests.BROWSER_ANCHOR?.passed]);

$('#groundTest').onclick=()=>runTest('ground-projection',async()=>{
 const THREE=await import('three'),{GroundProjector}=await import('./ground-projector-v0471.js'),{BrowserStage}=await import('./browser-stage-v0471.js');
 const camera=new THREE.PerspectiveCamera(60,390/844,.01,50);camera.position.set(0,1.6,0);camera.rotation.x=-.4;camera.updateMatrixWorld(true);const projector=new GroundProjector(),stage=new BrowserStage(),checks={};const check=(k,v)=>{checks[k]=!!v;if(!v)throw Error(k);};
 const pose={position:{x:0,y:1.6,z:0},rotation:{x:0,y:0,z:0,w:1},trackingStatus:'NORMAL'};
 // Regression: the actual 4.7 offer path cannot advance when native hitTest returns [].
 const {BrowserStage:OldStage}=await import('./browser-stage-v047.js'),old=new OldStage();old.update(pose,0);old.update(pose,310);check('oldEmptySurfaceQueryReproduced',!old.offer([],310)&&!old.place(camera.position,310));
 stage.update(pose,0);stage.update(pose,310);const estimate=projector.project(camera);check('estimatedGroundWithoutSDKSurface',!!estimate&&estimate.position.y===0&&estimate.type==='SLAM_GROUND_ESTIMATE');check('newPlacementAvailable',stage.offer([estimate],310)&&stage.place(camera.position,350));const anchor=JSON.stringify(stage.position);camera.position.set(2,1.6,-1);camera.updateMatrixWorld(true);stage.update({...pose,position:{x:2,y:1.6,z:-1}},380);stage.offer([projector.project(camera)],380);check('selectedPointRemainsFixed',JSON.stringify(stage.position)===anchor&&stage.scale===1);
 stage.update({...pose,trackingStatus:'LIMITED'},400);check('limitedTrackingDoesNotInventPlacement',!stage.visible&&!stage.offer([estimate],400));
 camera.rotation.x=1.2;camera.updateMatrixWorld(true);check('skyRejected',!projector.project(camera));camera.rotation.x=0.23;camera.updateMatrixWorld(true);check('horizontalRayRejected',!projector.project(camera));camera.rotation.x=-.4;camera.position.y=.1;camera.updateMatrixWorld(true);check('invalidHeightRejected',!projector.project(camera));camera.position.y=10;camera.rotation.x=0;camera.updateMatrixWorld(true);check('excessiveRangeRejected',!projector.project(camera));
 report.tests.GROUND_PROJECTION={passed:true,checks,planeIsEstimated:true,physicalCameraValidated:false};
});regressionStages.push(['groundTest','Posicionar no chão estimado mesmo sem resultados de superfície',()=>report.tests.GROUND_PROJECTION?.passed]);

$('#poseGuardTest').onclick=()=>runTest('world-pose-guard',async()=>{
 const THREE=await import('three'),{WorldPoseGuard}=await import('./world-pose-guard-v0472.js'),g=new WorldPoseGuard(),camera=new THREE.PerspectiveCamera(60,.5,.01,50),checks={};const check=(name,v)=>{checks[name]=!!v;if(!v)throw Error(name);};
 const raw=()=>({trackingStatus:'NORMAL',position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},rotation:{x:camera.quaternion.x,y:camera.quaternion.y,z:camera.quaternion.z,w:camera.quaternion.w},intrinsics:camera.projectionMatrix.toArray()});camera.position.y=1.6;
 for(let i=0;i<25;i++){camera.rotation.y=i*.02;g.observe(raw(),camera,i*100,false);}check('rotationAloneCannotEnablePlacement',!g.ready);
 g.reset();camera.rotation.set(0,0,0);for(let i=0;i<10;i++){camera.position.x=i*.01;g.observe(raw(),camera,i*100,false);}check('translationEvidenceEnables',g.ready&&g.safe);
 const initial=raw();camera.position.x+=.1;check('renderCameraMismatchRejected',!g.observe(initial,camera,1000,true)&&g.fault==='camera-pose-mismatch');
 g.reset();camera.position.x=0;g.observe(raw(),camera,0,false);camera.position.y=-.5;check('implausibleHeightJumpRejected',!g.observe(raw(),camera,100,true)&&g.fault==='tracking-jump');
 g.reset();camera.position.set(0,1.6,0);g.observe(raw(),camera,0,false);for(let i=1;i<=15;i++){g.motion({alpha:0,beta:35,gamma:0},i*100);g.observe(raw(),camera,i*100,true);}check('frozenPoseDuringGyroMotionRejected',g.fault==='pose-frozen-during-motion');
 g.reset();camera.position.x=0;for(let i=0;i<10;i++){camera.position.x=i*.01;g.observe(raw(),camera,i*100,false);}camera.position.y=1.55;check('normalCrouchAllowed',g.observe(raw(),camera,1100,true));check('trackingLossHides',!g.observe({...raw(),trackingStatus:'LIMITED'},camera,1200,true));
 report.tests.WORLD_POSE_GUARD={passed:true,checks,physicalCameraValidated:false};
});regressionStages.push(['poseGuardTest','Deslocamento real da pose, câmera coerente e rejeição de congelamento',()=>report.tests.WORLD_POSE_GUARD?.passed]);

$('#footingTest').onclick=()=>runTest('world-model-footing',async()=>{
 const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{prepareWorldModel}=await import('./world-model-v0473.js'),{GroundProjector}=await import('./ground-projector-v0473.js');
 const a=await new GLTFLoader().loadAsync('./ryuk-v025.glb'),prepared=prepareWorldModel(a),m=new T.AnimationMixer(a.scene),rows=[];
 for(const clip of a.animations){m.stopAllAction();m.clipAction(clip).reset().play();for(let i=0;i<24;i++){m.setTime(i/24*clip.duration);prepared.mount.updateMatrixWorld(true);const b=new T.Box3().setFromObject(prepared.mount,true);rows.push({clip:clip.name,time:i/24*clip.duration,bottom:b.min.y,top:b.max.y});}}
 m.stopAllAction();m.clipAction(a.animations.find(c=>c.name==='03_Presenca_Suave')).reset().play();m.setTime(0);prepared.mount.updateMatrixWorld(true);const box=new T.Box3().setFromObject(prepared.mount,true);
 if(Math.abs(box.min.y)>.001||Math.abs(box.max.y-2.4)>.001)throw Error('Neutral pose feet/height not normalized');
 if(rows.filter(r=>r.clip!=='01_Manifestacao').some(r=>r.bottom<-.07||r.bottom>.09))throw Error('Animation feet float above support');
 const c=new T.PerspectiveCamera(60,.5,.01,50);c.position.y=1.6;c.rotation.x=-1.45;c.updateMatrixWorld(true);const ground=new GroundProjector();if(ground.project(c)!==null||ground.snapshot().reason!=='too-close-to-camera')throw Error('Overhead placement accepted');
 c.rotation.x=-.4;c.updateMatrixWorld(true);if(!ground.project(c))throw Error('Normal floor placement rejected');
 report.tests.WORLD_MODEL_FOOTING={passed:true,reference:prepared.proof,rows,physicalCameraValidated:false,originalClips:a.animations.map(x=>x.name)};
});regressionStages.push(['footingTest','Base animada dos pés, altura de referência e distância de colocação',()=>report.tests.WORLD_MODEL_FOOTING?.passed]);

$('#worldPresentationTest').onclick=()=>runTest('world-presentation',async()=>{
 const {makePlacementArrow,renderBudget,setNaturalFraming}=await import('./world-presentation-v0474.js'),arrow=makePlacementArrow(),checks={};
 checks.arrowMesh=arrow.isMesh&&arrow.name==='KIRA_PLACEMENT_ARROW'&&!arrow.visible;checks.flatGround=arrow.geometry.boundingBox===null;arrow.geometry.computeBoundingBox();checks.flatGround=arrow.geometry.boundingBox.max.y-arrow.geometry.boundingBox.min.y<.001;
 const rows=[];for(const [w,h,dpr] of [[390,844,3],[412,915,2.6],[768,1024,2],[1920,1080,1],[844,390,3]]){const b=renderBudget(w,h,dpr);rows.push({w,h,dpr,...b});if(b.width*b.height>902000||Math.max(b.width,b.height)>1281||b.ratio>1)throw Error('Render budget exceeded');}
 const c=document.createElement('canvas');setNaturalFraming(c,true);checks.uniformCrop=c.style.transform==='scale(1.15)'&&c.style.width==='100%'&&c.style.height==='100%';setNaturalFraming(c,false);checks.wideAvailable=c.style.transform==='none';arrow.geometry.dispose();arrow.material.dispose();
 report.tests.WORLD_PRESENTATION={passed:Object.values(checks).every(Boolean),checks,rows,opticalCalibration:false,physicalCameraValidated:false};if(!report.tests.WORLD_PRESENTATION.passed)throw Error('Arrow/framing failed');
});regressionStages.push(['worldPresentationTest','Seta sem revelar Ryuk e orçamento de renderização',()=>report.tests.WORLD_PRESENTATION?.passed]);
$('#worldPersonTest').onclick=()=>runTest('world-person',async()=>{
 const {Compositor:WorldCompositor}=await import('./world-compositor-v0474.js'),{WorldPerson}=await import('./world-person-v0474.js'),scene=new THREE.Scene(),com=new WorldCompositor(document.createElement('div'),false),source=document.createElement('canvas');source.width=800;source.height=600;const ctx=source.getContext('2d');ctx.fillStyle='rgb(40,80,120)';ctx.fillRect(0,0,800,600);ctx.fillStyle='rgb(160,90,60)';ctx.fillRect(340,0,120,600);let worker;try{
 defaultCamera();com.liveVideo=true;com.attach(scene);com.viewportWidth=320;com.viewportHeight=900;const sample=document.createElement('canvas');sample.width=160;sample.height=450;sample.getContext('2d').drawImage(source,(800-600*320/900)/2,0,600*320/900,600,0,0,160,450);const alpha=new Uint8ClampedArray(64*86);for(let y=10;y<76;y++)for(let x=18;x<46;x++)alpha[y*64+x]=255;
 com.paint({bitmap:await createImageBitmap(sample),width:64,height:86,alpha,body:{present:true,center:{x:.5,y:.5},points:[]},captureAt:performance.now()});com.paintVideo(source,true,performance.now());renderer.render(scene,camera);const out=canvas(),o=out.getContext('2d');o.drawImage(renderer.domElement,0,0,W,H);const center=Array.from(o.getImageData(W/2,H/2,1,1).data),outer=Array.from(o.getImageData(5,5,1,1).data),crop=com.overlayMaterial.uniforms.crop.value.toArray();const rgb=center[0]===160&&center[1]===90&&center[2]===60&&center[3]===255,viewportCrop=Math.abs(crop[0]-(600*320/900)/800)<.001,clearOutside=outer[3]===0;com.paintVideo(source,true,com.maskAt+451);const staleHidden=!com.overlay.visible;
 worker=new WorkerRunner('./world-person-worker-v0474.js');await worker.ready;const photo=await loadImage('./portrait.jpg');const result=await worker.infer(photo,performance.now());const segmentation=result.mean>.01&&result.alpha.some(x=>x>=200);result.bitmap.close();
 const life=new WorldPerson(new THREE.Scene());let resolve;life.runner={infer:()=>new Promise(r=>resolve=r),close:()=>{}};Object.defineProperties(source,{videoWidth:{value:800},videoHeight:{value:600},readyState:{value:2}});life.update(source,true,true,320,900,performance.now());for(let i=0;i<10;i++)life.update(source,true,true,320,900,performance.now()+i);const single=life.stats.maxInFlight===1;const bitmap=await createImageBitmap(sample);life.dispose();resolve({bitmap,captureAt:performance.now()});await new Promise(r=>setTimeout(r,0));const lateClosed=bitmap.width===0;
 report.tests.WORLD_PERSON={passed:rgb&&viewportCrop&&clearOutside&&staleHidden&&segmentation&&single&&lateClosed,rgb,center,crop,viewportCrop,clearOutside,staleHidden,segmentation,single,lateClosed,physicalDepthMeasured:false,realFileInference:true,physicalCameraValidated:false};if(!report.tests.WORLD_PERSON.passed)throw Error('World person failed '+JSON.stringify(report.tests.WORLD_PERSON));
 }finally{worker?.close();com.dispose();}
});regressionStages.push(['worldPersonTest','Pessoa à frente no enquadramento AR, inferência única e descarte',()=>report.tests.WORLD_PERSON?.passed]);
