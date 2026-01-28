import { loadComponents } from '../components.js';
import { getQueryParams, validateParams } from './params.js';
import { renderLoading, renderSnapshot, renderError } from './render.js';
import { fetchSnapshot } from './api.js';
import { normalizeSnapshot } from './normalize.js';
import { createAlertController } from './alerts.js';
import { createAudioController } from './audio.js';
import { getPollInterval } from './config.js';
import { state, setParams, setSnapshot, setPollHandle, clearPollHandle, toggleShowPassing } from './state.js';

async function setup(){
  renderLoading();
  await loadComponents();

  const params = getQueryParams();
  const validation = validateParams(params);
  if(!validation.ok){
    const message = validation.issues.join(' / ');
    renderError(message || 'パラメータが正しくありません。');
    return;
  }
  setParams(params);

  const alerts = createAlertController();
  const audio = createAudioController();
  const passingToggle = document.querySelector('[data-toggle-passing]');

  const syncPassingToggle = (pressed) => {
    if(!passingToggle) return;
    passingToggle.classList.toggle('is-active', pressed);
    passingToggle.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    passingToggle.textContent = pressed ? '通過表示中' : '通過表示';
  };

  syncPassingToggle(state.showPassing);

  const applySnapshot = (snapshot, source) => {
    setSnapshot(snapshot, source);
    syncPassingToggle(state.showPassing);
    renderSnapshot(snapshot);
    if(snapshot.alert){
      alerts.show(snapshot.alert);
      if(snapshot.alert.requiresAudio){
        audio.playAlarm();
      }
    }else{
      alerts.hide();
    }
    if(snapshot.lineTitle){
      document.title = snapshot.lineTitle + ' | Tiny-TID';
    }
  };

  const recomputeSnapshot = () => {
    if(!state.lastSource || !state.params){
      return;
    }
    const snapshot = normalizeSnapshot(state.lastSource, state.params, { showPassing: state.showPassing });
    applySnapshot(snapshot, state.lastSource);
  };

  if(passingToggle){
    passingToggle.addEventListener('click', () => {
      const next = toggleShowPassing();
      syncPassingToggle(next);
      recomputeSnapshot();
    });
  }

  const loadSnapshot = async (showLoading) => {
    if(showLoading){
      renderLoading();
    }
    try{
      const source = await fetchSnapshot(params);
      const snapshot = normalizeSnapshot(source, params, { showPassing: state.showPassing });
      applySnapshot(snapshot, source);
    }catch(err){
      console.error('Snapshot load failed', err);
      renderError('データを取得できませんでした。時間を置いて再試行してください。');
    }
  };

  await loadSnapshot(false);

  const interval = getPollInterval();
  const handle = window.setInterval(() => {
    loadSnapshot(false);
  }, interval);
  setPollHandle(handle);

  window.addEventListener('beforeunload', () => {
    clearPollHandle();
    alerts.hide();
    audio.hide();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setup().catch((err) => {
    console.error('Tiny-TID init failed', err);
    renderError('初期化に失敗しました。');
  });
});
