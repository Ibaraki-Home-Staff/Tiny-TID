(function(){
  'use strict';

  function supportsModernSyntax(){
    try{
      Function('var o={a:1}; return (o?.a ?? 0);');
      Function('return (async function(){ await Promise.resolve(1); })();');
      return true;
    }catch(_err){
      return false;
    }
  }

  function supportsRequiredApis(){
    return !!(
      window.fetch &&
      window.URL &&
      window.URLSearchParams &&
      window.Promise &&
      Array.prototype.find
    );
  }

  function renderUnsupportedMessage(){
    var host = document.querySelector('main') || document.body;
    if(!host) return;

    var box = document.createElement('section');
    box.setAttribute('role', 'alert');
    box.style.margin = '1rem 0';
    box.style.padding = '1rem';
    box.style.border = '1px solid #d32f2f';
    box.style.borderRadius = '8px';
    box.style.background = '#fff3f3';
    box.style.color = '#6b0000';
    box.innerHTML =
      '<h2 style="margin:0 0 .5rem 0;font-size:1.1rem;">このブラウザは未対応です</h2>' +
      '<p style="margin:0;line-height:1.6;">' +
      'このページは新しい JavaScript 機能が必要です。' +
      'Edge / Safari を最新に更新して再度お試しください。' +
      '</p>';
    host.insertBefore(box, host.firstChild);
  }

  function appendModule(src){
    var s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    document.body.appendChild(s);
  }

  window.TIDBoot = {
    loadModules: function(modules){
      if(!supportsModernSyntax() || !supportsRequiredApis()){
        renderUnsupportedMessage();
        return false;
      }
      for(var i = 0; i < modules.length; i += 1){
        appendModule(modules[i]);
      }
      return true;
    }
  };
})();

