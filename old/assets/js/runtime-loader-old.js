(function(){
  'use strict';

  function getCurrentScript(){
    if(document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName('script');
    return scripts.length ? scripts[scripts.length - 1] : null;
  }

  function supportsModernSyntax(){
    try{
      Function('var x={a:1}; return x?.a ?? 0;');
      return true;
    }catch(_err){
      return false;
    }
  }

  function supportsModule(){
    try{
      var s = document.createElement('script');
      return 'noModule' in s;
    }catch(_err){
      return false;
    }
  }

  function setMode(mode){
    window.TID_RUNTIME_MODE = mode;
    try{ document.documentElement.setAttribute('data-runtime-mode', mode); }catch(_err){}
  }

  function showModeBadge(mode){
    try{
      var badge = document.createElement('div');
      badge.id = 'tid-runtime-mode-badge';
      badge.setAttribute('aria-label', 'Runtime mode');
      badge.textContent = mode === 'modern' ? 'Mode: MODERN' : 'Mode: LEGACY (old)';
      badge.style.position = 'fixed';
      badge.style.right = '10px';
      badge.style.bottom = '10px';
      badge.style.zIndex = '2147483647';
      badge.style.padding = '4px 8px';
      badge.style.borderRadius = '999px';
      badge.style.font = '600 11px/1.2 system-ui, sans-serif';
      badge.style.letterSpacing = '.04em';
      badge.style.background = mode === 'modern' ? 'rgba(16,124,16,.88)' : 'rgba(176,84,0,.9)';
      badge.style.color = '#fff';
      badge.style.boxShadow = '0 2px 8px rgba(0,0,0,.28)';
      badge.style.pointerEvents = 'none';
      document.addEventListener('DOMContentLoaded', function(){
        document.body.appendChild(badge);
      });
    }catch(_err){}
  }

  function appendModule(src){
    var s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    document.body.appendChild(s);
  }

  function appendScript(src){
    var s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.body.appendChild(s);
  }

  var script = getCurrentScript();
  var page = script && script.getAttribute('data-page') ? script.getAttribute('data-page') : '';
  var modern = supportsModule() && supportsModernSyntax();

  var legacyMap = {
    index: '/old/assets/js/legacy-index.js?v=5',
    tid: '/old/assets/js/legacy-tid.js?v=5'
  };
  var modernMap = {
    index: ['/old/assets/js/pwa.js?v=4', '/old/assets/js/main.js?v=42'],
    tid: ['/old/assets/js/pwa.js?v=4', '/old/assets/js/tid.js?v=42']
  };

  if(modern && modernMap[page]){
    setMode('modern');
    showModeBadge('modern');
    appendModule(modernMap[page][0]);
    appendModule(modernMap[page][1]);
    return;
  }

  setMode('legacy');
  showModeBadge('legacy');
  if(legacyMap[page]){
    appendScript(legacyMap[page]);
  }
})();
