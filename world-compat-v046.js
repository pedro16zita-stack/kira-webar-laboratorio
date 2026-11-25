export async function probeWorld({xr,secure=true,userAgent='',apple=false}={}){
 const result={secure,android:/Android/i.test(userAgent),apple,xrAPI:!!xr,immersiveAR:false,reason:'api-missing',error:null};
 if(!secure){result.reason='insecure';return result;}if(!xr)return result;
 try{result.immersiveAR=!!await xr.isSessionSupported('immersive-ar');result.reason=result.immersiveAR?'supported':'not-supported';}catch(e){result.reason='probe-failed';result.error={name:e.name??'Error',message:e.message};}return result;
}
export function nativeAndroidURL(base){
 const origin=new URL(base),file=new URL('./ryuk-scene-v046.glb',origin),fallback=new URL('./ambiente-v046.html?native=unavailable',origin);
 if(file.protocol!=='https:'||fallback.protocol!=='https:')throw Error('AR nativo exige HTTPS.');
 const query=new URLSearchParams({file:file.href,mode:'ar_only',resizable:'false',title:'KIRA · Death Note',enable_vertical_placement:'false'});
 return 'intent://arvr.google.com/scene-viewer/1.0?'+query+'#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url='+encodeURIComponent(fallback.href)+';end;';
}
