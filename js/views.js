/* =========================================================================
   VUES — manche, position, tablature, cercle, résumé
   (dépend de engine.js, state/$ définis dans app.js, audio.js pour la séquence)
   ========================================================================= */

function currentSelection(){
  const key = state.mode==='triad'?state.triad:state.scale;
  return buildSelection(state.rootPc, state.mode, key);
}

function renderSummary(map,useFlats){
  const entries = Object.entries(map)
    .map(([p,v])=>({p:+p,...v}))
    .sort((a,b)=>a.interval-b.interval);
  let label;
  if(state.mode==='note') label = `Note : <b>${noteName(state.rootPc,useFlats)}</b>`;
  else if(state.mode==='triad') label = `Triade : <b>${noteName(state.rootPc,useFlats)} ${TRIADS[state.triad].name}</b>`;
  else label = `Gamme : <b>${noteName(state.rootPc,useFlats)} ${SCALES[state.scale].name}</b>`;
  let chips = `<span class="chip">${label}</span>`;
  entries.forEach(e=>{
    chips += `<span class="chip">${e.degree} · ${noteName(e.p,useFlats)}</span>`;
  });
  $('summary').innerHTML = chips;
}

/* ---- Manche complet ---- */
function renderFretboard(){
  const {map,useFlats} = currentSelection();
  const strings = TUNINGS[state.tuning].strings; // low -> high
  const nFrets = state.frets;
  const view = strings.slice().reverse(); // corde aiguë en haut

  let html = '<table class="fretboard"><thead><tr><th></th><th class="fb-open"></th>';
  for(let f=1; f<=nFrets; f++) html += `<th class="fb-fretnum">${f}</th>`;
  html += '</tr></thead><tbody>';

  view.forEach(openNote=>{
    html += `<tr><td class="fb-string-name">${noteName(openNote,useFlats)}</td>`;
    for(let f=0; f<=nFrets; f++){
      const np = pc(openNote+f);
      const hit = map[np];
      const open = f===0;
      let inner='';
      if(hit){
        const role = roleOf(hit.interval);
        const txt = state.showLabels ? noteName(openNote+f,useFlats) : hit.degree;
        inner = `<div class="dot ${role}">${txt}</div>`;
      }
      html += `<td class="cell ${open?'openpos':''} ${f===1?'nut':''}">${inner}</td>`;
    }
    html += '</tr>';
  });

  html += `<tr><td></td><td></td>`;
  for(let f=1; f<=nFrets; f++){
    let mark='';
    if(DBL_INLAYS.has(f)) mark='<span></span> <span></span>';
    else if(INLAYS.has(f)) mark='<span></span>';
    html += `<td class="inlay">${mark}</td>`;
  }
  html += '</tr></tbody></table>';

  $('fretboardView').innerHTML = html;
  renderSummary(map,useFlats);
}

/* ---- Position / forme ---- */
// Formule d'intervalles : W = ton, H = demi-ton
function intervalFormula(iv){
  const s=[...iv].sort((a,b)=>a-b);
  const steps=[];
  for(let i=1;i<s.length;i++) steps.push(s[i]-s[i-1]);
  steps.push(12-s[s.length-1]); // retour à l'octave
  const lbl={1:'H',2:'W',3:'W½',4:'2W'};
  return steps.map(x=>lbl[x]||x).join(' – ');
}

function titleText(useFlats){
  if(state.mode==='note')  return noteName(state.rootPc,useFlats);
  if(state.mode==='triad') return noteName(state.rootPc,useFlats)+' '+TRIADS[state.triad].name;
  return noteName(state.rootPc,useFlats)+' '+SCALES[state.scale].name;
}

// Positions disponibles : fondamentale ancrée sur les DEUX cordes les plus graves
function getPositions(){
  const t = TUNINGS[state.tuning];
  const span = 5, maxF = state.frets;
  const nAnchor = Math.min(2, t.strings.length);
  const starts = new Set();
  for(let s=0; s<nAnchor; s++){
    for(let rf=0; rf<=maxF; rf++){
      if(pc(t.strings[s]+rf)===state.rootPc){
        let start = Math.max(0, rf-2);
        start = Math.min(start, Math.max(0, maxF-span));
        starts.add(start);
      }
    }
  }
  const res = [...starts].sort((a,b)=>a-b)
                .map(start=>({start, end:Math.min(maxF, start+span)}));
  if(res.length===0) res.push({start:0, end:Math.min(maxF,span)});
  return res;
}

