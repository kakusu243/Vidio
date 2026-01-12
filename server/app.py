from flask import Flask, request, jsonify, Response, stream_with_context, abort
from flask_cors import CORS
import yt_dlp
import requests
from werkzeug.utils import secure_filename
import os
import time
import tempfile
import shutil

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.config['JSON_SORT_KEYS'] = False

# --- API key and rate limit configuration ---
# If API_KEY is set, requests must provide the same key via header 'X-API-Key' or query param 'api_key'.
API_KEY = os.environ.get('API_KEY')  # e.g. export API_KEY="ma_cle_secrete"
RATE_LIMIT_ENABLED = os.environ.get('RATE_LIMIT_ENABLED', '1') != '0'
RATE_LIMIT_PER_MINUTE = int(os.environ.get('RATE_LIMIT_PER_MINUTE', '60'))

# Simple in-memory rate limiter (sufficient for example/dev only).
# Stores {client_id: (count, window_start_timestamp)} where client_id is API key or IP.
_rate_limits = {}

def _get_client_id():
    key = request.headers.get('X-API-Key') or request.args.get('api_key')
    if key:
        return f'key:{key}'
    return f'ip:{request.remote_addr}'

def _check_rate_limit():
    if not RATE_LIMIT_ENABLED:
        return True
    cid = _get_client_id()
    now = int(time.time())
    window = 60
    rec = _rate_limits.get(cid)
    if rec:
        count, start = rec
        if now - start < window:
            if count >= RATE_LIMIT_PER_MINUTE:
                return False
            _rate_limits[cid] = (count + 1, start)
        else:
            _rate_limits[cid] = (1, now)
    else:
        _rate_limits[cid] = (1, now)
    return True

# --- end of API key / rate limit config ---

# Small helper to build resolution label
def fmt_label(fmt):
    res = fmt.get('height')
    if res:
        return f"{res}p"
    if fmt.get('format_note'):
        return fmt.get('format_note')
    return fmt.get('format')

def get_audio_info(fmt):
    """Determine if format has audio and extract language info."""
    acodec = fmt.get('acodec')
    vcodec = fmt.get('vcodec')
    has_audio = acodec and acodec != 'none'
    audio_only = has_audio and (not vcodec or vcodec == 'none')
    language = fmt.get('language') or None
    return {'has_audio': has_audio, 'audio_only': audio_only, 'language': language}

