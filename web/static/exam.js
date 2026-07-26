/* English Trainer — Vanilla JS port */
"use strict";

// ─── Content ──────────────────────────────────────────────
// Every entry: w=word · e=emoji · lvl=1..5 · h=Hebrew meaning
// Age→level: ≤7→1 · ≤9→2 · ≤11→3 · ≤14→4 · else→5
// lvl 2–3 (ages 8–11) are enriched with professions, tools, vehicles,
// kitchen utensils, fruit & veg, furniture and school-subject words.
const VOCAB = (typeof window!=="undefined" && Array.isArray(window.VOCAB_EN) && window.VOCAB_EN.length)
  ? window.VOCAB_EN
  : [ /* fallback only — full 2950-word set is loaded from vocab_en.js */
      {w:"apple",e:"🍎",lvl:1,h:"תפוח"},{w:"dog",e:"🐶",lvl:1,h:"כלב"},{w:"sun",e:"☀️",lvl:1,h:"שמש"},
      {w:"teacher",e:"🧑‍🏫",lvl:2,h:"מורה"},{w:"bicycle",e:"🚲",lvl:2,h:"אופניים"},
      {w:"doctor",e:"🧑‍⚕️",lvl:3,h:"רופא"},{w:"hammer",e:"🔨",lvl:3,h:"פטיש"},
      {w:"microscope",e:"🔬",lvl:4,h:"מיקרוסקופ"},{w:"manuscript",e:"📜",lvl:5,h:"כתב יד"},
    ];

const CLOZE = [
  {
    id:"c1",lvl:1,title:"A Day at the Park",
    text:"On Sunday morning Dana went to the {1} near her house. The {2} was warm and the sky was very {3}. "+
      "She took her red {4} and a bottle of cold {5}. Her little {6} Tom ran after a butterfly. "+
      "Dana sat under a big {7} and opened her {8}. She read three {9} before lunch. "+
      "Then she saw her {10} Maya near the swings. They played together and {11} a lot. "+
      "At noon they ate {12} and shared an {13}. A small {14} came close and Tom gave it some bread. "+
      "Later the wind became {15} and grey clouds covered the {16}. "+
      "Dana put on her {17} and closed her bag. They walked {18} slowly along the path. "+
      "Tom was {19} but happy. Dana promised to come back {20} week. "+
      "At the gate they said {21} to Maya. The {22} home was short. "+
      "Mother opened the {23} and asked about their day. Dana said it was the best {24} of the whole {25}.",
    answers:["park","sun","blue","ball","water","brother","tree","book","pages","friend",
      "laughed","sandwiches","apple","bird","strong","sky","jacket","home","tired","next",
      "goodbye","walk","door","day","month"],
    decoys:["mountain","teacher","purple","airplane","silent","kitchen"],
    hints:["a green public place where children play","the bright star that gives us light and heat",
      "the colour of a clear sky","a round toy you throw or kick","a clear drink with no colour and no taste",
      "a boy in your family with the same parents","a tall plant with a trunk and branches",
      "pages with a story, joined together","the sheets of paper inside a book","someone you like and spend time with",
      "made a happy sound because something was funny","food made of two slices of bread with something inside",
      "a round red or green fruit","a small animal with feathers that can fly","having a lot of power or force",
      "the space above you where the clouds are","a short coat you wear when it is cold","the place where you live",
      "needing to rest or sleep","the one that comes after this one","what you say when you leave",
      "a short trip you make on your feet","the part of a house you open to go inside","the time from morning until night",
      "a period of about thirty days"],
  },
  {
    id:"c2",lvl:3,title:"The Old Lighthouse",
    text:"The lighthouse stood on a rocky {1} above the grey sea. For ninety {2} its lamp had warned every passing {3}. "+
      "Its keeper, an old man named Elias, climbed the narrow {4} twice each night. "+
      "He carried a heavy {5} of oil and a small {6}. The stairs were {7} and the wind was {8}. "+
      "From the top he could see the whole {9} and, on clear nights, the lights of the distant {10}. "+
      "Elias kept a {11} where he wrote the weather, the {12} of every ship, and anything {13}. "+
      "One winter a terrible {14} broke the eastern {15}. The waves rose higher than the {16}. "+
      "Elias worked all night to keep the {17} burning. In the morning the village {18} came to help him. "+
      "They found him {19} but alive, still holding the {20}. The newspaper called him a {21}. "+
      "Elias only said that the {22} needed the light, and that was {23}. "+
      "Today the lighthouse is a {24}, and children read his diary in the small {25} downstairs.",
    answers:["cliff","years","ship","stairs","can","lantern","steep","cold","bay","harbour",
      "diary","name","unusual","storm","window","roof","flame","fishermen","exhausted","matches",
      "hero","sailors","enough","museum","room"],
    decoys:["desert","sandals","chocolate","guitar","quietly","birthday"],
    hints:["a high steep rock face above the sea","periods of twelve months each",
      "a large boat that crosses the sea","steps that take you to a higher floor","a sealed metal container for liquid",
      "a lamp you carry, with the light inside glass","rising sharply and hard to climb","having a very low temperature",
      "a curved part of the coast where the sea comes in","a safe place where ships stop",
      "a book where you write what happens each day","the word people use to call someone","not normal or not common",
      "very bad weather with strong wind and rain","an opening in a wall with glass in it","the covering on top of a building",
      "the bright hot part of a fire","men who catch fish for a living","extremely tired","small sticks used to start a fire",
      "someone admired for great courage","people who work on ships","as much as is needed",
      "a building where old or important things are shown","a space inside a building, with walls"],
  },
];

const STORIES = [
  {
    id:"s1",lvl:2,title:"The Boy Who Fixed Clocks",
    text:`Sami was eleven years old and lived above his father's small repair shop on a narrow street. Every afternoon, when school ended, he sat on a wooden stool behind the counter and watched his father work. His father repaired clocks — big wall clocks, tiny silver watches, and old alarm clocks that no one else wanted to touch.

"A clock is honest," his father liked to say. "It tells you exactly when you are wrong."

One rainy Tuesday a woman brought in a clock shaped like a small house. It had a wooden bird inside that was supposed to come out every hour and sing. The bird had not sung for eleven years, she said. Her mother had owned the clock, and her mother's mother before that.

Sami's father opened the back of the clock and looked inside for a long time. Then he shook his head. "The spring is broken," he said. "I cannot find this part any more. They stopped making it before I was born."

The woman took the clock home and did not come back.

But Sami could not stop thinking about the silent bird. That night he drew the broken spring on a page of his notebook. The next day he drew it again, and again the day after. On Friday he went to the metal workshop at the end of the street and asked the man there for a thin piece of steel.

For three weeks Sami worked in secret. He cut, bent, measured, and failed. He failed sixteen times. The seventeenth spring was ugly, but it was the right shape.

When the woman came back in the spring to collect an old watch, Sami placed the house-shaped clock on the counter. He wound it carefully. At exactly four o'clock the small wooden door opened and the bird came out and sang.

The woman did not say anything for a moment. Then she began to cry, and then she laughed.

Sami's father looked at his son for a long time. "A clock is honest," he said quietly. "And so is patience."`,
    qpool:[
      {q:"Where did Sami live?",o:["Above his father's repair shop","In a village near the sea","Behind the school","In the metal workshop"],c:0},
      {q:"What did Sami's father repair?",o:["Bicycles","Clocks and watches","Shoes","Radios"],c:1},
      {q:"How long had the wooden bird been silent?",o:["Three weeks","One year","Eleven years","Ninety years"],c:2},
      {q:"Why couldn't the father fix the clock?",o:["He was too busy","The part was no longer made","The woman could not pay","The clock was too small"],c:1},
      {q:"How many times did Sami fail before he succeeded?",o:["Sixteen","Seventeen","Three","Eleven"],c:0},
      {q:"Where did Sami get the steel?",o:["From his father","From the woman","From a workshop on the street","From his school"],c:2},
      {q:"The new spring was described as",o:["perfect and shiny","ugly but the right shape","too short","made of silver"],c:1},
      {q:"At what time did the bird finally sing?",o:["Four o'clock","Noon","Midnight","Eight o'clock"],c:0},
      {q:"What was the woman's first reaction?",o:["She laughed loudly","She said nothing, then cried","She asked for money back","She left the shop"],c:1},
      {q:"What does the father's last sentence suggest?",o:["Patience is as reliable as a clock","Clocks are hard to fix","Sami should study more","The woman was wrong"],c:0},
      {q:"Sami drew the broken spring because",o:["his teacher asked him to","he wanted to understand it","he liked drawing birds","his father told him to"],c:1},
      {q:"The story mainly shows that",o:["old clocks are valuable","persistence can solve what experts give up on","children should not work","rain brings good luck"],c:1},
    ],
  },
  {
    id:"s2",lvl:4,title:"The Map That Was Wrong",
    text:`For two hundred years, every map of the northern coast showed an island called Sable Rock. It appeared on charts printed in London, copied in Lisbon, and reprinted in Boston. Captains marked it, avoided it, and warned each other about it. Insurance companies charged higher prices for ships that sailed near it.

The island did not exist.

The mistake began in 1799, when a young officer named Carter recorded a "low dark mass" during a night of heavy fog. He was tired, the sea was rough, and what he almost certainly saw was a whale. He wrote the position in his logbook and forgot about it. A clerk in the naval office copied the entry onto the master chart. From that chart, every later map was drawn.

Several sailors reported that they had passed through the exact position of Sable Rock and seen nothing but open water. Their reports were filed away. One editor wrote in the margin: "Instrument error — the island is well established."

That sentence is the heart of the problem. Once information is repeated often enough, it stops being evidence and starts being background. New facts are then tested against it, instead of the other way around.

The island was finally removed in 1957, after a survey ship spent four days sailing back and forth across the position with modern equipment. Even then, two shipping companies kept the old charts in use for another decade, because reprinting them was expensive.

Historians of navigation call these "phantom islands." More than two hundred have been erased from official maps. Some lasted a few years. Sable Rock lasted a hundred and fifty-eight.

The lesson is not that mapmakers were careless. Most were careful. The lesson is that a careful system built on a single unchecked observation will produce careful, confident, and wrong results for a very long time.`,
    qpool:[
      {q:"What was Sable Rock?",o:["A dangerous reef","An island that never existed","A naval base","A type of ship"],c:1},
      {q:"When did the error begin?",o:["1799","1957","1899","1750"],c:0},
      {q:"What did Carter most likely see?",o:["A rock","Another ship","A whale","A storm cloud"],c:2},
      {q:"How did the error spread?",o:["Sailors invented stories","A clerk copied it to the master chart","Insurance companies added it","It was a deliberate hoax"],c:1},
      {q:"How were the sailors' reports treated?",o:["Investigated at once","Filed away and dismissed","Published widely","Sent to Carter"],c:1},
      {q:"The editor's margin note shows that",o:["he trusted the instruments","established belief outweighed new evidence","the sailors were lying","the chart was new"],c:1},
      {q:"How long did Sable Rock survive on maps?",o:["Ten years","Fifty-eight years","A hundred and fifty-eight years","Two hundred years"],c:2},
      {q:"Why did two companies keep the old charts?",o:["They doubted the survey","Reprinting cost too much","The government required it","Their captains preferred them"],c:1},
      {q:"What is a 'phantom island'?",o:["An island that sank","A mapped island that does not exist","A very small island","An island with no name"],c:1},
      {q:"The author's main point is that",o:["mapmakers were lazy","careful systems can preserve a single error","night navigation is dangerous","modern equipment is unnecessary"],c:1},
      {q:"\"It stops being evidence and starts being background\" means the claim",o:["is forgotten","is no longer questioned","becomes secret","is proven true"],c:1},
      {q:"What finally removed the island?",o:["A captain's complaint","A four-day modern survey","A new insurance rule","Carter's confession"],c:1},
    ],
  },
];

