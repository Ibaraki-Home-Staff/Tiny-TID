import { loadComponents } from '../components.js';
import { getQueryParams, validateParams } from './params.js';
import { renderLoading, renderSnapshot, renderError } from './render.js';
import { fetchSnapshot } from './api.js';
import { normalizeSnapshot } from './normalize.js';
import { createAlertController } from './alerts.js';
import { createAudioController } from './audio.js';
import { getPollInterval } from './config.js';
import { state, setParams, setSnapshot, setPollHandle, clearPollHandle } from './state.js';

async function setup(){
  renderLoading();
  await loadComponents();

  const params = getQueryParams();
  const validation = validateParams(params);
  if(!validation.ok){
    const message = validation.issues.join(' / ');
    renderError(message || 'パラメータが不足しています。');
    return;
  }
  setParams(params);

  const alerts = createAlertController();
  const audio = createAudioController();

  const applySnapshot = (snapshot, source) => {
    setSnapshot(snapshot, source);
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

  const loadSnapshot = async (showLoading) => {
    if(showLoading){
      renderLoading();
    }
    try{
      const source = await fetchSnapshot(params);
      const snapshot = normalizeSnapshot(source, params);
      applySnapshot(snapshot, source);
    }catch(err){
      console.error('Snapshot load failed', err);
      renderError('データを取得できませんでした。時間をおいて再試行してください。');
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
