import * as THREE from 'three';
import {SmokeMotion} from './smoke-motion-v033.js';
const lattice=Float64Array.from({length:64*64},(_,i)=>{const v=Math.sin((i%64)*127.1+Math.floor(i/64)*311.7)*43758.5453;return v-Math.floor(v);});
const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),a=iy*64+ix;return (lattice[a]*(1-sx)+lattice[a+1]*sx)*(1-sy)+(lattice[a+64]*(1-sx)+lattice[a+65]*sx)*sy;};
function smokeTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),im=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const dx=(x-63.5)/64,dy=(y-63.5)/64,theta=Math.atan2(dy,dx),radius=Math.hypot(dx,dy);
  const bend=.16*Math.sin(dy*5)+.12*Math.sin(theta*3+radius*7),nx=x+12*Math.sin(dy*4+radius*5),ny=y+10*Math.cos(dx*5-radius*4);
  const n=.52*noise(nx*.065+6,ny*.065+12)+.31*noise(nx*.14+25,ny*.14+8)+.17*noise(nx*.29+12,ny*.29+20);
  const r=Math.hypot(dx+bend,dy+.12*Math.sin(dx*5)),edge=Math.max(0,1-r),curl=.5+.5*Math.sin(theta*2+radius*13+n*7),density=Math.max(0,(n-.22)*1.65)*(.48+.72*curl),a=edge**1.15*density,i=(y*128+x)*4;
  im.data[i]=im.data[i+1]=im.data[i+2]=Math.round(Math.max(0,Math.min(1,n*.7+curl*.3))*255);im.data[i+3]=Math.round(Math.min(1,a)*255);
 }
 ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.LinearFilter;return t;
}
export class LayeredSmoke extends THREE.Mesh {
 constructor(capacity=128){
  const base=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=base.index;geometry.setAttribute('position',base.attributes.position);geometry.setAttribute('uv',base.attributes.uv);
  const buffers={center:new Float32Array(capacity*3),size:new Float32Array(capacity),opacity:new Float32Array(capacity),angle:new Float32Array(capacity),tone:new Float32Array(capacity)};
  for(const [name,data] of Object.entries(buffers))geometry.setAttribute('i'+name[0].toUpperCase()+name.slice(1),new THREE.InstancedBufferAttribute(data,name==='center'?3:1).setUsage(THREE.DynamicDrawUsage));geometry.instanceCount=capacity;
  const texture=smokeTexture(),material=new THREE.ShaderMaterial({uniforms:{smokeMap:{value:texture},smokeFlow:{value:0}},transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,vertexShader:`
   attribute vec3 iCenter;attribute float iSize;attribute float iOpacity;attribute float iAngle;attribute float iTone;
   varying vec2 vUv;varying float vOpacity;varying float vTone;
   void main(){vUv=uv;vOpacity=iOpacity;vTone=iTone;vec4 c=modelViewMatrix*vec4(iCenter,1.0);float cs=cos(iAngle),sn=sin(iAngle);vec2 shape=position.xy*vec2(.82+iTone*.26,1.06+(1.0-iTone)*.32);vec2 p=mat2(cs,-sn,sn,cs)*shape*iSize;c.xy+=p*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*c;}
  `,fragmentShader:`
   uniform sampler2D smokeMap;uniform float smokeFlow;varying vec2 vUv;varying float vOpacity;varying float vTone;
   void main(){
    vec2 q=vUv-.5;float r=length(q),turn=.12*sin(smokeFlow*5.0+vTone*6.0+r*7.0),cs=cos(turn),sn=sin(turn);vec2 uv=mat2(cs,-sn,sn,cs)*q+.5;
    uv+=vec2(sin(uv.y*9.0+smokeFlow*5.0+vTone*6.0),cos(uv.x*8.0-smokeFlow*4.0))*.028;
    vec4 cloud=texture2D(smokeMap,clamp(uv,0.0,1.0));float alpha=cloud.a*vOpacity;if(alpha<.004)discard;
    vec3 dark=vec3(.018,.016,.024),rim=vec3(.145,.137,.162);vec3 tint=mix(dark,rim,clamp(cloud.r*.78+vTone*.14,0.0,1.0));gl_FragColor=vec4(tint,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `});
  super(geometry,material);this.motion=new SmokeMotion(capacity);this.buffers=buffers;this.texture=texture;this.visible=false;this.frustumCulled=false;this.renderOrder=2;
 }
 update(u,mode,quality='auto'){
  this.material.uniforms.smokeFlow.value=Math.max(0,Math.min(1,u));const m=this.motion.update(u,mode,quality),b=this.buffers;this.geometry.instanceCount=m.active;
  // Economy uses a distributed subset instead of cutting off the upper body.
  for(let j=0;j<m.active;j++){const slot=m.active===m.capacity?j:Math.floor(j*m.capacity/m.active),p=m.puffs[m.order[slot]];b.center[j*3]=p.x;b.center[j*3+1]=p.y;b.center[j*3+2]=p.z;b.size[j]=p.diameter;b.opacity[j]=p.alpha;b.angle[j]=p.angle;b.tone[j]=p.tone;}
  for(const a of Object.values(this.geometry.attributes))if(a.isInstancedBufferAttribute)a.needsUpdate=true;
  return this;
 }
 snapshot(){return {...this.motion.snapshot(),drawCallsPerVisiblePass:1,triangles:this.geometry.instanceCount*2,textureSize:128,externalTextures:0,billboardApproximation:true,rollingDensity:true,textureSamplesPerFragment:1,anisotropicWisps:true,structuredVortices:true,textureBytes:65536};}
 dispose(){this.geometry.dispose();this.material.dispose();this.texture.dispose();}
}
