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

let audioCtx=null, master=null, playTimers=[], playing=false;
let activeVoices=[];   // voix audio en cours, pour pouvoir tout couper net
const ksCache = {};

// Garde une référence sur une voix et l'auto-nettoie quand elle se termine
function trackVoice(node, gain){
  const v={node, gain};
  activeVoices.push(v);
  node.onended = ()=>{ const i=activeVoices.indexOf(v); if(i>=0) activeVoices.splice(i,1); };
}

function ensureCtx(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    // bus principal : compresseur pour éviter la saturation quand les notes se chevauchent
    master = audioCtx.createDynamicsCompressor();
    master.threshold.value=-14; master.ratio.value=4;
    master.attack.value=0.003; master.release.value=0.2;
    master.connect(audioCtx.destination);
  }
  return audioCtx;
}
const midiToFreq = m => 440*Math.pow(2,(m-69)/12);

/* --- Voix de basse réaliste : corde pincée (Karplus–Strong) ---
   Bruit filtré injecté dans une ligne de retard amortie -> son de corde.
   Le buffer est mis en cache par hauteur pour rester performant. */
function ksBuffer(freq){
  const sr = audioCtx.sampleRate;
  const key = Math.round(freq*4);
  if(ksCache[key]) return ksCache[key];
  const N = Math.max(2, Math.round(sr/freq));
  const dur = 1.3, total = Math.floor(sr*dur);
  const buf = audioCtx.createBuffer(1, total, sr);
  const out = buf.getChannelData(0);
  const line = new Float32Array(N);
  let lp = 0;
  for(let i=0;i<N;i++){ const w=Math.random()*2-1; lp=0.6*lp+0.4*w; line[i]=lp; } // excitation adoucie
  const R = 0.9955; // amortissement de la corde (sustain)
  let ptr=0;
  for(let i=0;i<total;i++){
    out[i] = line[ptr];
    line[ptr] = (line[ptr] + line[(ptr+1)%N]) * 0.5 * R; // moyenne = filtre passe-bas + perte
    ptr = (ptr+1)%N;
  }
  ksCache[key] = buf;
  return buf;
}
function playBassNote(time, freq){
  const src = audioCtx.createBufferSource();
  src.buffer = ksBuffer(freq);
  const lp = audioCtx.createBiquadFilter();
  lp.type='lowpass'; lp.frequency.value=Math.min(2600, freq*7); lp.Q.value=0.6;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.85, time+0.006); // attaque rapide (pincé)
  g.gain.exponentialRampToValueAtTime(0.0001, time+1.0); // extinction naturelle
  src.connect(lp).connect(g).connect(master);
  trackVoice(src, g);
  src.start(time); src.stop(time+1.05);
}
function playSynthNote(time, freq){
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type='triangle'; o.frequency.value=freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.4, time+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, time+0.5);
  o.connect(g).connect(master);
  trackVoice(o, g);
  o.start(time); o.stop(time+0.55);
}
function playNote(time, freq){
  if(state.sound==='none') return;        // notes coupées (le métronome reste géré à part)
  if(state.sound==='synth') playSynthNote(time, freq);
  else playBassNote(time, freq);
}
function playClick(time, accent){
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type='square'; o.frequency.value = accent?2000:1300;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(accent?0.25:0.15, time+0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, time+0.05);
  o.connect(g).connect(master);
  trackVoice(o, g);
  o.start(time); o.stop(time+0.06);
}
let currentPlaySeq = [];   // séquence en cours de lecture (pour le highlight manche)

function highlightNote(i){
  // tablature
  document.querySelectorAll('.tabsvg .tabnote.on').forEach(e=>e.classList.remove('on'));
  // manche (formes + manche complet)
  document.querySelectorAll('.dot.lit').forEach(e=>e.classList.remove('lit'));
  if(i<0) return;
  const el=document.querySelector(`.tabsvg .tabnote[data-i="${i}"]`);
  if(el) el.classList.add('on');
  const n = currentPlaySeq[i];
  if(n){
    document.querySelectorAll(`.dot[data-s="${n.s}"][data-f="${n.f}"]`)
      .forEach(d=>d.classList.add('lit'));
  }
}
function updatePlayBtn(){
  document.querySelectorAll('.js-play').forEach(b=>{
    b.textContent = playing ? '⏹ Stop' : '▶ Lecture';
    b.classList.toggle('playing', playing);
  });
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
  currentPlaySeq = seq;
  ensureCtx(); audioCtx.resume();
  playing=true; updatePlayBtn();
  scheduleRun(seq, audioCtx.currentTime+0.12, 60/state.bpm); // 1 note par temps
}
// Coupe net toutes les voix en cours ou programmées (micro-fondu anti-clic)
function cutVoices(){
  if(!audioCtx) return;
  const now = audioCtx.currentTime;
  activeVoices.slice().forEach(v=>{
    try{
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0.0001, now, 0.008); // ~25 ms
      v.node.stop(now+0.04);
    }catch(e){}
  });
  activeVoices=[];
}
function stopPlayback(){
  playing=false;
  playTimers.forEach(clearTimeout); playTimers=[];
  cutVoices();
  highlightNote(-1);
  updatePlayBtn();
}
