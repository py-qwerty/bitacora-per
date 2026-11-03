"""Une explanations/*.json en dist/explanations.json.

Cada archivo fuente es {id_pregunta: {"a": ..., "b": ..., "c": ..., "d": ..., "review"?: ...}}.
Las preguntas repetidas (mismo enunciado y opciones) comparten explicación.
"""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
bank = json.loads((root / 'dist/bank.json').read_text())
signature = lambda q: (q['text'].strip(), tuple(o['text'].strip() for o in q['options']))
by_signature = {}
for path in sorted((root / 'explanations').glob('*.json')):
    for qid, entry in json.loads(path.read_text()).items():
        by_signature[qid] = entry

questions = {q['id']: q for q in bank['questions']}
unknown = [qid for qid in by_signature if qid not in questions]
if unknown:
    sys.exit(f'IDs desconocidos: {unknown[:5]}')
shared = {signature(questions[qid]): entry for qid, entry in by_signature.items()}
items, missing = {}, []
for q in bank['questions']:
    entry = by_signature.get(q['id']) or shared.get(signature(q))
    if not entry:
        missing.append(q['id'])
        continue
    keys = [o['key'] for o in q['options']]
    bad = [k for k in keys if not isinstance(entry.get(k), str) or not entry[k].strip()]
    if bad:
        sys.exit(f'{q["id"]}: falta explicación para {bad}')
    items[q['id']] = {k: entry[k].strip() for k in keys} | ({'review': entry['review'].strip()} if entry.get('review') else {})

out = {'version': bank['version'], 'items': items}
(root / 'dist/explanations.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(f'{len(items)} preguntas con explicación, {len(missing)} sin ella')
