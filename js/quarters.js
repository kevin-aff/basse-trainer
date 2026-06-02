/* =========================================================================
   CERCLE DES QUARTES — mémorisation notes / triades
   Deux modes :
   - play  : play-along, l'arpège de triade de chaque accord défile autour
             du cercle des quartes, dans une zone de cases réglable.
   - guided: tu touches la fondamentale, la tierce puis la quinte de chaque
             accord (rappel actif), avec score et chrono.
   ========================================================================= */

// Ordre du cercle des quartes (chaque accord = +1 quarte = +5 demi-tons)
const CIRCLE4       = [0,5,10,3,8,1,6,11,4,9,2,7];
const CIRCLE4_NAMES = ['C','F','B♭','E♭','A♭','D♭','G♭','B','E','A','D','G'];
const CIRCLE4_FLAT  = [false,false,true,true,true,true,true,false,false,false,false,false];

const QZONES = [[0,5],[2,7],[5,9],[7,12],[9,14],[12,17]];
const QSTEP_LABEL = ['fondamentale','tierce','quinte'];

const qstate = {
  mode:'play',           // 'play' | 'guided'
  quality:'major',
  zoneLo:0, zoneHi:5,
  idx:0,                 // index dans CIRCLE4
  bpm:80, metro:true, autoAdvance:true,
  running:false,
  // guided
  guidedStep:0,
  foundSet:new Set(),
  errors:0, doneCount:0, startTime:null,
};
let qTimers=[];

function triadPcs(rootPc){
  const iv = qstate.quality==='minor' ? [0,3,7] : [0,4,7];
  return iv.map(i=>pc(rootPc+i));
}
function qCurrentRoot(){ return CIRCLE4[qstate.idx]; }
function qUseFlats(){ return CIRCLE4_FLAT[qstate.idx]; }

// Positions de la triade dans la zone, triées par hauteur
function qTriadPositions(){
  const t = TUNINGS[state.tuning];
  const pcs = triadPcs(qCurrentRoot());
  const pos = [];
  for(let s=0; s<t.strings.length; s++){
    for(let f=qstate.zoneLo; f<=qstate.zoneHi; f++){
      const role = pcs.indexOf(pc(t.strings[s]+f));
      if(role>=0) pos.push({s, f, midi:t.midi[s]+f, role});
    }
  }
  pos.sort((a,b)=>a.midi-b.midi);
  return pos;
}

/* ---------- Rendu ---------- */
function qHighlight(n){
  document.querySelectorAll('#qBoard .dot.lit').forEach(e=>e.classList.remove('lit'));
  if(n){
    const d = document.querySelector(`#qBoard .dot[data-s="${n.s}"][data-f="${n.f}"]`);
    if(d) d.classList.add('lit');
  }
}

function renderQBoard(){
  const t = TUNINGS[state.tuning];
  const lo=qstate.zoneLo, hi=qstate.zoneHi;
  const view = t.strings.map((p,i)=>({pc:p, midi:t.midi[i], s:i})).reverse();
  const pcs = triadPcs(qCurrentRoot());
  const useFlats = qUseFlats();
  const roleCls = ['root','third','fifth'];

  let html = '<div class="fretboard-wrap"><table class="fretboard formboard"><thead><tr><th></th>';
  for(let f=lo; f<=hi; f++) html += `<th class="fb-fretnum">${f}</th>`;
  html += '</tr></thead><tbody>';

  view.forEach(str=>{
    html += `<tr><td class="fb-string-name">${noteName(str.pc,useFlats)}</td>`;
    for(let f=lo; f<=hi; f++){
      const role = pcs.indexOf(pc(str.pc+f));
      let inner='';
      if(qstate.mode==='play'){
        if(role>=0)
          inner = `<div class="dot ${roleCls[role]}" data-s="${str.s}" data-f="${f}">${noteName(str.pc+f,useFlats)}</div>`;
      } else { // guided
        if(qstate.foundSet.has(str.s+'-'+f) && role>=0)
          inner = `<div class="dot ${roleCls[role]}" data-s="${str.s}" data-f="${f}">${noteName(str.pc+f,useFlats)}</div>`;
        else
          inner = `<div class="dot qblank" data-s="${str.s}" data-f="${f}"></div>`;
      }
      html += `<td class="cell ${f===0?'openpos':''}">${inner}</td>`;
    }
    html += '</tr>';
  });

  html += `<tr><td></td>`;
  for(let f=lo; f<=hi; f++){
    let m=''; if(DBL_INLAYS.has(f)) m='<span></span> <span></span>'; else if(INLAYS.has(f)) m='<span></span>';
    html += `<td class="inlay">${m}</td>`;
  }
  html += '</tr></tbody></table></div>';
  $('qBoard').innerHTML = html;

  if(qstate.mode==='guided'){
    $('qBoard').querySelectorAll('.dot.qblank').forEach(d=>{
      d.onclick = ()=>onQTap(+d.dataset.s, +d.dataset.f);
    });
  }
}

