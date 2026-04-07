const fs = require('fs');

function score(s){
  const arabic = (s.match(/[\u0600-\u06FF]/g)||[]).length;
  const moj = (s.match(/[ÃØÙÂÐ]/g)||[]).length;
  const repl = (s.match(/�/g)||[]).length;
  return {arabic, moj, repl, score: arabic - (moj*3) - (repl*8)};
}

function decodeRound(str, enc){
  const buf = Buffer.from(str, enc);
  return buf.toString('utf8');
}

function bestFix(input){
  let candidates = [];
  candidates.push({name:'orig', text:input});

  let a1 = decodeRound(input, 'latin1');
  candidates.push({name:'latin1-1', text:a1});
  let a2 = decodeRound(a1, 'latin1');
  candidates.push({name:'latin1-2', text:a2});
  let a3 = decodeRound(a2, 'latin1');
  candidates.push({name:'latin1-3', text:a3});

  candidates = candidates.map(c=>({...c, ...score(c.text)}));
  candidates.sort((x,y)=> (y.score-x.score) || (x.repl-y.repl) || (y.arabic-x.arabic));
  return {best:candidates[0], all:candidates};
}

const files = process.argv.slice(2);
for(const f of files){
  const src = fs.readFileSync(f,'utf8');
  const {best, all} = bestFix(src);
  console.log('FILE', f);
  console.log(all.map(x=>`${x.name}: score=${x.score}, ar=${x.arabic}, moj=${x.moj}, repl=${x.repl}`).join('\n'));
  if(best.name !== 'orig'){
    fs.copyFileSync(f, f + '.bak_before_deep_fix');
    fs.writeFileSync(f, best.text, 'utf8');
    console.log('APPLIED', best.name);
  } else {
    console.log('NO_CHANGE');
  }
}
