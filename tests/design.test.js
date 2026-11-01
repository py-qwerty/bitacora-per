import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('documented design tokens match the canonical CSS owner',()=>{
  const design=readFileSync(new URL('../DESIGN.md',import.meta.url),'utf8');
  const css=readFileSync(new URL('../dist/styles.css',import.meta.url),'utf8');
  const colors=design.split('colors:\n')[1].split('typography:')[0];
  for(const [,key,value] of colors.matchAll(/^  ([\w-]+): "([^"]+)"/gm))assert(css.includes(`--color-${key}:${value}`),key);
  assert(css.includes('--radius-control:8px'));assert(css.includes('--radius-panel:14px'));assert(css.includes('--page-max:480px'));
});
