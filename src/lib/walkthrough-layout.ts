import type {WalkthroughRect} from '@/src/providers/WalkthroughProvider';

/** Both readings must use the same window coordinate system, including Android insets. */
export function relativeWalkthroughRect(target:WalkthroughRect|null,overlay:WalkthroughRect|null):WalkthroughRect|null{
  if(!target||!overlay||![...Object.values(target),...Object.values(overlay)].every(Number.isFinite)||target.width<=0||target.height<=0||overlay.width<=0||overlay.height<=0)return null;
  const rect={...target,x:target.x-overlay.x,y:target.y-overlay.y};
  // Never move an offscreen control into view by clamping its highlight elsewhere.
  return rect.x+rect.width>0&&rect.y+rect.height>0&&rect.x<overlay.width&&rect.y<overlay.height?rect:null;
}
export function sameWalkthroughRect(left:WalkthroughRect|null,right:WalkthroughRect|null){
  return !!left&&!!right&&(['x','y','width','height'] as const).every(key=>Math.abs(left[key]-right[key])<=0.5);
}

/** Small native rectangles avoid Android's unreliable enormous rounded border mask. */
export function spotlightMask(spot:WalkthroughRect&{radius:number},width:number,height:number):WalkthroughRect[]{
  const {x,y,width:w,height:h}=spot,right=x+w,bottom=y+h;
  const blocks=[{x:0,y:0,width,height:y},{x:0,y:bottom,width,height:height-bottom},{x:0,y,width:x,height:h},{x:right,y,width:width-right,height:h}];
  return blocks.map(block=>{
    const left=Math.max(0,block.x),top=Math.max(0,block.y),right=Math.min(width,block.x+block.width),bottom=Math.min(height,block.y+block.height);
    return {x:left,y:top,width:right-left,height:bottom-top};
  }).filter(block=>block.width>0&&block.height>0);
}
/** Four small clipped rings provide anti-aliased corners without a screen-sized border. */
export function spotlightCorners(spot:WalkthroughRect&{radius:number}){
  const r=Math.min(spot.radius,spot.width/2,spot.height/2);
  return [{x:spot.x,y:spot.y,dx:-r,dy:-r},{x:spot.x+spot.width-r,y:spot.y,dx:-2*r,dy:-r},{x:spot.x,y:spot.y+spot.height-r,dx:-r,dy:-2*r},{x:spot.x+spot.width-r,y:spot.y+spot.height-r,dx:-2*r,dy:-2*r}].map(corner=>({...corner,r}));
}