const PICTURES = [
  {e:"🐘",ok:["elephant","an elephant","the elephant"]},
  {e:"🚲",ok:["bicycle","a bicycle","bike","a bike"]},
  {e:"🌧️",ok:["rain","raining","it is raining","it's raining","cloud and rain"]},
  {e:"🏫",ok:["school","a school","school building"]},
  {e:"🍕",ok:["pizza","a pizza","slice of pizza"]},
  {e:"🧑‍🍳",ok:["cook","a cook","chef","a chef"]},
  {e:"⛵",ok:["boat","a boat","sailboat","a sailboat","ship"]},
  {e:"🎂",ok:["cake","a cake","birthday cake"]},
  {e:"🦁",ok:["lion","a lion","the lion"]},
  {e:"🌉",ok:["bridge","a bridge","the bridge"]},
];

// ─── Constants ────────────────────────────────────────────
const QUOTA = {vocab:10,cloze:25,reading:6,pics:10,match:6,balloons:5};
const TIME   = {vocab:300,cloze:600,reading:600,pics:600,match:210,balloons:180,
                hv:240,hb:210,hw:240,hr:600,
                ma1:240,ma2:300,ma3:360,ma4:240};
const LEVEL_NAME = {1:"כיתות א׳–ב׳",2:"כיתות ג׳–ד׳",3:"כיתות ה׳–ו׳",4:"חטיבה",5:"תיכון"};
const PART_NAME  = {p1:"אוצר מילים",p2:"השלמת מילים",p3:"הבנת הנקרא",p4:"תיאור תמונה",
                    p5:"התאמת מילים",p6:"בלונים",
                    hv:"אוצר מילים",hb:"התאמת מילים",hw:"פירוש מילים",hr:"הבנת הנקרא",
                    ma1:"חיבור וחיסור",ma2:"כפל וחילוק",ma3:"בעיות מילוליות",ma4:"המספר החסר"};
// answers per part → used to normalise the score to /100
const PART_QUOTA = {p1:10,p2:25,p3:6,p4:10,p5:6,p6:5,
                    hv:10,hb:8,hw:10,hr:6,
                    ma1:10,ma2:10,ma3:6,ma4:8};
// subjects and their part order — every subject: 4 parts, 4 hourglasses
const SUBJECTS = {
  english:{name:"אנגלית", icon:"🔤", order:["p1","p2","p3","p4","p5","p6"]},
  hebrew: {name:"עברית",  icon:"📖", order:["hv","hb","hw","hr"]},
  math:   {name:"חשבון",  icon:"🔢", order:["ma1","ma2","ma3","ma4"]},
};
function curSubject(){ return SUBJECTS[S.subject] || SUBJECTS.english; }
function curOrder(){ return curSubject().order; }
function subjTotal(){ return curOrder().reduce((a,p)=>a+(PART_QUOTA[p]||0),0); }
const K = {session:p=>`session:${p}`,results:p=>`results:${p}`,seen:p=>`seen:${p}`};

// ─── Utilities ────────────────────────────────────────────
const shuffle = a => {
  const r=[...a];
  for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}
  return r;
};
const levelForAge = age => age<=7?1:age<=9?2:age<=11?3:age<=14?4:5;
const nearLevel = (items,lvl,min=6) => {
  let out=items.filter(i=>i.lvl===lvl),span=1;
  while(out.length<min&&span<5){out=items.filter(i=>Math.abs(i.lvl-lvl)<=span);span++;}
  return out.length?out:items;
};
const grade  = c => Math.round((c/subjTotal())*100);
const fmtDate= t => new Date(t).toLocaleDateString("he-IL",{day:"2-digit",month:"2-digit",year:"2-digit"});
const speak  = text => {
  try{if(!("speechSynthesis"in window))return;window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.lang="en-US";u.rate=0.85;window.speechSynthesis.speak(u);}catch(e){}
};

