const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const OUT="/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid/plate/";
const RANGES=[[0,216],[216,372],[816,942]];    // scenes 1+2, 3, 5
(async()=>{
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args:["--force-device-scale-factor=1","--hide-scrollbars"]});
const p=await b.newPage({viewport:{width:1080,height:1920}});
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8501/?plate=caps",{waitUntil:"networkidle"});
await p.evaluate(()=>window.__ready); await p.waitForTimeout(400);
let n=0;
for(const [a,z] of RANGES)
  for(let i=a;i<=z;i++){
    await p.evaluate(f=>window.setFrame(f),i);
    await p.screenshot({path:OUT+String(i).padStart(5,"0")+".png",omitBackground:true});
    n++;
  }
console.log("plate frames:",n,"| errors:",errs.length?errs.slice(0,2):"none");
await b.close();})();
