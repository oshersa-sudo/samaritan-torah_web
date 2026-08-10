const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const OUT="/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid/frames/";
(async()=>{
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args:["--force-device-scale-factor=1","--hide-scrollbars"]});
const p=await b.newPage({viewport:{width:1080,height:1920}});
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8501/",{waitUntil:"networkidle"});
await p.evaluate(()=>window.__ready);
await p.waitForTimeout(500);                      // let the webfont settle
const N=await p.evaluate(()=>window.TOTAL_FRAMES);
const t0=Date.now();
for(let i=0;i<N;i++){
  await p.evaluate(n=>window.setFrame(n),i);
  await p.screenshot({path:OUT+String(i).padStart(5,"0")+".jpg",type:"jpeg",quality:94});
  if(i%120===0)console.log(i+"/"+N,Math.round((Date.now()-t0)/1000)+"s");
}
console.log("done",N,"frames in",Math.round((Date.now()-t0)/1000)+"s");
console.log("PAGE ERRORS:",errs.length?errs.slice(0,3):"none");
await b.close();})();
