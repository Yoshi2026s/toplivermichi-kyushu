"""Create local WOFF2 subsets from the original OFL-licensed fonts.
Requires fonttools[woff]. Original TTFs/licenses are downloaded separately;
normal game builds only read the resulting assets and do not need Python.
"""
from pathlib import Path
import argparse, hashlib, json, unicodedata
from fontTools import subset, version
from fontTools.ttLib import TTFont

parser=argparse.ArgumentParser()
parser.add_argument('--sources', type=Path, required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
out=root/'assets'/'fonts'
out.mkdir(parents=True, exist_ok=True)
text=''.join(p.read_text(encoding='utf-8-sig') for p in sorted((root/'src').iterdir()) if p.suffix in ('.js','.html'))
chars={chr(i) for i in range(32,127)}|{c for c in text if not unicodedata.category(c).startswith('C')}
codepoints=sorted(map(ord,chars))
records=[]
for source, filename, family, ps_name, style, license_file, url in [
 ('display.ttf','quest-mincho-800.woff2','Quest Mincho','QuestMincho-ExtraBold','ExtraBold','display-OFL.txt','https://github.com/google/fonts/tree/main/ofl/shipporimincho'),
 ('body.ttf','quest-gothic-variable.woff2','Quest Gothic','QuestGothic-Regular','Regular','body-OFL.txt','https://github.com/google/fonts/tree/main/ofl/notosansjp'),
]:
    original=args.sources/source
    font=TTFont(original, recalcTimestamp=False)
    cmap=font.getBestCmap()
    included=[cp for cp in codepoints if cp in cmap]
    options=subset.Options()
    options.name_IDs=['*']
    options.name_legacy=True
    options.name_languages=['*']
    sub=subset.Subsetter(options=options)
    sub.populate(unicodes=included)
    sub.subset(font)
    # Subset derivatives use project-specific names; copyright/license records remain.
    names={1:family,2:style,3:ps_name+' subset 1.0',4:family+' '+style,6:ps_name,16:family,17:style,21:family,22:style,25:ps_name.split('-')[0]}
    for name in font['name'].names:
        if name.nameID in names:
            name.string=names[name.nameID].encode(name.getEncoding(),errors='replace')
    for key,value in names.items():
        font['name'].setName(value,key,3,1,0x409)
    font.flavor='woff2'
    target=out/filename
    font.save(target)
    license_name='OFL-Shippori-Mincho.txt' if source=='display.ttf' else 'OFL-Noto-Sans-JP.txt'
    (out/license_name).write_text('\n'.join(line.rstrip() for line in (args.sources/license_file).read_text(encoding='utf-8').splitlines())+'\n',encoding='utf-8',newline='\n')
    records.append({'file':filename,'family':family,'upstream':url,'license':license_name,'fontTools':version,'originalSHA256':hashlib.sha256(original.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'requestedCodepoints':len(codepoints),'includedCodepoints':len(included),'codepoints':included})
    print(filename, target.stat().st_size, 'bytes;',len(included),'glyph codepoints')
(out/'SOURCES.json').write_text(json.dumps({'textSHA256':hashlib.sha256(''.join(map(chr,codepoints)).encode()).hexdigest(),'fonts':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
