const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const fs=require("fs");
const VID="/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid";
(async()=>{
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const p=await b.newPage({viewport:{width:900,height:700}});
await p.goto("http://localhost:8501/measure.html",{waitUntil:"networkidle"});
const r=await p.evaluate(()=>{
  const out={};
  for(const k of Object.keys(window.PEOPLE)){
    const g=document.getElementById("m_"+k);
    const bb=g.getBBox();
    out[k]={x:+bb.x.toFixed(1),y:+bb.y.toFixed(1),w:+bb.width.toFixed(1),h:+bb.height.toFixed(1)};
  }
  return out;
});
console.log(JSON.stringify(r,null,1));
fs.writeFileSync(VID+"/people_bbox.json",JSON.stringify(r,null,1));
await b.close();})();
