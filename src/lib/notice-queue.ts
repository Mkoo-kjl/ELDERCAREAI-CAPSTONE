/** A distinct event must not replace another event's foreground dialog. */
export class NoticeQueue<T extends {id:string}> {
  private waiting:T[]=[];private current:T|null=null;private stopped=false;private finishing=false;private timer:ReturnType<typeof setTimeout>|null=null;
  constructor(private present:(value:T,done:()=>void)=>void){}
  push(value:T){if(this.stopped||this.current?.id===value.id||this.waiting.some(x=>x.id===value.id))return;this.waiting.push(value);this.drain();}
  private drain(){if(this.stopped||this.current||this.finishing||!this.waiting.length)return;const item=this.waiting.shift()!;this.current=item;let finished=false;this.present(item,()=>{if(finished)return;finished=true;this.current=null;this.finishing=true;this.timer=setTimeout(()=>{this.finishing=false;this.drain();},250);});}
  stop(){if(this.timer)clearTimeout(this.timer);this.stopped=true;this.waiting=[];this.current=null;}
}
