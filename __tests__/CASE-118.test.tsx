import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppWalkthrough} from '@/src/components/AppWalkthrough';
import {router} from 'expo-router';
let mockRect={x:170,y:640,width:40,height:40};
const mockMeasure=jest.fn(async()=>({...mockRect}));
const mockRegistry={measure:mockMeasure,setOverlay:jest.fn(),revision:0};
jest.mock('@/src/providers/WalkthroughProvider',()=>({useWalkthroughRegistry:()=>mockRegistry}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:24,bottom:24,left:0,right:0})}));
jest.mock('expo-router',()=>({router:{replace:jest.fn()},usePathname:()=>'/dashboard',useGlobalSearchParams:()=>({})}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'owner'}},onboarding:{completed_at:'2026-11-15'}})}));
jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:{elderly_id:'patient'}})}));
jest.mock('react-native-reanimated',()=>{
  const animation={easing:()=>animation,reduceMotion:()=>animation};
  return {__esModule:true,default:{View:require('react-native').View},FadeIn:{duration:()=>animation},Easing:{bezier:()=>undefined},ReduceMotion:{System:'system'}};
});
const centerY=()=>{const style=StyleSheet.flatten(screen.getByTestId('walkthrough-highlight').props.style);return style.top+style.height/2;};

test('tour follows a delayed native layout change and immediately discards the previous step highlight',async()=>{
  await AsyncStorage.clear();
  await render(<AppWalkthrough/>);
  await waitFor(()=>expect(centerY()).toBe(660));
  mockRect={...mockRect,y:680};
  await waitFor(()=>expect(centerY()).toBe(700));
  mockRect={x:20,y:100,width:280,height:70};
  await fireEvent.press(screen.getByText('Next →'));
  expect(screen.queryByTestId('walkthrough-highlight')).toBeNull();
  await waitFor(()=>expect(centerY()).toBe(135));
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Skip tour'));
  await waitFor(()=>expect(screen.queryByLabelText('New user walkthrough')).toBeNull());
});
