/**
 * Render module for Tiny-TID v2
 * Handles UI rendering of trains and status
 */

/**
 * Format ISO datetime to readable format
 * @param {string} isoString - ISO datetime string
 * @returns {string} Formatted time string
 */
function formatTime(isoString) {
  if (!isoString) return '--:--';

  try {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (error) {
    return '--:--';
  }
}

/**
 * Get train type badge class
 * @param {string} trainType - Train type category
 * @returns {string} CSS class name
 */
function getTrainTypeBadgeClass(trainType) {
  const typeMap = {
    local: 'type-badge-local',
    rapid: 'type-badge-rapid',
    special_rapid: 'type-badge-special-rapid',
    limited_express: 'type-badge-limited-express'
  };

  return typeMap[trainType] || 'type-badge-default';
}

/**
 * Render loading state
 */
export function renderLoading() {
  const container = document.querySelector('[data-board-container]');
  if (container) {
    container.innerHTML = '<p class="loading-message">読み込み中...</p>';
  }
}

/**
 * Render error message
 * @param {string} message - Error message
 */
export function renderError(message) {
  const container = document.querySelector('[data-board-container]');
  if (container) {
    container.innerHTML = `<p class="error-message">${message}</p>`;
  }
}

/**
 * Render train list
 * @param {Object} data - Train data from API
 * @param {Object} filterSettings - Filter settings
 */
export function renderTrains(data, filterSettings) {
  const container = document.querySelector('[data-board-container]');
  const updatedAtEl = document.querySelector('[data-updated-at]');
  const boardUpdatedEl = document.querySelector('[data-board-updated]');

  if (!container) return;

  // Update timestamps
  if (updatedAtEl && data.updated_at) {
    updatedAtEl.textContent = formatTime(data.updated_at);
  }

  if (boardUpdatedEl && data.updated_at) {
    boardUpdatedEl.textContent = `更新: ${formatTime(data.updated_at)}`;
  }

  // Filter trains by selected types
  const trains = (data.trains || []).filter(train => {
    const trainType = train.train_type || 'local';
    return filterSettings[trainType] === true;
  });

  if (trains.length === 0) {
    container.innerHTML = '<p class="empty-message">該当する列車がありません</p>';
    return;
  }

  // Group trains by direction
  const upTrains = trains.filter(t => t.direction === 'up');
  const downTrains = trains.filter(t => t.direction === 'down');

  // Render grouped trains
  let html = '';

  if (upTrains.length > 0) {
    html += '<div class="train-section">';
    html += '<h3 class="train-section__title">上り</h3>';
    html += '<div class="train-list">';
    upTrains.forEach(train => {
      html += renderTrainCard(train);
    });
    html += '</div>';
    html += '</div>';
  }

  if (downTrains.length > 0) {
    html += '<div class="train-section">';
    html += '<h3 class="train-section__title">下り</h3>';
    html += '<div class="train-list">';
    downTrains.forEach(train => {
      html += renderTrainCard(train);
    });
    html += '</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

/**
 * Render individual train card
 * @param {Object} train - Train object
 * @returns {string} HTML string
 */
function renderTrainCard(train) {
  const trainType = train.train_type || 'local';
  const badgeClass = getTrainTypeBadgeClass(trainType);
  const delayClass = train.delay_minutes > 0 ? 'train-card--delayed' : '';
  const delayText = train.delay_minutes > 0 ? `遅延 ${train.delay_minutes}分` : '';

  return `
    <div class="train-card ${delayClass}" data-train-id="${train.id}">
      <div class="train-card__header">
        <span class="train-card__type ${badgeClass}">${train.type || '普通'}</span>
        <span class="train-card__number">${train.number || '--'}</span>
        ${delayText ? `<span class="train-card__delay">${delayText}</span>` : ''}
      </div>
      <div class="train-card__body">
        <div class="train-card__destination">
          <span class="train-card__label">行先:</span>
          <span class="train-card__value">${train.destination || '--'}</span>
        </div>
        <div class="train-card__position">
          <span class="train-card__label">位置:</span>
          <span class="train-card__value">${train.position?.current || '--'}</span>
        </div>
        ${train.line_name ? `
        <div class="train-card__line">
          <span class="train-card__label">路線:</span>
          <span class="train-card__value">${train.line_name}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Update last updated timestamp
 * @param {string} timestamp - ISO timestamp
 */
export function updateTimestamp(timestamp) {
  const updatedAtEl = document.querySelector('[data-updated-at]');
  const boardUpdatedEl = document.querySelector('[data-board-updated]');

  if (updatedAtEl) {
    updatedAtEl.textContent = formatTime(timestamp);
  }

  if (boardUpdatedEl) {
    boardUpdatedEl.textContent = `更新: ${formatTime(timestamp)}`;
  }
}
