// Model the native storage bridge in Jest; feature tests can override it.
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-task-manager',()=>({defineTask:jest.fn(),isTaskDefined:jest.fn(()=>false),isTaskRegisteredAsync:jest.fn(async()=>false),unregisterTaskAsync:jest.fn(async()=>{}),isAvailableAsync:jest.fn(async()=>false)}));
jest.mock('expo-background-task',()=>({BackgroundTaskStatus:{Available:2,Restricted:1},BackgroundTaskResult:{Success:1,Failed:2},registerTaskAsync:jest.fn(async()=>{}),unregisterTaskAsync:jest.fn(async()=>{}),getStatusAsync:jest.fn(async()=>1)}));
