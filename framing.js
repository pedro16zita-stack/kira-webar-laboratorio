const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
// Relative framing, not an estimate in metres. A larger detected face means closer.
export function personFraming(box,proportion=1,referenceHeight=.09){
 if(!box||![box.top,box.bottom].every(Number.isFinite)||box.bottom<=box.top)return null;
 const height=box.bottom-box.top;
 if(!Number.isFinite(referenceHeight)||referenceHeight<=0)return null;
 return {faceHeight:height,scale:clamp(height/referenceHeight*proportion,.3,4.5),headY:clamp((box.top+box.bottom)/2-height*.08,-.1,1.1)};
}
export function rootYForHead(headY,scale,localHeadY,cameraY,viewHeight){
 return cameraY+(.5-headY)*viewHeight-localHeadY*scale;
}
