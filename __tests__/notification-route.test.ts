import {careNotificationRoute} from '@/src/lib/notification-route';
test('safe-zone notifications open the map and other care links retain their destination',()=>{
  expect(careNotificationRoute({url:'/location'})).toBe('/location');
  expect(careNotificationRoute({url:'/care?tab=Medications'})).toBe('/care?tab=Medications');
  expect(careNotificationRoute({url:'/alerts?tab=Emergency'})).toBe('/alerts?tab=Emergency');
});
test.each(['https://example.com','/careless','/care/../login','/location?redirect=https://example.com','/alert-response?id=invalid'])('does not navigate to an unsupported push URL: %s',url=>{
  expect(careNotificationRoute({url})).toBeNull();
});