function updateQHead(){
  $('qProg').textContent = `${qstate.idx+1} / 12`;
  $('qChord').textContent = CIRCLE4_NAMES[qstate.idx] + (qstate.quality==='minor'?'m':'');
  if(qstate.mode==='guided'){
    const wantPc = triadPcs(qCurrentRoot())[qstate.guidedStep];
    $('qPrompt').textContent = `Touche la ${QSTEP_LABEL[qstate.guidedStep]} (${noteName(wantPc,qUseFlats())})`;
    $('qStats').textContent = `Accords : ${qstate.doneCount}/12 · Erreurs : ${qstate.errors}`;
  } else {
    $('qPrompt').textContent = 'Arpège de la triade (monte puis descend)';
    $('qStats').textContent = '';
  }
}

function renderQuarter(){
  updateQHead();
  renderQBoard();
}

function updateQStart(){
  const b=$('qStart');
  if(qstate.mode==='play') b.textContent = qstate.running ? '⏹ Stop' : '▶ Démarrer';
  else b.textContent = qstate.running ? '↻ Recommencer' : '▶ Démarrer';
  b.classList.toggle('playing', qstate.running);
}

/* ---------- Mode play-along ---------- */
function qSchedule(){
  const pos = qTriadPositions();
  if(pos.length===0){ qstate.idx=(qstate.idx+1)%12; renderQuarter(); if(qstate.running) qSchedule(); return; }
  const up = pos, down = pos.slice(0,-1).reverse();
  const seq = up.concat(down);
  const spb = 60/qstate.bpm;
  const t0 = audioCtx.currentTime + 0.12;
  seq.forEach((n,i)=>{
    const tt = t0 + i*spb;
    playNote(tt, midiToFreq(n.midi));
    if(qstate.metro) playClick(tt, i===0);
    qTimers.push(setTimeout(()=>qHighlight(n), Math.max(0,(tt-audioCtx.currentTime)*1000)));
  });
  const endMs = (t0 + seq.length*spb - audioCtx.currentTime)*1000;
  qTimers.push(setTimeout(()=>{
    qHighlight(null);
    if(!qstate.running) return;
    if(qstate.autoAdvance){ qstate.idx=(qstate.idx+1)%12; renderQuarter(); qSchedule(); }
    else qStopPlay();
  }, Math.max(0,endMs)));
}
function qStartPlay(){
  ensureCtx(); audioCtx.resume();
  qstate.running=true; updateQStart();
  qSchedule();
}
function qStopPlay(){
  qstate.running=false;
  qTimers.forEach(clearTimeout); qTimers=[];
  cutVoices(); qHighlight(null);
  updateQStart();
}

