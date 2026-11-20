import {handShape,HandAssociation} from './hand-evidence-v027.js';
export {handShape,HandAssociation};
import {resolveGesture as previousResolve} from './hand-evidence-v027.js';
export function resolveGesture(raw,shape){
 const name=raw?.categoryName??raw?.name;
 // Keep explicit negative gestures and anatomically open fingers authoritative.
 if(shape?.valid&&shape.open<2&&shape.folded>=3&&name==='Open_Palm'){
  // A high classifier score cannot turn four folded fingers into an open palm.
  // Ambiguity pauses evidence; it does not create a positive fist observation.
  if(shape.closed)return {name:'Closed_Fist',score:.8,shape,source:'four-folded-thumb-confirmed'};
  return null;
 }

 return previousResolve(raw,shape);
}
