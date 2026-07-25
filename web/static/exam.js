/* English Trainer — Vanilla JS port */
"use strict";

// ─── Content ──────────────────────────────────────────────
// Every entry: w=word · e=emoji · lvl=1..5 · h=Hebrew meaning
// Age→level: ≤7→1 · ≤9→2 · ≤11→3 · ≤14→4 · else→5
// lvl 2–3 (ages 8–11) are enriched with professions, tools, vehicles,
// kitchen utensils, fruit & veg, furniture and school-subject words.
const VOCAB = [
  // ── lvl 1 · יסוד (גיל 5–7): חיות, אוכל, בית, טבע ──
  {w:"apple",e:"🍎",lvl:1,h:"תפוח"},{w:"banana",e:"🍌",lvl:1,h:"בננה"},
  {w:"dog",e:"🐶",lvl:1,h:"כלב"},{w:"cat",e:"🐱",lvl:1,h:"חתול"},
  {w:"sun",e:"☀️",lvl:1,h:"שמש"},{w:"moon",e:"🌙",lvl:1,h:"ירח"},
  {w:"star",e:"⭐",lvl:1,h:"כוכב"},{w:"book",e:"📕",lvl:1,h:"ספר"},
  {w:"ball",e:"⚽",lvl:1,h:"כדור"},{w:"house",e:"🏠",lvl:1,h:"בית"},
  {w:"fish",e:"🐟",lvl:1,h:"דג"},{w:"car",e:"🚗",lvl:1,h:"מכונית"},
  {w:"tree",e:"🌳",lvl:1,h:"עץ"},{w:"milk",e:"🥛",lvl:1,h:"חלב"},
  {w:"shoe",e:"👟",lvl:1,h:"נעל"},{w:"hat",e:"🧢",lvl:1,h:"כובע"},
  {w:"bird",e:"🐦",lvl:1,h:"ציפור"},{w:"flower",e:"🌸",lvl:1,h:"פרח"},
  {w:"hand",e:"✋",lvl:1,h:"יד"},{w:"egg",e:"🥚",lvl:1,h:"ביצה"},
  {w:"bread",e:"🍞",lvl:1,h:"לחם"},{w:"cake",e:"🍰",lvl:1,h:"עוגה"},
  {w:"bed",e:"🛏️",lvl:1,h:"מיטה"},{w:"door",e:"🚪",lvl:1,h:"דלת"},
  {w:"key",e:"🔑",lvl:1,h:"מפתח"},{w:"sock",e:"🧦",lvl:1,h:"גרב"},

  // ── lvl 2 · בית ספר, בית, אוכל, חיות (גיל 8–9) ──
  {w:"teacher",e:"🧑‍🏫",lvl:2,h:"מורה"},{w:"school",e:"🏫",lvl:2,h:"בית ספר"},
  {w:"pencil",e:"✏️",lvl:2,h:"עיפרון"},{w:"notebook",e:"📓",lvl:2,h:"מחברת"},
  {w:"backpack",e:"🎒",lvl:2,h:"תיק"},{w:"ruler",e:"📏",lvl:2,h:"סרגל"},
  {w:"window",e:"🪟",lvl:2,h:"חלון"},{w:"clock",e:"🕐",lvl:2,h:"שעון"},
  {w:"bus",e:"🚌",lvl:2,h:"אוטובוס"},{w:"train",e:"🚆",lvl:2,h:"רכבת"},
  {w:"bicycle",e:"🚲",lvl:2,h:"אופניים"},{w:"umbrella",e:"☂️",lvl:2,h:"מטרייה"},
  {w:"kitchen",e:"🍳",lvl:2,h:"מטבח"},{w:"garden",e:"🌻",lvl:2,h:"גינה"},
  {w:"guitar",e:"🎸",lvl:2,h:"גיטרה"},{w:"camera",e:"📷",lvl:2,h:"מצלמה"},
  {w:"orange",e:"🍊",lvl:2,h:"תפוז"},{w:"grapes",e:"🍇",lvl:2,h:"ענבים"},
  {w:"carrot",e:"🥕",lvl:2,h:"גזר"},{w:"tomato",e:"🍅",lvl:2,h:"עגבנייה"},
  {w:"chicken",e:"🐔",lvl:2,h:"תרנגולת"},{w:"cow",e:"🐄",lvl:2,h:"פרה"},
  {w:"horse",e:"🐴",lvl:2,h:"סוס"},{w:"rabbit",e:"🐰",lvl:2,h:"ארנב"},
  {w:"elephant",e:"🐘",lvl:2,h:"פיל"},{w:"rain",e:"🌧️",lvl:2,h:"גשם"},
  {w:"snow",e:"❄️",lvl:2,h:"שלג"},{w:"cloud",e:"☁️",lvl:2,h:"ענן"},
  {w:"mountain",e:"⛰️",lvl:2,h:"הר"},{w:"rainbow",e:"🌈",lvl:2,h:"קשת"},

  // ── lvl 3 · מקצועות, כלים, כלי רכב, כלי מטבח, פירות/ירקות, רהיטים, מקצועות לימוד (גיל 10–11) ──
  // מקצועות
  {w:"doctor",e:"🧑‍⚕️",lvl:3,h:"רופא"},{w:"nurse",e:"👩‍⚕️",lvl:3,h:"אחות"},
  {w:"farmer",e:"🧑‍🌾",lvl:3,h:"חקלאי"},{w:"pilot",e:"🧑‍✈️",lvl:3,h:"טייס"},
  {w:"engineer",e:"👷",lvl:3,h:"מהנדס"},{w:"chef",e:"🧑‍🍳",lvl:3,h:"שף"},
  {w:"police officer",e:"👮",lvl:3,h:"שוטר"},{w:"firefighter",e:"🧑‍🚒",lvl:3,h:"כבאי"},
  {w:"scientist",e:"🔬",lvl:3,h:"מדען"},{w:"dentist",e:"🦷",lvl:3,h:"רופא שיניים"},
  {w:"judge",e:"⚖️",lvl:3,h:"שופט"},{w:"baker",e:"🥖",lvl:3,h:"אופה"},
  {w:"carpenter",e:"🪚",lvl:3,h:"נגר"},{w:"painter",e:"🎨",lvl:3,h:"צַבָּע"},
  // כלים
  {w:"hammer",e:"🔨",lvl:3,h:"פטיש"},{w:"screwdriver",e:"🪛",lvl:3,h:"מברג"},
  {w:"wrench",e:"🔧",lvl:3,h:"מפתח ברגים"},{w:"drill",e:"🛠️",lvl:3,h:"מקדחה"},
  {w:"ladder",e:"🪜",lvl:3,h:"סולם"},{w:"scissors",e:"✂️",lvl:3,h:"מספריים"},
  {w:"nail",e:"🔩",lvl:3,h:"מסמר"},{w:"brush",e:"🖌️",lvl:3,h:"מברשת"},
  // כלי רכב
  {w:"truck",e:"🚚",lvl:3,h:"משאית"},{w:"airplane",e:"✈️",lvl:3,h:"מטוס"},
  {w:"helicopter",e:"🚁",lvl:3,h:"מסוק"},{w:"ship",e:"🚢",lvl:3,h:"אונייה"},
  {w:"tractor",e:"🚜",lvl:3,h:"טרקטור"},{w:"motorcycle",e:"🏍️",lvl:3,h:"אופנוע"},
  {w:"ambulance",e:"🚑",lvl:3,h:"אמבולנס"},{w:"rocket",e:"🚀",lvl:3,h:"טיל חלל"},
  // כלי מטבח
  {w:"pot",e:"🍲",lvl:3,h:"סיר"},{w:"knife",e:"🔪",lvl:3,h:"סכין"},
  {w:"kettle",e:"🫖",lvl:3,h:"קומקום"},{w:"spoon",e:"🥄",lvl:3,h:"כף"},
  {w:"fork",e:"🍴",lvl:3,h:"מזלג"},{w:"plate",e:"🍽️",lvl:3,h:"צלחת"},
  // פירות וירקות
  {w:"strawberry",e:"🍓",lvl:3,h:"תות"},{w:"watermelon",e:"🍉",lvl:3,h:"אבטיח"},
  {w:"lemon",e:"🍋",lvl:3,h:"לימון"},{w:"pineapple",e:"🍍",lvl:3,h:"אננס"},
  {w:"potato",e:"🥔",lvl:3,h:"תפוח אדמה"},{w:"onion",e:"🧅",lvl:3,h:"בצל"},
  {w:"corn",e:"🌽",lvl:3,h:"תירס"},{w:"cucumber",e:"🥒",lvl:3,h:"מלפפון"},
  {w:"pepper",e:"🫑",lvl:3,h:"פלפל"},{w:"eggplant",e:"🍆",lvl:3,h:"חציל"},
  {w:"broccoli",e:"🥦",lvl:3,h:"ברוקולי"},{w:"mushroom",e:"🍄",lvl:3,h:"פטרייה"},
  // רהיטים
  {w:"sofa",e:"🛋️",lvl:3,h:"ספה"},{w:"mirror",e:"🪞",lvl:3,h:"מראה"},
  {w:"lamp",e:"💡",lvl:3,h:"מנורה"},{w:"drawer",e:"🗄️",lvl:3,h:"מגירה"},
  // מקצועות לימוד
  {w:"mathematics",e:"➗",lvl:3,h:"מתמטיקה"},{w:"science",e:"🧪",lvl:3,h:"מדעים"},
  {w:"history",e:"📜",lvl:3,h:"היסטוריה"},{w:"geography",e:"🗺️",lvl:3,h:"גאוגרפיה"},
  {w:"music",e:"🎵",lvl:3,h:"מוזיקה"},{w:"homework",e:"📚",lvl:3,h:"שיעורי בית"},

  // ── lvl 4 · חטיבה: מדע, חברה, מופשט ──
  {w:"microscope",e:"🔬",lvl:4,h:"מיקרוסקופ"},{w:"volcano",e:"🌋",lvl:4,h:"הר געש"},
  {w:"compass",e:"🧭",lvl:4,h:"מצפן"},{w:"harvest",e:"🌾",lvl:4,h:"קציר"},
  {w:"anchor",e:"⚓",lvl:4,h:"עוגן"},{w:"telescope",e:"🔭",lvl:4,h:"טלסקופ"},
  {w:"laboratory",e:"⚗️",lvl:4,h:"מעבדה"},{w:"puzzle",e:"🧩",lvl:4,h:"פאזל"},
  {w:"lighthouse",e:"🗼",lvl:4,h:"מגדלור"},{w:"vaccine",e:"💉",lvl:4,h:"חיסון"},
  {w:"satellite",e:"🛰️",lvl:4,h:"לוויין"},{w:"sculpture",e:"🗿",lvl:4,h:"פסל"},
  {w:"orchestra",e:"🎻",lvl:4,h:"תזמורת"},{w:"skeleton",e:"💀",lvl:4,h:"שלד"},
  {w:"magnet",e:"🧲",lvl:4,h:"מגנט"},{w:"battery",e:"🔋",lvl:4,h:"סוללה"},

  // ── lvl 5 · תיכון: מושגים מתקדמים ──
  {w:"manuscript",e:"📜",lvl:5,h:"כתב יד"},{w:"infrastructure",e:"🏗️",lvl:5,h:"תשתית"},
  {w:"diplomacy",e:"🕊️",lvl:5,h:"דיפלומטיה"},{w:"commerce",e:"🏦",lvl:5,h:"מסחר"},
  {w:"specimen",e:"🦠",lvl:5,h:"דגימה"},{w:"expedition",e:"🧗",lvl:5,h:"משלחת"},
  {w:"observatory",e:"🔭",lvl:5,h:"מצפה כוכבים"},{w:"currency",e:"💱",lvl:5,h:"מטבע"},
  {w:"parliament",e:"🏛️",lvl:5,h:"פרלמנט"},{w:"reservoir",e:"🌊",lvl:5,h:"מאגר מים"},
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
const TOTAL  = Object.values(QUOTA).reduce((a,b)=>a+b,0); // 62
const TIME   = {vocab:300,cloze:600,reading:600,pics:600,match:210,balloons:180};
const ORDER  = ["p1","p2","p3","p4","p5","p6"];
const LEVEL_NAME = {1:"כיתות א׳–ב׳",2:"כיתות ג׳–ד׳",3:"כיתות ה׳–ו׳",4:"חטיבה",5:"תיכון"};
const PART_NAME  = {p1:"אוצר מילים",p2:"השלמת מילים",p3:"הבנת הנקרא",p4:"תיאור תמונה",p5:"התאמת מילים",p6:"בלונים"};
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
const grade  = c => Math.round((c/TOTAL)*100);
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
const S = {screen:"login",name:"",phone:"",age:9,score:0,seen:[],history:[],found:null,busy:false,prog:{}};

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
const V={},C={},R={},D={},M={},B={};

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
  const lvl=levelForAge(S.age),showPause=ORDER.includes(S.screen);
  return `<header class="topbar">
  <div class="brand">English<span>·</span>Trainer</div>
  <div class="who">${esc(S.name)}${S.name?" · ":""}${LEVEL_NAME[lvl]}</div>
  ${showPause?'<button class="pausebtn" id="btn-pause" title="השהה ושמור">⏸</button>':""}
  ${showPause?'<button class="pausebtn" id="btn-skip" title="דלג לשלב הבא">⏭</button>':""}
  <div class="score" id="score-el" aria-label="ניקוד">${grade(S.score)}<small>/100</small></div>
</header>`;
}

