/**
 * Tiny-TID v2 Initialization
 * Main entry point for Ibaraki station specialized version
 */

import { fetchIbarakiTrains } from './api-client.js';
import { loadSettings, saveSettings, getFilterSettings, updateFilterSettings, updateAlarmSettings, setAlarmSettingsOpen } from './settings.js';
import { renderLoading, renderError, renderTrains } from './render.js';
import { shouldTriggerAlarm, markAsNotified, createAlarmModal, clearAllNotifications } from './alarm.js';
import { createAudioController } from './audio.js';

const POLL_INTERVAL = 10000; // 10 seconds

let settings = null;
let pollTimer = null;
let alarmModal = null;
let audioController = null;
let previousTrains = new Map(); // trainId -> train data

/**
 * Initialize the application
 */
async function init() {
  try {
    // Load settings
    settings = loadSettings();

    // Create controllers
    alarmModal = createAlarmModal();
    audioController = createAudioController(settings);

    // Setup UI event listeners
    setupFilterControls();
    setupAlarmControls();

    // Restore alarm settings panel state
    const alarmSettingsEl = document.getElementById('alarmSettings');
    if (alarmSettingsEl) {
      alarmSettingsEl.open = settings.ui.alarmSettingsOpen;

      alarmSettingsEl.addEventListener('toggle', () => {
        setAlarmSettingsOpen(settings, alarmSettingsEl.open);
      });
    }

    // Initial data load
    renderLoading();
    await loadAndRenderTrains();

    // Start polling
    startPolling();

    console.log('Tiny-TID v2 initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Tiny-TID v2:', error);
    renderError('初期化に失敗しました。ページを再読み込みしてください。');
  }
}

/**
 * Setup filter controls
 */
function setupFilterControls() {
  const filterCheckboxes = document.querySelectorAll('#filter-local, #filter-rapid, #filter-special-rapid, #filter-limited-express');

  // Load current settings
  const filterSettings = getFilterSettings(settings);

  filterCheckboxes.forEach(checkbox => {
    const type = checkbox.value;
    checkbox.checked = filterSettings[type] === true;

    checkbox.addEventListener('change', () => {
      const newFilters = {};
      filterCheckboxes.forEach(cb => {
        newFilters[cb.value] = cb.checked;
      });

      updateFilterSettings(settings, newFilters);

      // Re-render with new filters
      loadAndRenderTrains();
    });
  });
}

/**
 * Setup alarm controls
 */
function setupAlarmControls() {
  setupAlarmDirection('up');
  setupAlarmDirection('down');
}

/**
 * Setup alarm controls for a specific direction
 * @param {string} direction - 'up' or 'down'
 */
function setupAlarmDirection(direction) {
  const enableCheckbox = document.getElementById(`alarm-${direction}-enable`);
  const typeCheckboxes = document.querySelectorAll(`.alarm-${direction}-type`);

  if (!enableCheckbox) return;

  // Load current settings
  const alarmSettings = settings.alarms[direction];

  enableCheckbox.checked = alarmSettings.enabled;

  typeCheckboxes.forEach(checkbox => {
    const type = checkbox.value;
    checkbox.checked = alarmSettings.types[type] === true;
    checkbox.disabled = !alarmSettings.enabled;
  });

  // Enable/disable alarm types
  enableCheckbox.addEventListener('change', () => {
    const enabled = enableCheckbox.checked;

    typeCheckboxes.forEach(cb => {
      cb.disabled = !enabled;
    });

    updateAlarmSettings(settings, direction, {
      enabled,
      types: alarmSettings.types
    });

    // Clear notifications when disabling
    if (!enabled) {
      clearAllNotifications();
    }
  });

  // Type checkbox changes
  typeCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const newTypes = {};

      typeCheckboxes.forEach(cb => {
        newTypes[cb.value] = cb.checked;
      });

      updateAlarmSettings(settings, direction, {
        enabled: alarmSettings.enabled,
        types: newTypes
      });

      // Clear notifications when changing types
      clearAllNotifications();
    });
  });
}

/**
 * Load trains from API and render
 */
async function loadAndRenderTrains() {
  try {
    const data = await fetchIbarakiTrains();

    // Check for alarms before rendering
    checkAlarms(data.trains || []);

    // Render trains
    const filterSettings = getFilterSettings(settings);
    renderTrains(data, filterSettings);

    // Update previous trains map
    updatePreviousTrains(data.trains || []);
  } catch (error) {
    console.error('Failed to load trains:', error);
    renderError('列車データの取得に失敗しました。');
  }
}

/**
 * Check if any trains should trigger alarms
 * @param {Array} trains - Array of train objects
 */
function checkAlarms(trains) {
  trains.forEach(train => {
    if (shouldTriggerAlarm(train, settings)) {
      // Check if this is a new train (not in previous data)
      const wasInPrevious = previousTrains.has(train.id);

      if (!wasInPrevious) {
        triggerAlarm(train);
      }
    }
  });
}

/**
 * Trigger alarm for a train
 * @param {Object} train - Train object
 */
async function triggerAlarm(train) {
  // Mark as notified
  markAsNotified(train.id);

  // Show modal
  alarmModal.show(train);

  // Play alarm sound
  try {
    await audioController.playAlarm();
  } catch (error) {
    console.error('Failed to play alarm:', error);
  }
}

/**
 * Update previous trains map
 * @param {Array} trains - Array of train objects
 */
function updatePreviousTrains(trains) {
  previousTrains.clear();
  trains.forEach(train => {
    previousTrains.set(train.id, train);
  });
}

/**
 * Start polling for train updates
 */
function startPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  pollTimer = setInterval(() => {
    loadAndRenderTrains();
  }, POLL_INTERVAL);
}

/**
 * Stop polling
 */
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopPolling();
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
