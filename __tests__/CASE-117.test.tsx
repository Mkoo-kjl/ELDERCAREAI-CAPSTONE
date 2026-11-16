import {Children,type ReactElement,type ReactNode} from 'react';
import {render,screen} from '@testing-library/react-native';
import {View} from 'react-native';
import TabLayout from '@/app/(tabs)/_layout';
type Icon=(props:{focused:boolean;color:string;size:number})=>ReactNode;
type Options={tabBarIcon:Icon;tabBarStyle:{height:number;paddingBottom:number}};
let mockTabsProps:{screenOptions:(props:{route:{name:string}})=>Options;children:ReactNode};
jest.mock('expo-router',()=>({Tabs:Object.assign((props:typeof mockTabsProps)=>{mockTabsProps=props;return null;},{Screen:()=>null}),Redirect:()=>null}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:24,bottom:32,left:0,right:0})}));
jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'owner'}},onboarding:{completed_at:'2026-11-15'},isLoading:false,isOnboardingLoading:false})}));

test('the two icon copies created by navigation register only the active tour anchor and retain system-bar space',async()=>{
  const layout=await render(<TabLayout/>),options=mockTabsProps.screenOptions({route:{name:'dashboard'}});
  expect(options.tabBarStyle.paddingBottom).toBeGreaterThanOrEqual(32);
  expect(options.tabBarStyle.height-options.tabBarStyle.paddingBottom).toBeGreaterThanOrEqual(72);
  const elle=(Children.toArray(mockTabsProps.children) as ReactElement<{name:string;options:{tabBarIcon:Icon}}>[]) .find(child=>child.props.name==='chatbot')!.props.options.tabBarIcon;
  await layout.unmount();
  for(const icon of [options.tabBarIcon,elle]){
    const icons=await render(<View>{icon({focused:true,color:'teal',size:25})}{icon({focused:false,color:'gray',size:25})}</View>);
    expect(screen.getAllByTestId(/^walkthrough-target:tab-/)).toHaveLength(1);
    await icons.unmount();
  }
});
