import sys, urllib.request, json
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'https://polite-mushroom-0a5ba400f.4.azurestaticapps.net'

url = f'{BASE_URL}/genesis/1'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8')

# Data is embedded as escaped JSON inside a script/attribute.
# Raw in HTML: {\"verses\":{\"1\":{\"hebrew\":\"...
# So in Python string the HTML contains: {\"verses\":{\"1\":
marker = '\\"verses\\":{'
idx = html.find(marker)
print('marker idx:', idx)

# Go back to find the opening { of the parent object
start = html.rfind('{', 0, idx)
print('start:', start, repr(html[start:start+40]))

# Extract to matching }
depth = 0
i = start
end = start
while i < len(html):
    c = html[i]
    if c == '{':
        depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1

chunk = html[start:end]
# Unescape: \" -> "  and \\ -> \
unescaped = chunk.replace('\\"', '"').replace('\\\\', '\\')
print('chunk length:', len(chunk), 'unescaped:', len(unescaped))
data = json.loads(unescaped)
verses = data.get('verses', {})
print('verse count:', len(verses))
print('verse 1 aramaic:', verses.get('1', {}).get('aramaic', ''))
print('verse 1 hebrew:', verses.get('1', {}).get('hebrew', ''))
