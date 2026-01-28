import { getAlarmSoundUrl } from './config.js';
import { setAudioEnabled } from './state.js';

export function createAudioController(){
  const overlay = document.querySelector('[data-audio-overlay]');
  if(!overlay){
    return {
      enabled: () => false,
      prompt: () => {},
      hide: () => {},
      playAlarm: () => {},
    };
  }
  const enableBtn = overlay.querySelector('[data-audio-enable]');
  const cancelBtn = overlay.querySelector('[data-audio-cancel]');
  const closeBtn = overlay.querySelector('[data-audio-close]');

  let enabled = false;
  let audioElement = null;

  const ensureAudio = () => {
    if(!audioElement){
      audioElement = new Audio(getAlarmSoundUrl());
      audioElement.preload = 'auto';
    }
    return audioElement;
  };

  const hide = () => {
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
  };

  const prompt = () => {
    overlay.classList.remove('is-hidden');
    overlay.setAttribute('aria-hidden', 'false');
  };

  const enable = async () => {
    try{
      const audio = ensureAudio();
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      enabled = true;
      setAudioEnabled(true);
    }catch(err){
      console.error('Audio enable failed', err);
      const audio = ensureAudio();
      audio.load();
    }finally{
      hide();
    }
  };

  const playAlarm = () => {
    if(!enabled){
      prompt();
      return;
    }
    const audio = ensureAudio();
    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.error('Alarm play failed', err);
      enabled = false;
      setAudioEnabled(false);
      prompt();
    });
  };

  if(enableBtn){
    enableBtn.addEventListener('click', enable);
  }
  const dismiss = () => hide();
  if(cancelBtn){
    cancelBtn.addEventListener('click', dismiss);
  }
  if(closeBtn){
    closeBtn.addEventListener('click', dismiss);
  }

  return {
    enabled: () => enabled,
    prompt,
    hide,
    playAlarm,
  };
}
