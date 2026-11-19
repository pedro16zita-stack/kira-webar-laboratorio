export function handMessages({ready,initialization,seen,armed,progress}){
 const pct=Math.round(Math.max(0,Math.min(1,progress??0))*100);
 if(!ready)return {hint:initialization==='failed'?'O gesto não carregou. Use Encerrar aparição.':'Preparando o gesto. Você também pode usar o botão de saída.',short:'Preparando saída por mão…'};
 if(!seen)return {hint:'Mostre a mão inteira, com boa luz, e feche o punho.',short:'Enquadre a mão inteira para a saída.'};
 if(armed)return {hint:'Punho '+pct+'%. Segure até completar.',short:'Punho: '+pct+'%. Segure.'};
 return {hint:'Mão encontrada. Feche o punho e mantenha-o visível.',short:'Mão detectada. Feche o punho para sair.'};
}
export function exitMessage(trigger,complete=false){
 if(trigger==='gesture')return complete?'Saída pelo punho concluída. Toque em reiniciar para repetir.':'Punho confirmado. Ryuk está se dissipando.';
 if(trigger==='button')return complete?'Aparição encerrada pelo botão. Toque em reiniciar para repetir.':'Saída pelo botão acionada. Ryuk está se dissipando.';
 return complete?'Saída concluída. Toque em reiniciar para repetir.':'Saída por fumaça acionada.';
}
