/** History remains available in Alerts; signing in is not a new alert event. */
export function shouldPresentNotice(sentAt:string,sessionStartedAt:number,now=Date.now()){
  const at=Date.parse(sentAt);
  return Number.isFinite(at)&&at>=sessionStartedAt-1000&&at<=now+10000;
}
