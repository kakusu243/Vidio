import requests
import sys

url = 'http://127.0.0.1:8080/api/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format_id=140'
print('Requesting', url)
try:
    r = requests.get(url, stream=True, timeout=60)
    print('STATUS', r.status_code)
    print('Content-Type:', r.headers.get('Content-Type'))
    # read up to 10KB
    total = 0
    for chunk in r.iter_content(chunk_size=1024):
        if chunk:
            total += len(chunk)
            print('Got chunk len', len(chunk), 'total', total)
            if total >= 10240:
                break
    if total == 0:
        print('No data received')
except Exception as e:
    print('ERROR', e)
    sys.exit(1)
