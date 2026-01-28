/**
 * Alarm Controller for Tiny-TID v2
 * Handles approach alarm triggering and notifications
 */

import { getAlarmSettings } from './settings.js';

const IBARAKI_STATION_CODE = '0610226';
const ALARM_SUPPRESSION_MS = 3 * 60 * 1000; // 3 minutes

// Track notified trains to prevent duplicate alarms
const alarmNotified = new Map(); // trainId -> timestamp

/**
 * Check if a train should trigger an approach alarm
 * @param {Object} train - Train object from API
 * @param {Object} settings - Settings object
 * @returns {boolean} True if alarm should trigger
 */
export function shouldTriggerAlarm(train, settings) {
  const direction = train.direction === 'up' ? 'up' : 'down';
  const alarmSettings = getAlarmSettings(settings, direction);

  // Check if alarms are enabled for this direction
  if (!alarmSettings.enabled) {
    return false;
  }

  // Check if this train type has alarms enabled
  const trainType = train.train_type || 'local';
  if (!alarmSettings.types[trainType]) {
    return false;
  }

  // Check if train is approaching Ibaraki station
  if (!isApproachingStation(train)) {
    return false;
  }

  // Check if we've already notified for this train recently
  const trainId = train.id;
  if (alarmNotified.has(trainId)) {
    const lastNotified = alarmNotified.get(trainId);
    if (Date.now() - lastNotified < ALARM_SUPPRESSION_MS) {
      return false;
    }
  }

  return true;
}

/**
 * Check if train is approaching Ibaraki station
 * @param {Object} train - Train object
 * @returns {boolean} True if approaching
 */
function isApproachingStation(train) {
  const position = train.position;
  if (!position || !position.current) {
    return false;
  }

  // Check if position indicates train is approaching (one station before)
  // The position.current format is "StationA → StationB"
  const positionText = position.current;

  // Simple heuristic: if position contains an arrow and mentions nearby stations
  // In a real implementation, you'd use station order data
  // For now, we'll assume the backend provides proper position data

  return positionText.includes('→') || positionText.includes('←');
}

/**
 * Mark a train as notified
 * @param {string} trainId - Train ID
 */
export function markAsNotified(trainId) {
  alarmNotified.set(trainId, Date.now());
  cleanupOldNotifications();
}

/**
 * Clean up old notifications from the map
 */
function cleanupOldNotifications() {
  const now = Date.now();
  const toDelete = [];

  for (const [trainId, timestamp] of alarmNotified.entries()) {
    if (now - timestamp > ALARM_SUPPRESSION_MS * 2) {
      toDelete.push(trainId);
    }
  }

  toDelete.forEach(trainId => alarmNotified.delete(trainId));
}

/**
 * Clear all alarm notifications (e.g., when settings change)
 */
export function clearAllNotifications() {
  alarmNotified.clear();
}

/**
 * Create alarm modal controller
 * @returns {Object} Controller with show/hide methods
 */
export function createAlarmModal() {
  const overlay = document.querySelector('[data-alert-overlay]');
  if (!overlay) {
    return {
      show: () => {},
      hide: () => {}
    };
  }

  const title = overlay.querySelector('#tidAlertTitle');
  const groups = overlay.querySelector('[data-alert-groups]');
  const closeBtn = overlay.querySelector('[data-alert-close]');

  let autoHideTimer = null;

  function hide() {
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  }

  function show(train) {
    if (!train) {
      hide();
      return;
    }

    // Set title
    if (title) {
      title.textContent = `列車接近: ${train.type || ''} ${train.destination || ''}`;
    }

    // Render train details
    if (groups) {
      groups.innerHTML = '';

      const details = [
        { label: '列車番号', value: train.number || '--' },
        { label: '種別', value: train.type || '--' },
        { label: '行先', value: train.destination || '--' },
        { label: '位置', value: train.position?.current || '--' },
        { label: '遅延', value: train.delay_minutes ? `${train.delay_minutes}分` : 'なし' }
      ];

      details.forEach(detail => {
        const wrapper = document.createElement('div');
        wrapper.className = 'tid-alert__group';

        const row = document.createElement('div');
        row.className = 'tid-alert__row';

        const label = document.createElement('span');
        label.className = 'tid-alert__label';
        label.textContent = detail.label;

        const value = document.createElement('span');
        value.className = 'tid-alert__value';
        value.textContent = detail.value;

        row.appendChild(label);
        row.appendChild(value);
        wrapper.appendChild(row);
        groups.appendChild(wrapper);
      });
    }

    overlay.classList.remove('is-hidden');
    overlay.setAttribute('aria-hidden', 'false');

    // Auto-hide after 10 seconds
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
    autoHideTimer = setTimeout(hide, 10000);
  }

  // Event listeners
  if (closeBtn) {
    closeBtn.addEventListener('click', hide);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hide();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hide();
    }
  });

  return { show, hide };
}
