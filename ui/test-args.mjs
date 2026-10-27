import { tokenize, join, getOpt, setOpt } from './src/lib/args.js';
const line = 'squeezelite -o bt -n "Living room" -s example.com -b 500:1000 -C 3600';
const t = tokenize(line);
console.log('tokens:', JSON.stringify(t));
console.log('C:', getOpt(t, '-C'));
const out = join(setOpt(t, '-C', '30'));
console.log('new :', out);
console.log('same?', out === line);
