import {act, render} from '@testing-library/react-native';
import LocationScreen from '@/app/location';
import type {WatchLiveState} from '@/src/lib/galaxy-watch';
import type {WatchTrackPoint} from '@/src/hooks/useWatchTrack';

const mockInject = jest.fn();
let mockWebProps: {onMessage: (event: unknown) => void};
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockSession = {user: {id: 'caregiver'}};
const mockPatient = {elderly_id: 'patient'};
const mockZone = {name: 'Home', latitude: 10, longitude: 123, radius_m: 20, enabled: true};
const mockAt = Date.parse('2026-11-26T00:00:00Z');
let mockWatch: WatchLiveState;
let mockTrack: WatchTrackPoint[];

jest.mock('expo-router', () => ({Redirect: () => null, useRouter: () => ({back: jest.fn()})}));
jest.mock('@expo/vector-icons', () => ({Ionicons: () => null}));
jest.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})}));
jest.mock('@/src/providers/AuthProvider', () => ({useAuth: () => ({session: mockSession})}));
jest.mock('@/src/providers/HealthDataProvider', () => ({useHealthData: () => ({elderly: mockPatient, galaxyWatch: mockWatch, error: null, refresh: mockRefresh})}));
jest.mock('@/src/hooks/useWatchTrack', () => ({useWatchTrack: () => ({points: mockTrack, error: null})}));
jest.mock('@/src/hooks/useSafeZone', () => ({useSafeZone: () => ({zone: mockZone, refresh: mockRefresh})}));
jest.mock('@/src/components/SafeZonePanel', () => ({SafeZonePanel: () => null}));
jest.mock('@/src/providers/WalkthroughProvider', () => {
  const React = require('react');
  const {ScrollView} = require('react-native');
  return {WalkthroughScrollView: React.forwardRef((props: object, ref: unknown) => React.createElement(ScrollView, {...props, ref})), useWalkthroughAnchor: () => undefined};
});
jest.mock('react-native-webview', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {WebView: React.forwardRef((props: typeof mockWebProps, ref: unknown) => {
    mockWebProps = props;
    React.useImperativeHandle(ref, () => ({injectJavaScript: mockInject}));
    return React.createElement(View, {testID: 'live-location-webview'});
  })};
});

beforeEach(() => {
  mockInject.mockClear();
  mockWatch = {
    elderly_id: 'patient', device_id: 'watch', monitoring: true,
    heart_rate_bpm: null, heart_rate_measured_at: null, battery_percent: 90,
    latitude: 10, longitude: 123, accuracy_m: 120, location_source: 'network',
    gps_measured_at: new Date(mockAt).toISOString(),
    status_at: new Date(mockAt).toISOString(), received_at: new Date(mockAt).toISOString(),
  };
  mockTrack = [{id: 'initial', elderly_id: 'patient', device_id: 'watch', latitude: 10, longitude: 123, accuracy_m: 120, location_source: 'network', measured_at: mockWatch.gps_measured_at!}];
});

test('the location screen forwards moving snapshots and newer route fixes without pinning low-accuracy coordinates', async () => {
  const screen = await render(<LocationScreen />);
  await act(async () => mockWebProps.onMessage({nativeEvent: {data: JSON.stringify({type: 'ready'})}}));
  mockWatch = {...mockWatch, latitude: 10.0002, gps_measured_at: new Date(mockAt + 2000).toISOString()};
  await screen.rerender(<LocationScreen />);
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('"latitude":10.0002,'));
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('"accuracy_m":120,'));
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining(mockWatch.gps_measured_at!));

  const routeFix: WatchTrackPoint = {...mockTrack[0], id: 'newer', latitude: 10.0004, accuracy_m: 80, location_source: 'fused', measured_at: new Date(mockAt + 4000).toISOString()};
  mockTrack = [...mockTrack, routeFix];
  await screen.rerender(<LocationScreen />);
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('"latitude":10.0004,'));
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('"location_source":"fused"'));
  expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('"safeZone":{"name":"Home","latitude":10,"longitude":123,"radius_m":20,"enabled":true}'));
});
