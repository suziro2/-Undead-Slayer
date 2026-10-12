// Holds the signed-in user and the latest server state. Scenes read from here and
// replace it with every server response (the server always returns the full state).
import { get } from './api.js';

export const session = {
  user: null,
  state: null,
  listeners: new Set(),
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  apply(payload) {
    if (payload?.user !== undefined) this.user = payload.user;
    if (payload?.state) this.state = payload.state;
    if (payload?.state?.user) this.user = payload.state.user;
    this.listeners.forEach((fn) => fn(this.state));
    return this.state;
  },
  async refresh() {
    return this.apply(await get('/api/state'));
  },
};
