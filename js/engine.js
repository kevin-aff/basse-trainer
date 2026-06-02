/* =========================================================================
   MOTEUR MUSICAL — données et helpers de théorie
   ========================================================================= */
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

const SCALES = {
  major:            {name:'Majeure (ionien)',      iv:[0,2,4,5,7,9,11], deg:['1','2','3','4','5','6','7']},
  natural_minor:    {name:'Mineure naturelle (éolien)', iv:[0,2,3,5,7,8,10], deg:['1','2','b3','4','5','b6','b7']},
  harmonic_minor:   {name:'Mineure harmonique',    iv:[0,2,3,5,7,8,11], deg:['1','2','b3','4','5','b6','7']},
  melodic_minor:    {name:'Mineure mélodique',     iv:[0,2,3,5,7,9,11], deg:['1','2','b3','4','5','6','7']},
  major_penta:      {name:'Pentatonique majeure',  iv:[0,2,4,7,9],      deg:['1','2','3','5','6']},
  minor_penta:      {name:'Pentatonique mineure',  iv:[0,3,5,7,10],     deg:['1','b3','4','5','b7']},
  blues:            {name:'Blues (mineure)',       iv:[0,3,5,6,7,10],   deg:['1','b3','4','b5','5','b7']},
  dorian:           {name:'Dorien',                iv:[0,2,3,5,7,9,10], deg:['1','2','b3','4','5','6','b7']},
  phrygian:         {name:'Phrygien',              iv:[0,1,3,5,7,8,10], deg:['1','b2','b3','4','5','b6','b7']},
  lydian:           {name:'Lydien',                iv:[0,2,4,6,7,9,11], deg:['1','2','3','#4','5','6','7']},
  mixolydian:       {name:'Mixolydien',            iv:[0,2,4,5,7,9,10], deg:['1','2','3','4','5','6','b7']},
  locrian:          {name:'Locrien',               iv:[0,1,3,5,6,8,10], deg:['1','b2','b3','4','b5','b6','b7']},
};

const TRIADS = {
  major:      {name:'Majeure',    iv:[0,4,7], deg:['1','3','5']},
  minor:      {name:'Mineure',    iv:[0,3,7], deg:['1','b3','5']},
  diminished: {name:'Diminuée',   iv:[0,3,6], deg:['1','b3','b5']},
  augmented:  {name:'Augmentée',  iv:[0,4,8], deg:['1','3','#5']},
};

const TUNINGS = {
  // midi = note MIDI de la corde à vide (grave -> aiguë), pour l'audio
  bass4:  {name:'Basse 4 cordes (E A D G)',   strings:[4,9,2,7],     midi:[28,33,38,43]},      // E1 A1 D2 G2
  bass5:  {name:'Basse 5 cordes (B E A D G)', strings:[11,4,9,2,7],  midi:[23,28,33,38,43]},   // B0 E1 A1 D2 G2
  bass4_drop_d:{name:'Basse 4 — Drop D (D A D G)', strings:[2,9,2,7], midi:[26,33,38,43]},     // D1 A1 D2 G2
  bass5_high:{name:'Basse 5 cordes (E A D G C)', strings:[4,9,2,7,0], midi:[28,33,38,43,48]},  // E1 A1 D2 G2 C3
};

const INLAYS = new Set([3,5,7,9,15,17,19,21]);
const DBL_INLAYS = new Set([12,24]);
const CIRCLE_ORDER = [0,7,2,9,4,11,6,1,8,3,10,5]; // C G D A E B F# C# G# D# A# F (quintes)

function pc(n){return ((n%12)+12)%12;}                  // pitch class 0..11
function noteName(n, flat){return (flat?FLATS:NOTES)[pc(n)];}

// Renvoie le set d'intervalles {pitchClass -> {degree, interval}} pour la sélection
function buildSelection(rootPc, mode, key){
  const map = {};
  let iv, deg, useFlats;
  if(mode==='note'){ iv=[0]; deg=['1']; }
  else if(mode==='triad'){ iv=TRIADS[key].iv; deg=TRIADS[key].deg; }
  else { iv=SCALES[key].iv; deg=SCALES[key].deg; }
  useFlats = /b/.test((deg||[]).join('')) || ['F','Bb','Eb','Ab','Db','Gb'].includes(NOTES[rootPc]);
  iv.forEach((interval,i)=>{
    const p = pc(rootPc+interval);
    map[p] = {degree:deg[i], interval};
  });
  return {map, useFlats};
}

// Classe une note (root/third/fifth/note) selon son intervalle à la tonique
function roleOf(interval){
  if(interval===0) return 'root';
  if(interval===3||interval===4) return 'third';
  if(interval===7||interval===6||interval===8) return 'fifth';
  return 'note';
}
