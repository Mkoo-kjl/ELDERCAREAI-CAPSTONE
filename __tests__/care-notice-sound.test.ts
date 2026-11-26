import {Vibration} from 'react-native';
import {playCareNoticeSound,stopCareNoticeSound} from '@/src/lib/care-notice-sound';

afterEach(()=>stopCareNoticeSound());

test('dismiss during seek prevents delayed audio from starting',async()=>{
  let finishSeek!:()=>void;
  const player={seekTo:jest.fn(()=>new Promise<void>(resolve=>{finishSeek=resolve;})),play:jest.fn(),pause:jest.fn()};
  const stop=playCareNoticeSound(player);
  stop();finishSeek();await Promise.resolve();
  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(player.play).not.toHaveBeenCalled();
});

test('opening a notification stops the current player and vibration',async()=>{
  const cancel=jest.spyOn(Vibration,'cancel');
  const player={seekTo:jest.fn().mockResolvedValue(undefined),play:jest.fn(),pause:jest.fn()};
  playCareNoticeSound(player);await Promise.resolve();
  expect(player.play).toHaveBeenCalledTimes(1);
  stopCareNoticeSound();
  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalled();
  cancel.mockRestore();
});

test('a late callback for an old popup cannot pause the next reminder sound',async()=>{
  const first={seekTo:jest.fn().mockResolvedValue(undefined),play:jest.fn(),pause:jest.fn()};
  const second={seekTo:jest.fn().mockResolvedValue(undefined),play:jest.fn(),pause:jest.fn()};
  const stopFirst=playCareNoticeSound(first);await Promise.resolve();
  playCareNoticeSound(second);await Promise.resolve();
  stopFirst();
  expect(first.pause).toHaveBeenCalledTimes(1);
  expect(second.pause).not.toHaveBeenCalled();
  expect(second.play).toHaveBeenCalledTimes(1);
});