function populatePositions(){
  const positions=getPositions();
  if(state.position>=positions.length) state.position=0;
  fillSelect($('position'),
    positions.map((p,i)=>[String(i), `Position ${i+1} — cases ${p.start}–${p.end}`]),
    String(state.position));
}

// Octave d'ancrage = de la fondamentale la plus grave présente dans la fenêtre
function anchorOctave(){
  const t = TUNINGS[state.tuning];
  const positions = getPositions();
  const {start,end} = positions[Math.min(state.position, positions.length-1)];
  let lo = Infinity;
  for(let s=0; s<t.strings.length; s++){
    for(let f=start; f<=end; f++){
      if(pc(t.strings[s]+f)===state.rootPc){
        const m = t.midi[s]+f;
        if(m<lo) lo=m;
      }
    }
  }
  if(!isFinite(lo)) lo = t.midi[0]+start;
  return {lo, hi: lo+12};
}

function renderForm(){
  const {map,useFlats} = currentSelection();
  const t = TUNINGS[state.tuning];
  const view = t.strings.map((p,i)=>({pc:p, midi:t.midi[i]})).reverse();
  const positions = getPositions();
  const pos = positions[Math.min(state.position, positions.length-1)];
  const {start,end} = pos;
  const {lo,hi} = anchorOctave();

  let formula='';
  if(state.mode==='scale')      formula = intervalFormula(SCALES[state.scale].iv);
  else if(state.mode==='triad') formula = intervalFormula(TRIADS[state.triad].iv);

  let html = `<div class="form-head"><div class="form-title">${titleText(useFlats)}</div>`;
  if(formula) html += `<div class="form-formula">${formula}</div>`;
  html += `</div>`;

  html += '<div class="fretboard-wrap"><table class="fretboard formboard"><thead><tr><th></th>';
  for(let f=start; f<=end; f++) html += `<th class="fb-fretnum">${f}</th>`;
  html += '</tr></thead><tbody>';

  view.forEach(str=>{
    html += `<tr><td class="fb-string-name">${noteName(str.pc,useFlats)}</td>`;
    for(let f=start; f<=end; f++){
      const np=pc(str.pc+f), hit=map[np]; let inner='';
      if(hit){
        const midi = str.midi+f;
        const txt = state.showLabels ? noteName(str.pc+f,useFlats) : hit.degree;
        const cls = hit.interval===0 ? 'formroot' : 'formdeg';
        const faded = state.octaveOnly && (midi<lo || midi>hi) ? ' faded' : '';
        inner = `<div class="dot ${cls}${faded}">${txt}</div>`;
      }
      html += `<td class="cell ${f===0?'openpos':''}">${inner}</td>`;
    }
    html += '</tr>';
  });

  html += `<tr><td></td>`;
  for(let f=start; f<=end; f++){
    let mark=''; if(DBL_INLAYS.has(f)) mark='<span></span> <span></span>';
    else if(INLAYS.has(f)) mark='<span></span>';
    html += `<td class="inlay">${mark}</td>`;
  }
  html += '</tr></tbody></table></div>';

  $('formView').innerHTML = html;
  renderSummary(map,useFlats);
}

/* ---- Tablature ---- */
function renderTab(){
  const sel = currentSelection();
  const map = sel.map;
  const strings = TUNINGS[state.tuning].strings;
  const nS = strings.length;
  const seq = directedSequence(); // défini dans audio.js
  const hasDeg = seq.some(n=>n.degree!=null); // degrés fournis par les exercices Odds/Evens

  const mL=44, mR=26, mT=24, mB=hasDeg?44:24, gap=26, dx=48;
  const W = mL + mR + Math.max(1, seq.length-1)*dx;
  const H = mT + mB + (nS-1)*gap;
  const yOf = s => mT + (nS-1-s)*gap;

  let svg = `<svg class="tabsvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMinYMin meet">`;
  for(let s=0; s<nS; s++){
    const y=yOf(s);
    svg += `<line x1="${mL-10}" y1="${y}" x2="${W-8}" y2="${y}" stroke="#9aa6b6" stroke-width="1"/>`;
    svg += `<text x="8" y="${y+4}" fill="#93a0b4" font-size="12" font-family="ui-monospace,monospace">${noteName(strings[s])}</text>`;
  }
  svg += `<line x1="${mL-10}" y1="${yOf(nS-1)}" x2="${mL-10}" y2="${yOf(0)}" stroke="#9aa6b6" stroke-width="1.5"/>`;

  seq.forEach((n,i)=>{
    const x = mL + i*dx, y = yOf(n.s), txt = String(n.f);
    const w = 8 + txt.length*8;
    svg += `<g class="tabnote" data-i="${i}">`;
    svg += `<rect x="${x-w/2}" y="${y-9}" width="${w}" height="18" fill="var(--panel2)"/>`;
    svg += `<text x="${x}" y="${y+5}" text-anchor="middle" fill="#e7ecf3" font-size="14" font-family="ui-monospace,monospace" font-weight="600">${txt}</text>`;
    svg += `</g>`;
  });

  // Rangée des degrés sous la tablature (exercices Odds/Evens)
  if(hasDeg){
    const yd = yOf(0) + 30;
    svg += `<line x1="${mL-10}" y1="${yd-16}" x2="${W-8}" y2="${yd-16}" stroke="#2a3140" stroke-width="1"/>`;
    svg += `<text x="8" y="${yd}" fill="#93a0b4" font-size="11" font-family="ui-monospace,monospace">deg</text>`;
    seq.forEach((n,i)=>{
      if(n.degree==null) return;
      const x = mL + i*dx;
      svg += `<text x="${x}" y="${yd}" text-anchor="middle" fill="#4cc2ff" font-size="12" font-weight="700" font-family="ui-monospace,monospace">${n.degree}</text>`;
    });
  }
  svg += `</svg>`;

  $('tabView').innerHTML = `<div class="tab-scroll">${svg}</div>`;
  renderSummary(map, sel.useFlats);
}

