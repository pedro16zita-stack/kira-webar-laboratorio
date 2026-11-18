export async function requestCamera({facing='environment',mediaDevices=globalThis.navigator?.mediaDevices,secureContext=globalThis.isSecureContext}={}){
 if(!secureContext)throw Object.assign(new Error('Camera requires secure context'),{name:'CameraSecurityError'});
 if(!mediaDevices?.getUserMedia)throw Object.assign(new Error('Camera API unavailable'),{name:'CameraUnsupportedError'});
 const constraints={audio:false,video:{facingMode:{ideal:facing},width:{ideal:640},height:{ideal:480}}};
 try{return {stream:await mediaDevices.getUserMedia(constraints),fallbackUsed:false}}
 catch(e){if(e.name!=='OverconstrainedError')throw e;return {stream:await mediaDevices.getUserMedia({audio:false,video:true}),fallbackUsed:true}}
}
export function cameraErrorInfo(error,stage='camera'){
 if(stage==='assets')return {code:'assets',title:'Não foi possível preparar a experiência',message:'Confira a conexão com a internet e recarregue a página. Nenhuma câmera foi mantida ligada.'};
 switch(error?.name){
  case 'NotFoundError':case 'DevicesNotFoundError':return {code:'not-found',title:'Nenhuma câmera foi encontrada',message:'Conecte uma webcam funcionando ou abra esta página no iPad ou celular. Neste computador, você pode usar a demonstração sem câmera.'};
  case 'NotAllowedError':case 'PermissionDeniedError':return {code:'permission',title:'O acesso à câmera não foi permitido',message:'Permita a câmera nas configurações deste site no navegador e tente novamente. Você também pode usar a demonstração sem câmera.'};
  case 'NotReadableError':case 'TrackStartError':return {code:'busy',title:'Não foi possível usar a câmera',message:'A câmera pode estar ocupada ou indisponível. Feche outros aplicativos ou abas que a utilizem, confira a conexão da webcam e tente novamente.'};
  case 'CameraSecurityError':case 'SecurityError':return {code:'security',title:'Abra a experiência pelo endereço seguro',message:'Use o link HTTPS do KIRA no Safari ou Chrome. A câmera precisa da permissão do navegador.'};
  case 'CameraUnsupportedError':return {code:'unsupported',title:'A câmera não está disponível neste navegador',message:'Abra o link no Safari do iPad ou no Chrome do celular. Neste aparelho, você pode usar a demonstração sem câmera.'};
  case 'OverconstrainedError':return {code:'constraints',title:'A câmera não aceitou a configuração',message:'Tente outra opção de câmera ou use o iPad ou celular. A demonstração continua disponível.'};
  default:return {code:'camera-failed',title:'Não foi possível iniciar a câmera',message:'Confira se a câmera está conectada e disponível neste navegador. Tente novamente ou use a demonstração sem câmera.'};
 }
}
