import { Alert, fireEvent, openDoctorForm, prepareDoctorCase, screen, waitFor } from '../test-support/doctor-contact-case-harness';

test('CASE-072 failed doctor save shows an error and keeps the form open', async () => {
  const { upsert } = prepareDoctorCase({ saveError: new Error('Database unavailable') });
  await openDoctorForm();
  await fireEvent.changeText(screen.getByLabelText('Doctor name'), 'Dr. Kevin Santos');
  await fireEvent.changeText(screen.getByLabelText('Phone number'), '+63 917 123 4567');
  await fireEvent.press(screen.getByText('Save doctor'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Unable to save doctor', 'Database unavailable'));
  expect(upsert).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Add doctor')).toBeTruthy();
});