// ─── Sound effects (synthesized — no asset files) ─────────
const SFX = {
  _ctx:null,
  _ac(){ try{ if(!this._ctx) this._ctx=new (window.AudioContext||window.webkitAudioContext)();
    if(this._ctx.state==="suspended") this._ctx.resume(); return this._ctx; }catch(e){ return null; } },
  _tone(ctx,freq,t0,dur,type="sine",gain=0.22){
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(gain,t0+0.015);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g);g.connect(ctx.destination);o.start(t0);o.stop(t0+dur+0.02);
  },
  // חגיגי — ארפג'יו עולה + "נצנוץ" (תשואות ילדים)
  good(){
    const ctx=this._ac();if(!ctx)return;const t=ctx.currentTime;
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>this._tone(ctx,f,t+i*0.09,0.28,"triangle",0.22));
    this._tone(ctx,1567.98,t+0.36,0.30,"sine",0.14);
    // רעש-לבן קצר כמחיאות כפיים
    try{
      const n=ctx.createBufferSource(),b=ctx.createBuffer(1,ctx.sampleRate*0.35,ctx.sampleRate);
      const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
      const g=ctx.createGain();g.gain.setValueAtTime(0.10,t+0.30);g.gain.exponentialRampToValueAtTime(0.0001,t+0.72);
      const hp=ctx.createBiquadFilter();hp.type="highpass";hp.frequency.value=1400;
      n.buffer=b;n.connect(hp);hp.connect(g);g.connect(ctx.destination);n.start(t+0.30);
    }catch(e){}
  },
  // שגיאה — שני צלילים יורדים נמוכים
  bad(){
    const ctx=this._ac();if(!ctx)return;const t=ctx.currentTime;
    this._tone(ctx,311.13,t,0.18,"sawtooth",0.18);
    this._tone(ctx,207.65,t+0.16,0.30,"sawtooth",0.18);
  },
};
// שחרור AudioContext במגע ראשון (מדיניות דפדפנים)
window.addEventListener("pointerdown",()=>SFX._ac(),{once:true});
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// ─── Storage ──────────────────────────────────────────────
const sGet = k=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}};
const sSet = (k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const sDel = k=>{try{localStorage.removeItem(k);}catch(e){}};

// ─── Global State ─────────────────────────────────────────
const S = {screen:"login",name:"",phone:"",age:9,score:0,seen:[],history:[],found:null,busy:false,prog:{},subject:"english",parentCode:"",lastGain:null};

// ─── Gamification (streak · XP · level · coins · badges) ──────────────────────
const BADGES=[
  {id:"first",   ic:"🎉", name:"מבחן ראשון", test:g=>g.tests>=1},
  {id:"three",   ic:"⭐", name:"3 מבחנים",    test:g=>g.tests>=3},
  {id:"ten",     ic:"🌟", name:"10 מבחנים",   test:g=>g.tests>=10},
  {id:"streak3", ic:"🔥", name:"רצף 3 ימים",  test:g=>g.bestStreak>=3},
  {id:"streak7", ic:"🔥", name:"רצף שבוע",    test:g=>g.bestStreak>=7},
  {id:"streak30",ic:"🏆", name:"רצף חודש",    test:g=>g.bestStreak>=30},
  {id:"perfect", ic:"💯", name:"ציון מושלם",  test:g=>g.perfects>=1},
  {id:"coins500",ic:"💰", name:"500 מטבעות",  test:g=>g.coins>=500},
];
function _dstr(ms){const d=new Date(ms);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function gamLoad(){return sGet("gam:"+S.phone)||{xp:0,coins:0,streak:0,bestStreak:0,lastDay:"",tests:0,perfects:0,badges:[]};}
function gamSave(g){if(S.phone)sSet("gam:"+S.phone,g);}
function gamLevel(xp){return 1+Math.floor((xp||0)/500);}
function gamAward(grade,correct){
  const g=gamLoad(),today=_dstr(Date.now());
  if(g.lastDay!==today){g.streak=(g.lastDay===_dstr(Date.now()-864e5))?(g.streak||0)+1:1;g.lastDay=today;}
  if(!g.streak)g.streak=1;
  g.bestStreak=Math.max(g.bestStreak||0,g.streak);
  const beforeLvl=gamLevel(g.xp);
  const xpGain=correct*10+(grade>=90?50:grade>=70?20:0), coinGain=correct;
  g.xp=(g.xp||0)+xpGain; g.coins=(g.coins||0)+coinGain; g.tests=(g.tests||0)+1;
  if(grade>=100)g.perfects=(g.perfects||0)+1;
  const had=new Set(g.badges||[]);
  const fresh=BADGES.filter(b=>!had.has(b.id)&&b.test(g));
  g.badges=[...(g.badges||[]),...fresh.map(b=>b.id)];
  gamSave(g);
  return {xpGain,coinGain,streak:g.streak,newBadges:fresh,
          leveledTo:gamLevel(g.xp)>beforeLvl?gamLevel(g.xp):0,
          stars:grade>=90?3:grade>=70?2:1,coins:g.coins,xp:g.xp};
}
function launchConfetti(){
  const el=document.getElementById("confetti");if(!el)return;
  const cols=["#6C5CE7","#FFB627","#3FBF6F","#F2545B","#2AA9E0","#E255A1"];let h="";
  for(let i=0;i<70;i++){
    const l=Math.random()*100,d=1.1+Math.random()*1.6,dl=Math.random()*0.5,c=cols[i%cols.length],r=Math.random()*360;
    h+=`<i style="left:${l}%;background:${c};animation-duration:${d}s;animation-delay:${dl}s;transform:rotate(${r}deg)"></i>`;
  }
  el.innerHTML=h;
}

// Hebrew-subject content (loaded from hebrew_data.js if present)
const HEB_VOCAB   = (typeof window!=="undefined" && Array.isArray(window.HEB_VOCAB))   ? window.HEB_VOCAB   : [];
const HEB_STORIES = (typeof window!=="undefined" && Array.isArray(window.HEB_STORIES)) ? window.HEB_STORIES : [];

// ─── Optional cloud sync (Contabo backend) ───────────────
// Enabled only when window.LEARN_BACKEND is set to the server URL. Purely
// best-effort — localStorage stays the source of truth and the app works
// fully offline when this is empty.
const BACKEND=(typeof window!=="undefined"&&window.LEARN_BACKEND)?String(window.LEARN_BACKEND).replace(/\/+$/,""):"";
function beacon(path,body){
  if(!BACKEND)return Promise.resolve(null);
  return fetch(BACKEND+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    .then(r=>r.json()).catch(()=>null);
}
function syncRegister(){
  if(!BACKEND)return;
  beacon("/api/register",{name:S.name,phone:S.phone,age:S.age}).then(j=>{
    if(j&&j.parent_code){S.parentCode=j.parent_code;sSet("pcode:"+S.phone,j.parent_code);
      const el=document.getElementById("parent-code");if(el)el.textContent=j.parent_code;}
  });
}
function syncResult(rec){
  if(!BACKEND)return;
  beacon("/api/results",{phone:S.phone,subject:rec.subject,grade:rec.g,correct:rec.correct,total:rec.total,ts:rec.t});
}

// ─── Timer ────────────────────────────────────────────────
const TM = {
  _id:null, left:0, total:1, _cb:null,
  start(secs,total,cb){
    this.stop();this.left=secs;this.total=total;this._cb=cb;
    this._id=setInterval(()=>{
      this.left=Math.max(0,this.left-1);
      updateHG();
      if(this.left<=0){this.stop();if(this._cb)this._cb();}
    },1000);
  },
  stop(){if(this._id){clearInterval(this._id);this._id=null;}},
};
function updateHG(){const w=document.getElementById("hg-wrap");if(w)w.innerHTML=hgHTML(TM.left,TM.total);}

// ─── Part Runtime ─────────────────────────────────────────
const V={},C={},R={},D={},M={},B={},MA={};

// ─── HTML Builders ────────────────────────────────────────
function hgHTML(left,total){
  const p=Math.max(0,Math.min(1,left/total));
  const mm=String(Math.floor(left/60)).padStart(2,"0"),ss=String(left%60).padStart(2,"0");
  const topY=(5+25*(1-p)).toFixed(2),botY=(57-25*(1-p)).toFixed(2);
  const stream=p>0&&p<1?'<rect x="19.4" y="30" width="1.2" height="9" class="hg-sand"/>':'';
  return `<div class="hg">
  <svg viewBox="0 0 40 62" width="34" height="53" aria-hidden="true">
    <defs>
      <clipPath id="hgTop"><path d="M6 5 H34 L21.6 30 H18.4 Z"/></clipPath>
      <clipPath id="hgBot"><path d="M18.4 32 H21.6 L34 57 H6 Z"/></clipPath>
    </defs>
    <rect x="4" y="2" width="32" height="4" rx="2" class="hg-frame"/>
    <rect x="4" y="56" width="32" height="4" rx="2" class="hg-frame"/>
    <path d="M6 5 H34 L21.6 30 H18.4 Z" class="hg-glass"/>
    <path d="M18.4 32 H21.6 L34 57 H6 Z" class="hg-glass"/>
    <g clip-path="url(#hgTop)"><rect x="0" y="${topY}" width="40" height="30" class="hg-sand"/></g>
    <g clip-path="url(#hgBot)"><rect x="0" y="${botY}" width="40" height="30" class="hg-sand"/></g>
    ${stream}
  </svg>
  <span class="hg-time${left<=30?" hg-low":""}">${mm}:${ss}</span>
</div>`;
}

function topbarHTML(){
  if(S.screen==="login")return "";
  const lvl=levelForAge(S.age),showPause=curOrder().includes(S.screen),subj=curSubject();
  return `<header class="topbar">
  <div class="brand">${subj.icon} ${esc(subj.name)}</div>
  <div class="who">${esc(S.name)}${S.name?" · ":""}${LEVEL_NAME[lvl]}</div>
  ${showPause?'<button class="pausebtn" id="btn-home" title="לתפריט הראשי">⌂</button>':""}
  ${showPause?'<button class="pausebtn" id="btn-pause" title="השהה ושמור">⏸</button>':""}
  ${showPause?'<button class="pausebtn" id="btn-skip" title="דלג לשלב הבא">⏭</button>':""}
  <div class="score" id="score-el" aria-label="ניקוד">${grade(S.score)}<small>/100</small></div>
</header>`;
}

function loginHTML(){
  return `<section class="card hero">
  <span class="eyebrow">אימון למידה יומי</span>
  <h1>ארבעה חלקים.<br>ארבעה שעוני חול.</h1>
  <p class="sub">מילים, השלמות, סיפור, חשבון ועוד — לפי הגיל והרמה בבית הספר. נשמר במכשיר וניתן להמשיך בכל רגע.</p>
  <label class="fld">מה לומדים היום?</label>
  <div class="subjects login-subjects" id="login-subjects">
    ${Object.entries(SUBJECTS).map(([k,s])=>`<button type="button" class="subj-btn${S.subject===k?" subj-on":""}" data-subj="${k}"><span class="subj-ic">${s.icon}</span><b>${esc(s.name)}</b></button>`).join("")}
  </div>
  <label class="fld">שם<input id="inp-name" placeholder="איך קוראים לך?" value="${esc(S.name)}"></label>
  <label class="fld">מספר טלפון<input id="inp-phone" type="tel" inputmode="numeric" dir="ltr" placeholder="0500000000" value="${esc(S.phone)}"></label>
  <label class="fld">גיל
    <input id="inp-age" type="range" min="5" max="18" value="${S.age}">
    <b id="age-lbl">${S.age} · ${LEVEL_NAME[levelForAge(S.age)]}</b>
  </label>
  <button id="btn-enter" class="primary" ${(!S.name.trim()||S.phone.length<9||S.busy)?"disabled":""}>
    ${S.busy?"רגע…":"יאללה, מתחילים"}
  </button>
</section>`;
}

function resumeHTML(){
  const f=S.found;
  return `<section class="card hero">
  <span class="eyebrow">נמצא מבחן פתוח</span>
  <h1>להמשיך?</h1>
  <p class="sub">נעצר ב<b>${esc(PART_NAME[f.screen]||"אמצע")}</b> בתאריך ${fmtDate(f.t)}, עם ${grade(f.score||0)} מתוך 100.</p>
  <button class="primary" id="btn-resume">המשך מהמקום שנעצרתי</button>
  <button class="ghost" id="btn-fresh">התחל מבחן חדש</button>
</section>`;
}

const PART_DESC = {p1:"מילים · 5 דק׳",p2:"השלמות · 10 דק׳",p3:"שאלות · 10 דק׳",p4:"תמונות · 10 דק׳",
                   p5:"התאמות · 3.5 דק׳",p6:"בלונים · 3 דק׳",
                   hv:"מילים · 4 דק׳",hb:"התאמות · 3.5 דק׳",hw:"פירושים · 4 דק׳",hr:"שאלות · 10 דק׳",
                   ma1:"תרגילים · 4 דק׳",ma2:"תרגילים · 5 דק׳",ma3:"בעיות · 6 דק׳",ma4:"תרגילים · 4 דק׳"};

function subjectHTML(){
  return `<section class="card hero">
  <span class="eyebrow">בחירת מקצוע</span>
  <h1>מה לומדים היום?</h1>
  <p class="sub">בחר/י מקצוע. אפשר להחליף בכל רגע — כל מקצוע נשמר בנפרד.</p>
  <div class="subjects">
    ${Object.entries(SUBJECTS).map(([k,s])=>`<button class="subj-btn" data-subj="${k}"><span class="subj-ic">${s.icon}</span><b>${esc(s.name)}</b></button>`).join("")}
  </div>
</section>`;
}

function menuHTML(){
  const subj=curSubject();
  const rel=S.history.filter(r=>(r.subject||"english")===S.subject).slice(0,5);
  const hist=rel.length
    ?`<span class="eyebrow">מבחנים קודמים</span>
<ul class="hist">${rel.map(r=>`<li><span>${fmtDate(r.t)}</span><b>${r.g}/100</b></li>`).join("")}</ul>`:"";
  const items=curOrder().map(p=>
    `<li data-part="${p}"><b>${PART_NAME[p]}</b><span>${PART_QUOTA[p]} ${PART_DESC[p]||""}</span></li>`).join("");
  const gm=gamLoad();
  const earned=(gm.badges||[]).map(id=>BADGES.find(b=>b.id===id)).filter(Boolean);
  const statbar=`<div class="statbar">
    <span class="stat"><b>${gm.streak||0}</b> 🔥</span>
    <span class="stat"><b>${gamLevel(gm.xp)}</b> ⭐ רמה</span>
    <span class="stat"><b>${gm.coins||0}</b> 🪙</span>
  </div>${earned.length?`<div class="badge-row mini">${earned.map(b=>`<span class="badge-chip" title="${esc(b.name)}">${b.ic}</span>`).join("")}</div>`:""}`;
  return `<section class="card">
  <div class="menu-head"><button class="ghost sm" id="btn-subj-back">↩ מקצוע</button><span class="eyebrow">${subj.icon} ${esc(subj.name)} · התוכנית שלך</span></div>
  ${statbar}
  <ul class="plan">${items}</ul>
  <p class="foot">${subjTotal()} תשובות · הציון מוצג מתוך 100</p>
  ${BACKEND?`<p class="foot">קוד להורים: <b id="parent-code">${esc(S.parentCode||"…")}</b> — למעקב מרחוק דרך עמוד ההורים</p>`:""}
  ${hist}
  <button class="primary" id="btn-start">התחלה</button>
</section>`;
}

function vocabHTML(){
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">חלק 1 · אוצר מילים</span><p class="lead">מה רואים בתמונה?</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.vocab?.left??TIME.vocab,TIME.vocab)}</span></div>
  </div>
  <div class="pic" id="q-pic"></div>
  <div class="opts" id="q-opts"></div>
  <p class="hint" id="q-hint"></p>
  <button class="ghost" id="btn-speak" disabled>🔊 שמע/י שוב</button>
</section>`;
}

function clozeHTML(){
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">חלק 2 · השלמת מילים</span><p class="lead" id="cloze-ttl"></p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.cloze?.left??TIME.cloze,TIME.cloze)}</span></div>
  </div>
  <p class="story cloze" dir="ltr" id="cloze-story"></p>
  <p class="foot">לחצו על קו ריק כדי לבחור מילה · על ? לרמז באנגלית · או בחרו מילה מהמאגר</p>
  <div class="bank" id="cloze-bank"></div>
  <div id="cloze-placer"></div>
  <div id="cloze-sheet"></div>
</section>`;
}

function readingHTML(){
  const eyebrow=(S.screen==="hr")?"עברית · הבנת הנקרא":"חלק 3 · הבנת הנקרא";
  const t=(S.screen==="hr")?TIME.hr:TIME.reading;
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">${eyebrow}</span><p class="lead" id="story-ttl"></p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.reading?.left??t,t)}</span></div>
  </div>
  <div id="reading-body"></div>
</section>`;
}

function describeHTML(){
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">חלק 4 · תיאור תמונה</span><p class="lead">כתוב/כתבי באנגלית מה רואים</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.pics?.left??TIME.pics,TIME.pics)}</span></div>
  </div>
  <div class="pic" id="q-pic"></div>
  <div class="placer center">
    <input id="desc-inp" dir="ltr" placeholder="type here…" autocomplete="off">
    <button class="primary sm" id="btn-check">בדיקה</button>
  </div>
</section>`;
}

// ─── Hebrew multiple-choice vocab (hv: definition→word · hw: word→definition) ─
const HM = {};
const HEB_MC_CFG = {
  hv:{eyebrow:"עברית · אוצר מילים", lead:"איזו מילה מתאימה להגדרה?", prompt:"d", answer:"w"},
  hw:{eyebrow:"עברית · פירוש מילים", lead:"מה הפירוש של המילה?",      prompt:"w", answer:"d"},
};
function mcHTML(){
  const c=HEB_MC_CFG[S.screen]||HEB_MC_CFG.hv, t=TIME[S.screen]??240;
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">${c.eyebrow}</span><p class="lead">${c.lead}</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog[S.screen]?.left??t,t)}</span></div>
  </div>
  <div class="mc-prompt" id="mc-prompt"></div>
  <div class="opts" id="q-opts"></div>
</section>`;
}
function initHebMC(){
  const scr=S.screen,cfg=HEB_MC_CFG[scr]||HEB_MC_CFG.hv;
  const lvl=levelForAge(S.age),n=PART_QUOTA[scr]||10,t=TIME[scr]??240;
  const saved=S.prog[scr];
  const src=(HEB_VOCAB.length?HEB_VOCAB:[]).filter(x=>x.w&&x.d);
  if(saved&&saved.qs){HM.qs=saved.qs;HM.i=saved.i||0;}
  else{
    const pool=nearLevel(src,lvl,Math.max(n+4,8));
    HM.qs=shuffle(pool).slice(0,n).map(it=>{
      const answer=it[cfg.answer], opts=[answer];
      for(const o of shuffle(pool.filter(x=>x[cfg.answer]!==answer)).map(x=>x[cfg.answer])){
        if(opts.length>=4)break; if(!opts.includes(o))opts.push(o);
      }
      return {p:it[cfg.prompt],a:answer,o:shuffle(opts)};
    });
    HM.i=0;
  }
  HM.picked=false;
  renderHebMCQ();
  TM.start(saved?.left??t,t,()=>gotoNext(scr));
}
function renderHebMCQ(){
  const q=HM.qs[HM.i];
  document.getElementById("q-ctr").textContent=`${HM.i+1}/${HM.qs.length}`;
  document.getElementById("mc-prompt").innerHTML=`<span dir="rtl">${esc(q.p)}</span>`;
  document.getElementById("q-opts").innerHTML=q.o.map(o=>
    `<button class="opt" data-val="${esc(o)}" dir="rtl"><span>${esc(o)}</span><span class="mark" style="display:none"></span></button>`).join("");
  HM.picked=false;
  document.getElementById("q-opts").onclick=e=>{
    const b=e.target.closest(".opt");if(!b||b.disabled||HM.picked)return;
    handleHebMC(b.dataset.val);
  };
}
function handleHebMC(val){
  if(HM.picked)return;HM.picked=true;
  const q=HM.qs[HM.i],correct=val===q.a;
  if(correct){addScore(1);SFX.good();}else SFX.bad();
  document.querySelectorAll("#q-opts .opt").forEach(b=>{
    const bv=b.dataset.val,mk=b.querySelector(".mark");
    if(bv===q.a){b.classList.add("opt-good");mk.textContent="✓";mk.className="mark good";mk.style.display="";}
    else if(bv===val&&!correct){b.classList.add("opt-bad");mk.textContent="✗";mk.className="mark bad";mk.style.display="";}
    else b.classList.add("opt-dim");
    b.disabled=true;
  });
  const scr=S.screen;
  commitProg({[scr]:{qs:HM.qs,i:HM.i,left:TM.left}});
  setTimeout(()=>{
    if(S.screen!==scr)return;
    HM.picked=false;HM.i++;
    if(HM.i>=HM.qs.length)gotoNext(scr);else renderHebMCQ();
  },1200);
}

const MATH_CFG = {
  ma1:{eyebrow:"חשבון · חיבור וחיסור",  lead:"בחר/י את התשובה הנכונה", type:"addsub"},
  ma2:{eyebrow:"חשבון · כפל וחילוק",    lead:"בחר/י את התשובה הנכונה", type:"muldiv"},
  ma3:{eyebrow:"חשבון · בעיות מילוליות", lead:"קרא/י ובחר/י תשובה",      type:"word"},
  ma4:{eyebrow:"חשבון · המספר החסר",     lead:"איזה מספר משלים?",        type:"missing"},
};
function mathHTML(){
  const c=MATH_CFG[S.screen]||MATH_CFG.ma1, t=TIME[S.screen]??300;
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">${c.eyebrow}</span><p class="lead">${c.lead}</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog[S.screen]?.left??t,t)}</span></div>
  </div>
  <div class="math-q" id="math-q"></div>
  <div class="opts" id="q-opts"></div>
</section>`;
}

function matchHTML(){
  const heb=(S.screen==="hb");
  const eyebrow=heb?"עברית · התאמת מילים":"חלק 5 · התאמת מילים";
  const foot=heb?"גררו מהמילה (משמאל) אל הפירוש הנכון (מימין)"
                :"גררו מהמילה באנגלית (משמאל) אל הפירוש הנכון בעברית (מימין)";
  const t=heb?TIME.hb:TIME.match;
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">${eyebrow}</span><p class="lead">מתחו קו בין המילה לפירוש</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.match?.left??t,t)}</span></div>
  </div>
  <p class="foot">${foot}</p>
  <div class="match" id="match-wrap" dir="${heb?"rtl":"ltr"}">
    <svg class="match-svg" id="match-svg"><line id="match-temp" class="match-temp" style="display:none"></line></svg>
    <div class="mcol mcol-l" id="mcol-left"></div>
    <div class="mcol mcol-r" id="mcol-right"></div>
  </div>
</section>`;
}

function balloonsHTML(){
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">חלק 6 · בלונים</span><p class="lead">חברו כל בלון למילה הנכונה</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.balloons?.left??TIME.balloons,TIME.balloons)}</span></div>
  </div>
  <p class="foot">גררו מחוט הבלון אל המילה באנגלית שמתאימה לתמונה</p>
  <div class="balloons" id="bln-wrap" dir="ltr">
    <svg class="match-svg" id="bln-svg"><line id="bln-temp" class="match-temp" style="display:none"></line></svg>
    <div class="bln-row" id="bln-top"></div>
    <div class="bln-words" id="bln-bot"></div>
  </div>
</section>`;
}

function pausedHTML(){
  return `<section class="card hero">
  <span class="eyebrow">נשמר במכשיר</span>
  <h1>המבחן ממתין לך</h1>
  <p class="sub">אפשר לסגור את הדף. בכניסה הבאה עם אותו מספר טלפון תחזור/י בדיוק לנקודה הזו.</p>
  <button class="primary" id="btn-menu">לתפריט</button>
</section>`;
}

function doneHTML(){
  const g=grade(S.score), lg=S.lastGain||{stars:1,xpGain:0,coinGain:0,streak:0,newBadges:[],leveledTo:0};
  const stars=[1,2,3].map(i=>`<span class="star${i<=lg.stars?" on":""}">★</span>`).join("");
  const msg=g>=90?"מדהים! 🌟":g>=70?"כל הכבוד! 👏":"יופי, ממשיכים! 💪";
  const lvl=lg.leveledTo?`<div class="levelup">⬆️ עלית לרמה ${lg.leveledTo}!</div>`:"";
  const badges=(lg.newBadges&&lg.newBadges.length)
    ?`<div class="new-badges"><span class="eyebrow">תגים חדשים!</span><div class="badge-row">${lg.newBadges.map(b=>`<div class="badge"><span class="badge-ic">${b.ic}</span><small>${esc(b.name)}</small></div>`).join("")}</div></div>`:"";
  const hist=S.history.length>1
    ?`<ul class="hist">${S.history.slice(0,5).map(r=>`<li><span>${fmtDate(r.t)}</span><b>${r.g}/100</b></li>`).join("")}</ul>`:"";
  return `<section class="card hero done-card">
  <div class="confetti" id="confetti"></div>
  <div class="stars">${stars}</div>
  <span class="eyebrow">סיימת</span>
  <h1>${g} <small class="of">/100</small></h1>
  <p class="sub">${msg} ${S.score} תשובות נכונות מתוך ${subjTotal()}.</p>
  <div class="gain-row">
    <div class="gain"><b>+${lg.xpGain}</b><small>XP</small></div>
    <div class="gain"><b>+${lg.coinGain}</b><small>🪙 מטבעות</small></div>
    <div class="gain"><b>${lg.streak} 🔥</b><small>רצף ימים</small></div>
  </div>
  ${lvl}${badges}${hist}
  <button class="primary" id="btn-again">סבב נוסף</button>
</section>`;
}

// ─── Core Render ──────────────────────────────────────────
const SCR_HTML={login:loginHTML,subject:subjectHTML,resume:resumeHTML,menu:menuHTML,
  p1:vocabHTML,p2:clozeHTML,p3:readingHTML,p4:describeHTML,p5:matchHTML,p6:balloonsHTML,
  hv:mcHTML,hb:matchHTML,hw:mcHTML,hr:readingHTML,
  ma1:mathHTML,ma2:mathHTML,ma3:mathHTML,ma4:mathHTML,
  paused:pausedHTML,done:doneHTML};

function gotoNext(cur){
  const o=curOrder(),k=o.indexOf(cur);
  if(k>=0&&k<o.length-1){S.screen=o[k+1];render();}
  else finish();
}

function render(){
  TM.stop();
  const root=document.getElementById("exam-root");
  root.innerHTML=topbarHTML()+(SCR_HTML[S.screen]||loginHTML)();
  attachListeners();
  initPart();
  saveSession();
}

function attachListeners(){
  const pb=document.getElementById("btn-pause");
  if(pb)pb.addEventListener("click",doPause);
  const sk=document.getElementById("btn-skip");
  if(sk)sk.addEventListener("click",()=>{TM.stop();gotoNext(S.screen);});
  const hb=document.getElementById("btn-home");
  if(hb)hb.addEventListener("click",doHome);

  if(S.screen==="login"){
    const ni=document.getElementById("inp-name"),pi=document.getElementById("inp-phone");
    const ai=document.getElementById("inp-age"),eb=document.getElementById("btn-enter");
    const checkEb=()=>{eb.disabled=!S.name.trim()||S.phone.length<9||S.busy;};
    ni.addEventListener("input",e=>{S.name=e.target.value;checkEb();});
    pi.addEventListener("input",e=>{S.phone=e.target.value.replace(/\D/g,"");e.target.value=S.phone;checkEb();});
    ai.addEventListener("input",e=>{
      S.age=+e.target.value;
      document.getElementById("age-lbl").textContent=`${S.age} · ${LEVEL_NAME[levelForAge(S.age)]}`;
    });
    const ls=document.getElementById("login-subjects");
    if(ls)ls.addEventListener("click",e=>{
      const b=e.target.closest(".subj-btn");if(!b)return;
      S.subject=b.dataset.subj;
      ls.querySelectorAll(".subj-btn").forEach(x=>x.classList.toggle("subj-on",x===b));
    });
    eb.addEventListener("click",doEnter);
  }
  if(S.screen==="resume"){
    document.getElementById("btn-resume").addEventListener("click",doResume);
    document.getElementById("btn-fresh").addEventListener("click",doFresh);
  }
  if(S.screen==="subject"){
    document.querySelectorAll(".subj-btn").forEach(b=>{
      b.addEventListener("click",()=>{
        S.subject=b.dataset.subj;S.score=0;S.prog={};S.screen="menu";render();
      });
    });
  }
  if(S.screen==="menu"){
    document.querySelectorAll(".plan li").forEach(li=>{
      li.addEventListener("click",()=>{S.screen=li.dataset.part;render();});
    });
    const sb=document.getElementById("btn-subj-back");
    if(sb)sb.addEventListener("click",()=>{S.screen="subject";render();});
    document.getElementById("btn-start").addEventListener("click",()=>{S.score=0;S.prog={};S.screen=curOrder()[0];render();});
  }
  if(S.screen==="paused")
    document.getElementById("btn-menu").addEventListener("click",()=>{S.screen="menu";render();});
  if(S.screen==="done"){
    document.getElementById("btn-again").addEventListener("click",()=>{S.score=0;S.prog={};S.lastGain=null;S.screen="menu";render();});
    launchConfetti();
    if((S.lastGain?.stars||0)>=2)SFX.good();
  }
}

function initPart(){
  if(S.screen==="p1")initVocab();
  else if(S.screen==="p2")initCloze();
  else if(S.screen==="p3")initReading();
  else if(S.screen==="p4")initDescribe();
  else if(S.screen==="p5")initMatch();
  else if(S.screen==="p6")initBalloons();
  else if(S.screen==="hv"||S.screen==="hw")initHebMC();
  else if(S.screen==="hb")initHebMatch();
  else if(S.screen==="hr")initReading();
  else if(S.screen[0]==="m"&&S.screen[1]==="a")initMath();
}

// ─── Session Helpers ──────────────────────────────────────
function saveSession(){
  if(!S.phone||S.screen==="login"||S.screen==="resume"||S.screen==="subject")return;
  sSet(K.session(S.phone),{name:S.name,age:S.age,score:S.score,screen:S.screen,subject:S.subject,prog:S.prog,t:Date.now()});
}
function commitProg(slice){S.prog={...S.prog,...slice};saveSession();}
function addScore(n){
  S.score+=n;
  const el=document.getElementById("score-el");
  if(el)el.innerHTML=`${grade(S.score)}<small>/100</small>`;
}

// ─── Toast ────────────────────────────────────────────────
function showToast(kind,text){
  let t=document.getElementById("app-toast");if(t)t.remove();
  t=document.createElement("div");t.id="app-toast";
  t.className=`toast toast-${kind}`;
  t.innerHTML=`<span class="toast-mark">${kind==="good"?"✓":"✗"}</span><span>${esc(text)}</span>`;
  document.body.appendChild(t);
  setTimeout(()=>{if(t.parentNode)t.remove();},1600);
}

// ─── Part 1: Vocab ────────────────────────────────────────
function initVocab(){
  const saved=S.prog.vocab,lvl=levelForAge(S.age);
  V.pool=nearLevel(VOCAB.filter(x=>x.e),lvl,6);  // picture prompt needs an emoji
  if(saved&&saved.round&&saved.round.length){V.round=saved.round;V.i=saved.i??0;}
  else{
    const fresh=V.pool.filter(x=>!S.seen.includes(x.w));
    const src=fresh.length>=QUOTA.vocab?fresh:V.pool;
    V.round=shuffle(src).slice(0,QUOTA.vocab).map(x=>x.w);V.i=0;
  }
  V.picked=null;
  renderVQ();
  TM.start(saved?.left??TIME.vocab,TIME.vocab,onVocabDone);
}

function renderVQ(){
  const w=V.round[V.i];
  V.item=V.pool.find(x=>x.w===w)||VOCAB.find(x=>x.w===w);
  if(!V.item)return;
  V.opts=shuffle([V.item,...shuffle(V.pool.filter(x=>x.w!==V.item.w)).slice(0,4)]);
  document.getElementById("q-ctr").textContent=`${V.i+1}/${V.round.length}`;
  document.getElementById("q-pic").textContent=V.item.e;
  document.getElementById("q-opts").innerHTML=V.opts.map(o=>
    `<button class="opt" data-word="${esc(o.w)}" dir="ltr"><span>${esc(o.w)}</span><span class="mark" style="display:none"></span></button>`
  ).join("");
  document.getElementById("q-hint").innerHTML="";
  const sb=document.getElementById("btn-speak");sb.disabled=true;sb.onclick=null;
  document.getElementById("q-opts").onclick=e=>{
    const btn=e.target.closest(".opt");
    if(!btn||btn.disabled||V.picked)return;
    handleVA(btn.dataset.word);
  };
}

function handleVA(word){
  if(V.picked)return;
  V.picked=word;
  const correct=word===V.item.w;
  if(correct){addScore(1);SFX.good();}else SFX.bad();
  speak(V.item.w);
  document.querySelectorAll("#q-opts .opt").forEach(btn=>{
    const bw=btn.dataset.word,mark=btn.querySelector(".mark");
    if(bw===V.item.w){btn.classList.add("opt-good");mark.textContent="✓";mark.className="mark good";mark.style.display="";}
    else if(bw===word&&!correct){btn.classList.add("opt-bad");mark.textContent="✗";mark.className="mark bad";mark.style.display="";}
    else btn.classList.add("opt-dim");
    btn.disabled=true;
  });
  if(!correct)document.getElementById("q-hint").innerHTML=`${esc(S.name)}, התשובה הנכונה היא <b dir="ltr">${esc(V.item.w)}</b>`;
  const sb=document.getElementById("btn-speak");sb.disabled=false;sb.onclick=()=>speak(V.item.w);
  commitProg({vocab:{round:V.round,i:V.i,left:TM.left}});
  setTimeout(()=>{
    if(S.screen!=="p1")return;
    V.picked=null;V.i++;
    if(V.i>=V.round.length)onVocabDone();else renderVQ();
  },2200);
}

function onVocabDone(){
  TM.stop();
  const ns=[...new Set([...S.seen,...V.round])];S.seen=ns;sSet(K.seen(S.phone),ns);
  S.screen="p2";render();
}

// ─── Part 2: Cloze ────────────────────────────────────────
function initCloze(){
  const saved=S.prog.cloze,lvl=levelForAge(S.age);
  if(saved&&saved.id)C.item=CLOZE.find(x=>x.id===saved.id)||CLOZE[0];
  else{
    const pool=CLOZE.filter(x=>Math.abs(x.lvl-lvl)<=2);
    const src=pool.length?pool:CLOZE;
    C.item=src[Math.floor(Math.random()*src.length)];
  }
  C.bank  =saved?.bank??shuffle([...C.item.answers,...C.item.decoys]);
  C.filled=saved?.filled??{};
  C.used  =saved?.used??[];
  C.sel=null;C.num="";C.sheetN=null;
  document.getElementById("cloze-ttl").textContent=C.item.title;
  refreshCS();refreshCB();
  document.getElementById("cloze-placer").innerHTML="";
  const sh=document.getElementById("cloze-sheet");if(sh)sh.innerHTML="";
  TM.start(saved?.left??TIME.cloze,TIME.cloze,()=>{S.screen="p3";render();});
}

function clozeStory(){
  return C.item.text.split(/(\{\d+\})/g).map(p=>{
    const m=p.match(/^\{(\d+)\}$/);if(!m)return esc(p);
    const n=Number(m[1]);
    return C.filled[n]
      ?`<b class="blank done">${esc(C.filled[n])}</b>`
      :`<span class="blank"><button class="blankbtn${C.sheetN===n?" blankbtn-on":""}" data-n="${n}"><sup>${n}</sup>______</button><button class="qbtn" data-hint="${n}" title="רמז">?</button></span>`;
  }).join("");
}

function refreshCS(){
  const el=document.getElementById("cloze-story");
  if(el){
    el.innerHTML=clozeStory();
    el.onclick=e=>{
      const bb=e.target.closest(".blankbtn"); if(bb){clozeSheet(+bb.dataset.n);return;}
      const qb=e.target.closest(".qbtn");     if(qb){clozeHint(+qb.dataset.hint);return;}
    };
  }
  const ctr=document.getElementById("q-ctr");if(ctr)ctr.textContent=`${Object.keys(C.filled).length}/${C.item.answers.length}`;
}
function clozePlace(n,w){
  if(!n||n<1||n>C.item.answers.length||C.filled[n])return false;
  if(C.item.answers[n-1]===w){
    C.filled={...C.filled,[n]:w};C.used=[...C.used,w];
    addScore(1);SFX.good();speak(w);showToast("good","נכון מאוד!");
    commitProg({cloze:{id:C.item.id,bank:C.bank,filled:C.filled,used:C.used,left:TM.left}});
    C.sel=null;C.num="";closeSheet();refreshCS();refreshCB();refreshCP();
    if(Object.keys(C.filled).length>=C.item.answers.length)
      setTimeout(()=>{if(S.screen!=="p2")return;gotoNext("p2");},1200);
    return true;
  }
  SFX.bad();showToast("bad",`${S.name}, נסה/י שוב`);
  return false;
}
function clozeSheet(n){
  C.sheetN=n;
  const remaining=C.bank.filter(w=>!C.used.includes(w));
  const el=document.getElementById("cloze-sheet");if(!el)return;
  el.innerHTML=`<div class="sheet" role="dialog">
    <div class="sheet-head"><b>איזו מילה שייכת לקו ${n}?</b><button class="ghost sm" id="sheet-close">סגור</button></div>
    <div class="sheet-grid" id="sheet-grid">${remaining.map(w=>`<button class="chip" dir="ltr" data-w="${esc(w)}">${esc(w)}</button>`).join("")}</div>
  </div>`;
  document.getElementById("sheet-close").onclick=closeSheet;
  document.getElementById("sheet-grid").onclick=e=>{const b=e.target.closest(".chip");if(b)clozePlace(n,b.dataset.w);};
  refreshCS();
}
function clozeHint(n){
  const h=C.item.hints&&C.item.hints[n-1];
  const el=document.getElementById("cloze-sheet");if(!el)return;
  el.innerHTML=`<div class="sheet" role="dialog">
    <div class="sheet-head"><b>Hint · קו ${n}</b><button class="ghost sm" id="sheet-close">סגור</button></div>
    <p class="hinttext" dir="ltr">${esc(h||"no hint available")}</p>
    <button class="ghost sm" id="hint-read">🔊 read it</button>
  </div>`;
  document.getElementById("sheet-close").onclick=closeSheet;
  const rb=document.getElementById("hint-read");if(rb)rb.onclick=()=>h&&speak(h);
}
function closeSheet(){C.sheetN=null;const el=document.getElementById("cloze-sheet");if(el)el.innerHTML="";}

function refreshCB(){
  const el=document.getElementById("cloze-bank");if(!el)return;
  el.innerHTML=C.bank.map(w=>
    `<button class="chip${C.used.includes(w)?" chip-used":""}${C.sel===w?" chip-sel":""}" dir="ltr" data-word="${esc(w)}"${C.used.includes(w)?" disabled":""}>${esc(w)}</button>`
  ).join("");
  el.onclick=e=>{
    const chip=e.target.closest(".chip");
    if(!chip||chip.disabled)return;
    C.sel=chip.dataset.word;C.num="";refreshCB();refreshCP();
  };
}

function refreshCP(){
  const el=document.getElementById("cloze-placer");if(!el)return;
  if(!C.sel){el.innerHTML="";return;}
  el.innerHTML=`<div class="placer">
  <span>לאיזה מספר לשבץ את <b dir="ltr">${esc(C.sel)}</b>?</span>
  <input type="number" id="cloze-num" min="1" max="${C.item.answers.length}" value="${esc(C.num)}" autocomplete="off">
  <button class="primary sm" id="btn-place">שבץ</button>
  <button class="ghost sm" id="btn-cancel">ביטול</button>
</div>`;
  const ni=document.getElementById("cloze-num");
  ni.addEventListener("input",e=>{C.num=e.target.value;});
  ni.addEventListener("keydown",e=>{if(e.key==="Enter")handleCP();});
  document.getElementById("btn-place").addEventListener("click",handleCP);
  document.getElementById("btn-cancel").addEventListener("click",()=>{C.sel=null;C.num="";refreshCB();refreshCP();});
  ni.focus();
}

function handleCP(){
  const n=parseInt(C.num,10),w=C.sel;
  if(!w||!n)return;
  if(!clozePlace(n,w)){C.sel=null;C.num="";refreshCB();refreshCP();}
}

// ─── Part 3: Reading ──────────────────────────────────────
function initReading(){
  const saved=S.prog.reading,lvl=levelForAge(S.age);
  const set=(S.screen==="hr")?HEB_STORIES:STORIES;
  const src0=set.length?set:STORIES;
  const qquota=(S.screen==="hr")?PART_QUOTA.hr:QUOTA.reading;
  if(saved&&saved.id)R.story=src0.find(x=>x.id===saved.id)||src0[0];
  else{
    const pool=src0.filter(x=>Math.abs(x.lvl-lvl)<=2);
    const src=pool.length?pool:src0;
    R.story=src[Math.floor(Math.random()*src.length)];
  }
  R.rtl=(S.screen==="hr");
  R.qIdx   =saved?.qIdx??shuffle(R.story.qpool.map((_,k)=>k)).slice(0,qquota);
  R.qi     =saved?.qi??0;
  R.reading=saved?.qi?false:true;
  R.picked =null;
  document.getElementById("story-ttl").textContent=R.story.title;
  refreshRV();
  TM.start(saved?.left??TIME[S.screen==="hr"?"hr":"reading"],TIME[S.screen==="hr"?"hr":"reading"],()=>gotoNext(S.screen));
}

function refreshRV(){
  const ctr=document.getElementById("q-ctr"),body=document.getElementById("reading-body");if(!body)return;
  const dir=R.rtl?"rtl":"ltr";
  if(R.reading){
    if(ctr)ctr.textContent="";
    body.innerHTML=`<div class="story scroll" dir="${dir}">${R.story.text.split("\n\n").map(p=>`<p>${esc(p)}</p>`).join("")}</div>
<button class="primary" id="btn-done-r">סיימתי לקרוא — לשאלות</button>`;
    document.getElementById("btn-done-r").addEventListener("click",()=>{R.reading=false;refreshRV();});
  }else{
    const qs=R.qIdx.map(k=>R.story.qpool[k]),q=qs[R.qi];
    if(ctr)ctr.textContent=`${R.qi+1}/${qs.length}`;
    body.innerHTML=`<p class="question" dir="${dir}">${esc(q.q)}</p>
<div class="opts" id="q-opts">${q.o.map((o,i)=>`<button class="opt" data-idx="${i}" dir="${dir}"><span>${esc(o)}</span><span class="mark" style="display:none"></span></button>`).join("")}</div>
<button class="ghost" id="btn-back-r">חזרה לסיפור</button>`;
    document.getElementById("q-opts").onclick=e=>{
      const btn=e.target.closest(".opt");
      if(!btn||btn.disabled||R.picked!==null)return;
      handleRA(parseInt(btn.dataset.idx,10));
    };
    document.getElementById("btn-back-r").addEventListener("click",()=>{R.reading=true;refreshRV();});
  }
}

function handleRA(idx){
  if(R.picked!==null)return;
  R.picked=idx;
  const qs=R.qIdx.map(k=>R.story.qpool[k]),q=qs[R.qi];
  if(idx===q.c){addScore(1);SFX.good();}else SFX.bad();
  document.querySelectorAll("#q-opts .opt").forEach(btn=>{
    const bi=parseInt(btn.dataset.idx,10),mark=btn.querySelector(".mark");
    if(bi===q.c){btn.classList.add("opt-good");mark.textContent="✓";mark.className="mark good";mark.style.display="";}
    else if(bi===idx&&idx!==q.c){btn.classList.add("opt-bad");mark.textContent="✗";mark.className="mark bad";mark.style.display="";}
    else btn.classList.add("opt-dim");
    btn.disabled=true;
  });
  commitProg({reading:{id:R.story.id,qIdx:R.qIdx,qi:R.qi,left:TM.left}});
  const scr=S.screen;
  setTimeout(()=>{
    if(S.screen!==scr)return;
    R.picked=null;R.qi++;
    const qs2=R.qIdx.map(k=>R.story.qpool[k]);
    if(R.qi>=qs2.length){TM.stop();gotoNext(scr);}
    else refreshRV();
  },1800);
}

// ─── Part 4: Describe ─────────────────────────────────────
function initDescribe(){
  const saved=S.prog.pics;
  D.idxs=saved?.idxs??shuffle(PICTURES.map((_,k)=>k)).slice(0,QUOTA.pics);
  D.i=saved?.i??0;D.locked=false;
  renderDI();
  TM.start(saved?.left??TIME.pics,TIME.pics,()=>gotoNext("p4"));
}

function renderDI(){
  const item=PICTURES[D.idxs[D.i]];
  document.getElementById("q-ctr").textContent=`${D.i+1}/${D.idxs.length}`;
  document.getElementById("q-pic").textContent=item.e;
  const inp=document.getElementById("desc-inp"),cb=document.getElementById("btn-check");
  inp.value="";inp.disabled=false;cb.disabled=false;
  inp.onkeydown=e=>{if(e.key==="Enter")handleDC();};
  cb.onclick=handleDC;
  inp.focus();
}

function handleDC(){
  if(D.locked)return;
  const inp=document.getElementById("desc-inp"),val=inp.value.trim();if(!val)return;
  const item=PICTURES[D.idxs[D.i]],ok=item.ok.includes(val.toLowerCase());
  D.locked=true;inp.disabled=true;document.getElementById("btn-check").disabled=true;
  if(ok){addScore(1);SFX.good();speak(item.ok[0]);showToast("good","נכון מאוד!");}
  else{SFX.bad();showToast("bad",`${S.name}, התשובה: ${item.ok[0]}`);}
  commitProg({pics:{idxs:D.idxs,i:D.i,left:TM.left}});
  setTimeout(()=>{
    if(S.screen!=="p4")return;
    D.locked=false;D.i++;
    if(D.i>=D.idxs.length)gotoNext("p4");else renderDI();
  },1900);
}

// ─── Line-drawing helpers (Match + Balloons) ──────────────
const _SVGNS="http://www.w3.org/2000/svg";
function _ptOf(svg,el,edge){
  const sr=svg.getBoundingClientRect(),r=el.getBoundingClientRect();
  let x,y;
  if(edge==="r"){x=r.right;y=r.top+r.height/2;}
  else if(edge==="l"){x=r.left;y=r.top+r.height/2;}
  else if(edge==="t"){x=r.left+r.width/2;y=r.top;}
  else if(edge==="b"){x=r.left+r.width/2;y=r.bottom;}
  else{x=r.left+r.width/2;y=r.top+r.height/2;}
  return {x:x-sr.left,y:y-sr.top};
}
function _addLine(svg,x1,y1,x2,y2,cls){
  const l=document.createElementNS(_SVGNS,"line");
  l.setAttribute("x1",x1);l.setAttribute("y1",y1);l.setAttribute("x2",x2);l.setAttribute("y2",y2);
  l.setAttribute("class",cls);svg.appendChild(l);return l;
}

// ─── Part 5: Word ↔ Meaning matching ──────────────────────
function matchState(){return {pairs:M.pairs,leftOrder:M.leftOrder,rightOrder:M.rightOrder,solved:[...M.solved],left:TM.left};}

function initMatch(){
  const saved=S.prog.match,lvl=levelForAge(S.age);
  if(saved&&saved.pairs){M.pairs=saved.pairs;M.leftOrder=saved.leftOrder;M.rightOrder=saved.rightOrder;M.solved=new Set(saved.solved||[]);}
  else{
    const pool=nearLevel(VOCAB,lvl,QUOTA.match).filter(x=>x.h);
    M.pairs=shuffle(pool).slice(0,QUOTA.match).map(x=>({w:x.w,h:x.h}));
    M.leftOrder=shuffle(M.pairs.map((_,k)=>k));
    M.rightOrder=shuffle(M.pairs.map((_,k)=>k));
    M.solved=new Set();
  }
  M.dragging=false;M.dragI=null;
  renderMatch();
  TM.start(saved?.left??TIME[S.screen==="hb"?"hb":"match"],TIME[S.screen==="hb"?"hb":"match"],()=>gotoNext(S.screen));
}

// Hebrew word ↔ Hebrew definition matching (reuses the match engine)
function initHebMatch(){
  const saved=S.prog.match,lvl=levelForAge(S.age),n=PART_QUOTA.hb;
  if(saved&&saved.pairs){M.pairs=saved.pairs;M.leftOrder=saved.leftOrder;M.rightOrder=saved.rightOrder;M.solved=new Set(saved.solved||[]);}
  else{
    const src=HEB_VOCAB.length?HEB_VOCAB:[{w:"בית",d:"מקום מגורים",lvl:1},{w:"שמח",d:"מרוצה",lvl:1},{w:"גדול",d:"רב־ממדים",lvl:1},{w:"מהיר",d:"זריז",lvl:2},{w:"יפה",d:"נאה",lvl:2},{w:"חכם",d:"נבון",lvl:2},{w:"קר",d:"צונן",lvl:1},{w:"חזק",d:"איתן",lvl:2}];
    const pool=nearLevel(src.filter(x=>x.d),lvl,n);
    M.pairs=shuffle(pool).slice(0,n).map(x=>({w:x.w,h:x.d}));
    M.leftOrder=shuffle(M.pairs.map((_,k)=>k));
    M.rightOrder=shuffle(M.pairs.map((_,k)=>k));
    M.solved=new Set();
  }
  M.dragging=false;M.dragI=null;
  renderMatch();
  TM.start(saved?.left??TIME.hb,TIME.hb,()=>gotoNext(S.screen));
}

function renderMatch(){
  const L=document.getElementById("mcol-left"),Rr=document.getElementById("mcol-right");
  if(!L||!Rr)return;
  L.innerHTML=M.leftOrder.map((pi,i)=>
    `<button class="mitem${M.solved.has(i)?" solved":""}" data-i="${i}" dir="ltr"><span>${esc(M.pairs[pi].w)}</span><i class="dot dot-r"></i></button>`).join("");
  Rr.innerHTML=M.rightOrder.map((pi,j)=>{
    const solvedJ=[...M.solved].some(i=>M.leftOrder[i]===M.rightOrder[j]);
    return `<button class="ritem${solvedJ?" solved":""}" data-j="${j}"><i class="dot dot-l"></i><span>${esc(M.pairs[pi].h)}</span></button>`;
  }).join("");
  updateMatchCtr();
  const wrap=document.getElementById("match-wrap"),svg=document.getElementById("match-svg");
  [...svg.querySelectorAll(".match-line")].forEach(l=>l.remove());
  requestAnimationFrame(()=>{
    [...M.solved].forEach(i=>{
      const j=M.rightOrder.findIndex(pi=>pi===M.leftOrder[i]);
      if(j>=0)drawMatchLine(i,j);
    });
  });
  bindDrag(wrap,svg,"match-temp",".mitem",".ritem",
    (li)=>_ptOf(svg,li,"r"),
    (from,to)=>attemptMatch(+from.dataset.i,+to.dataset.j),
    ()=>M.dragging,(v)=>M.dragging=v);
}

function updateMatchCtr(){const c=document.getElementById("q-ctr");if(c)c.textContent=`${M.solved.size}/${M.pairs.length}`;}

function drawMatchLine(i,j){
  const svg=document.getElementById("match-svg");
  const li=document.querySelector(`.mitem[data-i="${i}"]`),ri=document.querySelector(`.ritem[data-j="${j}"]`);
  if(!li||!ri||!svg)return;
  const a=_ptOf(svg,li,"r"),b=_ptOf(svg,ri,"l");
  _addLine(svg,a.x,a.y,b.x,b.y,"match-line solved");
}

function attemptMatch(i,j){
  if(M.solved.has(i))return;
  if(M.leftOrder[i]===M.rightOrder[j]){
    M.solved.add(i);
    document.querySelector(`.mitem[data-i="${i}"]`)?.classList.add("solved");
    document.querySelector(`.ritem[data-j="${j}"]`)?.classList.add("solved");
    drawMatchLine(i,j);addScore(1);SFX.good();updateMatchCtr();
    commitProg({match:matchState()});
    if(M.solved.size>=M.pairs.length){const scr=S.screen;setTimeout(()=>{if(S.screen===scr)gotoNext(scr);},1000);}
  }else{
    SFX.bad();
    const svg=document.getElementById("match-svg");
    const li=document.querySelector(`.mitem[data-i="${i}"]`),ri=document.querySelector(`.ritem[data-j="${j}"]`);
    if(li&&ri){
      const a=_ptOf(svg,li,"r"),b=_ptOf(svg,ri,"l");
      const l=_addLine(svg,a.x,a.y,b.x,b.y,"match-line wrong");
      li.classList.add("shake");ri.classList.add("shake");
      setTimeout(()=>{l.remove();li.classList.remove("shake");ri.classList.remove("shake");},480);
    }
  }
}

// ─── Part 6: Balloons ↔ Words ─────────────────────────────
const BLN_COLORS=["#F2545B","#6C5CE7","#3FBF6F","#FFB627","#2AA9E0","#E255A1"];
function balloonState(){return {pairs:B.pairs,topOrder:B.topOrder,botOrder:B.botOrder,solved:[...B.solved],left:TM.left};}

function initBalloons(){
  const saved=S.prog.balloons,lvl=levelForAge(S.age);
  if(saved&&saved.pairs){B.pairs=saved.pairs;B.topOrder=saved.topOrder;B.botOrder=saved.botOrder;B.solved=new Set(saved.solved||[]);}
  else{
    const pool=nearLevel(VOCAB.filter(x=>x.e),lvl,QUOTA.balloons);
    B.pairs=shuffle(pool).slice(0,QUOTA.balloons).map(x=>({w:x.w,e:x.e,h:x.h}));
    B.topOrder=shuffle(B.pairs.map((_,k)=>k));
    B.botOrder=shuffle(B.pairs.map((_,k)=>k));
    B.solved=new Set();
  }
  B.dragging=false;B.dragI=null;
  renderBalloons();
  TM.start(saved?.left??TIME.balloons,TIME.balloons,()=>gotoNext("p6"));
}

function renderBalloons(){
  const top=document.getElementById("bln-top"),bot=document.getElementById("bln-bot");
  if(!top||!bot)return;
  top.innerHTML=B.topOrder.map((pi,i)=>
    `<button class="balloon${B.solved.has(i)?" solved":""}" data-i="${i}" style="--bc:${BLN_COLORS[i%BLN_COLORS.length]}">
      <span class="bln-body"><span class="bln-emoji">${B.pairs[pi].e}</span></span>
      <span class="bln-string"></span><i class="dot dot-b"></i></button>`).join("");
  bot.innerHTML=B.botOrder.map((pi,j)=>{
    const solvedJ=[...B.solved].some(i=>B.topOrder[i]===B.botOrder[j]);
    return `<button class="wchip${solvedJ?" solved":""}" data-j="${j}" dir="ltr"><i class="dot dot-t"></i><span>${esc(B.pairs[pi].w)}</span></button>`;
  }).join("");
  updateBlnCtr();
  const wrap=document.getElementById("bln-wrap"),svg=document.getElementById("bln-svg");
  [...svg.querySelectorAll(".match-line")].forEach(l=>l.remove());
  requestAnimationFrame(()=>{
    [...B.solved].forEach(i=>{
      const j=B.botOrder.findIndex(pi=>pi===B.topOrder[i]);
      if(j>=0)drawBlnLine(i,j);
    });
  });
  bindDrag(wrap,svg,"bln-temp",".balloon",".wchip",
    (b)=>_ptOf(svg,b.querySelector(".dot-b"),"c"),
    (from,to)=>attemptBln(+from.dataset.i,+to.dataset.j),
    ()=>B.dragging,(v)=>B.dragging=v);
}

function updateBlnCtr(){const c=document.getElementById("q-ctr");if(c)c.textContent=`${B.solved.size}/${B.pairs.length}`;}

function drawBlnLine(i,j){
  const svg=document.getElementById("bln-svg");
  const dot=document.querySelector(`.balloon[data-i="${i}"] .dot-b`),wj=document.querySelector(`.wchip[data-j="${j}"]`);
  if(!dot||!wj||!svg)return;
  const a=_ptOf(svg,dot,"c"),b=_ptOf(svg,wj,"t");
  _addLine(svg,a.x,a.y,b.x,b.y,"match-line solved");
}

function attemptBln(i,j){
  if(B.solved.has(i))return;
  if(B.topOrder[i]===B.botOrder[j]){
    B.solved.add(i);
    document.querySelector(`.balloon[data-i="${i}"]`)?.classList.add("solved");
    document.querySelector(`.wchip[data-j="${j}"]`)?.classList.add("solved");
    drawBlnLine(i,j);addScore(1);SFX.good();updateBlnCtr();speak(B.pairs[B.topOrder[i]].w);
    commitProg({balloons:balloonState()});
    if(B.solved.size>=B.pairs.length)setTimeout(()=>{if(S.screen==="p6")gotoNext("p6");},1000);
  }else{
    SFX.bad();
    const svg=document.getElementById("bln-svg");
    const dot=document.querySelector(`.balloon[data-i="${i}"] .dot-b`),wj=document.querySelector(`.wchip[data-j="${j}"]`);
    const bl=document.querySelector(`.balloon[data-i="${i}"]`);
    if(dot&&wj){
      const a=_ptOf(svg,dot,"c"),b=_ptOf(svg,wj,"t");
      const l=_addLine(svg,a.x,a.y,b.x,b.y,"match-line wrong");
      bl?.classList.add("shake");wj.classList.add("shake");
      setTimeout(()=>{l.remove();bl?.classList.remove("shake");wj.classList.remove("shake");},480);
    }
  }
}

// generic drag-to-connect: from a source item to a target item
function bindDrag(wrap,svg,tempId,fromSel,toSel,ptFn,onConnect,isDragging,setDragging){
  const temp=document.getElementById(tempId);
  wrap.onpointerdown=e=>{
    const from=e.target.closest(fromSel);
    if(!from||from.classList.contains("solved"))return;
    wrap._from=from;setDragging(true);
    const a=ptFn(from);
    temp.setAttribute("x1",a.x);temp.setAttribute("y1",a.y);
    temp.setAttribute("x2",a.x);temp.setAttribute("y2",a.y);temp.style.display="";
    try{wrap.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
  };
  wrap.onpointermove=e=>{
    if(!isDragging())return;
    const sr=svg.getBoundingClientRect();
    temp.setAttribute("x2",e.clientX-sr.left);temp.setAttribute("y2",e.clientY-sr.top);
  };
  const end=e=>{
    if(!isDragging())return;setDragging(false);temp.style.display="none";
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const to=el&&el.closest?el.closest(toSel):null;
    if(to&&!to.classList.contains("solved")&&wrap._from)onConnect(wrap._from,to);
    wrap._from=null;
  };
  wrap.onpointerup=end;wrap.onpointercancel=end;
}

// ─── Math subject ─────────────────────────────────────────
function mathState(){return {qs:MA.qs,i:MA.i,left:TM.left};}
function _mrand(a,b){return a+Math.floor(Math.random()*(b-a+1));}
function _mkOpts(ans){
  const dec=!Number.isInteger(ans);
  const span=Math.max(2,Math.round(Math.abs(ans)*0.2))||2;
  const set=new Set([ans]);let guard=0;
  while(set.size<4&&guard++<50){
    let d=dec? Math.round((ans+(_mrand(-span,span)||1)*0.1)*10)/10 : ans+(_mrand(-span,span)||1);
    if(d!==ans && (dec||Number.isInteger(d))) set.add(d);
  }
  while(set.size<4){set.add(ans+set.size);}
  return shuffle([...set]);
}
function _genMathQ(lvl,type){
  type=type||"addsub";
  const R=_mrand;
  if(type==="addsub"){
    const mx = lvl<=1?10 : lvl===2?60 : lvl===3?200 : lvl===4?1000 : 10000;
    if(Math.random()<0.5){const x=R(1,mx),y=R(1,mx);return {t:`${x} + ${y}`,a:x+y,eq:true};}
    const x=R(2,mx),y=R(1,x);return {t:`${x} − ${y}`,a:x-y,eq:true};
  }
  if(type==="muldiv"){
    const top = lvl<=2?10 : lvl===3?12 : lvl===4?20 : 30;
    if(Math.random()<0.5){const x=R(2,top),y=R(2,top);return {t:`${x} × ${y}`,a:x*y,eq:true};}
    const y=R(2,top),q=R(2,top);return {t:`${y*q} ÷ ${y}`,a:q,eq:true};
  }
  if(type==="missing"){
    const mx = lvl<=1?10 : lvl===2?50 : lvl===3?100 : lvl===4?500 : 2000;
    if(Math.random()<0.5){const x=R(1,mx),y=R(1,mx);return {t:`${x} + ? = ${x+y}`,a:y,eq:false};}
    const y=R(1,mx),x=R(y+1,mx+y);return {t:`${x} − ? = ${x-y}`,a:y,eq:false};
  }
  return _genWordProblem(lvl);            // type === "word"
}

function _genWordProblem(lvl){
  const R=_mrand, big = lvl<=1?10 : lvl===2?30 : lvl===3?100 : lvl===4?500 : 2000;
  const tmpls=[
    ()=>{const a=R(3,big),b=R(1,a);return {t:`בכיתה יש ${a} תלמידים. ${b} מהם יצאו להפסקה. כמה תלמידים נשארו בכיתה?`,a:a-b};},
    ()=>{const a=R(3,big),b=R(1,big);return {t:`לרוני יש ${a} שקלים, והוא קיבל עוד ${b} שקלים. כמה שקלים יש לו עכשיו?`,a:a+b};},
    ()=>{const per=R(2,9),g=R(2,9);return {t:`בכל שולחן יושבים ${per} ילדים, ויש ${g} שולחנות. כמה ילדים בסך הכול?`,a:per*g};},
    ()=>{const per=R(2,9),g=R(2,9);return {t:`${per*g} עפרונות חולקו שווה בשווה ל-${g} ילדים. כמה עפרונות קיבל כל ילד?`,a:per};},
    ()=>{const price=R(2,12),n=R(2,9);return {t:`מחיר מחברת אחת הוא ${price} שקלים. כמה יעלו ${n} מחברות?`,a:price*n};},
    ()=>{const start=R(5,big),ate=R(1,Math.min(start,9));return {t:`בקופסה היו ${start} עוגיות, ודנה אכלה ${ate}. כמה עוגיות נשארו?`,a:start-ate};},
  ];
  const q=tmpls[R(0,tmpls.length-1)]();
  q.rtl=true; q.eq=false; return q;
}
function initMath(){
  const scr=S.screen,cfg=MATH_CFG[scr]||MATH_CFG.ma1;
  const saved=S.prog[scr],lvl=levelForAge(S.age),n=PART_QUOTA[scr]||10,t=TIME[scr]??300;
  if(saved&&saved.qs){MA.qs=saved.qs;MA.i=saved.i||0;}
  else{MA.qs=Array.from({length:n},()=>_genMathQ(lvl,cfg.type));MA.i=0;}
  MA.picked=false;
  renderMathQ();
  TM.start(saved?.left??t,t,()=>gotoNext(scr));
}
function renderMathQ(){
  const q=MA.qs[MA.i];
  MA.opts=_mkOpts(q.a);
  document.getElementById("q-ctr").textContent=`${MA.i+1}/${MA.qs.length}`;
  document.getElementById("math-q").innerHTML = q.rtl
    ? `<span dir="rtl" class="math-word">${esc(q.t)}</span>`
    : `<span dir="ltr">${esc(q.t)}${q.eq?" =":""}</span>`;
  document.getElementById("q-opts").innerHTML=MA.opts.map(o=>
    `<button class="opt opt-center" data-val="${o}"><span dir="ltr">${o}</span><span class="mark" style="display:none"></span></button>`).join("");
  MA.picked=false;
  document.getElementById("q-opts").onclick=e=>{
    const b=e.target.closest(".opt");if(!b||b.disabled||MA.picked)return;
    handleMA(parseFloat(b.dataset.val));
  };
}
function handleMA(val){
  if(MA.picked)return;MA.picked=true;
  const q=MA.qs[MA.i],correct=Math.abs(val-q.a)<1e-9;
  if(correct){addScore(1);SFX.good();}else SFX.bad();
  document.querySelectorAll("#q-opts .opt").forEach(b=>{
    const bv=parseFloat(b.dataset.val),mk=b.querySelector(".mark");
    if(Math.abs(bv-q.a)<1e-9){b.classList.add("opt-good");mk.textContent="✓";mk.className="mark good";mk.style.display="";}
    else if(bv===val&&!correct){b.classList.add("opt-bad");mk.textContent="✗";mk.className="mark bad";mk.style.display="";}
    else b.classList.add("opt-dim");
    b.disabled=true;
  });
  const scr=S.screen;
  commitProg({[scr]:mathState()});
  setTimeout(()=>{
    if(S.screen!==scr)return;
    MA.picked=false;MA.i++;
    if(MA.i>=MA.qs.length)gotoNext(scr);else renderMathQ();
  },1200);
}

// ─── Actions ──────────────────────────────────────────────
function doEnter(){
  if(!S.name.trim()||S.phone.length<9||S.busy)return;
  S.busy=true;
  document.getElementById("btn-enter").disabled=true;
  document.getElementById("btn-enter").textContent="רגע…";
  const ses=sGet(K.session(S.phone)),hist=sGet(K.results(S.phone)),seen=sGet(K.seen(S.phone));
  S.history=hist||[];S.seen=seen||[];S.busy=false;
  S.parentCode=sGet("pcode:"+S.phone)||"";
  syncRegister();
  if(ses&&ses.screen&&ses.screen!=="done"){S.found=ses;S.screen="resume";}
  else{S.prog={};S.score=0;S.screen="menu";}   // subject already chosen on the login screen
  render();
}

function doResume(){
  const f=S.found;
  S.name=f.name||S.name;S.age=f.age||S.age;S.score=f.score||0;
  S.subject=f.subject||"english";
  S.prog=f.prog||{};S.screen=f.screen;S.found=null;render();
}

function doFresh(){
  sDel(K.session(S.phone));S.prog={};S.score=0;S.found=null;S.screen="subject";render();
}

function saveCurrentProg(){
  if(S.screen==="p1"&&V.item)commitProg({vocab:{round:V.round,i:V.i,left:TM.left}});
  else if(S.screen==="p2"&&C.item)commitProg({cloze:{id:C.item.id,bank:C.bank,filled:C.filled,used:C.used,left:TM.left}});
  else if(S.screen==="p3"&&R.story)commitProg({reading:{id:R.story.id,qIdx:R.qIdx,qi:R.qi,left:TM.left}});
  else if(S.screen==="p4"&&D.idxs)commitProg({pics:{idxs:D.idxs,i:D.i,left:TM.left}});
  else if((S.screen==="p5"||S.screen==="hb")&&M.pairs)commitProg({match:matchState()});
  else if(S.screen==="p6"&&B.pairs)commitProg({balloons:balloonState()});
  else if(S.screen[0]==="m"&&S.screen[1]==="a"&&MA.qs)commitProg({[S.screen]:mathState()});
  else if((S.screen==="hv"||S.screen==="hw")&&HM.qs)commitProg({[S.screen]:{qs:HM.qs,i:HM.i,left:TM.left}});
  else if(S.screen==="hr"&&R.story)commitProg({reading:{id:R.story.id,qIdx:R.qIdx,qi:R.qi,left:TM.left}});
}
function doPause(){
  TM.stop();saveCurrentProg();
  S.screen="paused";render();
}
function doHome(){
  TM.stop();saveCurrentProg();
  S.screen="menu";render();
}

function finish(){
  TM.stop();
  const g=grade(S.score);
  const rec={t:Date.now(),name:S.name,subject:S.subject,lvl:levelForAge(S.age),correct:S.score,total:subjTotal(),g};
  S.history=[rec,...S.history].slice(0,30);
  sSet(K.results(S.phone),S.history);sDel(K.session(S.phone));
  syncResult(rec);
  S.lastGain=gamAward(g,S.score);
  S.prog={};S.screen="done";render();
}

// ─── Boot ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded",()=>render());
