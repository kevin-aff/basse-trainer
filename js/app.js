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
  $('bpm').value = state.bpm;
  $('bpmVal').textContent = state.bpm;
  $('modeSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('active', x.dataset.mode===state.mode));
  $('viewSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('active', x.dataset.view===state.view));
  $('scaleField').style.display = state.mode==='scale' ? 'flex' : 'none';
  $('triadField').style.display = state.mode==='triad' ? 'flex' : 'none';
  $('swLabels').classList.toggle('on', state.showLabels);
  $('swLabelsTxt').textContent = state.showLabels ? 'Notes' : 'Degrés';
  $('swMetro').classList.toggle('on', state.metronome);
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

  // Transport audio
  $('direction').onchange = e=>{state.direction=e.target.value; render();};
  $('sound').onchange = e=>{state.sound=e.target.value;};
  $('bpm').oninput = e=>{
    state.bpm=+e.target.value; $('bpmVal').textContent=state.bpm;
    if($('validateBpm')) $('validateBpm').textContent=state.bpm;
  };
  $('playBtn').onclick = ()=>{ playing ? stopPlayback() : startPlayback(); };
  $('swMetro').onclick  = ()=>{state.metronome=!state.metronome; $('swMetro').classList.toggle('on',state.metronome);};
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
syncControls();
render();
