import * as THREE from 'three';
import {AtmosphereState} from './atmosphere-state-v018.js';
export class SceneAtmosphere {
 constructor({view,renderer,rim}){this.view=view;this.renderer=renderer;this.rim=rim;this.baseRim=rim.intensity;this.state=new AtmosphereState();this.lastAlpha='';}
 setPreset(preset){this.state.setPreset(preset);this.view.classList.toggle('kira-scene',this.state.preset==='kira');this.view.classList.toggle('kira-cinema',this.state.preset==='cinema');this.renderer.toneMapping=this.state.preset==='original'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;this.apply(this.state.snapshot())}
 apply(s){this.renderer.toneMappingExposure=s.exposure;this.rim.intensity=this.baseRim*s.rimMultiplier;const alpha=s.edgeAlpha.toFixed(3);if(alpha!==this.lastAlpha){this.view.style.setProperty('--edge-alpha',alpha);this.lastAlpha=alpha}}
 update(input){this.apply(this.state.update(input))}
 reset(){this.state.reset();this.apply(this.state.snapshot())}
 snapshot(){return this.state.snapshot()}
}
