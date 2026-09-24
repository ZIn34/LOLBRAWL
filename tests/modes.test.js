const src = require('fs').readFileSync(__dirname+'/g.js','utf8');
const noop=()=>{}; const ctx2d=new Proxy({},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>(t[k]=v,true)});
const el=()=>({getContext:()=>ctx2d,addEventListener:noop,getBoundingClientRect:()=>({left:0,top:0,width:960,height:640}),style:{},classList:{add:noop,toggle:noop},setPointerCapture:noop,hidden:false,textContent:''});
const listeners={};
global.document={getElementById:el,createElement:el,body:el(),fonts:{ready:Promise.resolve()}};
global.window=global; global.devicePixelRatio=1; global.matchMedia=()=>({matches:false});
global.addEventListener=(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)};
Object.defineProperty(global,'navigator',{value:{getGamepads:()=>[]},configurable:true});
global.performance={now:()=>T}; let T=0; let raf=null; global.requestAnimationFrame=f=>{raf=f};
global.localStorage={getItem:()=>null,setItem:noop};
eval(src);
const key=(code,down=true)=>listeners[down?'keydown':'keyup'].forEach(f=>f({code,preventDefault:noop}));
const tap=c=>{key(c);key(c,false);};
function run(sec, each){ for(let i=0;i<sec*60;i++){T+=16.7; if(each) each(i); raf(T);} }
const mash=i=>{ const c=['KeyF','KeyE','Space','Comma','Period','KeyD','ArrowLeft','KeyQ','Slash','KeyW'][i%10]; if(i%7===0)key(c); if(i%7===3)key(c,false); };
// solo
tap('Digit1'); run(40, mash); tap('Tab'); tap('KeyS'); tap('Enter'); console.log('solo ok');
// local coop: title -> 2 -> where -> LOCAL
tap('Digit2'); tap('Enter'); run(40, mash); tap('Tab'); tap('KeyS'); tap('Enter'); console.log('coop ok');
tap('Digit3'); tap('Enter'); run(60, mash); tap('Tab'); tap('KeyS'); tap('Enter'); console.log('versus ok');
