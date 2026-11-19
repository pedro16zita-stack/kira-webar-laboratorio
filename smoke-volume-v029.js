import * as THREE from 'three';
import {SmokeMotion} from './smoke-motion-v029.js';
const lattice=Float64Array.from({length:64*64},(_,i)=>{const v=Math.sin((i%64)*127.1+Math.floor(i/64)*311.7)*43758.5453;return v-Math.floor(v);});
const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),a=iy*64+ix;return (lattice[a]*(1-sx)+lattice[a+1]*sx)*(1-sy)+(lattice[a+64]*(1-sx)+lattice[a+65]*sx)*sy;};
function smokeTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),im=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const dx=(x-63.5)/64,dy=(y-63.5)/64,n=.57*noise(x*.065+3,y*.065+9)+.29*noise(x*.14+21,y*.14+4)+.14*noise(x*.29+7,y*.29+15),warp=.12*Math.sin(dy*6)+.1*(n-.5),r=Math.hypot(dx+warp,dy+.08*Math.sin(dx*7)),edge=Math.max(0,1-r),density=Math.max(0,(n-.22)*1.65),a=edge**1.3*density,i=(y*128+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=Math.round(n*255);im.data[i+3]=Math.round(Math.min(1,a)*255);}
 ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.LinearFilter;return t;
}
export class LayeredSmoke extends THREE.Mesh {
 constructor(capacity=128){
  const base=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=base.index;geometry.setAttribute('position',base.attributes.position);geometry.setAttribute('uv',base.attributes.uv);
  const buffers={center:new Float32Array(capacity*3),size:new Float32Array(capacity),opacity:new Float32Array(capacity),angle:new Float32Array(capacity),tone:new Float32Array(capacity)};
  for(const [name,data] of Object.entries(buffers))geometry.setAttribute('i'+name[0].toUpperCase()+name.slice(1),new THREE.InstancedBufferAttribute(data,name==='center'?3:1).setUsage(THREE.DynamicDrawUsage));geometry.instanceCount=capacity;
  const texture=smokeTexture(),material=new THREE.ShaderMaterial({uniforms:{smokeMap:{value:texture}},transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,vertexShader:`
   attribute vec3 iCenter;attribute float iSize;attribute float iOpacity;attribute float iAngle;attribute float iTone;
   varying vec2 vUv;varying float vOpacity;varying float vTone;
   void main(){vUv=uv;vOpacity=iOpacity;vTone=iTone;vec4 c=modelViewMatrix*vec4(iCenter,1.0);float cs=cos(iAngle),sn=sin(iAngle);vec2 p=mat2(cs,-sn,sn,cs)*position.xy*iSize;c.xy+=p*length(modelViewMatrix[0].xyz);gl_Position=projectionMatrix*c;}
  `,fragmentShader:`
   uniform sampler2D smokeMap;varying vec2 vUv;varying float vOpacity;varying float vTone;
   void main(){vec4 cloud=texture2D(smokeMap,vUv);float alpha=cloud.a*vOpacity;if(alpha<0.004)discard;vec3 dark=vec3(0.025,0.021,0.032),rim=vec3(0.115,0.103,0.135);vec3 tint=mix(dark,rim,cloud.r*0.65+vTone*0.14);gl_FragColor=vec4(tint,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `});
  super(geometry,material);this.motion=new SmokeMotion(capacity);this.buffers=buffers;this.texture=texture;this.visible=false;this.frustumCulled=false;this.renderOrder=2;
 }
 update(u,mode,quality='auto'){
  const m=this.motion.update(u,mode,quality),b=this.buffers;this.geometry.instanceCount=m.active;
  // Economy uses a distributed subset instead of cutting off the upper body.
  for(let j=0;j<m.active;j++){const slot=m.active===m.capacity?j:Math.floor(j*m.capacity/m.active),p=m.puffs[m.order[slot]];b.center[j*3]=p.x;b.center[j*3+1]=p.y;b.center[j*3+2]=p.z;b.size[j]=p.diameter;b.opacity[j]=p.alpha;b.angle[j]=p.angle;b.tone[j]=p.tone;}
  for(const a of Object.values(this.geometry.attributes))if(a.isInstancedBufferAttribute)a.needsUpdate=true;
  return this;
 }
 snapshot(){return {...this.motion.snapshot(),drawCallsPerVisiblePass:1,triangles:this.geometry.instanceCount*2,textureSize:128,externalTextures:0,billboardApproximation:true};}
 dispose(){this.geometry.dispose();this.material.dispose();this.texture.dispose();}
}
