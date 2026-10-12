// DOM overlay for login, account creation and password recovery.
// Forms post to the server; on success the caller receives the state to start the game.
import { api, ApiError } from './api.js';

const $ = (sel) => document.querySelector(sel);

export function showAuth() {
  return new Promise((resolve) => {
    const overlay = $('#auth-overlay');
    overlay.classList.remove('hidden');
    const error = $('#auth-error');
    const setError = (msg, field) => {
      error.textContent = msg || '';
      document.querySelectorAll('.auth-form input').forEach((i) => i.removeAttribute('aria-invalid'));
      if (field) document.querySelector(`.auth-form:not(.hidden) [name="${field}"]`)?.setAttribute('aria-invalid', 'true');
    };
    const showTab = (name) => {
      document.querySelectorAll('.tab').forEach((t) => {
        const active = t.dataset.tab === name;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('.auth-form').forEach((f) => f.classList.toggle('hidden', f.id !== `form-${name}`));
      setError('');
    };
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

    const setBusy = (form, busy) => {
      form.querySelectorAll('button, input').forEach((el) => { el.disabled = busy; });
    };
    const formData = (form) => Object.fromEntries(new FormData(form).entries());

    const finish = (payload) => {
      overlay.classList.add('hidden');
      resolve(payload);
    };

    $('#form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const payload = formData(form);
      setBusy(form, true);
      try {
        const data = await api('POST', '/api/auth/login', payload);
        finish(data);
      } catch (err) {
        setError(err.message);
      } finally { setBusy(form, false); }
    });

    $('#form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const payload = formData(form);
      setBusy(form, true);
      try {
        const data = await api('POST', '/api/auth/register', payload);
        showRecoveryCode(data.recoveryCode, () => finish(data));
      } catch (err) {
        setError(err.message, err instanceof ApiError ? err.field : undefined);
      } finally { setBusy(form, false); }
    });

    $('#form-forgot').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const payload = formData(form);
      setBusy(form, true);
      try {
        const data = await api('POST', '/api/auth/forgot', payload);
        setError('');
        showRecoveryCode(data.recoveryCode, () => showTab('login'), 'Password changed. Your new recovery code:');
      } catch (err) {
        setError(err.message, err.field);
      } finally { setBusy(form, false); }
    });
    showTab('login');
  });
}

// Shows a new recovery code once. Continue is disabled until the player acknowledges it.
export function showRecoveryCode(code, onContinue, title) {
  const overlay = $('#recovery-overlay');
  const ack = $('#recovery-ack');
  const done = $('#recovery-done');
  $('#recovery-code').textContent = code;
  if (title) $('#recovery-title').textContent = title;
  ack.checked = false;
  done.disabled = true;
  overlay.classList.remove('hidden');
  const onAck = () => { done.disabled = !ack.checked; };
  ack.onchange = onAck;
  $('#recovery-copy').onclick = () => navigator.clipboard?.writeText(code).catch(() => {});
  done.onclick = () => {
    overlay.classList.add('hidden');
    $('#recovery-title').textContent = 'Save your recovery code';
    onContinue();
  };
}

// Generic DOM form used for text-entry actions inside the game (password change, etc.).
// Resolves with an object of field values, or null when cancelled.
export function promptForm({ title, fields, submitLabel = 'Save', hint = '' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const card = document.createElement('div');
    card.className = 'auth-card';
    const h = document.createElement('h2');
    h.textContent = title;
    const form = document.createElement('form');
    form.className = 'auth-form';
    form.autocomplete = 'off';
    const err = document.createElement('p');
    err.className = 'error';
    err.setAttribute('role', 'alert');
    if (hint) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = hint;
      card.append(h, p);
    } else card.append(h);
    for (const f of fields) {
      const label = document.createElement('label');
      label.textContent = f.label;
      const input = document.createElement('input');
      input.name = f.name;
      input.type = f.type || 'text';
      input.maxLength = f.maxLength || 128;
      input.required = true;
      input.autocomplete = f.autocomplete || 'off';
      label.append(input);
      form.append(label);
    }
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'primary';
    submit.textContent = submitLabel;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'secondary';
    cancel.textContent = 'Cancel';
    form.append(submit, cancel, err);
    card.append(form);
    overlay.append(card);
    document.body.append(overlay);
    const close = (value) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    cancel.onclick = () => close(null);
    form.onsubmit = (e) => {
      e.preventDefault();
      const values = Object.fromEntries(fields.map((f) => [f.name, form.elements[f.name].value]));
      close(values);
    };
    form.elements[fields[0].name].focus();
  });
}
