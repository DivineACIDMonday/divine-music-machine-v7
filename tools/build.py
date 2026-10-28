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
