import {LiveBudget as PreviousBudget} from './live-budget-v026.js';
export {renderProfile,videoFrameStamp} from './live-budget-v026.js';
export class LiveBudget extends PreviousBudget {
 choose(now,s){
  if(this.active||s.bodyBusy||s.handBusy)return null;
  const b=s.bodyAllowed&&s.bodyReady&&s.videoTime!==this.frames.body,h=s.handAllowed&&s.handReady&&s.videoTime!==this.frames.hand;
  const bodyAge=now-this.last.body,handAge=now-this.last.hand;
  const bodyDue=b&&bodyAge>=140,handDue=h&&handAge>=(s.handFocused?90:140);
  // Do not interrupt inference, duplicate decoded frames or starve body presence.
  if(bodyDue&&(!handDue||bodyAge>=280&&this.last.body<=this.last.hand))return 'body';
  if(handDue)return 'hand';return bodyDue?'body':null;
 }
 snapshot(){return {...super.snapshot(),focusedHandIntervalMs:90,searchHandIntervalMs:140,bodyPriorityDeadlineMs:280,gestureConfirmationMs:900};}
}
