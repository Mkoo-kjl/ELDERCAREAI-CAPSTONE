import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';

import {Linking} from 'react-native';

import {EmergencyContacts,orderedEmergencyContacts} from '@/src/components/EmergencyContacts';

const mockRefresh=jest.fn(),mockUpdate=jest.fn();

const patient={elderly_id:'patient',full_name:'Test patient',emergency_contacts:[{role:'doctor',name:'Dr C',relationship:'Physician',phone:'09170000003'},{role:'family',name:'Family B',relationship:'Brother',phone:'09170000002'},{role:'caregiver',name:'Caregiver A',relationship:'Caregiver',phone:'09170000001'}]};

jest.mock('@/src/providers/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'owner'}}})}));

jest.mock('@/src/providers/HealthDataProvider',()=>({useHealthData:()=>({elderly:patient,refresh:mockRefresh})}));

jest.mock('@/src/lib/supabase',()=>({supabase:{from:()=>{const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:null,error:null}),update:(payload:any)=>{mockUpdate(payload);return query;}};return query;}}}));

test('contact roles have a fixed caregiver → family → doctor order regardless of storage order',()=>expect(orderedEmergencyContacts(patient.emergency_contacts).map(x=>x.name)).toEqual(['Caregiver A','Family B','Dr C']));
