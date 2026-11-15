export class WorkerRunner {
 constructor(file){
  this.worker=new Worker(new URL(file,import.meta.url));this.next=0;this.jobs=new Map();this.closed=false;
  this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;this.timer=setTimeout(()=>reject(new Error('Carregamento do rastreamento excedeu 60 segundos')),60000)});this.ready.catch(()=>{});
  this.worker.onmessage=({data:d})=>{
   if(d.type==='ready'){clearTimeout(this.timer);this.resolveReady();return}
   if(d.type==='error'&&!d.id){clearTimeout(this.timer);this.rejectReady(new Error(d.message));return}
   const job=this.jobs.get(d.id);if(!job){d.bitmap?.close();return}this.jobs.delete(d.id);clearTimeout(job.timer);d.type==='error'?job.reject(new Error(d.message)):job.resolve(d);
  };
  this.worker.onerror=e=>{const error=new Error(e.message||'Falha no processamento');this.rejectReady(error);for(const j of this.jobs.values()){clearTimeout(j.timer);j.reject(error)}this.jobs.clear()};this.worker.postMessage({type:'init'});
 }
 async infer(source,timestamp){
  await this.ready;if(this.closed)throw new Error('Processamento encerrado');const bitmap=await createImageBitmap(source);if(this.closed){bitmap.close();throw new Error('Processamento encerrado')}
  const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.jobs.delete(id);reject(new Error('Tempo excedido ao processar quadro'))},8000);this.jobs.set(id,{resolve,reject,timer});this.worker.postMessage({type:'infer',id,timestamp,bitmap},[bitmap])});
 }
 close(){this.closed=true;clearTimeout(this.timer);this.rejectReady(new Error('Processamento encerrado'));for(const j of this.jobs.values()){clearTimeout(j.timer);j.reject(new Error('Processamento encerrado'))}this.jobs.clear();this.worker.terminate()}
}
