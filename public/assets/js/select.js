// Tiny-TID area/line/station selector (classic script: no modules, no
// bundling, conservative syntax so it runs as-is on every browser).
(function () {
  'use strict';

  // Shared header fragment (same source as the app pages).
  (function loadHeader() {
    var el = document.querySelector('[data-include="header"]');
    if (!el) return;
    fetch('/components/header.html', { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (html) {
      el.innerHTML = html;
    }).catch(function () {
      el.innerHTML = '<div class="component-error">読み込みエラー: header</div>';
    });
  })();

  var areaSel = document.getElementById('areaSelect');
  var lineSel = document.getElementById('lineSelect');
  var stationSel = document.getElementById('stationSelect');
  var showBtn = document.getElementById('showBtn');
  var errorEl = document.getElementById('selectError');
  var areas = {};

  function opt(value, text) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }

  function reset(sel, message) {
    sel.innerHTML = '';
    sel.appendChild(opt('', message));
    sel.disabled = true;
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) {}
  }

  function updateShowButton() {
    showBtn.disabled = !(areaSel.value && lineSel.value);
  }

  function restoreStation(stations) {
    var saved = storageGet('tid:select:station');
    if (saved && stations.some(function (s) { return s.code === saved; })) {
      stationSel.value = saved;
    }
  }

  function fillLines(areaId) {
    reset(lineSel, '路線を選択してください');
    reset(stationSel, '路線を選択してください');
    var area = areas[areaId];
    var lines = (area && area.lines) || [];
    if (!lines.length) return;
    lineSel.innerHTML = '';
    lineSel.appendChild(opt('', '選択してください'));
    lines.forEach(function (l) {
      lineSel.appendChild(opt(l.id, l.name || l.id));
    });
    lineSel.disabled = false;
    var savedLine = storageGet('tid:select:line');
    if (savedLine) {
      var has = lines.some(function (l) { return l.id === savedLine; });
      if (has) lineSel.value = savedLine;
    }
    if (lineSel.value) fillStations(lineSel.value);
    updateShowButton();
  }

  function fillStations(lineId) {
    reset(stationSel, '読み込み中…');
    updateShowButton();
    fetch('/api/stations?line=' + encodeURIComponent(lineId), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var stations = (data && data.stations) || [];
      stationSel.innerHTML = '';
      if (!stations.length) {
        reset(stationSel, '駅がありません');
        return;
      }
      stationSel.appendChild(opt('', '指定なし（全列車）'));
      stations.forEach(function (s) {
        stationSel.appendChild(opt(s.code, s.name || s.code));
      });
      stationSel.disabled = false;
      restoreStation(stations);
      updateShowButton();
    }).catch(function () {
      reset(stationSel, '取得に失敗しました');
      showError('駅一覧の取得に失敗しました。再読み込みしてください。');
    });
  }

  areaSel.addEventListener('change', function () {
    clearError();
    storageSet('tid:select:area', areaSel.value);
    storageSet('tid:select:line', '');
    storageSet('tid:select:station', '');
    fillLines(areaSel.value);
  });

  lineSel.addEventListener('change', function () {
    clearError();
    storageSet('tid:select:line', lineSel.value);
    storageSet('tid:select:station', '');
    if (lineSel.value) {
      fillStations(lineSel.value);
    } else {
      reset(stationSel, '路線を選択してください');
      updateShowButton();
    }
  });

  stationSel.addEventListener('change', function () {
    storageSet('tid:select:station', stationSel.value);
    updateShowButton();
  });

  showBtn.addEventListener('click', function () {
    if (showBtn.disabled) return;
    var q = 'area=' + encodeURIComponent(areaSel.value)
      + '&line=' + encodeURIComponent(lineSel.value);
    if (stationSel.value) q += '&station=' + encodeURIComponent(stationSel.value);
    window.location.href = '/view.html?' + q;
  });

  fetch('/api/areas', { cache: 'no-store' }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function (data) {
    areas = data || {};
    var ids = Object.keys(areas).sort();
    if (!ids.length) throw new Error('empty');
    areaSel.innerHTML = '';
    areaSel.appendChild(opt('', '選択してください'));
    ids.forEach(function (id) {
      var a = areas[id] || {};
      areaSel.appendChild(opt(id, a.name || id));
    });
    areaSel.disabled = false;
    var savedArea = storageGet('tid:select:area');
    if (savedArea && areas[savedArea]) {
      areaSel.value = savedArea;
      fillLines(savedArea);
    }
    updateShowButton();
  }).catch(function () {
    reset(areaSel, '取得に失敗しました');
    showError('エリア一覧の取得に失敗しました。再読み込みしてください。');
  });
})();
