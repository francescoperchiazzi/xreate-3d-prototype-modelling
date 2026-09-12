import { state } from './state.js';

state.lifecycle = state.lifecycle || {};

// The runtime receives every callback explicitly from its host.
let runtimeFrame = null;
let runtimePause = null;
let runtimeResume = null;

export function configure(ctx = {}) {
  runtimeFrame = (typeof ctx.frame === 'function') ? ctx.frame : null;
  runtimePause = (typeof ctx.pause === 'function') ? ctx.pause : null;
  runtimeResume = (typeof ctx.resume === 'function') ? ctx.resume : null;
  return true;
}

export function tick() {
  const lifecycle = state.lifecycle = state.lifecycle || {};
  if (lifecycle.paused) {
    lifecycle.rafId = null;
    return;
  }
  if (typeof lifecycle.rafId === 'number' && lifecycle.rafId) return;

  const step = () => {
    if (lifecycle.paused) {
      lifecycle.rafId = null;
      return;
    }
    lifecycle.rafId = requestAnimationFrame(step);
    const f = runtimeFrame;
    if (typeof f !== 'function') return;
    try { f(); } catch (err) { console.error('[render-loop] frame failed', err); }
  };

  lifecycle.rafId = requestAnimationFrame(step);
}

export function pause() {
  const f = runtimePause;
  if (typeof f !== 'function') return;
  return f();
}

export function resume() {
  const f = runtimeResume;
  if (typeof f !== 'function') return;
  return f();
}

export const RenderLoop = { configure, tick, pause, resume };