/* ---- Cercle des quintes ---- */
function renderCircle(){
  const svg=$('circle');
  const cx=160,cy=160,rOut=150,rIn=92;
  const N=12, step=2*Math.PI/N;
  let paths='', labels='';
  for(let i=0;i<N;i++){
    const p = CIRCLE_ORDER[i];
    const a0 = -Math.PI/2 + (i-0.5)*step;
    const a1 = -Math.PI/2 + (i+0.5)*step;
    const x0o=cx+rOut*Math.cos(a0), y0o=cy+rOut*Math.sin(a0);
    const x1o=cx+rOut*Math.cos(a1), y1o=cy+rOut*Math.sin(a1);
    const x0i=cx+rIn*Math.cos(a0), y0i=cy+rIn*Math.sin(a0);
    const x1i=cx+rIn*Math.cos(a1), y1i=cy+rIn*Math.sin(a1);
    const isRoot = p===state.rootPc;
    const inSel = !!currentSelection().map[p];
    let fill = '#1f242e';
    if(isRoot) fill='#ff5c7a';
    else if(inSel) fill='#2f6f4f';
    paths += `<path class="seg-path" data-pc="${p}" d="M${x0o},${y0o} A${rOut},${rOut} 0 0 1 ${x1o},${y1o} L${x1i},${y1i} A${rIn},${rIn} 0 0 0 ${x0i},${y0i} Z" fill="${fill}" stroke="#0f1115" stroke-width="2"/>`;
    const am = -Math.PI/2 + i*step;
    const rl=(rOut+rIn)/2;
    const lx=cx+rl*Math.cos(am), ly=cy+rl*Math.sin(am)+4;
    const useFlats = ['F','Bb','Eb','Ab','Db','Gb'].includes(NOTES[p]) && p!==6;
    labels += `<text data-pc="${p}" x="${lx}" y="${ly}" text-anchor="middle" fill="${isRoot?'#fff':'#e7ecf3'}">${noteName(p,useFlats)}</text>`;
  }
  labels += `<text x="${cx}" y="${cy-4}" text-anchor="middle" fill="#93a0b4" style="font-size:11px">quintes ↻</text>`;
  labels += `<text x="${cx}" y="${cy+12}" text-anchor="middle" fill="#93a0b4" style="font-size:11px">quartes ↺</text>`;
  svg.innerHTML = paths+labels;
  svg.querySelectorAll('[data-pc]').forEach(el=>{
    el.style.cursor='pointer';
    el.onclick=()=>{state.rootPc=+el.dataset.pc; $('root').value=String(state.rootPc); render();};
  });

  const fifth = pc(state.rootPc+7), fourth = pc(state.rootPc+5);
  const rel = pc(state.rootPc-3);
  $('circleDetail').innerHTML =
    `<div class="chips">
       <span class="chip">Tonique : <b>${noteName(state.rootPc)}</b></span>
       <span class="chip">Quinte (V) : <b>${noteName(fifth)}</b></span>
       <span class="chip">Quarte (IV) : <b>${noteName(fourth)}</b></span>
       <span class="chip">Rel. mineure : <b>${noteName(rel)}m</b></span>
     </div>`;
}
