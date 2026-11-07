import { fireEvent, openDoctorForm, prepareDoctorCase, screen, waitFor } from '../test-support/doctor-contact-case-harness';

test('CASE-073 existing doctor is updated within the caregiver and patient scope', async () => {
  const { update, upsert, saveQuery } = prepareDoctorCase({ saved: true });
  await openDoctorForm(true);
  expect(screen.getByDisplayValue('Dr. Kevin')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Doctor name'), 'Dr. Kevin Santos');
  await fireEvent.press(screen.getByText('Save doctor'));
  await waitFor(() => expect(screen.getByText('Dr. Kevin Santos')).toBeTruthy());
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ caregiver_id: 'caregiver-1', elderly_id: 'patient-1', full_name: 'Dr. Kevin Santos' }));
  expect(saveQuery.eq).toHaveBeenNthCalledWith(1, 'id', 'doctor-1');
  expect(saveQuery.eq).toHaveBeenNthCalledWith(2, 'caregiver_id', 'caregiver-1');
  expect(upsert).not.toHaveBeenCalled();
});
