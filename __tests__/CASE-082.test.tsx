import {emergencyRoles,emergencyDialUrl} from '@/src/lib/emergency-contact';
test('dedicated contacts expose caregiver, family and doctor roles and valid direct-call links',()=>{
  expect(emergencyRoles.map(([,label])=>label)).toEqual(['Caregiver','Family member','Doctor']);
  expect(emergencyDialUrl('+63 (917) 000-0001')).toBe('tel:+639170000001');
  expect(emergencyDialUrl('')).toBeNull();expect(emergencyDialUrl('0917#123*4567')).toBeNull();
});
