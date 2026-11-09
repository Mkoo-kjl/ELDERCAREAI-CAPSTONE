import {prepareCareWorkflow,pressText,showCare} from '../test-support/integration/care-workflow-harness';

test('schedule orders appointments by date and time and distinguishes completed activities',async()=>{
  const nextDay=Date.now()+86400000;
  prepareCareWorkflow({appointments:[
    {id:'later',elderly_id:'patient-1',caregiver_id:'caregiver-1',title:'Later visit',appointment_at:new Date(nextDay+3600000).toISOString(),status:'upcoming'},
    {id:'done',elderly_id:'patient-1',caregiver_id:'caregiver-1',title:'Completed visit',appointment_at:new Date(nextDay-86400000).toISOString(),status:'completed'},
    {id:'early',elderly_id:'patient-1',caregiver_id:'caregiver-1',title:'Earlier visit',appointment_at:new Date(nextDay).toISOString(),status:null},
  ]});
  const screen=await showCare();await pressText('Schedule');
  const titles=screen.getAllByText(/^(Earlier visit|Later visit|Completed visit)$/).map(node=>node.props.children);
  expect(titles).toEqual(['Earlier visit','Later visit','Completed visit']);
  expect(screen.getByText('Completed')).toBeTruthy();
});
