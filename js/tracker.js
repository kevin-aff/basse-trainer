/* =========================================================================
   SUIVI DE PROGRESSION — persistance locale + tableau de bord
   Stocke les meilleurs tempos validés (joués sans erreur) par configuration.
   ========================================================================= */
const STORE_KEY = 'bt_progress_v1';

function loadProgress(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {records:{}}; }
  catch(e){ return {records:{}}; }
}
function saveProgress(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(progress)); }catch(e){} }

let progress = loadProgress();
if(!progress.records) progress.records = {};

// Enregistre une validation « sans erreur » au tempo donné
function recordValidation(key, label, bpm, target){
  const r = progress.records[key] || {label, best:0, target, attempts:0, lastValidated:null, history:[]};
  r.label = label;
  r.target = target;
  r.attempts++;
  r.lastValidated = Date.now();
  if(bpm > r.best) r.best = bpm;
  r.history.push({bpm, date:Date.now()});
  if(r.history.length > 60) r.history = r.history.slice(-60);
  progress.records[key] = r;
  saveProgress();
}
function getRecord(key){ return progress.records[key]; }
function resetRecord(key){ delete progress.records[key]; saveProgress(); }
function clearProgress(){ progress = {records:{}}; saveProgress(); }

function fmtDate(ts){
  if(!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR') + ' ' +
         d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}

function renderDashboard(){
  const recs = Object.entries(progress.records);
  const box = $('dashboard');
  if(recs.length === 0){
    box.innerHTML = '<p class="info">Pas encore de tempo validé. Charge un exercice, joue-le, puis clique « Validé sans erreur » au tempo réussi.</p>';
    return;
  }
  recs.sort((a,b)=>(b[1].lastValidated||0)-(a[1].lastValidated||0));
  const curKey = (typeof currentRecordKey==='function') ? currentRecordKey() : null;

  let html = '<div style="overflow-x:auto"><table class="dash"><thead><tr>'
    + '<th>Exercice</th><th>Meilleur</th><th>Objectif</th><th>Progression</th>'
    + '<th>Validations</th><th>Dernière</th><th></th></tr></thead><tbody>';
  recs.forEach(([key,r])=>{
    const target = r.target || 120;
    const pct = Math.min(100, Math.round(100*r.best/target));
    const cur = key===curKey ? ' class="current"' : '';
    html += `<tr${cur}>
      <td>${r.label}</td>
      <td><b>${r.best} BPM</b></td>
      <td>${target} BPM</td>
      <td><span class="bar"><span class="barfill" style="width:${pct}%"></span></span>${pct}%</td>
      <td>${r.attempts}</td>
      <td>${fmtDate(r.lastValidated)}</td>
      <td><button class="del" title="Supprimer cette ligne" data-key="${encodeURIComponent(key)}">✕</button></td>
    </tr>`;
  });
  html += '</tbody></table></div>'
    + '<div class="row" style="margin-top:12px">'
    + '<button id="exportBtn">Exporter (JSON)</button>'
    + '<button id="clearBtn">Tout effacer</button></div>';
  box.innerHTML = html;

  box.querySelectorAll('.del').forEach(b=>{
    b.onclick = ()=>{ resetRecord(decodeURIComponent(b.dataset.key)); updateTrainingUI(); };
  });
  $('exportBtn').onclick = exportProgress;
  $('clearBtn').onclick = ()=>{
    if(confirm('Effacer toute la progression enregistrée ?')){ clearProgress(); updateTrainingUI(); }
  };
}

function exportProgress(){
  const blob = new Blob([JSON.stringify(progress,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'basse-trainer-progression.json';
  a.click();
  URL.revokeObjectURL(url);
}
