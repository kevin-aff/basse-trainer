/* =========================================================================
   SÉQUENCE & AUDIO (Web Audio API)
   ========================================================================= */

// Séquence ascendante de la position courante : {s, f, midi}
function buildSequence(){
  const t = TUNINGS[state.tuning];
  const map = currentSelection().map;
  const positions = getPositions();
  const {start,end} = positions[Math.min(state.position, positions.length-1)];
  const seq=[];
  for(let s=0; s<t.strings.length; s++){
    for(let f=start; f<=end; f++){
      if(map[pc(t.strings[s]+f)]!==undefined) seq.push({s, f, midi:t.midi[s]+f});
    }
  }
  if(state.octaveOnly){
    const {lo,hi}=anchorOctave(), seen=new Set();
    return seq
      .filter(n=>{
        if(n.midi<lo || n.midi>hi || seen.has(n.midi)) return false;
        seen.add(n.midi); return true;
      })
      .sort((a,b)=>a.midi-b.midi);
  }
  return seq;
}

/* Motifs « Odds & Evens » :
   - oddsEvens : impairs montants (1·3·5·7·9·11), pairs descendants (10·8·6·4·2),
     puis la sensible (un demi-ton/ton sous la fondamentale) avant de reboucler sur 1.
   - evensOdds : pairs montants (2·4·6·8·10), impairs descendants (11·9·7·5·3·1),
     puis reboucle sur 2 (résolution naturelle sur la fondamentale en fin de boucle).
   Démarre sur la corde la plus grave et traverse toutes les cordes (~2 octaves). */
const PATTERNS = {
  oddsEvens: { degs:[1,3,5,7,9,11, 10,8,6,4,2], leadingTail:true  },
  evensOdds: { degs:[2,4,6,8,10, 11,9,7,5,3,1], leadingTail:false },
};

function patternSequence(kind){
  const def = PATTERNS[kind] || PATTERNS.oddsEvens;
  const t = TUNINGS[state.tuning];
  const sc = SCALES[state.scale] || SCALES.major;
  const iv = sc.iv, n = iv.length;
  const maxF = state.frets;

  // fondamentale sur la corde la plus grave, position basse (0..11)
  const R = pc(state.rootPc - t.strings[0]);
  const rootMidi = t.midi[0] + R;

  // demi-tons d'un degré (1-indexé), avec gestion des octaves
  const degSemi = d=>{
    const k=d-1, oct=Math.floor(k/n), idx=((k%n)+n)%n;
    return iv[idx] + 12*oct;
  };

  const items = def.degs.map(d=>({off:degSemi(d), label:String(d)}));
  if(def.leadingTail) items.push({off: iv[n-1]-12, label:'sb'}); // sensible sous la fondamentale

  const lo = Math.max(0, R-1), hi = Math.min(maxF, Math.max(0,R-1)+5); // fenêtre ~6 cases
  const seq=[];
  items.forEach(it=>{
    const midi = rootMidi + it.off;
    let pick=null;
    // priorité aux cordes aiguës qui tombent dans la fenêtre -> forme compacte
    for(let s=t.strings.length-1; s>=0; s--){
      const f = midi - t.midi[s];
      if(f>=lo && f<=hi){ pick={s,f}; break; }
    }
    if(!pick){ // repli : case jouable la plus proche de la fondamentale
      let bestCost=Infinity;
      for(let s=0; s<t.strings.length; s++){
        const f = midi - t.midi[s];
        if(f>=0 && f<=maxF){ const c=Math.abs(f-R); if(c<bestCost){bestCost=c; pick={s,f};} }
      }
    }
    if(pick) seq.push({s:pick.s, f:pick.f, midi, degree:it.label});
  });
  return seq;
}

// Applique le sens de lecture (ou un motif d'exercice spécifique)
function directedSequence(){
  if(state.pattern && PATTERNS[state.pattern]) return patternSequence(state.pattern);
  const up = buildSequence();
  if(state.direction==='down')   return up.slice().reverse();
  if(state.direction==='updown') return up.concat(up.slice().reverse().slice(1));
  return up;
}

let audioCtx=null, playTimers=[], playing=false;
function ensureCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
}
const midiToFreq = m => 440*Math.pow(2,(m-69)/12);

function playNote(time, freq){
  const ctx=audioCtx;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type='triangle'; o.frequency.value=freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.4, time+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, time+0.5);
  o.connect(g).connect(ctx.destination);
  o.start(time); o.stop(time+0.55);
}
function playClick(time, accent){
  const ctx=audioCtx;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type='square'; o.frequency.value = accent?2000:1300;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(accent?0.25:0.15, time+0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, time+0.05);
  o.connect(g).connect(ctx.destination);
  o.start(time); o.stop(time+0.06);
}
function highlightNote(i){
  document.querySelectorAll('.tabsvg .tabnote.on').forEach(e=>e.classList.remove('on'));
  if(i>=0){
    const el=document.querySelector(`.tabsvg .tabnote[data-i="${i}"]`);
    if(el) el.classList.add('on');
  }
}
function updatePlayBtn(){
  const b=$('playBtn');
  b.textContent = playing ? '⏹ Stop' : '▶ Lecture';
  b.classList.toggle('playing', playing);
}
function scheduleRun(seq, t0, spb){
  seq.forEach((n,i)=>{
    const t = t0 + i*spb;
    playNote(t, midiToFreq(n.midi));
    if(state.metronome) playClick(t, i===0);
    const delayMs = (t - audioCtx.currentTime)*1000;
    playTimers.push(setTimeout(()=>highlightNote(i), Math.max(0, delayMs)));
  });
  const endMs = (t0 + seq.length*spb - audioCtx.currentTime)*1000;
  playTimers.push(setTimeout(()=>{
    if(state.loop && playing){ scheduleRun(seq, audioCtx.currentTime+0.03, spb); }
    else { stopPlayback(); }
  }, Math.max(0, endMs)));
}
function startPlayback(){
  if(playing) return;
  const seq = directedSequence();
  if(seq.length===0) return;
  ensureCtx(); audioCtx.resume();
  playing=true; updatePlayBtn();
  scheduleRun(seq, audioCtx.currentTime+0.12, 60/state.bpm); // 1 note par temps
}
function stopPlayback(){
  playing=false;
  playTimers.forEach(clearTimeout); playTimers=[];
  highlightNote(-1);
  updatePlayBtn();
}
