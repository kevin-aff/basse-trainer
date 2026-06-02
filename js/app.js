/* =========================================================================
   APP — état global, contrôles, rendu, initialisation
   ========================================================================= */
const state = {
  mode:'scale',        // 'scale' | 'note' | 'triad'
  rootPc:0,            // C
  scale:'major',
  triad:'major',
  tuning:'bass4',
  frets:15,
  showLabels:true,     // true = noms de notes, false = degrés
  view:'neck',         // 'neck' | 'form' | 'tab' | 'both'
  position:0,
  direction:'updown',  // 'up' | 'down' | 'updown'
  bpm:80,
  metronome:true,
  loop:false,
  octaveOnly:true,
  exercise:'scale_oct_updown',
  pattern:null,        // motif d'exercice spécial (ex. 'oddsEvens'), sinon null
  sound:'bass',        // 'bass' (corde pincée réaliste) | 'synth'
};

const $ = id=>document.getElementById(id);

// Synchronise tempo et métronome entre le lecteur principal et le mini-lecteur (onglet Entraînement)
function setBpm(v){
  state.bpm = v;
  document.querySelectorAll('.js-bpm').forEach(i=>{ if(+i.value!==v) i.value=v; });
  document.querySelectorAll('.js-bpmval').forEach(s=>s.textContent=v);
  if($('validateBpm')) $('validateBpm').textContent=v;
}
function setMetro(v){
  state.metronome = v;
  document.querySelectorAll('.js-metro').forEach(sw=>sw.classList.toggle('on', v));
}

/* ---- Onglets ---- */
let currentTab = 'visu';
function showTab(name){
  if(name===currentTab) return;
  if(currentTab==='circle') qStopAll();   // quitte le cercle : stoppe son lecteur
  if(name==='circle') stopPlayback();      // entre dans le cercle : stoppe le lecteur de gammes
  currentTab = name;
  document.querySelectorAll('.tabpage').forEach(p=>{
    p.style.display = (p.dataset.tab===name) ? 'block' : 'none';
  });
  document.querySelectorAll('#mainTabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
}
function initTabs(){
  document.querySelectorAll('#mainTabs button').forEach(b=>{ b.onclick=()=>showTab(b.dataset.tab); });
}

function fillSelect(el, entries, selected){
  el.innerHTML='';
  entries.forEach(([val,label])=>{
    const o=document.createElement('option');
    o.value=val; o.textContent=label;
    if(val===selected) o.selected=true;
    el.appendChild(o);
  });
}

// Synchronise tous les contrôles de l'UI avec l'état (utile après applyExercise)
function syncControls(){
  if($('exercise')) $('exercise').value = state.exercise;
  $('root').value = String(state.rootPc);
  $('scale').value = state.scale;
  $('triad').value = state.triad;
  $('tuning').value = state.tuning;
  $('frets').value = String(state.frets);
  $('direction').value = state.direction;
  if($('sound')) $('sound').value = state.sound;
  setBpm(state.bpm);
  $('modeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('active', x.dataset.mode===state.mode));
  $('viewSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('active', x.dataset.view===state.view));
  $('scaleField').style.display = state.mode==='scale' ? 'flex' : 'none';
  $('triadField').style.display = state.mode==='triad' ? 'flex' : 'none';
  $('swLabels').classList.toggle('on', state.showLabels);
  $('swLabelsTxt').textContent = state.showLabels ? 'Notes' : 'Degrés';
  setMetro(state.metronome);
  $('swLoop').classList.toggle('on', state.loop);
  $('swOctave').classList.toggle('on', state.octaveOnly);
}

function initControls(){
  fillSelect($('root'), NOTES.map((n,i)=>[String(i), n + (FLATS[i]!==n? ' / '+FLATS[i]:'')]), String(state.rootPc));
  fillSelect($('scale'), Object.entries(SCALES).map(([k,v])=>[k,v.name]), state.scale);
  fillSelect($('triad'), Object.entries(TRIADS).map(([k,v])=>[k,v.name]), state.triad);
  fillSelect($('tuning'), Object.entries(TUNINGS).map(([k,v])=>[k,v.name]), state.tuning);

  $('root').onchange   = e=>{state.rootPc=+e.target.value; render();};
  $('scale').onchange  = e=>{state.scale=e.target.value; render();};
  $('triad').onchange  = e=>{state.triad=e.target.value; render();};
  $('tuning').onchange = e=>{state.tuning=e.target.value; render();};
  $('frets').onchange  = e=>{state.frets=+e.target.value; render();};

  $('modeSeg').querySelectorAll('button').forEach(b=>{
    b.onclick=()=>{
      state.mode=b.dataset.mode;
      $('modeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
      $('scaleField').style.display = state.mode==='scale'?'flex':'none';
      $('triadField').style.display = state.mode==='triad'?'flex':'none';
      render();
    };
  });

  const swLabels=$('swLabels');
  swLabels.onclick=()=>{state.showLabels=!state.showLabels; swLabels.classList.toggle('on',state.showLabels);
    $('swLabelsTxt').textContent=state.showLabels?'Notes':'Degrés'; render();};

  $('viewSeg').querySelectorAll('button').forEach(b=>{
    b.onclick=()=>{
      state.view=b.dataset.view;
      $('viewSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
      render();
    };
  });

  $('position').onchange = e=>{state.position=+e.target.value; render();};

  // Transport audio (lecteur principal + mini-lecteur de l'onglet Entraînement, synchronisés)
  $('direction').onchange = e=>{state.direction=e.target.value; render();};
  $('sound').onchange = e=>{state.sound=e.target.value;};
  document.querySelectorAll('.js-bpm').forEach(i=>{ i.oninput = e=>setBpm(+e.target.value); });
  document.querySelectorAll('.js-play').forEach(b=>{ b.onclick = ()=>{ playing ? stopPlayback() : startPlayback(); }; });
  document.querySelectorAll('.js-metro').forEach(sw=>{ sw.onclick = ()=>setMetro(!state.metronome); });
  $('swLoop').onclick   = ()=>{state.loop=!state.loop; $('swLoop').classList.toggle('on',state.loop);};
  $('swOctave').onclick = ()=>{state.octaveOnly=!state.octaveOnly; $('swOctave').classList.toggle('on',state.octaveOnly); render();};
}

/* ---- Rendu global ---- */
function render(){
  if(playing) stopPlayback();
  populatePositions();

  const showNeck = state.view==='neck';
  const showForm = state.view==='form' || state.view==='both';
  const showTab  = state.view==='tab'  || state.view==='both';

  // transport disponible dans toutes les vues (le highlight manche marche aussi en vue Manche)
  $('transport').style.display     = 'flex';
  // le sélecteur de position n'a de sens que pour les vues fenêtrées
  $('positionField').style.display = showNeck ? 'none' : 'flex';
  $('fretboardView').style.display = showNeck ? 'block' : 'none';
  $('formView').style.display      = showForm ? 'block' : 'none';
  $('tabView').style.display       = showTab  ? 'block' : 'none';
  $('viewSep').style.display       = (showForm && showTab) ? 'block' : 'none';

  if(showNeck) renderFretboard();
  if(showForm) renderForm();
  if(showTab)  renderTab();
  renderCircle();

  if(typeof updateTrainingUI==='function') updateTrainingUI();
}

/* ---- Démarrage ---- */
initControls();
initTraining();
initQuarters();
initTabs();
syncControls();
render();