/* ---------- Mode guidé (toucher) ---------- */
function qStartGuided(){
  qstate.running=true;
  qstate.idx=0; qstate.guidedStep=0; qstate.foundSet.clear();
  qstate.errors=0; qstate.doneCount=0; qstate.startTime=Date.now();
  updateQStart(); renderQuarter();
}
function onQTap(s,f){
  if(!qstate.running) return;
  ensureCtx(); audioCtx.resume();
  const t = TUNINGS[state.tuning];
  const pcs = triadPcs(qCurrentRoot());
  const tappedPc = pc(t.strings[s]+f);
  const wantPc = pcs[qstate.guidedStep];
  if(tappedPc===wantPc){
    qstate.foundSet.add(s+'-'+f);
    playNote(audioCtx.currentTime+0.01, midiToFreq(t.midi[s]+f));
    qstate.guidedStep++;
    renderQBoard();
    if(qstate.guidedStep>2){
      qstate.doneCount++; updateQHead();
      setTimeout(()=>{
        if(qstate.doneCount>=12){ qFinishGuided(); return; }
        qstate.idx=(qstate.idx+1)%12; qstate.guidedStep=0; qstate.foundSet.clear();
        renderQuarter();
      }, 480);
    } else updateQHead();
  } else {
    qstate.errors++; flashWrong(s,f); updateQHead();
  }
}
function flashWrong(s,f){
  const d = document.querySelector(`#qBoard .dot[data-s="${s}"][data-f="${f}"]`);
  if(d){ d.classList.add('qwrong'); setTimeout(()=>d.classList.remove('qwrong'),400); }
}
function qReveal(){
  const wantPc = triadPcs(qCurrentRoot())[qstate.guidedStep];
  const t = TUNINGS[state.tuning];
  document.querySelectorAll('#qBoard .dot.qblank').forEach(d=>{
    const s=+d.dataset.s, f=+d.dataset.f;
    if(pc(t.strings[s]+f)===wantPc){ d.classList.add('lit'); setTimeout(()=>d.classList.remove('lit'),900); }
  });
}
function qFinishGuided(){
  qstate.running=false; updateQStart();
  const secs = Math.round((Date.now()-qstate.startTime)/1000);
  const best = qLoadBest(); const key=qstate.quality; const prev=best[key];
  let rec='';
  if(!prev || secs<prev.time || (secs===prev.time && qstate.errors<prev.errors)){
    best[key] = {time:secs, errors:qstate.errors, date:Date.now()};
    qSaveBest(best); rec=' 🏅 nouveau record !';
  }
  $('qChord').textContent='Terminé !';
  $('qProg').textContent='12 / 12';
  $('qPrompt').textContent = `Tour complet en ${secs}s · ${qstate.errors} erreur(s)${rec}`;
  $('qStats').textContent = qBestText();
}
function qLoadBest(){ try{ return JSON.parse(localStorage.getItem('bt_quarters_v1'))||{}; }catch(e){ return {}; } }
function qSaveBest(o){ try{ localStorage.setItem('bt_quarters_v1', JSON.stringify(o)); }catch(e){} }
function qBestText(){
  const b=qLoadBest()[qstate.quality];
  return b ? `Record (${qstate.quality==='minor'?'min':'maj'}) : ${b.time}s · ${b.errors} erreur(s)` : '';
}

/* ---------- Commandes ---------- */
function qToggleStart(){
  if(qstate.mode==='play'){ qstate.running ? qStopPlay() : qStartPlay(); }
  else { qStartGuided(); }
}
function qStopAll(){ if(qstate.mode==='play') qStopPlay(); else { qstate.running=false; updateQStart(); } }
function qGo(delta){
  qStopAll();
  qstate.idx = (qstate.idx + delta + 12) % 12;
  qstate.guidedStep=0; qstate.foundSet.clear();
  renderQuarter();
}

function qSetMode(m){
  qStopAll();
  qstate.mode = m;
  qstate.guidedStep=0; qstate.foundSet.clear();
  $('qModeSeg').querySelectorAll('button').forEach(b=>b.classList.toggle('active', b.dataset.qmode===m));
  const play = m==='play';
  $('qTempoField').style.display = play ? 'flex' : 'none';
  $('qMetroToggle').style.display = play ? 'flex' : 'none';
  $('qAutoToggle').style.display = play ? 'flex' : 'none';
  $('qReveal').style.display = play ? 'none' : 'inline-block';
  $('qStats').textContent = play ? '' : qBestText();
  renderQuarter();
}

function initQuarters(){
  // zones compatibles avec le nombre de cases
  const zones = QZONES.filter(z=>z[1]<=Math.max(5,state.frets));
  fillSelect($('qZone'), zones.map((z,i)=>[String(i), `cases ${z[0]}–${z[1]}`]), '0');
  qstate.zoneLo=zones[0][0]; qstate.zoneHi=zones[0][1];

  $('qModeSeg').querySelectorAll('button').forEach(b=>{ b.onclick=()=>qSetMode(b.dataset.qmode); });
  $('qQuality').onchange = e=>{ qStopAll(); qstate.quality=e.target.value; renderQuarter(); if(qstate.mode==='guided') $('qStats').textContent=qBestText(); };
  $('qZone').onchange = e=>{ qStopAll(); const z=zones[+e.target.value]; qstate.zoneLo=z[0]; qstate.zoneHi=z[1]; renderQuarter(); };
  $('qBpm').oninput = e=>{ qstate.bpm=+e.target.value; $('qBpmVal').textContent=qstate.bpm; };
  $('qMetro').onclick = ()=>{ qstate.metro=!qstate.metro; $('qMetro').classList.toggle('on',qstate.metro); };
  $('qAuto').onclick  = ()=>{ qstate.autoAdvance=!qstate.autoAdvance; $('qAuto').classList.toggle('on',qstate.autoAdvance); };
  $('qStart').onclick = qToggleStart;
  $('qPrev').onclick  = ()=>qGo(-1);
  $('qNext').onclick  = ()=>qGo(1);
  $('qReveal').onclick = qReveal;

  qSetMode('play');
}
