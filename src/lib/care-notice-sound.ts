import {Vibration} from 'react-native';

type NoticePlayer={seekTo:(seconds:number)=>Promise<void>;play:()=>void;pause:()=>void};
let activeStop:(()=>void)|null=null;

export function stopCareNoticeSound(){
  activeStop?.();
  activeStop=null;
  Vibration.cancel();
}

/** A dismissed popup must not start playing when an earlier seek finishes. */
export function playCareNoticeSound(player:NoticePlayer){
  stopCareNoticeSound();
  let stopped=false;
  const stop=()=>{
    if(stopped)return;
    stopped=true;
    try{player.pause();}catch{/* The native player may already have been released. */}
    Vibration.cancel();
    if(activeStop===stop)activeStop=null;
  };
  activeStop=stop;
  void player.seekTo(0).then(()=>{if(!stopped)player.play();}).catch(()=>undefined);
  return stop;
}
