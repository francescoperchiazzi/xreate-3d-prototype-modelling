let services = {};
let managerInstance = null;
let modalInstance = null;

export function configureAutosave(nextServices = {}) {
  services = { ...services, ...(nextServices || {}) };
  return services;
}

export function getAutosaveManager() { return managerInstance; }
export function getAutosaveModalUi() { return modalInstance; }

function getDevWarn() { return typeof services.devWarn === 'function' ? services.devWarn : null; }

function devWarn(...args) {
  const f = getDevWarn();
  if (!f) return;
  try { f(...args); } catch (_) {}
}

function tr(key) {
  try {
    return typeof services.tr === 'function' ? services.tr(key) : String(key);
  } catch (_) {
    return String(key);
  }
}

function showToast(msg, type) {
  try {
    if (typeof services.showToast === 'function') return services.showToast(msg, type);
  } catch (_) {}
}

function getProjectMetaModified() {
  try {
    if (typeof services.getProjectMetaModified === 'function') return services.getProjectMetaModified();
  } catch (_) {}
  return null;
}

function resolveProjectIoBridge() {
  return typeof services.getProjectIO === 'function' ? services.getProjectIO() : (services.projectIO || null);
}

function buildProjectSavePayload() {
  const io = resolveProjectIoBridge();
  if (io && typeof io.buildProjectSavePayload === 'function') return io.buildProjectSavePayload();
  if (typeof services.buildProjectSavePayload !== 'function') throw new Error('buildProjectSavePayload bridge not available');
  return services.buildProjectSavePayload();
}

async function loadProjectFromPayload(payload) {
  const io = resolveProjectIoBridge();
  if (io && typeof io.loadProjectFromPayload === 'function') return await io.loadProjectFromPayload(payload);
  if (typeof services.loadProjectFromPayload !== 'function') throw new Error('loadProjectFromPayload bridge not available');
  return await services.loadProjectFromPayload(payload);
}

function download(bytes, filename, mime) {
  try {
    if (typeof services.download === 'function') return services.download(bytes, filename, mime);
  } catch (_) {}
}

function projectFilenameBase(name) {
  const value = String(name || '').trim() || 'Untitled';
  return value
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64) || 'Untitled';
}

const AutosaveLogger = {
  debug: (...a) => { try { console.debug(...a); } catch (_) {} },
  info: (...a) => { try { console.info(...a); } catch (_) {} },
  warn: (...a) => { try { console.warn(...a); } catch (_) {} },
  error: (...a) => { try { console.error(...a); } catch (_) {} },
};

const autosaveStorage = {
  isAvailable: true,
  lastWriteErrorName: null,
  lastWriteErrorMessage: null,
  getItem(key) {
    const k = String(key);
    let raw = null;
    try {
      raw = localStorage.getItem(k);
      this.isAvailable = true;
    } catch (_) {
      this.isAvailable = false;
      return null;
    }
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      try { localStorage.removeItem(k); } catch (_) {}
      devWarn('[XReate][Autosave] Corrupted JSON removed:', k);
      return null;
    }
  },
  setItem(key, value) {
    const k = String(key);
    this.lastWriteErrorName = null;
    this.lastWriteErrorMessage = null;
    try {
      localStorage.setItem(k, JSON.stringify(value));
      this.isAvailable = true;
      return true;
    } catch (e) {
      this.isAvailable = false;
      this.lastWriteErrorName = e && e.name ? String(e.name) : 'Error';
      this.lastWriteErrorMessage = e && e.message ? String(e.message) : String(e);
      devWarn('[XReate][Autosave] setItem failed:', this.lastWriteErrorName, this.lastWriteErrorMessage);
      return false;
    }
  },
  removeItem(key) {
    const k = String(key);
    try { localStorage.removeItem(k); } catch (_) {}
  },
};

class AutosaveBuffer {
  constructor(maxSlots) {
    this.maxSlots = maxSlots;
    this.index = null;
  }

  setMaxSlots(maxSlots) {
    this.maxSlots = maxSlots;
  }

  createSlotMetadata(id, payload) {
    const ts = Date.now();
    const sceneName = payload && payload.project && payload.project.name ? String(payload.project.name) : 'Untitled';
    const entityCount = payload && payload.project && Array.isArray(payload.project.shapes) ? payload.project.shapes.length : 0;
    let size = 0;
    try { size = new TextEncoder().encode(JSON.stringify(payload)).byteLength; } catch (_) { size = 0; }
    return { id, timestamp: ts, sceneName, entityCount, size };
  }

