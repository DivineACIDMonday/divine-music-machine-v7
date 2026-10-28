import re,os,sys
V='/home/claude/divine-music-machine-v7'
VERSION=sys.argv[1] if len(sys.argv)>1 else 'dev'
src=open(V+'/index.html',encoding='utf8').read()
i=src.index('/* Divine Music Machine engine'); s0=src.rfind('<script>',0,i); e=src.index('</script>',i)+9
engine=src[s0:e]
app=open('/tmp/work/studio/app.html',encoding='utf8').read().replace('__VERSION__',VERSION)
out=app.replace('<!--ENGINE-->',engine)
os.makedirs(V+'/studio',exist_ok=True)
open(V+'/studio/index.html','w',encoding='utf8').write(out)
ub=open(V+'/tools/ujam_build.py',encoding='utf8').read(); import re as _re; PATCH=_re.search(r'PATCH = r"""(.*?)"""',ub,_re.S).group(1)
uj=out.replace(engine, '<script>window.DMS_UJAM=true;window.DMM_UJAM=true;</script>'+engine+'<script>'+PATCH+'</script>').replace('<title>Divine Music Studio</title>','<title>Divine Music Studio UJAM</title>')
os.makedirs(V+'/ujam/studio',exist_ok=True)
open(V+'/ujam/studio/index.html','w',encoding='utf8').write(uj)
print('built',len(out))
G='<script>window.DMS_GROOVE=true;</script>'
for path,html,t in [('/studio/groove',out,'Divine Music Studio'),('/ujam/studio/groove',uj,'Divine Music Studio UJAM')]:
    gh=html.replace('<title>'+t+'</title>','<title>'+t.replace('Music','Groove')+'</title>').replace(engine, G+engine,1) if path=='/studio/groove' else html.replace('<script>window.DMS_UJAM=true;',G+'<script>window.DMS_UJAM=true;',1).replace('<title>'+t+'</title>','<title>'+t.replace('Music','Groove')+'</title>')
    assert 'DMS_GROOVE' in gh
    os.makedirs(V+path,exist_ok=True); open(V+path+'/index.html','w',encoding='utf8').write(gh)
print('groove built')
# share previews, app install, icons
import json, shutil
B='https://divineacidmonday.github.io/divine-music-machine-v7'
DESC0='<meta name="description" content="Pick a genre, shape your song, get it as MIDI. Free, mechanical, right in your browser. By Divine Monday.">'
CFG=[('/studio','Divine Music Studio','DM Studio','studio','og-studio','Pick a genre, shape your song step by step, get it as MIDI. Totally free. No AI inside. By Divine Monday.'),
     ('/studio/groove','Divine Groove Studio','DM Groove Studio','groove-studio','og-groove-studio','Pick a genre, shape a whole beat step by step, get it as MIDI. Totally free. No AI inside. By Divine Monday.'),
     ('/ujam/studio','Divine Music Studio UJAM','DM Studio UJAM','studio','og-studio-ujam','Pick a genre, shape your song step by step, get it as MIDI for UJAM plugins. Totally free. No AI inside. By Divine Monday.'),
     ('/ujam/studio/groove','Divine Groove Studio UJAM','DM Groove UJAM','groove-studio','og-groove-studio-ujam','Pick a genre, shape a whole beat step by step, get it as MIDI for Beatmaker and Virtual Drummer. Totally free. No AI inside. By Divine Monday.')]
for path,name,short,ic,og,desc in CFG:
    f=V+path+'/index.html'; html=open(f,encoding='utf8').read(); url=B+path+'/'
    meta=(f'<meta name="description" content="{desc}"><meta property="og:type" content="website"><meta property="og:site_name" content="Divine Monday"><meta property="og:title" content="{name}"><meta property="og:description" content="{desc}"><meta property="og:url" content="{url}"><meta property="og:image" content="{B}/og/{og}.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{name}"><meta name="twitter:description" content="{desc}"><meta name="twitter:image" content="{B}/og/{og}.png">'
          f'<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="/divine-music-machine-v7/icons/{ic}-180.png"><meta name="theme-color" content="#101219"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="{short}"><link rel="icon" type="image/png" sizes="192x192" href="/divine-music-machine-v7/icons/{ic}-192.png">'
          "<script>if ('serviceWorker' in navigator && /\\.github\\.io$/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(function () {});</script>")
    assert html.count(DESC0)==1, path
    html=html.replace(DESC0,meta); open(f,'w',encoding='utf8').write(html)
    man={"name":name,"short_name":short,"description":desc.replace(' By Divine Monday.',''),"id":"/divine-music-machine-v7"+path+"/","start_url":"./","scope":"./","display":"standalone","background_color":"#101219","theme_color":"#101219",
         "icons":[{"src":f"/divine-music-machine-v7/icons/{ic}-192.png","sizes":"192x192","type":"image/png","purpose":"any"},{"src":f"/divine-music-machine-v7/icons/{ic}-512.png","sizes":"512x512","type":"image/png","purpose":"any"},{"src":f"/divine-music-machine-v7/icons/{ic}-maskable.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
    open(V+path+'/manifest.webmanifest','w').write(json.dumps(man,indent=1)); shutil.copy(V+'/groove/sw.js',V+path+'/sw.js')
print('meta done')
