// Configuration : changez API_BASE pour pointer vers votre serveur d'extraction
const API_BASE = document.querySelector('meta[name="api-base"]')?.content || 'https://vidio-production.up.railway.app'; // production Railway URL

const videoUrlInput = document.getElementById('videoUrl');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const resultBox = document.getElementById('result');
const thumbnailImg = document.getElementById('thumbnail');
const titleEl = document.getElementById('title');
const metaEl = document.getElementById('meta');
const formatSelect = document.getElementById('formatSelect');
const downloadBtn = document.getElementById('downloadBtn');
const infoBox = document.getElementById('infoBox');
const copyLinkBtn = document.getElementById('copyLink');
const analyzeSpinner = document.getElementById('analyzeSpinner');

function showLoading(){
  analyzeBtn.disabled = true;
  if(analyzeSpinner) analyzeSpinner.classList.remove('d-none');
  showInfo('Analyse en cours…');
}
function hideLoading(){
  analyzeBtn.disabled = false;
  if(analyzeSpinner) analyzeSpinner.classList.add('d-none');
}


analyzeBtn.addEventListener('click', analyze);
clearBtn.addEventListener('click', clearAll);
formatSelect.addEventListener('change', updateDownloadLink);
copyLinkBtn.addEventListener('click', copyCurrentLink);

const apiAlert = document.getElementById('apiAlert');

function showApiAlert(msg) {
  if(apiAlert) {
    apiAlert.textContent = msg;
    apiAlert.classList.remove('d-none');
  } else {
    infoBox.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
  }
}

function hideApiAlert() {
  if(apiAlert) {
    apiAlert.textContent = '';
    apiAlert.classList.add('d-none');
  }
}

function showError(msg) {
  infoBox.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
}

function showInfo(msg) {
  infoBox.innerHTML = `<div class="alert alert-info">${msg}</div>`;
  hideApiAlert();
} 

function clearAll(){
  videoUrlInput.value='';
  resultBox.classList.add('d-none');
  formatSelect.innerHTML='';
  downloadBtn.classList.add('disabled');
  infoBox.innerHTML='';
}

async function analyze(){
  const url = videoUrlInput.value.trim();
  if(!url){ showError('Veuillez entrer une URL.'); return; }

  showLoading();
  try{
    let resp;
    try {
      resp = await fetch(`${API_BASE}/api/extract?url=${encodeURIComponent(url)}`);
    } catch(fetchErr) {
      const msg = `Impossible de joindre l'API (${API_BASE}). Vérifiez que le serveur est accessible. Détails: ${fetchErr.message}`;
      showApiAlert(msg);
      throw fetchErr;
    }
    if(!resp.ok){
      let errText = `Erreur serveur (${resp.status})`;
      try{
        const errJson = await resp.json();
        if(errJson.error) errText += `: ${errJson.error}${errJson.reason ? ' - ' + errJson.reason : ''}`;
      }catch(e){}
      showApiAlert(errText);
      throw new Error(errText);
    }
    const data = await resp.json();
    hideApiAlert();

    // Afficher miniature et titre
    thumbnailImg.src = data.thumbnail || '';
    titleEl.textContent = data.title || 'Sans titre';
    metaEl.textContent = data.uploader ? `Par ${data.uploader}` : '';

    // Remplir les formats (résolutions) - tri descendant par height puis filesize
    formatSelect.innerHTML = '';
    if(Array.isArray(data.formats) && data.formats.length){
      data.formats.sort((a,b)=>{
        const ha = Number(a.height || parseInt(a.resolution) || 0) || 0;
        const hb = Number(b.height || parseInt(b.resolution) || 0) || 0;
        if(hb !== ha) return hb - ha;
        return (b.filesize||0) - (a.filesize||0);
      });

      data.formats.forEach(fmt => {
        let type_info = [];
        if(fmt.audio_only){
          type_info.push('[🔊 Audio seul]');
        } else if(fmt.has_audio){
          type_info.push('[✓ Audio+Vidéo]');
        } else {
          type_info.push('[❌ Pas d\'audio]');
        }
        if(fmt.language){
          type_info.push(`[Langue: ${fmt.language}]`);
        }
        const formatInfo = `${fmt.ext} — ${fmt.resolution || fmt.format_note || fmt.format} ${fmt.filesize ? `- ${Math.round(fmt.filesize/1024/1024)} MB` : ''}`;
        const typeStr = type_info.join(' ');
        // Add spaces to create visual separation (right-align the info)
        const padding = Math.max(0, 100 - formatInfo.length);
        const label = formatInfo + ' '.repeat(padding) + typeStr;
        const opt = document.createElement('option');
        opt.value = JSON.stringify({format_id: fmt.format_id, has_audio: !!fmt.has_audio});
        opt.textContent = label;
        formatSelect.appendChild(opt);
      });
      // Sélectionner par défaut le premier format qui contient de l'audio (préférer les flux muxés)
      (function selectDefaultWithAudio(){
        const opts = Array.from(formatSelect.options);
        let defaultIndex = opts.findIndex(o => {
          try { return JSON.parse(o.value).has_audio; } catch(e){ return false; }
        });
        formatSelect.selectedIndex = defaultIndex === -1 ? 0 : defaultIndex;
      })();
      updateDownloadLink();
      downloadBtn.classList.remove('disabled');
      resultBox.classList.remove('d-none');
      showInfo('Format(s) détecté(s). Choisissez une option puis cliquez sur Télécharger.');
    } else {
      showError('Aucun format disponible ou vidéo non prise en charge par l’API.');
      downloadBtn.classList.add('disabled');
    }

  }catch(err){
    showError(err.message || 'Erreur inconnue');
    console.error(err);
  } finally {
    hideLoading();
  }
}

function updateDownloadLink(){
  const url = videoUrlInput.value.trim();
  const selected = formatSelect.value;
  if(!selected || !url){ downloadBtn.classList.add('disabled'); return; }
  const selObj = JSON.parse(selected);
  // Le front-end appelle l'endpoint de téléchargement qui proxie le flux
  const downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(url)}&format_id=${encodeURIComponent(selObj.format_id)}`;
  downloadBtn.href = downloadUrl;
  downloadBtn.classList.remove('disabled');

  // Non bloquant : vérifier si le serveur utilisera le fallback (yt-dlp) et informer l'utilisateur
  (async function probeDownload(){
    try{
      const resp = await fetch(downloadUrl, { method: 'GET', headers: { 'Range': 'bytes=0-0' }, mode: 'cors' });
      const fb = resp.headers.get('X-Used-Fallback');
      if(fb === 'yt-dlp' || fb === 'mp3-conversion'){
        showInfo('Remarque : le téléchargement utilisera un fallback côté serveur (yt-dlp). Le téléchargement peut être plus lent mais le fichier sera complet.');
      } else {
        // clear previous fallback notice if present
        if(infoBox && infoBox.textContent && infoBox.textContent.includes("Remarque : le téléchargement utilisera")){
          infoBox.innerHTML = '';
        }
      }
    }catch(e){
      // probe failed (CORS, network) — silencieux
      console.debug('probeDownload failed', e);
    }
  })();
}

async function copyCurrentLink(){
  if(downloadBtn.classList.contains('disabled')) return;
  try{
    await navigator.clipboard.writeText(downloadBtn.href);
    showInfo('Lien de téléchargement copié dans le presse-papiers.');
  }catch(e){
    showError('Impossible de copier le lien.');
  }
}
