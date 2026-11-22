export function flowState({live,phase,personVisible=false,mustClear=false,idle=false}){
 if(!live)return {key:'off',hidden:true,index:-1,title:'',detail:'',replay:false};
 if(phase==='complete')return {key:'complete',hidden:false,index:2,title:'A aparição terminou',detail:'Recomece pelo caderno quando estiver pronto.',replay:true};
 if(phase==='exiting')return {key:'exiting',hidden:false,index:2,title:'Ryuk está desaparecendo',detail:'Aguarde a fumaça se dissipar.',replay:false};
 if(phase==='active'&&idle&&!personVisible)return {key:'idle',hidden:false,index:2,title:'Ryuk está em repouso',detail:'Reenquadre uma pessoa para retomar. Para encerrar, use o punho ou o botão.',replay:false};
 if(phase==='active'&&personVisible)return {key:'active',hidden:false,index:2,title:'Ryuk está presente',detail:'Para encerrar, feche o punho e mantenha a mão visível.',replay:false};
 if(phase==='active')return {key:'paused',hidden:false,index:1,title:'Reenquadre a pessoa',detail:'Mantenha a pessoa na imagem para retomar a aparição.',replay:false};
 if(phase==='body')return {key:'body',hidden:false,index:1,title:'Agora, enquadre a pessoa',detail:'Afaste a câmera para mostrar o corpo quando possível.',replay:false};
 if(phase==='target')return {key:mustClear?'target-clear':'target',hidden:false,index:0,title:'Apresente a capa do caderno',detail:mustClear?'Retire o caderno da imagem e apresente a capa novamente.':'Mostre a capa inteira, com boa luz e sem reflexos.',replay:false};
 return {key:'preparing',hidden:true,index:-1,title:'',detail:'',replay:false};
}
export class PresentationFlow {
 constructor({guide,title,detail,steps,panel,button,onReplay}){Object.assign(this,{guide,title,detail,steps,panel,button});this.key=null;this.writes=0;button.addEventListener('click',onReplay);this.hide();}
 update(input){const s=flowState(input);if(s.key===this.key)return s;this.key=s.key;this.writes++;this.guide.hidden=s.hidden;this.panel.hidden=!s.replay;this.title.textContent=s.title;this.detail.textContent=s.detail;this.guide.dataset.stage=s.key;this.steps.forEach((el,i)=>{el.dataset.state=i<s.index?'done':i===s.index?'current':'waiting';if(i===s.index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});return s;}
 hide(){this.update({live:false});}
 snapshot(){return {stage:this.key,hidden:this.guide.hidden,replayVisible:!this.panel.hidden,title:this.title.textContent,detail:this.detail.textContent,writes:this.writes,steps:this.steps.map(el=>({state:el.dataset.state,current:el.getAttribute('aria-current')}))};}
}
