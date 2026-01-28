export const state = {
  params: null,
  snapshot: null,
  lastSource: null,
  pollHandle: null,
  audioEnabled: false,
  showPassing: false,
};

export function setParams(params){
  state.params = params;
}

export function setSnapshot(snapshot, source){
  state.snapshot = snapshot;
  state.lastSource = source || null;
}

export function setPollHandle(handle){
  if(state.pollHandle){
    clearInterval(state.pollHandle);
  }
  state.pollHandle = handle;
}

export function clearPollHandle(){
  if(state.pollHandle){
    clearInterval(state.pollHandle);
    state.pollHandle = null;
  }
}

export function setAudioEnabled(enabled){
  state.audioEnabled = Boolean(enabled);
}

export function setShowPassing(value){
  state.showPassing = Boolean(value);
}

export function toggleShowPassing(){
  state.showPassing = !state.showPassing;
  return state.showPassing;
}
