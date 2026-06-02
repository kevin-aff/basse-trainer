/* =========================================================================
   EXERCICES & ENTRAÎNEMENT
   Un exercice = un préréglage (gamme/triade, octave, sens, affichage)
   appliqué à la sélection courante, + validation manuelle du tempo.
   ========================================================================= */
const EXERCISES = {
  scale_oct_updown: {
    name:'Gamme — 1 octave (aller-retour)',
    mode:'scale', octaveOnly:true, direction:'updown', view:'both',
    desc:'Joue la gamme sur une octave (1→8→1) en suivant le métronome. Quand tu la joues proprement, valide le tempo.'
  },
  scale_oct_up: {
    name:'Gamme — 1 octave (montée)',
    mode:'scale', octaveOnly:true, direction:'up', view:'both',
    desc:'Joue la gamme en montant sur une octave (1→8), bien en place avec le métronome.'
  },
  scale_oct_down: {
    name:'Gamme — 1 octave (descente)',
    mode:'scale', octaveOnly:true, direction:'down', view:'both',
    desc:'Joue la gamme en descendant sur une octave (8→1).'
  },
  scale_full: {
    name:'Gamme — position complète (aller-retour)',
    mode:'scale', octaveOnly:false, direction:'updown', view:'both',
    desc:'Joue toutes les notes de la gamme présentes dans la position, en montant puis en descendant.'
  },
  triad_arp: {
    name:'Arpège de triade (aller-retour)',
    mode:'triad', octaveOnly:true, direction:'updown', view:'both',
    desc:'Joue l’arpège de la triade (1 3 5 8) en montant puis en descendant.'
  },
  odds_evens: {
    name:'Odds & Evens — impairs → pairs',
    mode:'scale', view:'tab', octaveOnly:false, direction:'updown', loop:true, pattern:'oddsEvens',
    desc:'Parcours la gamme par degrés impairs en montant (1·3·5·7·9·11) puis par degrés pairs en descendant (10·8·6·4·2), avec un passage sur la sensible (ex. Gb) avant de relancer la boucle sur la fondamentale. Démarre sur la corde grave et traverse toutes les cordes (≈2 octaves). Fonctionne aussi sur les gammes mineures (la sensible s’adapte). Active la boucle et le métronome, puis valide ton meilleur tempo.'
  },
  evens_odds: {
    name:'Evens & Odds — pairs → impairs',
    mode:'scale', view:'tab', octaveOnly:false, direction:'updown', loop:true, pattern:'evensOdds',
    desc:'Le sens inverse : degrés pairs en montant (2·4·6·8·10) puis degrés impairs en descendant (11·9·7·5·3·1), résolution naturelle sur la fondamentale en fin de boucle. Démarre sur la corde grave et traverse toutes les cordes (≈2 octaves). Fonctionne aussi sur les gammes mineures.'
  },
};

const DIR_LABEL = {up:'Montée', down:'Descente', updown:'Aller-retour'};
function dirLabel(d){ return DIR_LABEL[d] || d; }

// Applique un exercice à la sélection courante
function applyExercise(key){
  const ex = EXERCISES[key];
  if(!ex) return;
  state.exercise = key;
  state.pattern = ex.pattern || null;
  if(ex.mode)               state.mode = ex.mode;
  if('octaveOnly' in ex)    state.octaveOnly = ex.octaveOnly;
  if(ex.direction)          state.direction = ex.direction;
  if('loop' in ex)          state.loop = ex.loop;
  if(ex.view)               state.view = ex.view;
  syncControls();
  render();                 // render() appelle updateTrainingUI()
  $('exerciseDesc').textContent = ex.desc;
}

// Clé unique de suivi pour la configuration en cours
function currentRecordKey(){
  const sel = state.mode==='triad' ? ('triad:'+state.triad) : ('scale:'+state.scale);
  return [state.exercise, sel, 'r'+state.rootPc, 'p'+state.position, state.direction].join('|');
}
function currentRecordLabel(){
  const selName = state.mode==='triad' ? TRIADS[state.triad].name : SCALES[state.scale].name;
  const exName  = (EXERCISES[state.exercise]||{}).name || state.exercise;
  return `${noteName(state.rootPc)} ${selName} · ${exName} · Pos.${state.position+1} · ${dirLabel(state.direction)}`;
}

// Met à jour l'affichage du bloc entraînement (record courant + bouton + dashboard)
function updateTrainingUI(){
  if(!$('validateBpm')) return; // panneau pas encore présent
  $('validateBpm').textContent = state.bpm;
  const key = currentRecordKey();
  const r = getRecord(key);
  const target = +$('target').value || 120;
  if(r){
    const reached = r.best >= target;
    $('recordInfo').innerHTML =
      `Config : <b>${currentRecordLabel()}</b><br>` +
      `Meilleur tempo validé : <b>${r.best} BPM</b> · Objectif ${target} BPM · ` +
      `${r.attempts} validation(s)` + (reached ? ' · 🎯 objectif atteint' : '');
  } else {
    $('recordInfo').innerHTML =
      `Config : <b>${currentRecordLabel()}</b><br>` +
      `Aucune validation pour cette configuration. Objectif ${target} BPM.`;
  }
  renderDashboard();
}

// Câblage des contrôles d'entraînement (appelé depuis app.js)
function initTraining(){
  fillSelect($('exercise'),
    Object.entries(EXERCISES).map(([k,v])=>[k,v.name]),
    state.exercise);
  $('exerciseDesc').textContent = (EXERCISES[state.exercise]||{}).desc || '';

  $('exercise').onchange = e=>applyExercise(e.target.value);
  $('loadExercise').onclick = ()=>applyExercise($('exercise').value);
  $('target').onchange = ()=>updateTrainingUI();

  $('validateBtn').onclick = ()=>{
    const key = currentRecordKey();
    const target = +$('target').value || 120;
    recordValidation(key, currentRecordLabel(), state.bpm, target);
    const btn = $('validateBtn');
    btn.classList.remove('flash'); void btn.offsetWidth; btn.classList.add('flash');
    updateTrainingUI();
  };
}
