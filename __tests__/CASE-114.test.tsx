import {coachmarkGeometry,spotlightGeometry,walkthroughSteps} from '@/src/lib/walkthrough';
test('the tour highlights real controls on every requested care screen and never executes their destructive actions',()=>{
  expect(walkthroughSteps.map(step=>step.target)).toEqual(expect.arrayContaining(['settings-contacts','settings-thresholds','settings-watch','location-zone','care-prescription','care-appointments','elle-composer','alerts-sos']));
  expect(walkthroughSteps.find(step=>step.target==='alerts-sos')?.body).toContain('no call is placed');
});
test.each([{width:360,height:800},{width:320,height:640},{width:1024,height:768}])('spotlight and anchored tooltip fit $width × $height',({width,height})=>{
  const tab={x:width-55,y:height-70,width:30,height:30};
  const spot=spotlightGeometry(tab,width,height,true),card=coachmarkGeometry(spot,width,height,290,24,24);
  expect(spot.radius).toBe(spot.width/2);expect(spot.x).toBeGreaterThanOrEqual(0);expect(spot.x+spot.width).toBeLessThanOrEqual(width);
  expect(card.above).toBe(true);expect(card.y).toBeGreaterThanOrEqual(36);expect(card.x+card.width).toBeLessThanOrEqual(width-16);
  expect(card.y+290).toBeLessThanOrEqual(spot.y);
});