@app.route('/api/extract')
def extract():
    video_url = request.args.get('url')
    if not video_url:
        return jsonify({'error': 'Paramètre url requis'}), 400

    # API key check (if enabled) and rate limit
    if API_KEY:
        key = request.headers.get('X-API-Key') or request.args.get('api_key')
        if not key or key != API_KEY:
            return jsonify({'error': 'API key manquante ou invalide'}), 401
    if not _check_rate_limit():
        return jsonify({'error': 'Trop de requêtes, réessayez plus tard'}), 429

    try:
        ydl_opts = {'skip_download': True, 'quiet': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

        formats = []
        for f in info.get('formats', []):
            audio_info = get_audio_info(f)
            formats.append({
                'format_id': f.get('format_id'),
                'ext': f.get('ext'),
                'resolution': fmt_label(f),
                'height': f.get('height'),
                'filesize': f.get('filesize') or f.get('filesize_approx'),
                'format_note': f.get('format_note'),
                'has_audio': audio_info['has_audio'],
                'audio_only': audio_info['audio_only'],
                'language': audio_info['language'],
            })

        # Add an MP3 conversion option if any audio is available
        if any(f['has_audio'] for f in formats):
            formats.append({
                'format_id': 'mp3',
                'ext': 'mp3',
                'resolution': 'audio',
                'height': None,
                'filesize': None,
                'format_note': 'Converti en MP3 (ffmpeg requis)',
                'has_audio': True,
                'audio_only': True,
                'language': None,
            })

        return jsonify({
            'title': info.get('title'),
            'thumbnail': info.get('thumbnail'),
            'uploader': info.get('uploader'),
            'formats': formats
        })
    except yt_dlp.utils.DownloadError as e:
        return jsonify({'error': 'Impossible d’extraire la vidéo ou format non pris en charge', 'reason': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Erreur interne', 'reason': str(e)}), 500

@app.route('/api/download')
def download():
    video_url = request.args.get('url')
    format_id = request.args.get('format_id')
    if not video_url or not format_id:
        return jsonify({'error': 'Paramètres url et format_id requis'}), 400

    # API key check (if enabled) and rate limit
    if API_KEY:
        key = request.headers.get('X-API-Key') or request.args.get('api_key')
        if not key or key != API_KEY:
            return jsonify({'error': 'API key manquante ou invalide'}), 401
    if not _check_rate_limit():
        return jsonify({'error': 'Trop de requêtes, réessayez plus tard'}), 429

    try:
        ydl_opts = {'skip_download': True, 'quiet': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

        # Special handling for mp3 conversion
        if format_id == 'mp3':
            tempdir = tempfile.mkdtemp()
            try:
                outtmpl = os.path.join(tempdir, '%(title)s.%(ext)s')
                ydl_opts_conv = {
                    'outtmpl': outtmpl,
                    'format': 'bestaudio/best',
                    'quiet': True,
                    'noplaylist': True,
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'mp3',
                        'preferredquality': '192',
                    }]
                }
                with yt_dlp.YoutubeDL(ydl_opts_conv) as ydl_conv:
                    try:
                        info_conv = ydl_conv.extract_info(video_url, download=True)
                    except Exception as e:
                        return jsonify({'error': 'Échec de la conversion MP3', 'reason': str(e)}), 500

                # Find the created mp3 file in tempdir
                mp3_file = None
                for root, dirs, files in os.walk(tempdir):
                    for fn in files:
                        if fn.lower().endswith('.mp3'):
                            mp3_file = os.path.join(root, fn)
                            break
                    if mp3_file:
                        break
                if not mp3_file:
                    return jsonify({'error': 'Conversion MP3 introuvable'}), 500

                filename = secure_filename((info_conv.get('title') or 'audio') + '.mp3')
                def generate_file():
                    try:
                        with open(mp3_file, 'rb') as fh:
                            while True:
                                chunk = fh.read(8192)
                                if not chunk:
                                    break
                                yield chunk
                    finally:
                        try:
                            shutil.rmtree(tempdir)
                        except Exception:
                            pass

                resp = Response(stream_with_context(generate_file()), content_type='audio/mpeg')
                resp.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
                try:
                    resp.headers['Content-Length'] = str(os.path.getsize(mp3_file))
                except Exception:
                    pass
                return resp
            finally:
                # If something failed and tempdir still exists, leave cleanup to generator's finally
                pass

        chosen = None
        for f in info.get('formats', []):
            if str(f.get('format_id')) == str(format_id):
                chosen = f
                break
        if not chosen:
            return jsonify({'error': 'Format non trouvé'}), 404

        # Direct media URL (peut être temporaire)
        media_url = chosen.get('url')
        if not media_url:
            return jsonify({'error': 'URL du média introuvable'}), 500

        # Proxy the stream
        headers = {'User-Agent': request.headers.get('User-Agent', 'python-requests')}
        r = requests.get(media_url, headers=headers, stream=True, timeout=15)
        if r.status_code != 200:
            return abort(502)

        filename = secure_filename((info.get('title') or 'video') + '.' + (chosen.get('ext') or 'mp4'))
        def generate():
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk

        resp = Response(stream_with_context(generate()), content_type=r.headers.get('content-type', 'application/octet-stream'))
        resp.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        if r.headers.get('content-length'):
            resp.headers['Content-Length'] = r.headers.get('content-length')
        return resp

    except yt_dlp.utils.DownloadError as e:
        return jsonify({'error': 'Erreur durant l’extraction', 'reason': str(e)}), 400
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'Erreur lors du téléchargement du média', 'reason': str(e)}), 502
    except Exception as e:
        return jsonify({'error': 'Erreur interne', 'reason': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
