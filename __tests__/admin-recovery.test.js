const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../website/edcadmin/admin.js'), 'utf8');

function loadAdmin(hash = '') {
  const elements = new Map();
  const listeners = new Map();
  const element = (id) => {
    if (!elements.has(id)) {
      const handlers = new Map();
      elements.set(id, {
        value: '', textContent: '', hidden: false, disabled: false,
        elements: {
          from: { value: '' }, to: { value: '' }, code: { value: '' },
          password: { value: '' }, confirm: { value: '' },
        },
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
        addEventListener: (type, handler) => handlers.set(type, handler),
        querySelector: () => ({ disabled: false }),
        handlers,
      });
    }
    return elements.get(id);
  };
  const fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  const window = {
    ELDERCARE_ADMIN_CONFIG: {
      url: 'https://project.supabase.co', publishableKey: 'public-key', adminEmail: 'admin+portal@example.com',
    },
    location: { hash, origin: 'https://eldercareai.vercel.app', pathname: '/edcadmin/', search: '' },
    history: { replaceState: jest.fn() },
    setInterval: jest.fn(),
  };
  const document = {
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener: (type, handler) => listeners.set(type, handler),
  };
  vm.runInNewContext(script, { document, window, fetch, URL, URLSearchParams, Date });
  return { element, fetch, window };
}

describe('admin password recovery', () => {
  it('requests a fresh link for the admin alias with the portal redirect', async () => {
    const { element, fetch } = loadAdmin();
    element('username').value = 'eldercareadmin';
    const button = element('reset-password');
    await button.handlers.get('click')({ currentTarget: button });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://project.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Feldercareai.vercel.app%2Fedcadmin%2F');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ email: 'admin+portal@example.com' });
    expect(element('recovery-message').textContent).toContain('newest reset email');
    expect(element('recovery-form').hidden).toBe(false);
    expect(element('login-form').hidden).toBe(true);
    expect(button.disabled).toBe(false);
  });

  it('verifies an emailed code before showing the new-password form', async () => {
    const { element, fetch } = loadAdmin();
    element('username').value = 'eldercareadmin';
    const button = element('reset-password');
    await button.handlers.get('click')({ currentTarget: button });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'verified-token', user: { email: 'admin+portal@example.com' } }),
    });
    const form = element('recovery-form');
    form.elements.code.value = '123456';
    await form.handlers.get('submit')({ preventDefault: () => {}, currentTarget: form });

    const [url, options] = fetch.mock.calls[1];
    expect(url).toBe('https://project.supabase.co/auth/v1/verify');
    expect(JSON.parse(options.body)).toEqual({ email: 'admin+portal@example.com', token: '123456', type: 'recovery' });
    expect(element('invite-form').hidden).toBe(false);
    expect(element('invite-email').textContent).toBe('admin+portal@example.com');
  });

  it('updates the password with the verified recovery token', async () => {
    const { element, fetch } = loadAdmin();
    element('username').value = 'eldercareadmin';
    const resetButton = element('reset-password');
    await resetButton.handlers.get('click')({ currentTarget: resetButton });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'verified-token', user: { email: 'admin+portal@example.com' } }),
    });
    const codeForm = element('recovery-form');
    codeForm.elements.code.value = '123456';
    await codeForm.handlers.get('submit')({ preventDefault: () => {}, currentTarget: codeForm });
    const passwordForm = element('invite-form');
    passwordForm.elements.password.value = 'a-new-strong-password';
    passwordForm.elements.confirm.value = 'a-new-strong-password';
    await passwordForm.handlers.get('submit')({ preventDefault: () => {}, currentTarget: passwordForm });

    const [url, options] = fetch.mock.calls[2];
    expect(url).toBe('https://project.supabase.co/auth/v1/user');
    expect(options.headers.Authorization).toBe('Bearer verified-token');
    expect(JSON.parse(options.body)).toEqual({ password: 'a-new-strong-password' });
    expect(element('login-message').textContent).toContain('Password set');
  });

  it('rejects a missing username before calling Auth', async () => {
    const { element, fetch } = loadAdmin();
    const button = element('reset-password');
    await button.handlers.get('click')({ currentTarget: button });
    expect(fetch).not.toHaveBeenCalled();
    expect(element('login-message').textContent).toContain('Enter your admin username');
  });

  it('explains an expired email link on the admin page', async () => {
    const { element, window } = loadAdmin('#error=access_denied&error_code=otp_expired');
    await Promise.resolve();
    expect(element('login-message').textContent).toContain('expired or was already used');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/edcadmin/');
  });
});
