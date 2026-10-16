import re, sys
local = len(sys.argv) > 1 and sys.argv[1] in ('local', 'conceptlocal')
concept = len(sys.argv) > 1 and sys.argv[1] in ('concept', 'conceptlocal')
head = open('head.html').read()
if concept:
    head = head.replace('<title>Pest Panic Online</title>', '<title>Magnifying Glass Concept</title>')
    head += open('concept_panel.html').read()
eng = open('engine.js').read()
eng = re.sub(r'^export \{[^}]*\};\s*$', '', eng, flags=re.M)
eng = re.sub(r'^export (const|function|class) ', r'\1 ', eng, flags=re.M)
game = open('game.js').read()
import os
ver = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'VERSION')).read().strip()
head = head.replace('__VERSION__', ver)
base = '/node_modules/three/' if local else 'https://cdn.jsdelivr.net/npm/three@0.160.0/'
imap = '<script type="importmap">{"imports":{"three":"%sbuild/three.module.js","three/addons/":"%sexamples/jsm/"}}</script>' % (base, base)
out = head + '\n' + imap + '\n<script type="module">\n' + eng + '\n' + game + '\n</script>\n'
name = ('concept' if concept else 'index') + ('_local' if local else '') + '.html'
open(name, 'w').write(out)
print(len(out), 'bytes')
