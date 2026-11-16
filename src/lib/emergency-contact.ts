export type EmergencyRole='caregiver'|'family'|'doctor';
export type EmergencyContact={role:EmergencyRole;name:string;relationship:string;phone:string};
export const emergencyRoles=[['caregiver','Caregiver'],['family','Family member'],['doctor','Doctor']] as const;
export function orderedEmergencyContacts(value:unknown):EmergencyContact[]{
  const rows=Array.isArray(value)?value:[];
  return emergencyRoles.map(([role,label])=>{const row=rows.find(row=>row&&row.role===role);return {role,name:typeof row?.name==='string'?row.name:'',relationship:typeof row?.relationship==='string'?row.relationship:label,phone:typeof row?.phone==='string'?row.phone:''};});
}
export function emergencyDialUrl(phone:string){
  const digits=phone.replace(/\D/g,'');
  if(!/^\+?[\d ()-]{7,25}$/.test(phone)||digits.length<7)return null;
  return `tel:${phone.trim().startsWith('+')?'+':''}${digits}`;
}
