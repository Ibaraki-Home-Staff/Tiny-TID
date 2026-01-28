/**
 * Settings management with localStorage
 */

const SETTINGS_KEY = 'tid:v2:settings';
const IBARAKI_STATION_CODE = '0610226';

// Default settings
const DEFAULT_SETTINGS = {
  filters: {
    trainTypes: {
      local: true,
      rapid: true,
      special_rapid: true,
      limited_express: true
    }
  },
  alarms: {
    up: {
      enabled: false,
      types: {
        local: false,
        rapid: false,
        special_rapid: false,
        limited_express: false
      }
    },
    down: {
      enabled: false,
      types: {
        local: false,
        rapid: false,
        special_rapid: false,
        limited_express: false
      }
    }
  },
  audio: {
    unlocked: false
  },
  ui: {
    alarmSettingsOpen: false
  }
};

/**
 * Load settings from localStorage
 * @returns {Object} Settings object
 */
export function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    const parsed = JSON.parse(stored);
    // Merge with defaults to handle new fields
    return mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch (error) {
    console.error('Failed to load settings:', error);
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

/**
 * Save settings to localStorage
 * @param {Object} settings - Settings object
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

/**
 * Deep merge two settings objects
 * @param {Object} defaults - Default settings
 * @param {Object} custom - Custom settings
 * @returns {Object} Merged settings
 */
function mergeSettings(defaults, custom) {
  const result = {};

  for (const key in defaults) {
    if (custom && key in custom) {
      if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        result[key] = mergeSettings(defaults[key], custom[key]);
      } else {
        result[key] = custom[key];
      }
    } else {
      result[key] = defaults[key];
    }
  }

  return result;
}

/**
 * Get filter settings for train types
 * @param {Object} settings - Settings object
 * @returns {Object} Filter settings
 */
export function getFilterSettings(settings) {
  return settings.filters.trainTypes;
}

/**
 * Update filter settings
 * @param {Object} settings - Settings object
 * @param {Object} filters - New filter settings
 * @returns {Object} Updated settings
 */
export function updateFilterSettings(settings, filters) {
  settings.filters.trainTypes = { ...settings.filters.trainTypes, ...filters };
  saveSettings(settings);
  return settings;
}

/**
 * Get alarm settings for a direction
 * @param {Object} settings - Settings object
 * @param {string} direction - 'up' or 'down'
 * @returns {Object} Alarm settings for direction
 */
export function getAlarmSettings(settings, direction) {
  return settings.alarms[direction];
}

/**
 * Update alarm settings for a direction
 * @param {Object} settings - Settings object
 * @param {string} direction - 'up' or 'down'
 * @param {Object} alarmSettings - New alarm settings
 * @returns {Object} Updated settings
 */
export function updateAlarmSettings(settings, direction, alarmSettings) {
  settings.alarms[direction] = { ...settings.alarms[direction], ...alarmSettings };
  saveSettings(settings);
  return settings;
}

/**
 * Set audio unlocked status
 * @param {Object} settings - Settings object
 * @param {boolean} unlocked - Audio unlocked status
 * @returns {Object} Updated settings
 */
export function setAudioUnlocked(settings, unlocked) {
  settings.audio.unlocked = unlocked;
  saveSettings(settings);
  return settings;
}

/**
 * Check if audio is unlocked
 * @param {Object} settings - Settings object
 * @returns {boolean} True if audio is unlocked
 */
export function isAudioUnlocked(settings) {
  return settings.audio.unlocked === true;
}

/**
 * Set alarm settings panel open state
 * @param {Object} settings - Settings object
 * @param {boolean} open - Open state
 * @returns {Object} Updated settings
 */
export function setAlarmSettingsOpen(settings, open) {
  settings.ui.alarmSettingsOpen = open;
  saveSettings(settings);
  return settings;
}