  async deleteAutosaveData(id) {
    try {
      const dataKey = `autosave:data:${id}`;
      autosaveStorage.removeItem(dataKey);
    } catch (_) {}
  }

  async loadIndex() {
    const stored = autosaveStorage.getItem('autosave:index');
    if (!stored || typeof stored !== 'object') {
      this.index = { slots: [], lastSave: null, nextSlotIndex: 0 };
      return;
    }
    try {
      const slots = Array.isArray(stored.slots) ? stored.slots : [];
      this.index = {
        slots: slots.filter(Boolean),
        lastSave: stored.lastSave || null,
        nextSlotIndex: (typeof stored.nextSlotIndex === 'number') ? stored.nextSlotIndex : 0,
      };
    } catch (e) {
      AutosaveLogger.error('[AutosaveBuffer] Failed to load index:', e);
      this.index = { slots: [], lastSave: null, nextSlotIndex: 0 };
    }
  }

  async saveIndex() {
    if (!this.index) return false;
    const ok = autosaveStorage.setItem('autosave:index', this.index);
    if (!ok) AutosaveLogger.error('[AutosaveBuffer] Failed to save index:', autosaveStorage.lastWriteErrorName, autosaveStorage.lastWriteErrorMessage);
    return ok;
  }

  getLastSaveTimestamp() {
    return this.index && this.index.lastSave ? this.index.lastSave : null;
  }

  async validateIndexIntegrity() {
    if (!this.index) await this.loadIndex();
    if (!this.index) return;
    if (!Array.isArray(this.index.slots)) this.index.slots = [];
    const filtered = [];
    for (const slot of this.index.slots) {
      if (!slot || !slot.id) continue;
      const dataKey = `autosave:data:${slot.id}`;
      const exists = autosaveStorage.getItem(dataKey) !== null;
      if (exists) filtered.push(slot);
      else {
        try { autosaveStorage.removeItem(`autosave:data:${slot.id}`); } catch (_) {}
      }
    }
    this.index.slots = filtered;
    await this.saveIndex();
  }

  async deleteOldestAutosave() {
    if (!this.index) await this.loadIndex();
    await this.validateIndexIntegrity();
    const slots = this.index && Array.isArray(this.index.slots) ? this.index.slots : [];
    if (!slots.length) return false;
    const oldest = [...slots].sort((a, b) => a.timestamp - b.timestamp)[0];
    return await this.deleteAutosave(oldest.id);
  }

  async deleteAutosave(id) {
    if (!this.index) await this.loadIndex();
    await this.deleteAutosaveData(id);
    if (this.index && Array.isArray(this.index.slots)) this.index.slots = this.index.slots.filter(s => s && s.id !== id);
    await this.saveIndex();
    return true;
  }

  async clearAll() {
    if (!this.index) await this.loadIndex();
    if (this.index && Array.isArray(this.index.slots)) {
      for (const slot of this.index.slots) {
        autosaveStorage.removeItem(`autosave:data:${slot.id}`);
      }
    }
    this.index = { slots: [], lastSave: null, nextSlotIndex: 0 };
    await this.saveIndex();
    return true;
  }

