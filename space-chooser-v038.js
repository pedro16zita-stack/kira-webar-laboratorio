const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function spaceOptions(body,refs,scale,viewWidth,gapFactor){
 const xs=[11,12,23,24].map(i=>body.points?.[i]).filter(p=>p&&p.visibility>=.4&&(p.presence??1)>=.5&&p.x>=0&&p.x<=1).map(p=>(p.x-.5)*viewWidth);
 const actor=(body.center.x-.5)*viewWidth,halfActor=body.shoulderWidth*viewWidth/2;
 const left=xs.length?Math.min(...xs):actor-halfActor,right=xs.length?Math.max(...xs):actor+halfActor;
 const halfRyuk=refs.shoulderWidth*scale*.55,gap=refs.shoulderWidth*scale*gapFactor,headMargin=(refs.headWidth??refs.shoulderWidth*.8)*scale*.5+viewWidth*.012,limit=Math.max(viewWidth*.08,viewWidth/2-headMargin);
 return [-1,1].map(direction=>{const desired=(direction<0?left:right)+direction*(halfRyuk+gap),x=clamp(desired,-limit,limit),overlap=Math.max(0,Math.min(right,x+halfRyuk)-Math.max(left,x-halfRyuk)),free=direction<0?left+viewWidth/2:viewWidth/2-right,room=Math.max(0,(limit-direction*x)/scale);const actualGap=direction<0?left-(x+halfRyuk):(x-halfRyuk)-right,minClearance=refs.shoulderWidth*.16,inwardRange=Math.max(0,actualGap/scale-minClearance);return {direction,actualGap:actualGap/viewWidth,score:(overlap*5+Math.abs(desired-x)*.2-free*.25)/viewWidth,free:free/viewWidth,overlap:overlap/viewWidth,composition:{x,walkRange:Math.min(.65,room),floatRange:Math.min(.10,room),gapModelUnits:refs.shoulderWidth*gapFactor,inwardRange,minClearanceModelUnits:minClearance,limited:Math.abs(x-desired)>.001}};});
}
export class SpaceChooser {
 constructor(){this.reset();}
 reset(){this.direction=null;this.pending=null;this.since=0;this.mode=null;this.last=null;}
 update(body,refs,scale,viewWidth,gapFactor,now,mode='auto',front=false){
  const options=spaceOptions(body,refs,scale,viewWidth,gapFactor),best=[...options].sort((a,b)=>a.score-b.score)[0];
  if(mode!=='auto'){this.direction=((mode==='right')!==front)?1:-1;this.pending=null;}
  else{if(this.mode!=='auto'||this.direction===null)this.direction=best.direction;const current=options.find(x=>x.direction===this.direction);if(best.direction!==this.direction&&best.score<current.score-.018){if(this.pending!==best.direction){this.pending=best.direction;this.since=now;}if(now-this.since>=450){this.direction=best.direction;this.pending=null;}}else this.pending=null;}
  this.mode=mode;const chosen=options.find(x=>x.direction===this.direction);this.last={direction:this.direction,displaySide:(front?-this.direction:this.direction)>0?'right':'left',mode,pending:this.pending,options:options.map(({composition,...x})=>({...x,x:composition.x})),scaleChanged:false};return chosen;
 }
 snapshot(){return this.last;}
}

export function safeFloatOffset(value,direction,inwardRange){if(!Number.isFinite(inwardRange)||direction*value>=0)return value;const limit=Math.max(0,inwardRange);return limit>1e-5?-direction*limit*Math.tanh(Math.abs(value)/limit):0;}
