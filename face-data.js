export function faceSnapshot(points){
 if(!points?.length)return {faceSeen:false,nose:null,box:null,eyes:[]};
 const xy=p=>({x:p.x,y:p.y});
 const eye=(iris,contour)=>({iris:iris.map(i=>points[i]).filter(Boolean).map(xy),contour:contour.map(i=>points[i]).filter(Boolean).map(xy)});
 return {faceSeen:true,nose:xy(points[1]),box:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))},eyes:[eye([469,470,471,472],[33,160,158,133,153,144]),eye([474,475,476,477],[362,385,387,263,373,380])]};
}