  async addAutosave(payload) {
    if (!Number.isFinite(this.maxSlots) || this.maxSlots < 1) throw new Error('Autosave disabled: invalid maxSlots');
    if (!this.index) await this.loadIndex();
    if (!this.index) throw new Error('Autosave index not initialized');
    const autosaveId = `autosave_${Date.now()}`;
    const slot = this.createSlotMetadata(autosaveId, payload);
    const dataKey = `autosave:data:${autosaveId}`;
    const ok = autosaveStorage.setItem(dataKey, payload);
    if (!ok) {
      const err = new Error(autosaveStorage.lastWriteErrorMessage || 'Failed to save autosave data');
      err.name = autosaveStorage.lastWriteErrorName || 'QuotaExceededError';
      err.storageKey = dataKey;
      err.storageReason = autosaveStorage.lastWriteErrorName || null;
      throw err;
    }
    this.index.slots.push(slot);
    this.index.lastSave = Date.now();
    if (this.index.slots.length > this.maxSlots) {
      const byTs = [...this.index.slots].sort((a, b) => a.timestamp - b.timestamp);
      const overflow = byTs.slice(0, Math.max(0, byTs.length - this.maxSlots));
      for (const oldestSlot of overflow) {
        try { await this.deleteAutosaveData(oldestSlot.id); } catch (_) {}
      }
      const keep = new Set(byTs.slice(Math.max(0, byTs.length - this.maxSlots)).map(s => s.id));
      this.index.slots = this.index.slots.filter(s => s && keep.has(s.id));
    }
    const ok2 = await this.saveIndex();
    if (!ok2) {
      autosaveStorage.removeItem(dataKey);
      const err = new Error(autosaveStorage.lastWriteErrorMessage || 'Failed to save autosave index');
      err.name = autosaveStorage.lastWriteErrorName || 'QuotaExceededError';
      err.storageKey = 'autosave:index';
      err.storageReason = autosaveStorage.lastWriteErrorName || null;
      throw err;
    }
    return autosaveId;
  }

  async getAutosave(id) {
    const dataKey = `autosave:data:${id}`;
    const payload = autosaveStorage.getItem(dataKey);
    if (!payload) throw new Error(`Autosave not found: ${id}`);
    return payload;
  }

  async getHistory() {
    if (!this.index) await this.loadIndex();
    await this.validateIndexIntegrity();
    if (!this.index || !this.index.slots) return [];
    return [...this.index.slots].sort((a, b) => b.timestamp - a.timestamp);
  }
}

class AutosaveManager {
  constructor() {
    this.config = {
      intervalMs: 5 * 60 * 1000,
      maxSlots: 12,
      isEnabled: true,
      maxRetries: 1,
    };
    this.state = {
      timerId: null,
      countdownId: null,
      nextRunAt: null,
      isSaving: false,
      lastSaveTime: null,
      retryCount: 0,
      lastProjectModified: null,
      pollId: null,
      suppressOnce: false,
    };
    this.buffer = new AutosaveBuffer(this.config.maxSlots);
    managerInstance = this;
  }

  async init() {
    this.loadPreferences();
    await this.buffer.loadIndex();
    const last = this.buffer.getLastSaveTimestamp();
    if (last) this.state.lastSaveTime = last;
    this.updateLastTimeUi();
    this.startProjectModifiedPoll();
    if (this.config.isEnabled) this.start();
    else this.updateCountdownUi('Autosave: Disabled');
  }

  loadPreferences() {
    const p = autosaveStorage.getItem('autosave:preferences');
    if (!p || typeof p !== 'object') return;
    if (typeof p.intervalMs === 'number') this.config.intervalMs = p.intervalMs;
    if (typeof p.maxSlots === 'number') this.config.maxSlots = p.maxSlots;
    if (typeof p.isEnabled === 'boolean') this.config.isEnabled = p.isEnabled;
    this.buffer.setMaxSlots(this.config.maxSlots);
  }

  savePreferences() {
    autosaveStorage.setItem('autosave:preferences', {
      intervalMs: this.config.intervalMs,
      maxSlots: this.config.maxSlots,
      isEnabled: this.config.isEnabled,
    });
  }

  onProjectLoaded() {
    try {
      this.state.suppressOnce = true;
      this.state.lastProjectModified = getProjectMetaModified();
      this.resetDirty();
      this.updateLastTimeUi();
    } catch (_) {}
  }

  startProjectModifiedPoll() {
    if (this.state.pollId) clearInterval(this.state.pollId);
    this.state.lastProjectModified = getProjectMetaModified();
    this.state.pollId = setInterval(() => {
      try {
        const cur = getProjectMetaModified();
        if (cur && this.state.lastProjectModified && cur !== this.state.lastProjectModified) {
          this.state.lastProjectModified = cur;
          if (this.state.suppressOnce) this.state.suppressOnce = false;
          else this.markDirty();
        }
      } catch (_) {}
    }, 900);
  }

  markDirty() { this._dirty = true; }
  resetDirty() { this._dirty = false; }
  isDirty() { return !!this._dirty; }

  start() {
    this.stop();
    if (!this.config.isEnabled) return;
    this.state.nextRunAt = Date.now() + this.config.intervalMs;
    this.state.timerId = setTimeout(() => this.performAutosave(false), this.config.intervalMs);
    this.startCountdown();
  }

