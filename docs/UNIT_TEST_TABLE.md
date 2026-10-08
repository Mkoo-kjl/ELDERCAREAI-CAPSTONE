# Unit Testing

This table records the 63 Jest and React Native Testing Library cases in app-use order. Proponent and Date Tested are intentionally blank for the final report. "Passed" records the automated Jest run; mocked services are not live integration tests.

| Proponent | Module Name | Unit Name | Date Tested | Test Case ID | Test Case Description | Expected Result | Actual Result | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Authentication Module | Google Sign-In |  | CASE-001 | Open the login screen. | Google sign-in button is visible. | Performed as expected | Passed |
|  | Authentication Module | Google Sign-In |  | CASE-002 | Tap Google sign-in and return a successful mocked result. | Sign-in starts and the app redirects to the route resolver. | Performed as expected | Passed |
|  | Authentication Module | Google Sign-In |  | CASE-003 | Return a failed mocked sign-in result. | Error appears and the login screen remains open. | Performed as expected | Passed |
|  | Authentication Module | Session Routing |  | CASE-004 | Open login with an existing caregiver session. | App redirects to the introduction screen. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing |  | CASE-005 | Open the app as a new caregiver. | Introduction screen opens first. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing |  | CASE-006 | Leave caregiver information incomplete. | Caregiver setup remains the next step. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing |  | CASE-007 | Leave older-adult information incomplete. | Older-adult setup remains the next step. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing |  | CASE-008 | Leave wearable setup incomplete. | Wearable setup remains the next step. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing |  | CASE-009 | Leave location consent incomplete. | Home access is deferred until location setup. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing |  | CASE-010 | Complete every onboarding step. | Home screen becomes the next route. | Performed as expected | Passed |
|  | Form Components Module | Form Field |  | CASE-011 | Render a field with validation feedback. | Error appears beside the related input. | Performed as expected | Passed |
|  | Form Components Module | Form Field |  | CASE-012 | Render the authenticated email field. | Email value cannot be edited. | Performed as expected | Passed |
|  | Form Components Module | Choice Field |  | CASE-013 | Select an available choice. | Component reports the selected option. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup |  | CASE-014 | Submit missing required caregiver details. | Field errors appear and no profile is saved. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup |  | CASE-015 | Enter an invalid caregiver phone number. | Profile save is blocked. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup |  | CASE-016 | Enter a caregiver age below the allowed minimum. | Form rejects the age and does not save. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup |  | CASE-017 | Submit valid caregiver details. | Profile saves and older-adult setup opens. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup |  | CASE-018 | Return a mocked database error during caregiver save. | Error appears and setup does not advance. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup |  | CASE-019 | Submit missing required older-adult details. | Required-field guidance appears. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup |  | CASE-020 | Enter implausible weight and height. | Profile save is blocked. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup |  | CASE-021 | Select a birth date from the calendar. | The selected date is saved and determines the older adult's age. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup |  | CASE-022 | Enter an invalid emergency phone number. | Profile save is blocked. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup |  | CASE-023 | Submit valid older-adult details. | Profile saves and wearable setup opens. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup |  | CASE-024 | Return a mocked database error during older-adult save. | Error appears and setup does not advance. | Performed as expected | Passed |
|  | Vitals Module | Vital Card |  | CASE-025 | Render a patient vital card. | Patient reading and timestamp are shown. | Performed as expected | Passed |
|  | Vitals Module | Vital Card |  | CASE-026 | Tap the patient vital card. | Reading detail action is called. | Performed as expected | Passed |
|  | Vitals Module | Vital Card |  | CASE-027 | Render a full-width vital card. | Card uses the readable row layout. | Performed as expected | Passed |
|  | Health Insights Module | Insight Generation |  | CASE-028 | Calculate insight with no reading history. | Waiting insight is returned. | Performed as expected | Passed |
|  | Health Insights Module | Insight Generation |  | CASE-029 | Analyze a low oxygen reading. | Critical oxygen insight is returned. | Performed as expected | Passed |
|  | Health Insights Module | Insight Generation |  | CASE-030 | Analyze short sleep duration. | Sleep warning insight is returned. | Performed as expected | Passed |
|  | Health Insights Module | Trend Analysis |  | CASE-031 | Request a trend with fewer than four distinct readings. | Prediction waits for more data. | Performed as expected | Passed |
|  | Health Insights Module | Trend Analysis |  | CASE-032 | Analyze four distinct readings. | Labeled statistical trend is returned. | Performed as expected | Passed |
|  | Health Insights Module | Anomaly Detection |  | CASE-033 | Analyze abnormal heart rate and oxygen together. | Both measurements are flagged. | Performed as expected | Passed |
|  | Health Insights Module | Anomaly Detection |  | CASE-034 | Analyze a normal latest reading. | No anomaly is claimed. | Performed as expected | Passed |
|  | Health Insights Module | HRV Insight |  | CASE-035 | Calculate an HRV insight. | Raw RMSSD is reported in milliseconds. | Performed as expected | Passed |
|  | Elle Assistant Module | Chat Screen |  | CASE-036 | Open Elle chat. | Non-medical assistant disclaimer is visible. | Performed as expected | Passed |
|  | Elle Assistant Module | Message Input |  | CASE-037 | Try to send a blank message. | Assistant request is not called. | Performed as expected | Passed |
|  | Elle Assistant Module | Chat Reply |  | CASE-038 | Send one question with a mocked assistant reply. | Question and reply render once. | Performed as expected | Passed |
|  | Elle Assistant Module | Chat Error |  | CASE-039 | Return a mocked service failure. | Friendly message appears without raw Bad Request text. | Performed as expected | Passed |
|  | Elle Assistant Module | New Chat |  | CASE-040 | Start a new chat after previous messages. | Old replies clear and welcome text returns. | Performed as expected | Passed |
|  | Care Plan Module | Medication List |  | CASE-041 | Open an empty medication list. | Clear empty state appears. | Performed as expected | Passed |
|  | Care Plan Module | Medication Form |  | CASE-042 | Save a medication without a name. | Save is rejected with validation feedback. | Performed as expected | Passed |
|  | Care Plan Module | Medication Form |  | CASE-043 | Choose a medication reminder time with the picker. | The selected time appears in the form without manual entry. | Performed as expected | Passed |
|  | Care Plan Module | Caregiver Note |  | CASE-044 | Save an empty caregiver note. | Empty note is rejected. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status |  | CASE-045 | Check an as-needed medication. | No scheduled dose is shown. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status |  | CASE-046 | Check a medication taken today. | Dose is marked taken. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status |  | CASE-047 | Check yesterday's or another medication's log. | It is not counted as taken today. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status |  | CASE-048 | Check a medicine without reminder time. | Status is unscheduled. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status |  | CASE-049 | Check a dose due within 30 minutes. | Status is due now. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status |  | CASE-050 | Check a dose due within three hours. | Status is due soon. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status |  | CASE-051 | Check a later scheduled dose. | Status is upcoming. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status |  | CASE-052 | Check a dose whose time has passed. | Status says due earlier. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Sorting |  | CASE-053 | Sort missed and upcoming doses. | Missed doses appear first. | Performed as expected | Passed |
|  | Reminders Module | Time Validation |  | CASE-054 | Enter valid 24-hour reminder times. | Valid times are accepted. | Performed as expected | Passed |
|  | Reminders Module | Time Validation |  | CASE-055 | Enter malformed or out-of-range times. | Invalid times are rejected. | Performed as expected | Passed |
|  | Reminders Module | Reminder Schedule |  | CASE-056 | Calculate the second daily reminder from 20:30. | Second reminder time wraps to 08:30. | Performed as expected | Passed |
|  | Reminders Module | Medication Alert |  | CASE-057 | Schedule an as-needed medication. | No timed alert is created. | Performed as expected | Passed |
|  | Reminders Module | Appointment Alert |  | CASE-058 | Deny notification permission. | App does not claim an appointment alert was set. | Performed as expected | Passed |
|  | Reminders Module | Appointment Alert |  | CASE-059 | Permit an appointment alert for a patient. | Alert text names the patient. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings |  | CASE-060 | Open Settings without a saved doctor. | Empty doctor contact state appears. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings |  | CASE-061 | Save a doctor without a name. | Save is blocked. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings |  | CASE-062 | Save a doctor with an invalid phone number. | Save is blocked. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings |  | CASE-063 | Save a valid doctor contact. | Doctor appears in Settings after save. | Performed as expected | Passed |
