import os
import zipfile
import urllib.request
token = None
with open('.env') as f:
    for line in f:
        if line.startswith('GH_TOKEN='):
            token = line.split('=', 1)[1].strip().strip('\"\'')

req = urllib.request.Request(
    'https://api.github.com/repos/alfreddev8-coder/viral-short-factory/actions/runs/23385188424/logs',
    headers={'Authorization': 'Bearer ' + token}
)
try:
    with urllib.request.urlopen(req) as res:
        with open('logs.zip', 'wb') as f:
            f.write(res.read())
    with zipfile.ZipFile('logs.zip', 'r') as z:
        z.extractall('logs_extracted')
    
    # Read the produce-video log file
    for root, dirs, files in os.walk('logs_extracted'):
        for file in files:
            if file.endswith('.txt') and 'produce-video' in file:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    with open('filtered_logs.txt', 'w', encoding='utf-8') as out:
                        out.write(f.read())
                    print("Wrote logs to filtered_logs.txt")
                    break
except Exception as e:
    print('Failed:', e)
