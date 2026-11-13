/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories load isolated modules before app imports. */
// Model native bridges in Jest; feature tests can override them.
jest.mock('react-native-webview',()=>{
  const React=require('react');
  const {View}=require('react-native');
  return {WebView:React.forwardRef(function MockWebView(props:Record<string,unknown>,ref:unknown){return React.createElement(View,{...props,ref});})};
});
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-task-manager',()=>({defineTask:jest.fn(),isTaskDefined:jest.fn(()=>false),isTaskRegisteredAsync:jest.fn(async()=>false),unregisterTaskAsync:jest.fn(async()=>{}),isAvailableAsync:jest.fn(async()=>false)}));
jest.mock('expo-background-task',()=>({BackgroundTaskStatus:{Available:2,Restricted:1},BackgroundTaskResult:{Success:1,Failed:2},registerTaskAsync:jest.fn(async()=>{}),unregisterTaskAsync:jest.fn(async()=>{}),getStatusAsync:jest.fn(async()=>1)}));
