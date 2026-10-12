(() => {
  const config = window.ELDERCARE_ADMIN_CONFIG;
  const state = { token: null, email: '', recoveryEmail: '', currentView: 'dashboard', page: 0, accounts: null, selectedCaregiver: null, lastInteraction: Date.now() };
  const $ = (id) => document.getElementById(id);
  const titles = { dashboard: 'Overview', accounts: 'Manage accounts', monitor: 'System monitor', alerts: 'Alerts & notifications', reports: 'Generate reports', security: 'Manage security' };

  function message(text, error = false) {
    const target = $('global-message');
    target.textContent = text;
    target.hidden = !text;
    target.classList.toggle('is-error', error);
  }

  function dateTime(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
  }

  function cell(row, value) {
    const td = document.createElement('td');
    td.textContent = value == null || value === '' ? '—' : String(value);
    row.append(td);
    return td;
  }

  function button(label, onClick, kind = 'quiet') {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `row-action ${kind}`;
    item.textContent = label;
    item.addEventListener('click', () => {
      Promise.resolve().then(onClick).catch((error) => message(error.message, true));
    });
    return item;
  }

  function rows(tbodyId, records, renderRow, columns) {
    const body = $(tbodyId);
    body.replaceChildren();
    if (!records.length) {
      const row = document.createElement('tr');
      const empty = document.createElement('td');
      empty.colSpan = columns;
      empty.className = 'empty-cell';
      empty.textContent = 'No records found.';
      row.append(empty);
      body.append(row);
      return;
    }
    records.forEach((record) => {
      const row = document.createElement('tr');
      renderRow(row, record);
      body.append(row);
    });
  }

  function activityList(id, items, label) {
    const list = $(id);
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-copy';
      empty.textContent = 'No recent activity.';
      list.append(empty);
      return;
    }
    items.forEach((item) => {
      const line = document.createElement('div');
      line.className = 'activity-line';
      const title = document.createElement('strong');
      title.textContent = label(item);
      const time = document.createElement('span');
      time.textContent = dateTime(item.triggered_at);
      line.append(title, time);
      list.append(line);
    });
  }

  function signOut() {
    state.token = null;
    state.email = '';
    state.recoveryEmail = '';
    state.accounts = null;
    $('password').value = '';
    $('invite-form').hidden = true;
    $('recovery-form').hidden = true;
    $('login-form').hidden = false;
    $('recovery-code').value = '';
    $('invite-password').value = '';
    $('invite-confirm').value = '';
    $('login-message').classList.remove('is-success');
    $('login-view').hidden = false;
    $('admin-app').hidden = true;
  }

  function loginEmail() {
    const entered = $('username').value.trim().toLowerCase();
    return entered === 'eldercareadmin' ? config.adminEmail : entered;
  }

  async function api(action, payload = {}) {
    const response = await fetch(`${config.url}/functions/v1/admin-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) signOut();
      const error = new Error(data.error || 'Could not complete the request. Please try again.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadDashboard() {
    const data = await api('dashboard');
    $('metric-caregivers').textContent = data.stats.caregivers;
    $('metric-patients').textContent = data.stats.patients;
    $('metric-devices').textContent = data.stats.connectedDevices;
    $('metric-suspended').textContent = data.stats.suspended;
    $('latest-vital').textContent = dateTime(data.lastVitalSyncAt);
    $('api-response').textContent = `${data.responseMs} ms`;
    const status = data.lastVitalSyncAt && Date.now() - new Date(data.lastVitalSyncAt).getTime() < 60 * 60 * 1000 ? 'Recent sync' : 'Check sync age';
    $('pipeline-status').textContent = data.lastVitalSyncAt ? status : 'No saved vitals';
    $('pipeline-status').classList.toggle('is-warning', status !== 'Recent sync');
    activityList('dashboard-alerts', data.alerts, (item) => `${item.severity}: ${item.title}`);
    activityList('dashboard-emergencies', data.emergencies, (item) => `${item.severity}: ${item.event_type}`);
  }

  function patientRows() {
    const caregiver = state.accounts?.caregivers.find((item) => item.id === state.selectedCaregiver);
    $('patient-context').textContent = caregiver ? `Linked to ${caregiver.full_name}` : 'Select a caregiver to view their profiles.';
    const patients = state.accounts?.patients.filter((item) => item.caregiver_id === state.selectedCaregiver) ?? [];
    rows('patient-rows', patients, (row, patient) => {
      cell(row, patient.full_name);
      cell(row, patient.age);
      cell(row, patient.emergency_contact);
      cell(row, patient.medical_conditions ? 'Recorded' : 'Not recorded');
      const actions = cell(row, '');
      actions.textContent = '';
      actions.className = 'row-actions';
      actions.append(button('Edit', () => editPatient(patient)), button('Delete', () => deletePatient(patient), 'danger'));
    }, 5);
  }

  async function loadAccounts() {
    const data = await api('accounts', { page: state.page });
    state.accounts = data;
    $('accounts-page').textContent = `Page ${data.page + 1} of ${Math.max(1, data.pages)}`;
    $('accounts-prev').disabled = state.page === 0;
    $('accounts-next').disabled = state.page + 1 >= data.pages;
    if (!data.caregivers.some((item) => item.id === state.selectedCaregiver)) state.selectedCaregiver = null;
    rows('caregiver-rows', data.caregivers, (row, caregiver) => {
      const status = data.access.find((item) => item.user_id === caregiver.id)?.status ?? 'unknown';
      cell(row, caregiver.full_name);
      cell(row, caregiver.email || caregiver.phone);
      cell(row, 'Caregiver');
      cell(row, status);
      cell(row, data.patients.filter((patient) => patient.caregiver_id === caregiver.id).length);
      const actions = cell(row, '');
      actions.textContent = '';
      actions.className = 'row-actions';
      actions.append(button('View', () => { state.selectedCaregiver = caregiver.id; patientRows(); }),
        button('Edit', () => editCaregiver(caregiver)),
        button(status === 'active' ? 'Suspend' : 'Activate', () => setStatus(caregiver, status === 'active' ? 'suspended' : 'active')),
        button('Delete', () => deleteCaregiver(caregiver), 'danger'));
    }, 6);
    patientRows();
    const chooser = $('security-caregiver');
    chooser.replaceChildren();
    const first = document.createElement('option');
    first.value = '';
    first.textContent = 'Select caregiver';
    chooser.append(first);
    data.caregivers.forEach((caregiver) => {
      const option = document.createElement('option');
      option.value = caregiver.id;
      option.textContent = caregiver.full_name;
      chooser.append(option);
    });
  }

  function editCaregiver(record) {
    $('patient-editor').hidden = true;
    const form = $('caregiver-editor');
    form.elements.id.value = record.id;
    form.elements.full_name.value = record.full_name ?? '';
    form.elements.phone.value = record.phone ?? '';
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function editPatient(record) {
    $('caregiver-editor').hidden = true;
    const form = $('patient-editor');
    for (const name of ['id', 'full_name', 'age', 'gender', 'emergency_contact', 'emergency_contact_phone', 'medical_conditions']) {
      form.elements[name].value = record[name] ?? '';
    }
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function setStatus(caregiver, status) {
    if (!window.confirm(`${status === 'suspended' ? 'Suspend' : 'Activate'} ${caregiver.full_name}?`)) return;
    await api('set-status', { id: caregiver.id, status });
    message(`${caregiver.full_name} is now ${status}.`);
    await loadAccounts();
  }

  async function deletePatient(patient) {
    const confirmation = window.prompt(`Delete ${patient.full_name} and linked records? Type the full name to confirm.`);
    if (confirmation !== patient.full_name) return;
    const result = await api('delete-elderly', { id: patient.elderly_id });
    message(result.photoCleanupFailed
      ? `${patient.full_name} was deleted, but the profile photo could not be removed. Review Storage cleanup.`
      : `${patient.full_name} was deleted.`, Boolean(result.photoCleanupFailed));
    await loadAccounts();
  }

  async function deleteCaregiver(caregiver) {
    const confirmation = window.prompt(`Permanently delete ${caregiver.full_name} and the connected account? Type the full name to confirm.`);
    if (confirmation !== caregiver.full_name) return;
    await api('delete-caregiver', { id: caregiver.id });
    message(`${caregiver.full_name} was deleted.`);
    await loadAccounts();
  }

  async function loadMonitor() {
    const data = await api('monitor');
    rows('device-rows', data.devices, (row, item) => {
      cell(row, item.user_id); cell(row, item.wearable_status); cell(row, item.paired_device_count); cell(row, dateTime(item.updated_at));
    }, 4);
    rows('sync-rows', data.syncs, (row, item) => {
      cell(row, item.elderly_id); cell(row, dateTime(item.synced_at)); cell(row, dateTime(item.recorded_at)); cell(row, item.source);
    }, 4);
    renderAudit(data.activity);
  }

  function renderAudit(items) {
    rows('audit-rows', items, (row, item) => {
      cell(row, dateTime(item.created_at)); cell(row, item.action); cell(row, `${item.target_type ?? ''} ${item.target_id ?? ''}`.trim());
    }, 3);
  }

  async function loadAlerts() {
    const data = await api('alerts');
    rows('alert-rows', data.alerts, (row, item) => {
      cell(row, dateTime(item.triggered_at)); cell(row, item.severity); cell(row, item.title); cell(row, item.elderly_id); cell(row, item.is_resolved ? 'Resolved' : 'Open');
    }, 5);
    rows('notification-rows', data.notifications, (row, item) => {
      cell(row, dateTime(item.sent_at)); cell(row, item.notification_type); cell(row, item.title); cell(row, item.delivery_status);
    }, 4);
    rows('emergency-rows', data.emergencies, (row, item) => {
      cell(row, dateTime(item.triggered_at)); cell(row, item.severity); cell(row, item.event_type); cell(row, item.elderly_id); cell(row, item.is_resolved ? 'Resolved' : 'Open');
    }, 5);
  }

  async function loadSecurity() {
    if (!state.accounts) await loadAccounts();
    const [monitor, admins] = await Promise.all([api('monitor'), api('admins')]);
    renderAudit(monitor.activity);
    $('admin-count').textContent = `${admins.admins.length} administrator${admins.admins.length === 1 ? '' : 's'}`;
    rows('admin-rows', admins.admins, (row, item) => {
      const email = item.profile?.email || item.user_id;
      cell(row, email);
      cell(row, item.status === 'active' ? 'Active' : 'Suspended');
      cell(row, dateTime(item.profile?.created_at));
      const actions = cell(row, '');
      actions.textContent = '';
      actions.className = 'row-actions';
      if (item.user_id === admins.currentId) {
        actions.textContent = 'You';
      } else {
        actions.append(
          button(item.status === 'active' ? 'Suspend' : 'Activate', () => setAdminStatus(item, email)),
          button('Delete', () => deleteAdmin(item, email), 'danger'),
        );
      }
    }, 4);
    $('security-email').textContent = state.email;
  }

  async function setAdminStatus(item, email) {
    const status = item.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`${status === 'suspended' ? 'Suspend' : 'Activate'} admin access for ${email}?`)) return;
    await api('set-admin-status', { id: item.user_id, status });
    message(`Admin access for ${email} is now ${status}.`);
    await loadSecurity();
  }

  async function deleteAdmin(item, email) {
    if (window.prompt(`Permanently delete admin ${email}? Type the email to confirm.`) !== email) return;
    await api('delete-admin', { id: item.user_id });
    message(`${email} was deleted.`);
    await loadSecurity();
  }

  async function showView(view) {
    if (!titles[view]) return;
    state.currentView = view;
    $('view-title').textContent = titles[view];
    document.querySelectorAll('.admin-view').forEach((section) => { section.hidden = section.id !== `view-${view}`; });
    document.querySelectorAll('#admin-nav button').forEach((item) => item.classList.toggle('is-active', item.dataset.view === view));
    message('');
    try {
      if (view === 'dashboard') await loadDashboard();
      if (view === 'accounts') await loadAccounts();
      if (view === 'monitor') await loadMonitor();
      if (view === 'alerts') await loadAlerts();
      if (view === 'security') await loadSecurity();
      $('last-updated').textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (error) { message(error.message, true); }
  }

  function csvCell(value) {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadCsv(type, from, to, rowsToExport) {
    const columns = Object.keys(rowsToExport[0]);
    const csv = [columns.map(csvCell).join(','), ...rowsToExport.map((row) => columns.map((name) => csvCell(row[name])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `eldercare-${type}-${from}-to-${to}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const loginMessage = $('login-message');
    loginMessage.textContent = '';
    loginMessage.classList.remove('is-success');
    if (!config?.url || !config?.publishableKey || !config?.adminEmail) {
      loginMessage.textContent = 'Admin configuration is missing. Contact the project administrator.';
      return;
    }
    const email = loginEmail();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      loginMessage.textContent = 'Invalid admin credentials.';
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    let authSucceeded = false;
    try {
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
        body: JSON.stringify({ email, password: form.elements.password.value }),
      });
      const auth = await response.json().catch(() => ({}));
      if (!response.ok || !auth.access_token) {
        if (auth.error_code === 'email_not_confirmed') throw new Error('Confirm the separate admin email in Supabase, then try again.');
        throw new Error('Admin email or password was not accepted. Check the separate admin Auth account.');
      }
      authSucceeded = true;
      state.token = auth.access_token;
      const verified = await api('session');
      state.email = verified.user.email;
      state.lastInteraction = Date.now();
      $('admin-identity').textContent = state.email;
      $('login-view').hidden = true;
      $('admin-app').hidden = false;
      form.elements.password.value = '';
      await showView('dashboard');
    } catch (error) {
      signOut();
      if (!authSucceeded) loginMessage.textContent = error instanceof TypeError
        ? 'Cannot reach Supabase Auth. Check your connection and try again.' : error.message;
      else if (error.message === 'Admin access is required.') loginMessage.textContent = 'This account is not an active administrator. Check its role and status in user_access.';
      else if (error.status === 403) loginMessage.textContent = 'The admin service rejected access. Check the admin-portal function logs.';
      else if (error.status === 404) loginMessage.textContent = 'The admin-portal function is not deployed to this Supabase project.';
      else if (error.message === 'Unable to verify admin permissions.') loginMessage.textContent = 'Admin permissions could not be checked. Confirm the admin migration is applied.';
      else loginMessage.textContent = 'Authentication succeeded, but the admin service could not complete sign-in. Check Edge Function logs.';
    } finally { submit.disabled = false; }
  });

  $('reset-password').addEventListener('click', async (event) => {
    const feedback = $('login-message');
    feedback.textContent = '';
    feedback.classList.remove('is-success');
    if (!config?.url || !config?.publishableKey || !config?.adminEmail) {
      feedback.textContent = 'Admin configuration is missing. Contact the project administrator.';
      return;
    }
    const email = loginEmail();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      feedback.textContent = 'Enter your admin username or email above first.';
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const redirect = new URL('/edcadmin/', window.location.origin).href;
      const response = await fetch(`${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        feedback.textContent = response.status === 429
          ? 'Please wait before requesting another reset email.'
          : 'Could not send a reset email right now. Try again later.';
        return;
      }
      state.recoveryEmail = email;
      $('recovery-email').textContent = email;
      $('recovery-message').textContent = 'If this account exists, enter the code from the newest reset email.';
      $('recovery-message').classList.add('is-success');
      $('login-form').hidden = true;
      $('recovery-form').hidden = false;
    } catch {
      feedback.textContent = 'Could not reach Supabase Auth. Check your connection and try again.';
    } finally {
      button.disabled = false;
    }
  });

  $('recovery-back').addEventListener('click', () => {
    signOut();
    $('login-message').textContent = '';
  });

  $('recovery-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $('recovery-message');
    const code = form.elements.code.value.trim();
    feedback.textContent = '';
    feedback.classList.remove('is-success');
    if (!/^\d{6,8}$/.test(code) || !state.recoveryEmail) {
      feedback.textContent = 'Enter the code from your newest reset email.';
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const response = await fetch(`${config.url}/auth/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
        body: JSON.stringify({ email: state.recoveryEmail, token: code, type: 'recovery' }),
      });
      const verified = await response.json().catch(() => ({}));
      if (!response.ok || !verified.access_token || verified.user?.email?.toLowerCase() !== state.recoveryEmail) {
        feedback.textContent = 'That code is invalid or expired. Request a new reset email.';
        return;
      }
      state.token = verified.access_token;
      state.email = verified.user.email;
      state.lastInteraction = Date.now();
      form.elements.code.value = '';
      $('invite-email').textContent = state.email;
      $('recovery-form').hidden = true;
      $('invite-form').hidden = false;
    } catch {
      feedback.textContent = 'Could not verify the code. Check your connection and try again.';
    } finally {
      submit.disabled = false;
    }
  });

  async function openInviteLink() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has('error')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      $('login-message').textContent = params.get('error_code') === 'otp_expired'
        ? 'This reset link expired or was already used. Request a new one and open the newest email once.'
        : 'This admin link could not be verified. Request a new one.';
      return;
    }
    if (!params.has('access_token')) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const token = params.get('access_token');
    if (!token || !['invite', 'recovery'].includes(params.get('type'))) {
      $('login-message').textContent = 'This admin link is invalid or expired.';
      return;
    }
    state.token = token;
    try {
      const verified = await api('session');
      state.email = verified.user.email;
      state.lastInteraction = Date.now();
      $('invite-email').textContent = state.email;
      $('login-form').hidden = true;
      $('invite-form').hidden = false;
    } catch {
      signOut();
      $('login-message').textContent = 'This admin link is invalid or expired. Ask an administrator for a new invitation.';
    }
  }

  $('invite-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.password.value;
    const feedback = $('invite-message');
    feedback.textContent = '';
    if (password !== form.elements.confirm.value) {
      feedback.textContent = 'Passwords do not match.';
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const response = await fetch(`${config.url}/auth/v1/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error('Could not set your password. Request a new invitation or try again.');
      const email = state.email;
      signOut();
      $('username').value = email;
      $('login-message').textContent = 'Password set. Sign in with your email.';
      $('login-message').classList.add('is-success');
    } catch (error) { feedback.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  $('admin-invite-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = $('admin-invite-result');
    feedback.textContent = '';
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const email = form.elements.email.value.trim().toLowerCase();
      await api('invite-admin', { email });
      form.reset();
      feedback.textContent = `Invitation sent to ${email}.`;
      await loadSecurity();
    } catch (error) { message(error.message, true); }
    finally { submit.disabled = false; }
  });

  $('sign-out').addEventListener('click', signOut);
  $('refresh-view').addEventListener('click', () => void showView(state.currentView));
  document.querySelectorAll('#admin-nav button').forEach((item) => item.addEventListener('click', () => void showView(item.dataset.view)));
  document.querySelectorAll('[data-go]').forEach((item) => item.addEventListener('click', () => void showView(item.dataset.go)));
  $('accounts-prev').addEventListener('click', () => { state.page = Math.max(0, state.page - 1); void loadAccounts().catch((error) => message(error.message, true)); });
  $('accounts-next').addEventListener('click', () => { state.page += 1; void loadAccounts().catch((error) => message(error.message, true)); });
  document.querySelectorAll('[data-cancel]').forEach((item) => item.addEventListener('click', () => { item.closest('form').hidden = true; }));

  $('caregiver-editor').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api('update-caregiver', { id: form.elements.id.value, full_name: form.elements.full_name.value, phone: form.elements.phone.value });
      form.hidden = true;
      message('Caregiver profile saved.');
      await loadAccounts();
    } catch (error) { message(error.message, true); }
  });
  $('patient-editor').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      await api('update-elderly', values);
      form.hidden = true;
      message('Older adult profile saved.');
      await loadAccounts();
    } catch (error) { message(error.message, true); }
  });
  $('security-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const caregiver = state.accounts?.caregivers.find((item) => item.id === form.elements.id.value);
    if (!caregiver) return message('Select a caregiver on this page.', true);
    try {
      await setStatus(caregiver, form.elements.status.value);
      await loadSecurity();
    } catch (error) { message(error.message, true); }
  });
  $('report-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const data = await api('report', values);
      if (data.rows.length) downloadCsv(values.type, values.from, values.to, data.rows);
      $('report-result').textContent = data.rows.length
        ? `${data.rows.length} rows exported.${data.truncated ? ' More records exist; choose a shorter date range.' : ''}`
        : 'No records in this date range.';
    } catch (error) { message(error.message, true); }
  });

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  $('report-form').elements.from.value = weekAgo.toISOString().slice(0, 10);
  $('report-form').elements.to.value = today.toISOString().slice(0, 10);
  for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => { state.lastInteraction = Date.now(); }, { passive: true });
  window.setInterval(() => {
    if (state.token && Date.now() - state.lastInteraction > 15 * 60 * 1000) {
      signOut();
      $('login-message').textContent = 'Session ended after 15 minutes of inactivity.';
    }
  }, 60000);
  void openInviteLink();
})();
