import {relativeWalkthroughRect,sameWalkthroughRect,spotlightMask} from '@/src/lib/walkthrough-layout';
import {coachmarkGeometry,spotlightGeometry} from '@/src/lib/walkthrough';

test('Android window insets are removed exactly once using the overlay origin',()=>{
  const overlay={x:0,y:24,width:320,height:668},icon={x:170,y:650,width:40,height:40};
  const rect=relativeWalkthroughRect(icon,overlay)!;
  expect(rect).toEqual({x:170,y:626,width:40,height:40});
  const spot=spotlightGeometry(rect,overlay.width,overlay.height,true);
  // A partially clipped ring must stay centered on the icon, not jump up to fit.
  expect(spot.x+spot.width/2).toBe(rect.x+rect.width/2);
  expect(spot.y+spot.height/2).toBe(rect.y+rect.height/2);
  expect(spot.y+spot.height).toBeGreaterThan(overlay.height);
});

test('first and last navigation arrows line up with the measured button center',()=>{
  for(const x of [6,274]){
    const spot=spotlightGeometry({x,y:602,width:40,height:40},320,640,true);
    const card=coachmarkGeometry(spot,320,640,176,24,24);
    expect(card.x+card.arrowX).toBe(spot.x+spot.width/2);
    expect(card.y+176).toBeLessThan(spot.y);
  }
});

test('native dimming rectangles leave the navigation icon clear and stay inside the overlay',()=>{
  const spot=spotlightGeometry({x:170,y:626,width:40,height:40},320,668,true),blocks=spotlightMask(spot,320,668);
  const covered=(x:number,y:number)=>blocks.some(block=>x>block.x&&x<block.x+block.width&&y>block.y&&y<block.y+block.height);
  expect(covered(190,646)).toBe(false);expect(covered(190,656)).toBe(false);
  expect(covered(10,100)).toBe(true);expect(covered(310,640)).toBe(true);
  for(const block of blocks){expect(block.x).toBeGreaterThanOrEqual(0);expect(block.y).toBeGreaterThanOrEqual(0);expect(block.x+block.width).toBeLessThanOrEqual(320);expect(block.y+block.height).toBeLessThanOrEqual(668);}
});

test('offscreen and invalid native measurements cannot make a false on-screen highlight',()=>{
  const overlay={x:0,y:24,width:320,height:668};
  expect(relativeWalkthroughRect({x:10,y:750,width:40,height:40},overlay)).toBeNull();
  expect(relativeWalkthroughRect({x:NaN,y:100,width:40,height:40},overlay)).toBeNull();
  expect(sameWalkthroughRect({x:1,y:2,width:40,height:40},{x:1.2,y:2.1,width:40,height:40})).toBe(true);
  expect(sameWalkthroughRect({x:1,y:2,width:40,height:40},{x:1,y:50,width:40,height:40})).toBe(false);
});
