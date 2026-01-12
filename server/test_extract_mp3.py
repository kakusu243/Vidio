import requests, json, sys
try:
    r = requests.get('http://127.0.0.1:8080/api/extract?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ', timeout=120)
    print('STATUS', r.status_code)
    data = r.json()
    ids = [f.get('format_id') for f in data.get('formats', [])]
    print('found mp3?', 'mp3' in ids)
    if 'mp3' in ids:
        print([f for f in data.get('formats', []) if f.get('format_id') == 'mp3'][0])
except Exception as e:
    print('ERROR', e)
    sys.exit(1)
