import {act,render} from '@testing-library/react-native';
import {CareNotificationObserver} from '@/src/components/CareNotificationObserver';
import * as Notifications from 'expo-notifications';
const mockPush=jest.fn(),mockRemove=jest.fn();let mockAuth:any,mockReceived:any;
jest.mock('expo-router',()=>({router:{push:(...args:any[])=>mockPush(...args)}}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>mockAuth}));
jest.mock('@/src/lib/notifications',()=>({initializeNotifications:jest.fn().mockResolvedValue(undefined)}));
jest.mock('expo-notifications',()=>({getLastNotificationResponse:jest.fn(),clearLastNotificationResponse:jest.fn(),addNotificationResponseReceivedListener:(callback:any)=>{mockReceived=callback;return{remove:mockRemove};}}));
const notification=(url:string)=>({request:{content:{data:{url}}}});
beforeEach(()=>{mockAuth={session:null,isLoading:true};(Notifications.getLastNotificationResponse as jest.Mock).mockReturnValue({notification:notification('/location')});});
test('a closed-app notification tap waits for session restoration before opening the map',async()=>{
  const view=await render(<CareNotificationObserver/>);expect(mockPush).not.toHaveBeenCalled();expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
  mockAuth={session:{user:{id:'caregiver'}},isLoading:false};await view.rerender(<CareNotificationObserver/>);
  expect(mockPush).toHaveBeenCalledWith('/location');expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  await view.unmount();expect(mockRemove).toHaveBeenCalledTimes(1);
});
test('a tap is retained while signed out and reminder taps use the correct care page after login',async()=>{
  mockAuth={session:null,isLoading:false};const view=await render(<CareNotificationObserver/>);expect(mockPush).not.toHaveBeenCalled();
  (Notifications.getLastNotificationResponse as jest.Mock).mockReturnValue(null);mockAuth={session:{user:{id:'caregiver'}},isLoading:false};await view.rerender(<CareNotificationObserver/>);
  await act(async()=>mockReceived({notification:notification('/care?tab=Medications')}));expect(mockPush).toHaveBeenCalledWith('/care?tab=Medications');
  await act(async()=>mockReceived({notification:notification('https://untrusted.invalid')}));expect(mockPush).toHaveBeenCalledTimes(1);
});
