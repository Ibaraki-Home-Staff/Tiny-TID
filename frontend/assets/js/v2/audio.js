/**
 * Audio Controller for Tiny-TID v2
 * Handles alarm sound playback and audio unlocking
 */

import { setAudioUnlocked, isAudioUnlocked } from './settings.js';

const ALARM_SOUND_URL = '/assets/sound/alarm.mp3';

let audioElement = null;
let settings = null;

/**
 * Initialize audio controller
 * @param {Object} settingsObj - Settings object
 * @returns {Object} Controller with methods
 */
export function createAudioController(settingsObj) {
  settings = settingsObj;

  const overlay = document.querySelector('[data-audio-overlay]');
  if (!overlay) {
    return {
      playAlarm: () => Promise.resolve(false),
      prompt: () => {},
      hide: () => {}
    };
  }

  const enableBtn = overlay.querySelector('[data-audio-enable]');
  const cancelBtn = overlay.querySelector('[data-audio-cancel]');
  const closeBtn = overlay.querySelector('[data-audio-close]');

  // Ensure audio element exists
  function ensureAudioElement() {
    if (!audioElement) {
      audioElement = new Audio(ALARM_SOUND_URL);
      audioElement.preload = 'auto';
    }
    return audioElement;
  }

  // Show unlock prompt
  function prompt() {
    overlay.classList.remove('is-hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  // Hide overlay
  function hide() {
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  // Enable audio (unlock)
  async function enable() {
    try {
      const audio = ensureAudioElement();

      // iOS workaround: play muted then unmute
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;

      setAudioUnlocked(settings, true);
      hide();

      return true;
    } catch (error) {
      console.error('Failed to enable audio:', error);

      // Fallback: just load the audio
      const audio = ensureAudioElement();
      audio.load();

      hide();
      return false;
    }
  }

  // Play alarm sound
  async function playAlarm() {
    if (!isAudioUnlocked(settings)) {
      prompt();
      return false;
    }

    try {
      const audio = ensureAudioElement();
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch (error) {
      console.error('Failed to play alarm:', error);

      // If playback failed, audio might have been locked again
      setAudioUnlocked(settings, false);
      prompt();

      return false;
    }
  }

  // Event listeners
  if (enableBtn) {
    enableBtn.addEventListener('click', enable);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', hide);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', hide);
  }

  return {
    playAlarm,
    prompt,
    hide
  };
}
