import {handMessages as previousMessages} from './presentation-status-v030.js';
export {exitMessage} from './presentation-status-v030.js';
export function handMessages(state){
 if(state.ready&&state.armed&&!state.seen){const pct=Math.round(Math.max(0,Math.min(1,state.progress??0))*100);return {hint:'Punho '+pct+'%. Mantenha a mesma mão inteira no enquadramento.',short:'Punho: '+pct+'%. Reenquadre a mesma mão.'};}
 if(state.ready&&!state.seen){
  if(state.lighting?.highlightLimited)return {hint:'A mão está muito clara na análise. Afaste-a do reflexo direto e mostre os dedos.',short:'Detalhes da mão encobertos pelo brilho.'};
  if(state.lighting?.signalLimited)return {hint:'A mão está pouco definida. Traga-a um pouco mais perto da câmera e mostre-a inteira.',short:'Aproxime a mão para recuperar os detalhes.'};
  return {hint:'Mostre a mão inteira mais perto da câmera; depois feche o punho por cerca de um segundo.',short:'Procurando a mão. Aproxime-a da câmera.'};
 }
 return previousMessages(state);
}