  stop() {
    if (this.state.timerId) clearTimeout(this.state.timerId);
    this.state.timerId = null;
    this.state.nextRunAt = null;
    this.stopCountdown();
  }

  startCountdown() {
    this.stopCountdown();
    this.state.countdownId = setInterval(() => {
      if (!this.config.isEnabled) return;
      if (!this.state.nextRunAt) return;
      const ms = this.state.nextRunAt - Date.now();
      if (ms <= 0) return;
      const s = Math.ceil(ms / 1000);
      const m = Math.floor(s / 60);
      const r = s % 60;
      this.updateCountdownUi(`${m}:${String(r).padStart(2, '0')}`);
    }, 450);
  }

  stopCountdown() {
    if (this.state.countdownId) clearInterval(this.state.countdownId);
    this.state.countdownId = null;
  }

  updateCountdownUi(text) {
    try {
      const el = document.getElementById('autosave-countdown');
      if (el) el.textContent = String(text);
    } catch (_) {}
  }

  updateLastTimeUi() {
    try {
      const el = document.getElementById('autosave-last-time');
      if (!el) return;
      if (!this.state.lastSaveTime) { el.textContent = '—'; return; }
      el.textContent = new Date(this.state.lastSaveTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (_) {}
  }

  setEnabled(enabled) {
    this.config.isEnabled = !!enabled;
    this.savePreferences();
    if (this.config.isEnabled) this.start();
    else { this.stop(); this.updateCountdownUi(tr('autosave_disabled')); }
  }

  setIntervalMinutes(minutes) {
    const m = Math.max(1, Number(minutes) || 5);
    this.config.intervalMs = m * 60 * 1000;
    this.savePreferences();
    if (this.config.isEnabled) this.start();
  }

  setMaxSlots(slots) {
    const n = Math.max(1, Number(slots) || 12);
    this.config.maxSlots = n;
    this.buffer.setMaxSlots(n);
    this.savePreferences();
  }

  async saveNow() {
    await this.performAutosave(true);
  }

  async performAutosave(force) {
    if (!this.config.isEnabled) return;
    if (this.state.isSaving) return;
    if (!force && !this.isDirty()) { this.start(); return; }
    this.state.isSaving = true;
    try {
      let attempts = 0;
      let saved = false;
      while (!saved) {
        try {
          const payload = buildProjectSavePayload();
          payload.metadata = { saved: Date.now(), isAutosave: true, version: '1.0' };
          await this.buffer.addAutosave(payload);
          this.state.lastSaveTime = Date.now();
          this.updateLastTimeUi();
          this.resetDirty();
          this.state.retryCount = 0;
          try {
            const now = Date.now();
            const last = (typeof this.state.lastToastAt === 'number' && isFinite(this.state.lastToastAt)) ? this.state.lastToastAt : 0;
            const allow = force || !last || (now - last) > 30000;
            if (allow) {
              showToast(tr('toast_autosave_done'), 'info');
              this.state.lastToastAt = now;
            }
          } catch (_) {}
          saved = true;
          break;
        } catch (e) {
          const name = e && e.name ? String(e.name) : '';
          const msg = e && e.message ? String(e.message) : '';
          const isQuota = name === 'QuotaExceededError' || msg.toLowerCase().includes('quota') || (autosaveStorage.lastWriteErrorName === 'QuotaExceededError');
          if (isQuota && attempts < this.config.maxRetries) {
            attempts++;
            this.state.retryCount = attempts;
            try { await this.buffer.deleteOldestAutosave(); } catch (_) {}
            continue;
          }
          break;
        }
      }
    } finally {
      this.state.isSaving = false;
      this.start();
    }
  }

  async getHistory() {
    return await this.buffer.getHistory();
  }

  async getAutosave(id) {
    return await this.buffer.getAutosave(id);
  }

  async restoreAutosave(id) {
    const payload = await this.buffer.getAutosave(id);
    await loadProjectFromPayload(payload);
  }

  async deleteAutosave(id) {
    return await this.buffer.deleteAutosave(id);
  }

  async clearAll() {
    return await this.buffer.clearAll();
  }
}

class AutosaveHistoryModal {
  constructor(manager) {
    this.manager = manager;
    this.modal = document.getElementById('autosaveModal');
    this.list = document.getElementById('autosaveList');
    this.btnClose = document.getElementById('autosaveCloseBtn');
    this.btnNow = document.getElementById('autosaveNowBtn');
    this.btnClear = document.getElementById('autosaveClearBtn');
    this.clearConfirmMsg = document.getElementById('autosaveClearConfirmMsg');
    this.clearConfirmActions = document.getElementById('autosaveClearConfirmActions');
    this.btnClearConfirm = document.getElementById('autosaveClearConfirmBtn');
    this.btnClearCancel = document.getElementById('autosaveClearCancelBtn');
    this.chkEnabled = document.getElementById('autosaveEnabled');
    this.selInterval = document.getElementById('autosaveInterval');
    this.selSlots = document.getElementById('autosaveMaxSlots');
    this._bound = false;
    this._confirmingClear = false;
    this._modalState = null;
  }

  bind() {
    if (this._bound) return;
    this._bound = true;
    if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());
    if (this.modal) this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });
    if (this.btnNow) this.btnNow.addEventListener('click', async () => { await this.manager.saveNow(); await this.refresh(); });
    const hideClearConfirm = (returnFocus) => {
      this._confirmingClear = false;
      if (this.btnClear) this.btnClear.hidden = false;
      if (this.clearConfirmMsg) this.clearConfirmMsg.hidden = true;
      if (this.clearConfirmActions) this.clearConfirmActions.hidden = true;
      if (returnFocus && this.btnClear) {
        try { this.btnClear.focus(); } catch (_) {}
      }
    };
    const showClearConfirm = () => {
      if (this._confirmingClear) return;
      this._confirmingClear = true;
      if (this.btnClear) this.btnClear.hidden = true;
      if (this.clearConfirmMsg) this.clearConfirmMsg.hidden = false;
      if (this.clearConfirmActions) this.clearConfirmActions.hidden = false;
      try { this.btnClearConfirm && this.btnClearConfirm.focus && this.btnClearConfirm.focus(); } catch (_) {}
    };
    if (this.btnClear) this.btnClear.addEventListener('click', () => showClearConfirm());
    if (this.btnClearCancel) this.btnClearCancel.addEventListener('click', () => hideClearConfirm(true));
    if (this.btnClearConfirm) this.btnClearConfirm.addEventListener('click', async () => {
      await this.manager.clearAll();
      await this.refresh();
      try { showToast(tr('autosave_cleared_toast'), 'info'); } catch (_) {}
      hideClearConfirm(true);
    });
    if (this.chkEnabled) this.chkEnabled.addEventListener('change', () => this.manager.setEnabled(this.chkEnabled.checked));
    if (this.selInterval) this.selInterval.addEventListener('change', () => this.manager.setIntervalMinutes(parseInt(this.selInterval.value, 10)));
    if (this.selSlots) this.selSlots.addEventListener('change', () => this.manager.setMaxSlots(parseInt(this.selSlots.value, 10)));
    if (this.list) this.list.addEventListener('click', async (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('button[data-action]') : null;
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (action === 'restore') {
        const ok = confirm(tr('autosave_confirm_restore'));
        if (!ok) return;
        await this.manager.restoreAutosave(id);
        try { showToast(tr('toast_autosave_restored'), 'success'); } catch (_) {}
        this.close();
      } else if (action === 'delete') {
        await this.manager.deleteAutosave(id);
        await this.refresh();
      } else if (action === 'export') {
        try {
          const payload = await this.manager.buffer.getAutosave(id);
          const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
          const name = projectFilenameBase(payload?.project?.name);
          download(bytes, `${name}-autosave.xreate.json`, 'application/json');
        } catch (_) {}
      }
    });
    if (this.modal) {
      this.modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._confirmingClear) { e.preventDefault(); hideClearConfirm(true); }
      });
    }
  }

  syncSettingsUi() {
    if (this.chkEnabled) this.chkEnabled.checked = !!this.manager.config.isEnabled;
    if (this.selInterval) {
      const minutes = Math.round(this.manager.config.intervalMs / 60000);
      this.selInterval.value = String(minutes);
    }
    if (this.selSlots) this.selSlots.value = String(this.manager.config.maxSlots);
  }

  async refresh() {
    if (!this.list) return;
    const history = await this.manager.getHistory();
    this.list.innerHTML = '';
    if (!history.length) {
      const empty = document.createElement('li');
      empty.className = 'xr-autosave-entry';
      const m = document.createElement('div');
      m.className = 'xr-autosave-entry__meta';
      const t = document.createElement('div');
      t.className = 'xr-autosave-entry__title';
      t.textContent = tr('autosave_empty_title');
      const s = document.createElement('div');
      s.className = 'xr-autosave-entry__sub';
      s.textContent = tr('autosave_empty_sub');
      m.appendChild(t);
      m.appendChild(s);
      empty.appendChild(m);
      this.list.appendChild(empty);
      return;
    }
    for (const entry of history) {
      const row = document.createElement('li');
      row.className = 'xr-autosave-entry';
      const meta = document.createElement('div');
      meta.className = 'xr-autosave-entry__meta';
      const title = document.createElement('div');
      title.className = 'xr-autosave-entry__title';
      const ts = new Date(entry.timestamp);
      const tsLabel = ts.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      title.textContent = tsLabel;
      const sub = document.createElement('div');
      sub.className = 'xr-autosave-entry__sub';
      const kb = entry.size ? Math.round(entry.size / 1024) : 0;
      sub.textContent = `${entry.sceneName} • ${entry.entityCount} shapes • ${kb} KB`;
      meta.appendChild(title);
      meta.appendChild(sub);
      const actions = document.createElement('div');
      actions.className = 'xr-autosave-entry__actions';
      const btnRestore = document.createElement('button');
      btnRestore.className = 'xr-modal__btn';
      btnRestore.type = 'button';
      btnRestore.textContent = tr('autosave_action_restore');
      btnRestore.setAttribute('aria-label', `${tr('aria_autosave_restore_prefix')} ${tsLabel}`);
      btnRestore.setAttribute('data-action', 'restore');
      btnRestore.setAttribute('data-id', entry.id);
      const btnExport = document.createElement('button');
      btnExport.className = 'xr-modal__btn';
      btnExport.type = 'button';
      btnExport.textContent = tr('autosave_action_export');
      btnExport.setAttribute('data-action', 'export');
      btnExport.setAttribute('data-id', entry.id);
      const btnDelete = document.createElement('button');
      btnDelete.className = 'xr-modal__btn is-danger';
      btnDelete.type = 'button';
      btnDelete.textContent = tr('autosave_action_delete');
      btnDelete.setAttribute('aria-label', `${tr('aria_autosave_delete_prefix')} ${tsLabel}`);
      btnDelete.setAttribute('data-action', 'delete');
      btnDelete.setAttribute('data-id', entry.id);
      actions.appendChild(btnRestore);
      actions.appendChild(btnExport);
      actions.appendChild(btnDelete);
      row.appendChild(meta);
      row.appendChild(actions);
      this.list.appendChild(row);
    }
  }

  async open() {
    this.bind();
    this.syncSettingsUi();
    await this.refresh();
    const openModal = typeof services.openModal === 'function' ? services.openModal : null;
    if (!openModal) return;
    this._modalState = openModal(this.modal, { initialFocusEl: this.btnClose, returnFocusEl: document.activeElement });
  }

  close() {
    const closeModal = typeof services.closeModal === 'function' ? services.closeModal : null;
    if (!closeModal) return;
    if (this._modalState) closeModal(this._modalState);
    else closeModal(this.modal);
    this._modalState = null;
  }
}

function ensureAutosaveManager() {
  if (managerInstance) return managerInstance;
  try {
    const manager = new AutosaveManager();
    void manager.init();
    managerInstance = manager;
    return manager;
  } catch (_) {
    return null;
  }
}

function ensureAutosaveModalUi() {
  if (modalInstance) return modalInstance;
  const manager = ensureAutosaveManager();
  if (!manager) return null;
  try {
    const modalUi = new AutosaveHistoryModal(manager);
    modalInstance = modalUi;
    return modalUi;
  } catch (_) {
    return null;
  }
}

async function openAutosaveModal() {
  const modalUi = ensureAutosaveModalUi();
  if (!modalUi || typeof modalUi.open !== 'function') return null;
  try {
    await modalUi.open();
    return modalUi;
  } catch (_) {
    return null;
  }
}

export { AutosaveManager, AutosaveHistoryModal, ensureAutosaveManager, ensureAutosaveModalUi, openAutosaveModal };
