// Configuration : changez API_BASE pour pointer vers votre serveur d'extraction
const API_BASE = 'http://192.168.1.133:8080/'; // <-- remplacez par votre URL d'API

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

function showError(msg) {
  infoBox.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
}

function showInfo(msg) {
  infoBox.innerHTML = `<div class="alert alert-info">${msg}</div>`;
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
    const resp = await fetch(`${API_BASE}/api/extract?url=${encodeURIComponent(url)}`);
    if(!resp.ok) throw new Error('Erreur lors de la requête vers l’API d’extraction');
    const data = await resp.json();

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
        opt.value = JSON.stringify({format_id: fmt.format_id});
        opt.textContent = label;
        formatSelect.appendChild(opt);
      });
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
