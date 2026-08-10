const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const OUT="/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid/shots/";
(async()=>{
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
p.on("pageerror",e=>console.log("ERR",e.message));
await p.goto("http://localhost:8391/",{waitUntil:"networkidle"});
const shots=[
 ["hub",      "english", 5, "subject"],
 ["math",     "math",    5, "ma1"],
 ["english",  "english", 5, "p1"],
 ["hebrew",   "hebrew",  3, "hv"],
 ["match",    "hebrew",  3, "hb"],
 ["reading",  "science", 5, "sr"],
 ["science",  "science", 5, "sq"],
 ["geo",      "geo",     6, "gq"],
 ["history",  "history", 7, "iq"],
 ["balloons", "english", 4, "p6"],
 ["done",     "math",    5, "done"],
];
for(const [name,subj,g,scr] of shots){
  await p.evaluate(async([subj,g,scr])=>{
    S.name="נועם";S.phone="0500000011";S.avatar="🦊";
    S.history=[{t:Date.now()-86400000,name:"נועם",subject:"math",lvl:g,correct:9,total:10,g:90},
               {t:Date.now()-172800000,name:"נועם",subject:"hebrew",lvl:g,correct:8,total:10,g:80}];
    S.seen=[];S.prog={};S.partCounts={};
    S.subject=subj;S.age=g+5;S.lvlOverride=g;S.adaptLvl=g;
    startFreshTest();
    if(scr==="done"){ S.score=27; S.partCounts={ma1:10,ma2:10,ma5:10}; }
    S.screen=scr; render();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  },[subj,g,scr]);
  await p.waitForTimeout(350);
  await p.screenshot({path:OUT+name+".png"});
  console.log("shot",name);
}
await b.close();})();