function loginHTML(){
  return `<section class="card hero">
  <span class="eyebrow">אימון אנגלית יומי</span>
  <h1>ארבעה חלקים.<br>ארבעה שעוני חול.</h1>
  <p class="sub">מילים, השלמות, סיפור ותיאור תמונה — לפי הגיל והרמה בבית הספר. המבחן נשמר במכשיר וניתן להמשיך אותו בכל רגע.</p>
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

function menuHTML(){
  const hist=S.history.length
    ?`<span class="eyebrow">מבחנים קודמים</span>
<ul class="hist">${S.history.slice(0,5).map(r=>`<li><span>${fmtDate(r.t)}</span><b>${r.g}/100</b></li>`).join("")}</ul>`:"";
  return `<section class="card">
  <span class="eyebrow">התוכנית שלך היום</span>
  <ul class="plan">
    <li data-part="p1"><b>אוצר מילים</b><span>${QUOTA.vocab} מילים · 5 דק׳</span></li>
    <li data-part="p2"><b>השלמת מילים</b><span>${QUOTA.cloze} השלמות · 10 דק׳</span></li>
    <li data-part="p3"><b>הבנת הנקרא</b><span>${QUOTA.reading} שאלות · 10 דק׳</span></li>
    <li data-part="p4"><b>תיאור תמונה</b><span>${QUOTA.pics} תמונות · 10 דק׳</span></li>
    <li data-part="p5"><b>התאמת מילים</b><span>${QUOTA.match} התאמות · 3.5 דק׳</span></li>
    <li data-part="p6"><b>בלונים</b><span>${QUOTA.balloons} בלונים · 3 דק׳</span></li>
  </ul>
  <p class="foot">${TOTAL} תשובות · הציון מוצג מתוך 100</p>
  ${hist}
  <button class="primary" id="btn-start">התחלה מחלק 1</button>
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
  <div class="bank" id="cloze-bank"></div>
  <div id="cloze-placer"></div>
</section>`;
}

function readingHTML(){
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">חלק 3 · הבנת הנקרא</span><p class="lead" id="story-ttl"></p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.reading?.left??TIME.reading,TIME.reading)}</span></div>
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

function matchHTML(){
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">חלק 5 · התאמת מילים</span><p class="lead">מתחו קו בין המילה לפירוש</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.match?.left??TIME.match,TIME.match)}</span></div>
  </div>
  <p class="foot">גררו מהמילה באנגלית (משמאל) אל הפירוש הנכון בעברית (מימין)</p>
  <div class="match" id="match-wrap" dir="ltr">
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
  const hist=S.history.length>1
    ?`<ul class="hist">${S.history.slice(0,5).map(r=>`<li><span>${fmtDate(r.t)}</span><b>${r.g}/100</b></li>`).join("")}</ul>`:"";
  return `<section class="card hero">
  <span class="eyebrow">סיימת</span>
  <h1>${grade(S.score)} <small class="of">/100</small></h1>
  <p class="sub">${S.score} תשובות נכונות מתוך ${TOTAL}. כל הכבוד, ${esc(S.name)} — התוצאה נשמרה.</p>
  ${hist}
  <button class="primary" id="btn-again">סבב נוסף</button>
</section>`;
}

// ─── Core Render ──────────────────────────────────────────
const SCR_HTML={login:loginHTML,resume:resumeHTML,menu:menuHTML,p1:vocabHTML,p2:clozeHTML,p3:readingHTML,p4:describeHTML,p5:matchHTML,p6:balloonsHTML,paused:pausedHTML,done:doneHTML};

function gotoNext(cur){
  const k=ORDER.indexOf(cur);
  if(k>=0&&k<ORDER.length-1){S.screen=ORDER[k+1];render();}
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
    eb.addEventListener("click",doEnter);
  }
  if(S.screen==="resume"){
    document.getElementById("btn-resume").addEventListener("click",doResume);
    document.getElementById("btn-fresh").addEventListener("click",doFresh);
  }
  if(S.screen==="menu"){
    document.querySelectorAll(".plan li").forEach(li=>{
      li.addEventListener("click",()=>{S.screen=li.dataset.part;render();});
    });
    document.getElementById("btn-start").addEventListener("click",()=>{S.screen="p1";render();});
  }
  if(S.screen==="paused")
    document.getElementById("btn-menu").addEventListener("click",()=>{S.screen="menu";render();});
  if(S.screen==="done")
    document.getElementById("btn-again").addEventListener("click",()=>{S.score=0;S.prog={};S.screen="menu";render();});
}

function initPart(){
  if(S.screen==="p1")initVocab();
  else if(S.screen==="p2")initCloze();
  else if(S.screen==="p3")initReading();
  else if(S.screen==="p4")initDescribe();
  else if(S.screen==="p5")initMatch();
  else if(S.screen==="p6")initBalloons();
}

// ─── Session Helpers ──────────────────────────────────────
function saveSession(){
  if(!S.phone||S.screen==="login"||S.screen==="resume")return;
  sSet(K.session(S.phone),{name:S.name,age:S.age,score:S.score,screen:S.screen,prog:S.prog,t:Date.now()});
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
  V.pool=nearLevel(VOCAB,lvl,6);
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
  C.sel=null;C.num="";
  document.getElementById("cloze-ttl").textContent=C.item.title;
  refreshCS();refreshCB();
  document.getElementById("cloze-placer").innerHTML="";
  TM.start(saved?.left??TIME.cloze,TIME.cloze,()=>{S.screen="p3";render();});
}

function clozeStory(){
  return C.item.text.split(/(\{\d+\})/g).map(p=>{
    const m=p.match(/^\{(\d+)\}$/);if(!m)return esc(p);
    const n=Number(m[1]);
    return C.filled[n]
      ?`<b class="blank done">${esc(C.filled[n])}</b>`
      :`<span class="blank"><sup>${n}</sup>______</span>`;
  }).join("");
}

function refreshCS(){
  const el=document.getElementById("cloze-story");if(el)el.innerHTML=clozeStory();
  const ctr=document.getElementById("q-ctr");if(ctr)ctr.textContent=`${Object.keys(C.filled).length}/${C.item.answers.length}`;
}

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
  const n=parseInt(C.num,10);
  if(!C.sel||!n||n<1||n>C.item.answers.length)return;
  if(C.item.answers[n-1]===C.sel&&!C.filled[n]){
    C.filled={...C.filled,[n]:C.sel};C.used=[...C.used,C.sel];
    addScore(1);SFX.good();speak(C.sel);showToast("good","נכון מאוד!");
    commitProg({cloze:{id:C.item.id,bank:C.bank,filled:C.filled,used:C.used,left:TM.left}});
    C.sel=null;C.num="";refreshCS();refreshCB();refreshCP();
    if(Object.keys(C.filled).length>=C.item.answers.length)
      setTimeout(()=>{if(S.screen!=="p2")return;S.screen="p3";render();},1200);
  }else{
    SFX.bad();showToast("bad",`${S.name}, נסה/י שוב`);
    C.sel=null;C.num="";refreshCB();refreshCP();
  }
}

// ─── Part 3: Reading ──────────────────────────────────────
function initReading(){
  const saved=S.prog.reading,lvl=levelForAge(S.age);
  if(saved&&saved.id)R.story=STORIES.find(x=>x.id===saved.id)||STORIES[0];
  else{
    const pool=STORIES.filter(x=>Math.abs(x.lvl-lvl)<=2);
    const src=pool.length?pool:STORIES;
    R.story=src[Math.floor(Math.random()*src.length)];
  }
  R.qIdx   =saved?.qIdx??shuffle(R.story.qpool.map((_,k)=>k)).slice(0,QUOTA.reading);
  R.qi     =saved?.qi??0;
  R.reading=saved?.qi?false:true;
  R.picked =null;
  document.getElementById("story-ttl").textContent=R.story.title;
  refreshRV();
  TM.start(saved?.left??TIME.reading,TIME.reading,()=>{S.screen="p4";render();});
}

function refreshRV(){
  const ctr=document.getElementById("q-ctr"),body=document.getElementById("reading-body");if(!body)return;
  if(R.reading){
    if(ctr)ctr.textContent="";
    body.innerHTML=`<div class="story scroll" dir="ltr">${R.story.text.split("\n\n").map(p=>`<p>${esc(p)}</p>`).join("")}</div>
<button class="primary" id="btn-done-r">סיימתי לקרוא — לשאלות</button>`;
    document.getElementById("btn-done-r").addEventListener("click",()=>{R.reading=false;refreshRV();});
  }else{
    const qs=R.qIdx.map(k=>R.story.qpool[k]),q=qs[R.qi];
    if(ctr)ctr.textContent=`${R.qi+1}/${qs.length}`;
    body.innerHTML=`<p class="question" dir="ltr">${esc(q.q)}</p>
<div class="opts" id="q-opts">${q.o.map((o,i)=>`<button class="opt" data-idx="${i}" dir="ltr"><span>${esc(o)}</span><span class="mark" style="display:none"></span></button>`).join("")}</div>
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
  setTimeout(()=>{
    if(S.screen!=="p3")return;
    R.picked=null;R.qi++;
    const qs2=R.qIdx.map(k=>R.story.qpool[k]);
    if(R.qi>=qs2.length){TM.stop();S.screen="p4";render();}
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
  TM.start(saved?.left??TIME.match,TIME.match,()=>gotoNext("p5"));
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
    if(M.solved.size>=M.pairs.length)setTimeout(()=>{if(S.screen==="p5")gotoNext("p5");},1000);
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
    const pool=nearLevel(VOCAB,lvl,QUOTA.balloons).filter(x=>x.e);
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

// ─── Actions ──────────────────────────────────────────────
function doEnter(){
  if(!S.name.trim()||S.phone.length<9||S.busy)return;
  S.busy=true;
  document.getElementById("btn-enter").disabled=true;
  document.getElementById("btn-enter").textContent="רגע…";
  const ses=sGet(K.session(S.phone)),hist=sGet(K.results(S.phone)),seen=sGet(K.seen(S.phone));
  S.history=hist||[];S.seen=seen||[];S.busy=false;
  if(ses&&ses.screen&&ses.screen!=="done"){S.found=ses;S.screen="resume";}
  else{S.prog={};S.score=0;S.screen="menu";}
  render();
}

function doResume(){
  const f=S.found;
  S.name=f.name||S.name;S.age=f.age||S.age;S.score=f.score||0;
  S.prog=f.prog||{};S.screen=f.screen;S.found=null;render();
}

function doFresh(){
  sDel(K.session(S.phone));S.prog={};S.score=0;S.found=null;S.screen="menu";render();
}

function doPause(){
  if(S.screen==="p1"&&V.item)commitProg({vocab:{round:V.round,i:V.i,left:TM.left}});
  else if(S.screen==="p2"&&C.item)commitProg({cloze:{id:C.item.id,bank:C.bank,filled:C.filled,used:C.used,left:TM.left}});
  else if(S.screen==="p3"&&R.story)commitProg({reading:{id:R.story.id,qIdx:R.qIdx,qi:R.qi,left:TM.left}});
  else if(S.screen==="p4"&&D.idxs)commitProg({pics:{idxs:D.idxs,i:D.i,left:TM.left}});
  else if(S.screen==="p5"&&M.pairs)commitProg({match:matchState()});
  else if(S.screen==="p6"&&B.pairs)commitProg({balloons:balloonState()});
  S.screen="paused";render();
}

function finish(){
  TM.stop();
  const rec={t:Date.now(),name:S.name,lvl:levelForAge(S.age),correct:S.score,total:TOTAL,g:grade(S.score)};
  S.history=[rec,...S.history].slice(0,30);
  sSet(K.results(S.phone),S.history);sDel(K.session(S.phone));
  S.prog={};S.screen="done";render();
}

// ─── Boot ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded",()=>render());
