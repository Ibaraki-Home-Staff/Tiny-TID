function queryAlertElements(){
  const overlay = document.querySelector('[data-alert-overlay]');
  if(!overlay) return null;
  return {
    overlay,
    title: overlay.querySelector('#tidAlertTitle'),
    groups: overlay.querySelector('[data-alert-groups]'),
    close: overlay.querySelector('[data-alert-close]'),
  };
}

function renderGroups(container, groups){
  container.innerHTML = '';
  if(!groups.length){
    const empty = document.createElement('p');
    empty.textContent = '追加情報はありません。';
    container.appendChild(empty);
    return;
  }
  for(const group of groups){
    const wrapper = document.createElement('div');
    wrapper.className = 'tid-alert__group';

    const row = document.createElement('div');
    row.className = 'tid-alert__row';

    const label = document.createElement('span');
    label.className = 'tid-alert__label';
    label.textContent = group.label;

    const value = document.createElement('span');
    value.className = 'tid-alert__value';
    if(group.type === 'delay-bad'){
      value.classList.add('tid-alert__value--delay-bad');
    }
    value.textContent = group.value;

    row.appendChild(label);
    row.appendChild(value);
    wrapper.appendChild(row);
    container.appendChild(wrapper);
  }
}

export function createAlertController(){
  const elements = queryAlertElements();
  if(!elements){
    return {
      show(){},
      hide(){},
      teardown(){},
    };
  }
  const { overlay, title, groups, close } = elements;

  function hide(){
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function show(alert){
    if(!alert){
      hide();
      return;
    }
    if(title){
      title.textContent = alert.title || '運行情報';
    }
    if(groups){
      renderGroups(groups, alert.groups || []);
    }
    overlay.classList.remove('is-hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function onOverlayClick(event){
    if(event.target === overlay){
      hide();
    }
  }

  overlay.addEventListener('click', onOverlayClick);
  if(close){
    close.addEventListener('click', hide);
  }
  const onKeydown = (event) => {
    if(event.key === 'Escape'){
      hide();
    }
  };
  document.addEventListener('keydown', onKeydown);

  return {
    show,
    hide,
    teardown(){
      overlay.removeEventListener('click', onOverlayClick);
      if(close){
        close.removeEventListener('click', hide);
      }
      document.removeEventListener('keydown', onKeydown);
    },
  };
}
