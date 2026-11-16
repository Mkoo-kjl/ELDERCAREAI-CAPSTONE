import type {WalkthroughRect} from '@/src/providers/WalkthroughProvider';
export const walkthroughSteps=[
  {title:'Your care starts here',body:'Follow Elle’s quick tour to find the care essentials on your Home screen.',route:'/dashboard',target:'tab-dashboard',circle:true},
  {title:'Your patient',body:'View the person you care for. Edit their details in Settings → Older adult information.',route:'/dashboard',target:'home-patient'},
  {title:'Vital readings',body:'Tap Heart rate for readings and history. Start monitoring on the watch for updates.',route:'/dashboard',target:'home-heart'},
  {title:'Save the people to call',body:'Add doctor, caregiver and family numbers. Choose who the main SOS button calls.',route:'/profile',target:'settings-contacts'},
  {title:'Health alert limits',body:'Set this patient’s alert thresholds using targets agreed with their clinician.',route:'/profile',target:'settings-thresholds'},
  {title:'Connect your watch',body:'Pair your watch here, allow permissions, then start monitoring on the watch.',route:'/profile',target:'settings-watch'},
  {title:'Set a safe zone',body:'Choose a place and radius, then save. Alerts need repeated, clear location fixes.',route:'/location',target:'location-zone'},
  {title:'Scan a prescription',body:'Upload one prescription to draft all readable medicines. Unclear fields stay blank.',route:'/care?tab=Medications',target:'care-prescription'},
  {title:'Add an appointment',body:'Tap + to add a visit. Search for a hospital, pick a map pin or enter the place.',route:'/care?tab=Appointments',target:'care-appointments',circle:true},
  {title:'Chat with Elle',body:'Type here to ask about recorded care. Elle supports you and does not replace a clinician.',route:'/chatbot',target:'elle-composer'},
  {title:'Your SOS contact',body:'SOS calls your main contact; smaller buttons call others. In this tour, no call is placed.',route:'/alerts',target:'alerts-sos'},
  {title:'Elle is always here',body:'Open this tab to chat. Replay the tour any time from Settings.',route:'/chatbot',target:'tab-chatbot',circle:true},
] as const;
export function spotlightGeometry(rect:WalkthroughRect,width:number,height:number,circle=false){
  const pad=circle?10:6,w=circle?Math.max(rect.width,rect.height)+pad*2:rect.width+pad*2,h=circle?w:rect.height+pad*2;
  // Preserve the control's center, even beside a system inset or clipped edge.
  // The overlay clips overflow; shifting the hole would point to the wrong UI.
  const x=rect.x+rect.width/2-w/2,y=rect.y+rect.height/2-h/2;
  return {x,y,width:w,height:h,radius:circle?w/2:18};
}
export function coachmarkGeometry(spot:WalkthroughRect|null,width:number,height:number,cardHeight:number,topInset=0,bottomInset=0){
  const cardWidth=Math.min(260,width*0.74,width-32),safeTop=topInset+12,safeBottom=height-bottomInset-12;
  const above=!!spot&&(spot.y-safeTop>=cardHeight+20||safeBottom-(spot.y+spot.height)<cardHeight+20);
  const top=spot?(above?spot.y-cardHeight-20:spot.y+spot.height+20):safeTop+30;
  const x=Math.max(16,Math.min(width-cardWidth-16,(spot?spot.x+spot.width/2:width/2)-cardWidth/2));
  return {x,y:Math.max(safeTop,Math.min(safeBottom-cardHeight,top)),width:cardWidth,above,arrowX:spot?Math.max(8,Math.min(cardWidth-8,spot.x+spot.width/2-x)):cardWidth/2};
}
