const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
const angle=(a,b,c)=>{const u=[a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0)],v=[c.x-b.x,c.y-b.y,(c.z??0)-(b.z??0)],den=Math.hypot(...u)*Math.hypot(...v);return den>1e-9?Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0)/den)))*180/Math.PI:180;};
export function handShape(points){
 if(points?.length!==21||points.some(p=>![p.x,p.y,p.z??0].every(Number.isFinite)))return {valid:false,folded:0,open:0,closed:false};
 const palm=Math.max(dist(points[5],points[17]),dist(points[0],points[9]));if(palm<1e-5)return {valid:false,folded:0,open:0,closed:false};
 const fingers=[5,9,13,17].map(m=>{const bend=angle(points[m],points[m+1],points[m+2]),ratio=dist(points[m+3],points[0])/Math.max(1e-6,dist(points[m+1],points[0]));return {bend,ratio,folded:ratio<1.17&&(bend<155||dist(points[m+3],points[m])<palm*.72)||bend<120&&ratio<1.35,open:bend>155&&ratio>1.35};});
 const folded=fingers.filter(f=>f.folded).length,open=fingers.filter(f=>f.open).length,thumbDistance=dist(points[4],points[5])/palm,thumbFolded=thumbDistance<.55;
 return {valid:true,folded,open,thumbFolded,thumbDistance,closed:folded===4&&thumbFolded,fingers};
}
export function resolveGesture(raw,shape){
 const g=raw?{name:raw.categoryName??raw.name,score:raw.score}:null;
 if(shape?.valid&&shape.open>=3)return {name:'Open_Palm',score:.98,shape,source:'landmark-open'};
 if(g&&['Thumb_Up','Thumb_Down','Pointing_Up','Victory','ILoveYou'].includes(g.name)&&g.score>=.55)return {...g,shape,source:'classifier-negative'};
 if(shape?.closed&&(!g||g.name==='None'||g.name==='Closed_Fist'||g.name==='Open_Palm'&&g.score<.85))return {name:'Closed_Fist',score:Math.max(.78,g?.name==='Closed_Fist'?g.score:0),shape,source:'classifier-and-joints'};
 if(g?.name==='Open_Palm'&&g.score<.85)return null;
 return g?{...g,shape,source:'classifier'}:null;
}
export class HandAssociation {
 constructor(){this.reset();}
 reset(){this.anchor=null;this.lastSeen=-Infinity;}
 select(result,now,armed=false){
  const hands=result.hands?.length?result.hands:[{points:result.points??[],gesture:result.gesture,shape:result.shape,rawGesture:result.rawGesture}];
  const candidates=hands.filter(h=>h.points?.length>=15);let selected;
  if(armed&&this.anchor&&now-this.lastSeen<800){selected=candidates.map(h=>({h,d:Math.hypot(h.points[0].x-this.anchor.x,h.points[0].y-this.anchor.y)})).filter(x=>x.d<.23).sort((a,b)=>a.d-b.d)[0]?.h;if(!selected)return {...result,handSeen:false,gesture:null,points:[],association:'waiting-for-same-hand'};}
  else selected=candidates.sort((a,b)=>((b.gesture?.name==='Closed_Fist'?2:0)+(b.gesture?.score??0))-((a.gesture?.name==='Closed_Fist'?2:0)+(a.gesture?.score??0)))[0];
  if(!selected)return {...result,handSeen:false,gesture:null,points:[],association:'no-hand'};
  const wrist=selected.points[0];if(armed||selected.gesture?.name==='Closed_Fist'){this.anchor={x:wrist.x,y:wrist.y};this.lastSeen=now;}else this.anchor=null;
  return {...result,...selected,handSeen:true,gesture:selected.gesture?{...selected.gesture,center:{x:wrist.x,y:wrist.y}}:null,association:armed?'same-hand':'selected-hand'};
 }
}
