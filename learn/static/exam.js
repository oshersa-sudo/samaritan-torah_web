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
      {w:"apple",e:"🍎",lvl:3,h:"תפוח"},{w:"dog",e:"🐶",lvl:3,h:"כלב"},{w:"sun",e:"☀️",lvl:3,h:"שמש"},
      {w:"teacher",e:"🧑‍🏫",lvl:3,h:"מורה"},{w:"bicycle",e:"🚲",lvl:3,h:"אופניים"},
      {w:"doctor",e:"🧑‍⚕️",lvl:5,h:"רופא"},{w:"hammer",e:"🔨",lvl:5,h:"פטיש"},
      {w:"microscope",e:"🔬",lvl:8,h:"מיקרוסקופ"},{w:"manuscript",e:"📜",lvl:11,h:"כתב יד"},
    ];

const CLOZE = [
  {
    id:"c1",lvl:3,title:"A Day at the Park",
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
    id:"c2",lvl:5,title:"The Old Lighthouse",
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
  },,
  {"id":"c3","lvl":3,"title":"My Cat Lily","text":"I have a little {1}. Her name is Lily. She is very {2}. Every {3} she wakes me up. She likes to {4} in the sun. Her fur is soft and {5}. She has two big {6} and a long {7}. She likes to {8} with a ball. When she is happy she likes to {9}. At night she likes to {10}. I give her {11} in a bowl. She drinks {12} too. I love my {13} very much. She is my best {14}. Every day we {15} in the yard. She always makes me {16}.","answers":["cat","cute","morning","sit","warm","eyes","tail","play","purr","sleep","food","water","pet","friend","run","happy"],"decoys":["dog","cold","night","jump","small","sad"],"hints":["A small furry pet that says meow","Pretty and sweet to look at","The start of the day, when the sun comes up","To rest on your bottom, not standing","Not cold, it gives a nice gentle heat","You use these two things to see","The long part at the back of an animal","To have fun with toys","The soft rumbling sound a happy cat makes","To close your eyes and rest at night","What you eat when you are hungry","A clear drink you need every day","An animal you keep at home and love","Someone you like and spend time with","To move fast on your legs","The feeling that gives you a big smile"]},
  {"id":"c4","lvl":3,"title":"A Day at the Park","text":"On Sunday my family went to the {1}. The sun was bright and the sky was {2}. We rode our {3} down the path. My brother wanted to {4} on the tall swings. I climbed up a big {5} to see far away. We ate lunch on a green {6} spread on the grass. Mom made tasty {7} for everyone. We drank cold {8} from a bottle. A little {9} landed near my foot and sang. We watched a {10} swimming in the pond. In the afternoon we flew a {11} in the wind. It went very {12} into the air. Then dark {13} came and it began to {14}. We ran back to the {15}. It was a wonderful {16}.","answers":["park","blue","bikes","swing","tree","blanket","sandwiches","water","bird","duck","kite","high","clouds","rain","car","day"],"decoys":["green","boat","walk","hot","flowers","field"],"hints":["A green place with trees where children play","The color of a clear, sunny sky","Two-wheeled things you ride and pedal","To move back and forth on a hanging seat","A tall plant with a trunk, branches, and leaves","A soft cloth you spread on the grass to sit on","Bread with something tasty inside","A clear drink with no color or taste","A small animal with feathers that can fly","A water bird that says quack","A toy that flies on a string in the wind","Very far up, not low","White or grey shapes that float in the sky","Water falling down from the sky","The thing with four wheels your family drives","The time from morning until night"]},
  {"id":"c5","lvl":5,"title":"A Journey Through Space","text":"Last week our class learned about {1}. Our teacher showed us pictures of the {2} and the eight {3} that move around it. The Earth is the third planet and it is our {4}. It spins around once every {5}. At night the {6} shines by reflecting the sunlight. Brave people called {7} travel far above us inside a {8}. They wear special {9} that help them breathe. In space there is almost no {10}, so everything floats freely. Stars are giant balls of burning {11} that sit very far {12} from us. Scientists study the sky through a powerful {13}. One day humans may build a {14} on the planet Mars. I dream of becoming a space {15} when I grow up. Learning about the universe is truly {16}.","answers":["space","sun","planets","home","day","moon","astronauts","rocket","suits","gravity","gas","away","telescope","base","explorer","amazing"],"decoys":["comet","orbit","cold","robot","ground","dark"],"hints":["The huge empty place beyond our sky where stars float","The bright star at the center of our solar system","Large round worlds that orbit a star","The place where you live","A period of twenty-four hours","The round rock that circles Earth and glows at night","People trained to travel beyond Earth","A tall machine that blasts off into space","Protective clothing worn in dangerous places","The force that pulls things down to the ground","A substance like air that is not solid or liquid","Far in distance, not near","A tube-shaped tool that makes far things look closer","A main station or camp people build to live and work","A person who travels to discover new places","So wonderful it fills you with wonder"]},
  {"id":"c6","lvl":8,"title":"The Guardian of the Forest","text":"The ancient {1} stretched for miles beneath a canopy of tall trees. A determined young {2} named Maya set out on an important {3} to save the wilderness. She carried a leather {4} filled with maps and tools. Along the muddy {5}, she discovered rare {6} that bloomed only in the shade. Suddenly a curious {7} scampered across her way and vanished into the thick {8}. Maya knew that many creatures were in terrible {9} because of pollution. She carefully gathered {10} and wrote everything down in her {11}. As the sun began to {12}, the sky glowed with brilliant {13} of orange and pink. Exhausted but proud, she found a quiet clearing to make {14}. That night she felt a deep sense of {15} for the beautiful world she was working hard to {16}.","answers":["forest","explorer","mission","backpack","path","flowers","squirrel","bushes","danger","samples","journal","set","colors","camp","gratitude","protect"],"decoys":["mountain","river","guide","compass","quest","wildlife"],"hints":["A large area thickly covered with trees","A person who travels to discover unknown places","An important task or journey with a clear goal","A bag you wear on your shoulders to carry things","A narrow track you follow through the woods","Colorful blossoms that grow on plants","A small bushy-tailed animal that climbs trees for nuts","Thick low plants growing close to the ground","A situation where something may be harmed or lost","Small pieces collected to study or prove something","A private notebook where you record daily thoughts","What the sun does in the evening as it goes down","Bright hues you see, like red, blue, and green","A temporary shelter with a tent for sleeping outdoors","A thankful feeling for something good","To keep safe from harm"]},
  {"id":"c7","lvl":3,"title":"My Dog","text":"I have a big {1}. His name is Max. He is {2} and white. Max likes to {3} in the park. I give him {4} every day. At night, Max sleeps in my {5}.","answers":["dog","black","run","food","room"],"decoys":["cat","red","jump","water","garden","book"],"hints":["a pet animal that barks","a dark colour, the opposite of white","to move fast on your legs","what you eat","the place in your house where you sleep"]},
  {"id":"c8","lvl":3,"title":"My School Day","text":"Every morning I {1} up at seven o'clock. I eat {2} with my family. Then I walk to {3} with my friend. My favourite {4} is English because I like to read stories. After school I do my {5}, and then I {6} football with my brother.","answers":["wake","breakfast","school","subject","homework","play"],"decoys":["sleep","lunch","home","teacher","lesson","watch"],"hints":["to stop sleeping","the first meal of the day","the place where children learn","a topic you study, like maths or science","work the teacher gives you to do at home","to take part in a game or sport"]},
  {"id":"c9","lvl":5,"title":"A Day at the Beach","text":"Last summer my family went to the {1}. The weather was hot and {2}. We swam in the blue {3} and built a big castle in the {4}. My little sister found a beautiful {5} near the water. In the evening we were tired but very {6}. It was the best day of our {7}.","answers":["beach","sunny","sea","sand","shell","happy","holiday"],"decoys":["mountain","cloudy","river","snow","stone","sad"],"hints":["a sandy place next to the sea","bright with light from the sun","a large area of salt water","tiny soft grains you find on the beach","the hard cover of a sea animal that people collect","feeling glad and pleased","a time when you do not go to school and often travel"]},
  {"id":"c10","lvl":8,"title":"A New Friend","text":"When Maya moved to a new city, she felt lonely and {1}. On her first day at school she did not know {2}. During the lunch break, a girl named Dana came to {3} to her and smiled. Dana {4} Maya to sit with her group. Soon the two girls became close {5}. Maya learned that making friends only {6} a little courage and a friendly {7}.","answers":["nervous","anyone","talk","invited","friends","takes","smile"],"decoys":["afraid","everyone","walk","allowed","strangers","costs"],"hints":["worried and not relaxed","not a single person","to speak with someone","asked someone to come or join (past tense)","people you like and spend time with","needs or requires (present tense)","a happy expression you make with your face"]},
  {"id":"c11","lvl":11,"title":"The Power of Reading","text":"Reading is one of the most valuable {1} a person can develop. When we open a book, we can {2} to faraway places without leaving our room. Stories allow us to understand how other people {3} and to see the world through their eyes. Scientists have also {4} that regular reading improves memory and {5} the brain active as we grow older. Although screens now compete for our {6}, a good book still offers a unique kind of {7} that is hard to replace.","answers":["skills","travel","feel","discovered","keeps","attention","pleasure"],"decoys":["talents","think","imagined","makes","freedom","comfort"],"hints":["abilities you learn and get better at with practice","to go on a journey to another place","to experience an emotion","found something out through study (past tense)","makes something stay in a certain state","the act of focusing your mind on something","a feeling of enjoyment or happiness"]},
  {"id":"c12","lvl":3,"title":"My Pet Cat","text":"I have a small {1} named Luna. She has soft grey fur and green {2}. Luna loves to {3} with a ball of wool. In the morning she drinks {4} from a little bowl. When she is tired, she {5} on my bed all day. I love my cat because she is my best {6}.","answers":["cat","eyes","play","milk","sleeps","friend"],"decoys":["dog","ears","run","juice","jumps","teacher"],"hints":["a small pet animal that says meow","you use these to see","to have fun with a toy or game","a white drink that comes from cows","to rest with your eyes closed","someone you like and spend time with"]},
  {"id":"ch1","lvl":8,"text":"Although the first experiment failed completely, the young scientists stayed {1} and eventually {2} a solution that surprised everyone.","answers":["optimistic","discovered"],"hints":["hopeful and positive about the future","found something after searching"],"decoys":["nervous","destroyed","ignored","forgot","argued"]},
  {"id":"ch2","lvl":8,"text":"The new report clearly {1} that air pollution has a serious {2} on the health of people living in big cities.","answers":["demonstrates","impact"],"hints":["shows something with evidence","an effect or influence on something"],"decoys":["hides","benefit","question","reduces","reward"]},
  {"id":"ch3","lvl":11,"text":"Despite the {1} evidence supporting the new theory, several experienced researchers remained {2}, insisting that further experiments were absolutely {3} before any firm conclusion could be reached.","answers":["compelling","skeptical","necessary"],"hints":["convincing and difficult to argue against","doubtful and not easily convinced","needed or required"],"decoys":["weak","convinced","optional","certain","pointless"]},
  {"id":"ch4","lvl":11,"text":"The novelist is widely admired for her {1} descriptions of the sea; {2}, critics frequently complain that her plots lack {3} and can be predicted from the very first chapter.","answers":["vivid","however","originality"],"hints":["strikingly clear, bright and detailed","a connector that introduces a contrast","the quality of being new and not copied"],"decoys":["dull","therefore","clarity","moreover","tradition"]},
  {"id":"ch5","lvl":11,"text":"By the time the volunteers finally {1} the isolated village, the flood had already {2} most of the crops, leaving the families with dangerously {3} supplies to survive the long winter.","answers":["reached","destroyed","scarce"],"hints":["arrived at a place (past tense)","ruined or wiped out completely (past perfect)","very limited and in short supply"],"decoys":["left","rescued","abundant","plentiful","planted"]}
];

const STORIES = [
  {
    id:"s1",lvl:3,title:"The Boy Who Fixed Clocks",
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
    id:"s2",lvl:8,title:"The Map That Was Wrong",
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
  },,
  {"id":"e3","lvl":3,"title":"The Lost Cat","text":"Maya had a small white cat named Snow. Every morning, Snow slept on Maya's bed. One day, Snow was not there. Maya looked under the bed and behind the door. She could not find Snow.\n\nMaya went outside to look. She looked in the garden and near the big tree. She called, \"Snow! Snow!\" But the cat did not come. Maya felt sad.\n\nThen she heard a soft sound. It came from a green box. Maya opened the box slowly. Snow was inside with three tiny kittens! The kittens were black and gray. Snow was now a mother.\n\nMaya smiled and ran to tell her mom. \"Snow has babies!\" she said. Her mom was happy too. Now Maya had four cats to love.","qpool":[{"q":"What color was Maya's cat?","o":["Black","Gray","White","Brown"],"c":2},{"q":"What was the cat's name?","o":["Snow","Maya","Kitty","Star"],"c":0},{"q":"Where did Snow usually sleep?","o":["In the garden","On Maya's bed","In a box","Near the tree"],"c":1},{"q":"How did Maya feel when she could not find Snow?","o":["Happy","Angry","Sad","Tired"],"c":2},{"q":"Where did Maya finally find Snow?","o":["Under the bed","In a green box","Behind the door","In the tree"],"c":1},{"q":"How many kittens did Snow have?","o":["Two","Three","Four","Five"],"c":1},{"q":"What colors were the kittens?","o":["White and pink","Black and gray","Brown and white","Red and blue"],"c":1},{"q":"Who did Maya tell about the babies?","o":["Her friend","Her teacher","Her mom","Her brother"],"c":2}]},
  {"id":"e4","lvl":5,"title":"The New Bike","text":"Tom wanted a bike more than anything. All his friends had bikes, but Tom did not. His family did not have much money for a new one. Tom felt a little sad, but he did not give up.\n\nOne day, Tom's dad had an idea. \"Let's fix an old bike together,\" he said. In the garage, there was an old red bike. It had a flat tire and no seat. It looked broken and dirty.\n\nEvery weekend, Tom and his dad worked on the bike. They cleaned the metal, fixed the tire, and put on a new seat. Tom learned how to use tools. It was hard work, but it was also fun to work with his dad.\n\nAfter one month, the bike was ready. It was clean and shiny. Tom got on and rode down the street. The wind was in his hair, and he felt free. His friends came to see the bike.\n\n\"Wow, it looks great!\" said his best friend, Ben. Tom smiled. This bike was special because he had made it with his dad. It was the best bike of all.","qpool":[{"q":"What did Tom want more than anything?","o":["A dog","A bike","A game","A new house"],"c":1},{"q":"Why did Tom not have a bike at first?","o":["He did not like bikes","His family did not have much money","He was too young","He lost his old bike"],"c":1},{"q":"Whose idea was it to fix an old bike?","o":["Tom's","Ben's","Tom's dad's","Tom's mom's"],"c":2},{"q":"What color was the old bike?","o":["Blue","Green","Red","Black"],"c":2},{"q":"What was wrong with the old bike?","o":["It had a flat tire and no seat","It had no wheels","It was too small","It had no handlebars"],"c":0},{"q":"How often did Tom and his dad work on the bike?","o":["Every day","Every weekend","Once a year","Every night"],"c":1},{"q":"How long did it take to finish the bike?","o":["One week","One day","One month","One year"],"c":2},{"q":"Why was the bike special to Tom?","o":["It was very fast","He made it with his dad","It was new and expensive","It was a gift from Ben"],"c":1}]},
  {"id":"e5","lvl":8,"title":"The Garden Surprise","text":"Emma lived in a small house with a big backyard. The backyard was empty and full of brown grass. Emma wished it could be beautiful, but she did not know how to change it. One spring day, her grandmother came to visit and brought a small brown bag.\n\n\"What is in the bag?\" Emma asked. Her grandmother smiled and opened it. Inside were many tiny seeds. \"These are flower seeds,\" she said. \"If we plant them and take care of them, they will grow into a beautiful garden.\"\n\nEmma was excited. Together, they dug small holes in the ground and put the seeds inside. Then they covered the seeds with soft soil and gave them water. \"Now we must be patient,\" said Grandmother. \"Plants need sun, water, and time to grow.\"\n\nEvery day after school, Emma watered the seeds. At first, nothing happened, and Emma felt worried. But after two weeks, tiny green leaves came out of the ground. Emma was so happy that she jumped up and down.\n\nThe weeks passed, and the plants grew taller and stronger. Then, one bright morning, Emma looked outside and gasped. The backyard was full of red, yellow, and purple flowers. Bees and butterflies flew from flower to flower.\n\nEmma called her grandmother on the phone. \"The garden is beautiful!\" she said. \"Thank you for teaching me.\" Her grandmother was proud. Emma learned that with hard work and patience, she could make something wonderful.","qpool":[{"q":"What did Emma's backyard look like at the start?","o":["Full of flowers","Empty with brown grass","Covered in snow","Full of trees"],"c":1},{"q":"Who came to visit Emma?","o":["Her friend","Her teacher","Her grandmother","Her aunt"],"c":2},{"q":"What was inside the small brown bag?","o":["Toys","Flower seeds","Food","Books"],"c":1},{"q":"What did they do after putting the seeds in the holes?","o":["Left them alone","Covered them with soil and gave water","Put them in the sun only","Took them back inside"],"c":1},{"q":"According to Grandmother, what do plants need to grow?","o":["Only water","Sun, water, and time","Only sunlight","Music and love"],"c":1},{"q":"How long did it take for the green leaves to appear?","o":["One day","Two weeks","Two months","One year"],"c":1},{"q":"What colors were the flowers in the end?","o":["Only red","Black and white","Red, yellow, and purple","Blue and green"],"c":2},{"q":"What lesson did Emma learn?","o":["Flowers are easy to grow","Grandmothers know everything","Hard work and patience make something wonderful","Bees are dangerous"],"c":2}]},
  {"id":"e6","lvl":3,"title":"Ben and His Ball","text":"Ben is a boy. He is seven years old. He has a red ball. He likes to play with it every day.\n\nOne morning Ben went to the park. He played with his ball on the green grass. The sun was warm and the sky was blue.\n\nThen a big dog ran to Ben. The dog took the ball! Ben was sad. But the dog gave the ball back. Ben and the dog played together. Now they are friends.","qpool":[{"q":"How old is Ben?","o":["five","six","seven","eight"],"c":2},{"q":"What colour is Ben's ball?","o":["blue","red","green","yellow"],"c":1},{"q":"Where did Ben go one morning?","o":["to school","to the park","to the sea","to a shop"],"c":1},{"q":"What was the weather like?","o":["cold and rainy","warm and sunny","windy and grey","cold and snowy"],"c":1},{"q":"What did the dog do first?","o":["ate the ball","took the ball","hid the ball","kicked the ball"],"c":1},{"q":"How does the story end?","o":["Ben cries","Ben goes home","Ben and the dog become friends","the dog runs away"],"c":2}]},
  {"id":"e7","lvl":3,"title":"The School Trip","text":"On Monday, Class 4B went on a trip to the zoo. All the children were very excited. They took a big yellow bus from their school.\n\nAt the zoo they saw many animals. The lions were sleeping in the sun, and the monkeys were jumping in the trees. Dana's favourite animal was the tall giraffe.\n\nAt lunch time the children sat under a big tree. They ate sandwiches and drank juice. A clever bird tried to take Tom's bread!\n\nIn the afternoon they went back to school. Everyone was tired but happy. Dana said it was the best day of the year.","qpool":[{"q":"Where did Class 4B go?","o":["to a museum","to the zoo","to the beach","to a farm"],"c":1},{"q":"On which day did they go?","o":["Sunday","Monday","Friday","Saturday"],"c":1},{"q":"How did the children travel?","o":["by train","by car","by bus","on foot"],"c":2},{"q":"Which animal was Dana's favourite?","o":["the lion","the monkey","the giraffe","the bird"],"c":2},{"q":"What did the children drink at lunch?","o":["water","milk","juice","tea"],"c":2},{"q":"What tried to take Tom's bread?","o":["a monkey","a bird","a dog","a lion"],"c":1},{"q":"How did the children feel at the end of the trip?","o":["sad and angry","tired but happy","bored and cold","afraid"],"c":1}]},
  {"id":"e8","lvl":5,"title":"The Lost Kitten","text":"It was a rainy afternoon when Noa heard a strange sound in the garden. She opened the door and looked outside. Under a bush she found a small, wet kitten shaking with cold.\n\nNoa carefully picked up the kitten and brought it inside. She dried it with a soft towel and gave it a bowl of warm milk. The kitten drank quickly and then fell asleep on her lap.\n\nNoa wanted to keep the kitten, but she knew it might belong to someone. The next day she made a poster with a picture of the kitten and put it near the shops.\n\nThat evening a woman knocked on the door. The kitten was hers, and she had been looking for it all day. She thanked Noa with a big smile and gave her a box of chocolates.\n\nNoa was a little sad to say goodbye, but she felt happy that she had helped. The woman promised that Noa could visit the kitten any time she wanted.","qpool":[{"q":"What was the weather like when Noa found the kitten?","o":["sunny","rainy","snowy","windy"],"c":1},{"q":"Where did Noa find the kitten?","o":["inside the house","under a bush in the garden","at school","near the shops"],"c":1},{"q":"What did Noa give the kitten to drink?","o":["water","juice","warm milk","tea"],"c":2},{"q":"Why didn't Noa keep the kitten right away?","o":["She did not like it","She thought it might belong to someone","It was too big","Her parents said no"],"c":1},{"q":"How did Noa try to find the owner?","o":["She called the police","She made a poster","She asked her teacher","She waited at home"],"c":1},{"q":"How did the woman thank Noa?","o":["with money","with a box of chocolates","with a new toy","with a letter"],"c":1},{"q":"How did Noa probably feel at the end of the story?","o":["only angry","both a little sad and happy","bored","afraid"],"c":1}]},
  {"id":"e9","lvl":8,"title":"The Science Fair","text":"Omer had always loved building things, so when his teacher announced the school science fair, he could not wait to begin. He decided to build a small robot that could follow a line on the floor.\n\nFor two weeks Omer worked every evening after his homework. He collected old motors, wires, and wheels, and he watched many videos to learn how everything worked. Some nights the robot did not move at all, and Omer felt like giving up.\n\nHis older sister, Shira, noticed how frustrated he was. She reminded him that every inventor makes mistakes before they succeed. With her help, Omer found a loose wire that had caused the problem.\n\nOn the day of the fair, the gym was full of colourful projects and nervous students. When it was Omer's turn, his little robot moved slowly but perfectly along the black line. The judges asked many questions, and Omer answered each one with confidence.\n\nOmer did not win first prize, but the judges gave him a special award for the most creative project. More importantly, he had learned that hard work and patience are the real keys to success.","qpool":[{"q":"What did Omer decide to build for the science fair?","o":["a computer","a robot that follows a line","a model plane","a clock"],"c":1},{"q":"How long did Omer work on his project?","o":["two days","two weeks","two months","one year"],"c":1},{"q":"Why did Omer sometimes feel like giving up?","o":["He was tired of school","The robot would not move","His sister was unkind","He had no tools"],"c":1},{"q":"How did Shira help her brother?","o":["She built the robot for him","She encouraged him and helped find the problem","She gave him money","She did his homework"],"c":1},{"q":"What was actually wrong with the robot?","o":["a broken wheel","a loose wire","no batteries","the wrong motor"],"c":1},{"q":"What happened when Omer showed his robot at the fair?","o":["it did not work","it moved perfectly along the line","it fell and broke","it went too fast"],"c":1},{"q":"What award did Omer receive?","o":["first prize","the most creative project","best student","no award"],"c":1},{"q":"What is the main lesson of the story?","o":["Robots are too hard to build","Winning is the only thing that matters","Hard work and patience lead to success","Science fairs are boring"],"c":2}]},
  {"id":"e10","lvl":11,"title":"A Difficult Choice","text":"Maya had dreamed of joining the national swimming team for as long as she could remember. After years of early-morning practice, she finally received an invitation to the most important competition of her life. There was only one problem: the event was on the same weekend as her best friend's family celebration in another city.\n\nRoni, her closest friend, had asked Maya to be there weeks earlier. Their families had planned everything together, and Maya had promised she would come. Now she felt torn between her personal ambition and her loyalty to a friend who had always supported her.\n\nFor several days Maya could not decide. She spoke to her coach, who told her that missing the competition might cost her a place on the team. She also spoke to her mother, who simply said, \"Whatever you choose, make sure you can live with it.\"\n\nIn the end, Maya made a surprising decision. She travelled to the celebration to keep her promise, but before she left, she recorded a short video explaining her situation to the selectors and asking for another chance.\n\nTo her relief, the selectors were impressed by her honesty and her sense of responsibility. They offered her a place in a later trial. Maya realised that being true to her values had not closed the door she feared, but had opened a different one.\n\nYears later, whenever Maya faced a hard choice, she remembered that weekend and the lesson it had taught her: that keeping our promises and staying true to ourselves is never a waste.","qpool":[{"q":"What was Maya's long-time dream?","o":["to become a doctor","to join the national swimming team","to travel the world","to win a scholarship"],"c":1},{"q":"Why did Maya face a difficult choice?","o":["She was ill","The competition was on the same weekend as her friend's celebration","She had lost her invitation","Her coach was angry with her"],"c":1},{"q":"What had Maya promised Roni?","o":["to help her study","to be at the family celebration","to join the swimming team","to lend her money"],"c":1},{"q":"What did the coach warn Maya about?","o":["the bad weather","that she might lose her place on the team","that swimming is dangerous","that Roni was upset"],"c":1},{"q":"What did Maya's mother mean by her advice?","o":["Maya should always choose the team","Maya should choose what earns the most money","Maya should choose something she can feel at peace with","Maya should let her coach decide"],"c":2},{"q":"What decision did Maya finally make?","o":["She went to the competition instead","She stayed home and did nothing","She went to the celebration and asked the selectors for another chance","She gave up swimming forever"],"c":2},{"q":"How did the selectors respond to Maya?","o":["They were angry with her","They were impressed and offered her a later trial","They ignored her message","They removed her from the list"],"c":1},{"q":"What is the main message of the story?","o":["Never trust your friends","Winning is the most important thing in life","Staying true to your values can open new doors","Always do exactly what your coach says"],"c":2}]},
  {"id":"eh1","lvl":8,"title":"The Long Road of the Bicycle","text":"Today the bicycle seems like an ordinary machine, but its journey from a strange curiosity to a trusted companion took nearly a century. The earliest version, built in Germany in 1817, had no pedals at all. Riders pushed it forward with their feet along the ground, almost as if they were running while sitting down. People laughed at the contraption and nicknamed it the \"hobby horse\".\n\nDecades later, inventors added pedals directly to the front wheel. To go faster, designers made that front wheel enormous, sometimes as tall as a grown adult. These \"high-wheelers\" were exciting but genuinely dangerous. A rider perched high above the road could be thrown forward over the wheel by even a small stone, and serious injuries were common.\n\nThe machine we would recognise today appeared in the 1880s and was sensibly called the \"safety bicycle\". It had two wheels of equal size and, crucially, a chain that connected the pedals to the back wheel. This clever arrangement meant a rider could travel quickly without sitting dangerously high off the ground. When air-filled rubber tyres were added soon afterwards, the ride became far smoother and more comfortable.\n\nThe effects of this invention reached far beyond transport. For the first time, ordinary working people could travel several kilometres cheaply, without a horse or a train ticket. The bicycle gave many women, in particular, a new and welcome sense of freedom and independence, allowing them to move about their towns on their own. Some historians argue that this humble machine quietly reshaped society as much as it reshaped travel.\n\nMore than a hundred years later, the basic design has barely changed, which is itself a kind of praise. In an age of crowded roads and polluted air, millions of people are rediscovering that a simple, silent machine powered only by human muscle is still one of the cleverest inventions ever made.","qpool":[{"q":"What is the main idea of the passage?","o":["The bicycle developed slowly over time and changed society","Bicycles have always looked the same","High-wheelers were the safest bicycles","Bicycles are no longer used today"],"c":0},{"q":"Why did people nickname the earliest machine the \"hobby horse\"?","o":["It was pulled by a real horse","It was extremely fast","It had a very large front wheel","Riders pushed it with their feet as if running while seated"],"c":3},{"q":"According to the passage, why were the \"high-wheelers\" dangerous?","o":["They had no wheels","A rider sat high up and could be thrown forward over the wheel","They moved too slowly","They had air-filled tyres"],"c":1},{"q":"What made the \"safety bicycle\" safer than the high-wheeler?","o":["It had one enormous wheel","It had no pedals","It had equal wheels and a chain, so the rider sat lower","It was pushed along the ground"],"c":2},{"q":"In the fourth paragraph, the word \"independence\" is closest in meaning to:","o":["fear","freedom to act on one's own","tiredness","expense"],"c":1},{"q":"What does the writer mean by saying the unchanged design is \"itself a kind of praise\"?","o":["The design was a failure","The original design was so good that it needed little improvement","Nobody uses bicycles anymore","The bicycle was copied from a car"],"c":1},{"q":"What is the author's main purpose in the final paragraph?","o":["To warn readers against cycling","To explain how to build a bicycle","To suggest the bicycle is still valuable, especially for a cleaner world","To describe the first hobby horse again"],"c":2}]},
  {"id":"eh2","lvl":11,"title":"The Quiet Work of Sleep","text":"For most of human history, sleep was regarded as little more than a nightly pause, an empty gap between the meaningful hours of the day. Modern science has overturned that assumption entirely. Far from being a passive shutdown, sleep is now understood as an intensely active period during which the body and, above all, the brain carry out essential maintenance that cannot be performed while we are awake.\n\nOne of the most striking discoveries concerns memory. During certain stages of sleep, the brain appears to replay the experiences of the day, strengthening the connections that matter and quietly discarding those that do not. This is why a student who sleeps well after studying often remembers more than one who stays awake all night cramming. The learning does not simply sit still; it is consolidated, reorganised, and woven into what the person already knows.\n\nSleep also serves as a kind of cleaning system. Researchers have found that during deep sleep the spaces between brain cells widen, allowing fluid to flush away waste products that build up during waking hours. Some of these substances have been linked to serious diseases when they are allowed to accumulate. In other words, a good night's rest may protect the brain not only in the short term but across an entire lifetime.\n\nDespite this growing evidence, modern societies frequently treat sleep as an enemy of productivity, something to be defeated with bright screens and endless artificial light. Many people wear their exhaustion almost as a badge of honour, boasting about how little they sleep. Scientists warn that this attitude is both mistaken and costly, since chronic sleep loss weakens memory, judgement, mood and even the body's ability to fight illness.\n\nThe lesson emerging from the laboratory is therefore surprisingly simple, even if it is inconvenient. Sleep is not wasted time to be trimmed away whenever life grows busy. It is a biological necessity as fundamental as food and water, and the hours we spend apparently doing nothing may in fact be among the most productive of our lives.","qpool":[{"q":"What is the central idea of the passage?","o":["Sleep is a waste of valuable time","People today sleep too much","Sleep is an active, essential process that maintains the brain and body","Memory has nothing to do with sleep"],"c":2},{"q":"How has the scientific view of sleep changed, according to the first paragraph?","o":["From an empty pause to an intensely active maintenance period","From an active process to a passive one","From dangerous to harmless","It has not changed at all"],"c":0},{"q":"Why does a student who sleeps after studying often remember more?","o":["Sleep erases all new information","Studying at night is impossible","The brain stops working during sleep","During sleep the brain consolidates and reorganises what was learned"],"c":3},{"q":"In the third paragraph, what happens in the brain during deep sleep?","o":["Waste products build up faster","Spaces between brain cells widen and fluid flushes away waste","The brain stops cleaning itself","Memories are permanently deleted"],"c":1},{"q":"The phrase \"wear their exhaustion almost as a badge of honour\" suggests that some people:","o":["feel ashamed of being tired","sleep more than they need","are proud of how little they sleep","never feel tired"],"c":2},{"q":"What is the author's attitude toward the idea that sleep is an \"enemy of productivity\"?","o":["The author considers it mistaken and harmful","The author agrees completely","The author is unsure","The author finds it amusing but correct"],"c":0},{"q":"In the final paragraph, \"a biological necessity as fundamental as food and water\" mainly emphasises that sleep is:","o":["optional and easily skipped","only important for students","less important than eating","absolutely essential for survival and health"],"c":3},{"q":"What is the author's overall purpose in the passage?","o":["To teach readers how to fall asleep faster","To persuade readers that sleep is vital and should not be sacrificed","To describe a single scientific experiment","To argue that people sleep too much"],"c":1}]},
  {"id":"eh3","lvl":11,"title":"The Keeper of the Light","text":"For thirty-one years, Mr. Alder had climbed the same one hundred and forty-two steps every evening to light the great lamp at the top of the lighthouse. The island had no other residents, only screaming gulls and the endless grey conversation of the sea. Visitors sometimes asked whether the loneliness troubled him. He would smile and answer that a man who keeps a light for others is never truly alone.\n\nThe work demanded a strange kind of discipline. On calm summer nights, when the water lay flat as glass, it was tempting to believe the light was unnecessary. Yet Mr. Alder never allowed himself that thought. He understood that the value of a warning is not measured on the nights when nothing goes wrong, but on the single night, perhaps years apart, when a ship is saved from the rocks it could not see.\n\nThen the letter arrived. The mainland authorities, proud of their new automatic beacons, had decided that human keepers were no longer needed. A machine would tend the light now, they explained, and it would never grow old, never fall ill, and never ask for wages. Mr. Alder read the letter twice, folded it neatly, and placed it in the drawer where he kept things he did not wish to think about.\n\nOn his final night, he climbed the familiar steps more slowly than usual. He polished the great lens until it shone, though no inspector would ever check his work again. As the beam swept out across the black water, he found that he was not bitter, only quiet. The light would continue without him; that, after all, had always been the point. His pride had never been in being needed, but in the faithful doing of a necessary thing.\n\nYears later, sailors who passed the island still spoke of the lighthouse, though few remembered that a man had once lived there. And perhaps that was the truest measure of his life's work: not that he was remembered, but that, on some forgotten stormy night, a ship had reached its harbour safely because a light had been kept burning by a man who believed it mattered.","qpool":[{"q":"What is the main theme of the story?","o":["The danger of living near the sea","The excitement of modern technology","Quiet dedication to a necessary duty, even without recognition","The importance of becoming famous"],"c":2},{"q":"Why does Mr. Alder say he is \"never truly alone\"?","o":["Because keeping a light for others gives him a sense of connection and purpose","Because the island is crowded with people","Because he dislikes company","Because machines keep him company"],"c":0},{"q":"According to the second paragraph, when is the value of the light truly proven?","o":["On calm summer nights","When inspectors visit","When the sea is flat as glass","On the rare night when a ship is saved from unseen rocks"],"c":3},{"q":"Why did the authorities decide to replace the human keepers?","o":["Because Mr. Alder asked to retire","Because new automatic beacons were cheaper and needed no wages or rest","Because the lighthouse was closing forever","Because ships no longer passed the island"],"c":1},{"q":"What does placing the letter \"in the drawer where he kept things he did not wish to think about\" reveal about Mr. Alder?","o":["He was excited about the change","He had forgotten how to read","He was quietly hurt but tried not to dwell on it","He was planning to fight the decision"],"c":2},{"q":"In the fourth paragraph, the phrase \"he was not bitter, only quiet\" suggests that Mr. Alder felt:","o":["furious and vengeful","calm acceptance rather than anger","completely indifferent","frightened of the machine"],"c":1},{"q":"What does the final paragraph suggest is \"the truest measure of his life's work\"?","o":["That he became famous among sailors","That the lighthouse was named after him","That machines could never replace him","That ships were kept safe, even if he himself was forgotten"],"c":3},{"q":"What is the author's main purpose in telling this story?","o":["To explain how lighthouses work","To celebrate humble, faithful service that asks for no reward","To warn readers against living alone","To criticise sailors for forgetting Mr. Alder"],"c":1}]}
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
                hv:240,hb:210,hw:240,hs:240,wg:210,hr:600,
                ma1:240,ma2:300,ma5:360,ma6:360,ma3:360,ma4:240,
                sv:240,sw:240,sq:300,sr:600,
                tv:240,tw:240,tq:300,tr:600,
                lp:240,lf:240,ln:240,
                gv:240,gw:240,gq:300,gr:600,
                iv:240,iw:240,iq:300,ir:600};
// Levels are single school grades (א׳=1 … י״ב=12), so content can be matched to
// one grade rather than a two-year band.
const GRADE_LETTER = {1:"א׳",2:"ב׳",3:"ג׳",4:"ד׳",5:"ה׳",6:"ו׳",7:"ז׳",8:"ח׳",9:"ט׳",10:"י׳",11:"י״א",12:"י״ב"};
const MAX_LVL = 12;
const LEVEL_NAME = Object.fromEntries(Object.entries(GRADE_LETTER).map(([k,v])=>[k,"כיתה "+v]));
const PART_NAME  = {p1:"אוצר מילים",p2:"השלמת מילים",p3:"הבנת הנקרא",p4:"תיאור תמונה",
                    p5:"התאמת מילים",p6:"בלונים",
                    hv:"אוצר מילים",hb:"התאמת מילים",hw:"פירוש מילים",hs:"נרדפות והפכים",wg:"מילה או קשקוש",hr:"הבנת הנקרא",
                    ma1:"חיבור וחיסור",ma2:"כפל וחילוק",ma5:"שברים",ma6:"הנדסה וגיאומטריה",ma3:"בעיות מילוליות",ma4:"המספר החסר",
                    sv:"אוצר מילים במדע",sw:"פירוש מושגים",sq:"חידון טבע ומדע",sr:"הבנת הנקרא",
                    tv:"אוצר מושגים",tw:"פירוש מושגים",tq:"חידון תנ״ך",tr:"הבנת הנקרא",
                    lp:"חלקי הדיבר",lf:"צורות ופעלים",ln:"ניקוד ופיסוק",
                    gv:"מושגי גיאוגרפיה",gw:"פירוש מושגים",gq:"חידון מולדת וסביבה",gr:"הבנת הנקרא",
                    iv:"מושגי היסטוריה",iw:"פירוש מושגים",iq:"חידון היסטוריה",ir:"הבנת הנקרא"};
// answers per part → used to normalise the score to /100
const PART_QUOTA = {p1:10,p2:25,p3:6,p4:10,p5:6,p6:5,
                    hv:10,hb:8,hw:10,hs:10,wg:10,hr:6,
                    ma1:10,ma2:10,ma5:10,ma6:8,ma3:6,ma4:8,
                    sv:10,sw:10,sq:10,sr:6,
                    tv:10,tw:10,tq:10,tr:6,
                    lp:8,lf:8,ln:8,
                    gv:10,gw:10,gq:10,gr:6,
                    iv:10,iw:10,iq:10,ir:6};
// subjects and their part order — every subject: 4 parts, 4 hourglasses
const SUBJECTS = {
  english:{name:"אנגלית", icon:"🌍", desc:"מילים, שמיעה ודיבור",
           grad:"linear-gradient(150deg,#7dd3fc,#0284c7)", shadow:"#0369a1",
           mascot:"🐸", mascotName:"פְרוֹגִי הַצְּפַרְדֵּעַ",
           order:["p1","p2","p3","p4","p5","p6"]},
  hebrew: {name:"עברית",  icon:"📖", desc:"אוצר מילים, קריאה והבנה",
           grad:"linear-gradient(150deg,#a78bfa,#7c3aed)", shadow:"#6d28d9",
           mascot:"🦉", mascotName:"אוּפִּי הַיַּנְשׁוּף",
           order:["hv","hb","hs","wg","hr"]},
  math:   {name:"חשבון",  icon:"🧮", desc:"חיבור, כפל, שברים ובעיות",
           grad:"linear-gradient(150deg,#fda4af,#e11d48)", shadow:"#be123c",
           mascot:"👨‍🏫", mascotName:"פְּרוֹפֶסוֹר חֶשְׁבּוֹן",
           order:["ma1","ma2","ma5","ma6","ma3","ma4"]},
  science:{name:"טבע ומדעים", icon:"🔬", desc:"עולם החי, הצומח והחלל",
           grad:"linear-gradient(150deg,#6ee7b7,#059669)", shadow:"#047857",
           mascot:"🦎", mascotName:"נִיבִּי הַחוֹקֶרֶת",
           order:["sv","sw","sq","sr"]},
  torah:  {name:"תורה", icon:"📜", desc:"סיפורי המקרא, מושגים וחידון",
           grad:"linear-gradient(150deg,#fcd34d,#b45309)", shadow:"#92400e",
           mascot:"🕊️", mascotName:"יוֹנָה הַחֲכָמָה",
           order:["tv","tw","tq","tr"]},
  geo:    {name:"מולדת וסביבה", icon:"🗺️", desc:"מפות, ארץ ישראל והסביבה",
           grad:"linear-gradient(150deg,#86efac,#15803d)", shadow:"#166534",
           mascot:"🦅", mascotName:"נָוִיט הַנֶּשֶׁר",
           order:["gv","gw","gq","gr","iv","iw","iq","ir"]},
  history:{name:"היסטוריה", icon:"🏛️", desc:"תקופות, אירועים ודמויות",
           grad:"linear-gradient(150deg,#fbbf24,#92400e)", shadow:"#78350f",
           mascot:"🦉", mascotName:"כְּרוֹנוֹ הַזְּמַן",
           order:["iv","iw","iq","ir"]},
  lashon: {name:"לשון", icon:"✍️", desc:"דקדוק, חלקי הדיבר וזמנים",
           grad:"linear-gradient(150deg,#67e8f9,#0891b2)", shadow:"#0e7490",
           mascot:"🦜", mascotName:"טוּקִי הַמְדַבֵּר",
           order:["lp","lf","ln"]},
};
// friendly per-subject progress for the picker cards — the most recent grade
// for that subject (0 if the child hasn't played it yet).
function subjProgress(k){
  const hist=(S.history||[]).filter(r=>(r.subject||"english")===k);
  const pct=hist.length?Math.max(0,Math.min(100,hist[0].g|0)):0;
  return {pct, label:hist.length?`${pct}% בסבב האחרון`:"בואו נתחיל!"};
}
// render the design's rich gradient subject card
function subjectCard(k,s,selected){
  const p=subjProgress(k);
  return `<button type="button" class="subj-card${selected?" subj-on":""}" data-subj="${k}"
    style="background:${s.grad};box-shadow:0 9px 0 ${s.shadow},0 16px 28px rgba(60,40,120,.18)">
    <span class="subj-blob"></span>
    <span class="subj-ic">${s.icon}</span>
    <span class="subj-body">
      <b class="subj-title">${esc(s.name)}</b>
      <span class="subj-desc">${esc(s.desc||"")}</span>
      <span class="subj-prog"><i style="width:${p.pct}%"></i></span>
      <span class="subj-plabel">${esc(p.label)}</span>
    </span>
  </button>`;
}
// "הצוות שלנו" — meet-the-mascots cards; tap to hear each character speak
function teamHTML(){
  return `<div class="team-sec">
    <div class="team-title">הצוות שלנו — לחצו כדי להכיר</div>
    <div class="team-grid" id="team-grid">
      ${TEAM_ORDER.map(k=>{const p=VOICE_PROFILES[k];
        return `<button type="button" class="team-card" data-voice="${k}" style="background:${p.grad};box-shadow:0 8px 0 ${p.shadow}">
          <span class="team-emoji">${p.emoji}</span>
          <b class="team-name">${esc(p.name)}</b>
          <span class="team-role">${esc(p.role)} <span class="team-listen">🔊 להאזנה</span></span>
        </button>`;}).join("")}
    </div>
  </div>`;
}
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
// Israeli schooling: כיתה א׳ starts at age 6, so grade ≈ age − 5.
const levelForAge = age => Math.max(1,Math.min(MAX_LVL,(+age||6)-5));
// adaptive difficulty: starts at the student's grade, nudges ±1 by part accuracy
function curLevel(){ return Math.max(1,Math.min(MAX_LVL, S.adaptLvl||levelForAge(S.age))); }
// Some generators were tuned against the old five-band scale. Map a school
// grade back onto those five difficulty tiers so their calibration still holds:
// tier1 = א׳–ב׳, tier2 = ג׳–ד׳, tier3 = ה׳–ו׳, tier4 = חטיבה, tier5 = תיכון.
const gradeTier = g => g<=2?1 : g<=4?2 : g<=6?3 : g<=9?4 : 5;
const nearLevel = (items,lvl,min=6) => {
  let out=items.filter(i=>i.lvl===lvl),span=1;
  while(out.length<min&&span<MAX_LVL){out=items.filter(i=>Math.abs(i.lvl-lvl)<=span);span++;}
  return out.length?out:items;
};
// ─── Freshness: don't hand the same student the same items twice in a row ────
// Per-student, per-kind memory of what was already served; selection prefers
// unseen items and only recycles once the pool is exhausted.
const _idOf = x => (x&&x.id!=null)?x.id : (x&&x.w!=null)?x.w : (x&&x.title!=null)?x.title : String(x);
function seenGet(kind){ return (S.phone&&sGet(`seen:${S.phone}:${kind}`))||[]; }
function seenSet(kind,arr,cap){ if(S.phone)sSet(`seen:${S.phone}:${kind}`,arr.slice(-Math.max(cap||0,1))); }
// pick up to n items from pool, preferring ones not recently seen; records them
function pickFresh(pool,kind,n,idFn){
  idFn=idFn||_idOf;
  const seen=new Set(seenGet(kind));
  let fresh=pool.filter(x=>!seen.has(idFn(x)));
  if(fresh.length<n){ fresh=pool.slice(); seen.clear(); }   // pool exhausted → new cycle
  const chosen=shuffle(fresh).slice(0,Math.min(n,pool.length));
  chosen.forEach(x=>seen.add(idFn(x)));
  seenSet(kind,[...seen],pool.length);
  return chosen;
}
const pickFreshOne=(pool,kind,idFn)=>pickFresh(pool,kind,1,idFn)[0];
// Grade denominator = the number of questions ACTUALLY served in this test
// (summed per part as each part builds), so every test scales to 100 by its own
// size — a single part, or a part whose pool is smaller than its quota, can
// still reach 100. Falls back to the full-subject quota until a part registers.
function askedTotal(){ try{ const s=Object.values(S.partCounts||{}).reduce((a,b)=>a+(b||0),0); return s||subjTotal(); }catch(e){ return subjTotal(); } }
// record how many questions the current part serves (idempotent per screen, so
// resume re-registers the same value instead of double-counting)
function setPartCount(n){ try{ (S.partCounts=S.partCounts||{})[S.screen]=Math.max(0,n|0); }catch(e){} }
const grade  = c => Math.round((c/Math.max(1,askedTotal()))*100);
const fmtDate= t => new Date(t).toLocaleDateString("he-IL",{day:"2-digit",month:"2-digit",year:"2-digit"});

// ─── Settings (parents area toggles — actually control the app) ──────────────
function setLoad(){ return sGet("settings")||{}; }
function setGet(k,def){ const v=setLoad()[k]; return v===undefined?def:v; }
function setPut(k,v){ const o=setLoad(); o[k]=v; sSet("settings",o); }

// ─── Text-to-speech using the device's own installed voice engines ──────────
let _voices=[];
function _loadVoices(){ try{ _voices=window.speechSynthesis.getVoices()||[]; }catch(e){ _voices=[]; } }
if("speechSynthesis"in window){ _loadVoices(); try{ window.speechSynthesis.onvoiceschanged=_loadVoices; }catch(e){} }
// pick the best installed voice for a language (e.g. Carmit on iOS, Google
// עברית on Android for "he"). Prefer local (on-device) voices.
function pickVoice(lang){
  if(!_voices.length)_loadVoices();
  const pre=lang.slice(0,2).toLowerCase();
  const cand=_voices.filter(v=>(v.lang||"").toLowerCase().replace("_","-").startsWith(pre));
  if(!cand.length)return null;
  return cand.find(v=>v.localService&&(v.lang||"").toLowerCase().startsWith(lang.toLowerCase()))
      || cand.find(v=>(v.lang||"").toLowerCase().startsWith(lang.toLowerCase()))
      || cand.find(v=>v.localService) || cand[0];
}
function _say(text,lang,rate,pitch){
  if(!setGet("tts",true))return;
  const ss=("speechSynthesis"in window)?window.speechSynthesis:null; if(!ss)return;
  const doSpeak=()=>{ try{
    ss.cancel();                                   // clear anything stuck
    const u=new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=rate; if(pitch!=null)u.pitch=pitch;
    const v=pickVoice(lang); if(v)u.voice=v;
    try{ ss.resume(); }catch(e){}                  // some Android builds pause the queue
    ss.speak(u);
  }catch(e){} };
  // On many phones getVoices() is empty until voices load asynchronously — if so,
  // reload and retry once on the next tick so the utterance isn't dropped.
  if(!_voices.length){ _loadVoices(); if(!_voices.length){ setTimeout(()=>{ _loadVoices(); doSpeak(); }, 200); return; } }
  doSpeak();
}
// Prime speech synthesis inside the first user gesture — iOS/Safari refuse to
// speak until this happens (this is why background music worked but TTS didn't).
let _ttsPrimed=false;
function primeTTS(){
  if(_ttsPrimed) return; _ttsPrimed=true;
  try{ const ss=window.speechSynthesis; if(!ss)return;
    _loadVoices();
    const u=new SpeechSynthesisUtterance(" "); u.volume=0.01; ss.speak(u); ss.cancel();
  }catch(e){}
}
const speak = text => _say(text,"en-US",0.85);

// ─── Sound effects ────────────────────────────────────────
// Real recorded clips (Kenney, CC0 — see static/sounds/LICENSE.txt) with a
// synthesized fallback for older browsers or if a file is missing. WAV format
// plays everywhere, including iOS Safari.
const SND_BASE = "/static/sounds/";
const SND_FILES = {
  correct:"sfx-correct", wrong:"sfx-wrong", tap:"sfx-tap", celebrate:"celebrate",
  jingle_english:"jingle-english", jingle_hebrew:"jingle-hebrew",
  jingle_math:"jingle-math", jingle_science:"jingle-science",
};
// Clips that ship as MP3 (a fraction of the WAV size). Everything else stays
// WAV; a missing MP3 falls back to the WAV of the same name.
const SND_MP3 = new Set(["correct","wrong","celebrate"]);
const SFX = {
  _ctx:null,
  _ac(){ try{ if(!this._ctx) this._ctx=new (window.AudioContext||window.webkitAudioContext)();
    if(this._ctx.state==="suspended") this._ctx.resume(); return this._ctx; }catch(e){ return null; } },
  // play a bundled recorded clip; returns true if playback was started
  _clip(key,vol){
    if(!setGet("sfx",true))return false;
    const f=SND_FILES[key]; if(!f||typeof Audio==="undefined")return false;
    try{
      const mp3=SND_MP3.has(key);
      const a=new Audio(SND_BASE+f+(mp3?".mp3":".wav"));
      a.volume=(vol==null?0.6:vol);
      // if the MP3 cannot be decoded on this device, fall back to the WAV
      if(mp3)a.addEventListener("error",()=>{ try{
        const w=new Audio(SND_BASE+f+".wav"); w.volume=a.volume;
        const q=w.play(); if(q&&q.catch)q.catch(()=>{});
      }catch(e){} },{once:true});
      const p=a.play(); if(p&&p.catch)p.catch(()=>{});
      return true;
    }catch(e){ return false; }
  },
  _tone(ctx,freq,t0,dur,type="sine",gain=0.22){
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t0);
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(gain,t0+0.015);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g);g.connect(ctx.destination);o.start(t0);o.stop(t0+dur+0.02);
  },
  // תשואות! — פנפרה עולה + מחיאות כפיים (רעש-לבן פועם) + "יש!" נצנוץ
  good(){
    try{mascotReact("happy");burst();}catch(e){}
    if(!setGet("sfx",true))return;
    if(this._clip("correct",0.62))return;            // real recorded "correct" chime
    const ctx=this._ac();if(!ctx)return;const t=ctx.currentTime;
    // fanfare — cheerful rising major arpeggio, twice
    [523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>this._tone(ctx,f,t+i*0.075,0.26,"triangle",0.20));
    this._tone(ctx,2093,t+0.40,0.32,"sine",0.12);        // sparkle
    // applause — several soft noise bursts (clap-like), stereo-ish via timing
    try{
      const claps=7;
      for(let k=0;k<claps;k++){
        const st=t+0.10+k*0.055+Math.random()*0.02;
        const n=ctx.createBufferSource(),b=ctx.createBuffer(1,ctx.sampleRate*0.08,ctx.sampleRate);
        const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);
        const g=ctx.createGain();g.gain.setValueAtTime(0.11,st);g.gain.exponentialRampToValueAtTime(0.0001,st+0.09);
        const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=1800+Math.random()*900;bp.Q.value=0.8;
        n.buffer=b;n.connect(bp);bp.connect(g);g.connect(ctx.destination);n.start(st);
      }
    }catch(e){}
  },
  // אכזבה — "wah-wah" יורד (glissando) עם רטט קל
  bad(){
    try{mascotReact("sad");}catch(e){}
    if(!setGet("sfx",true))return;
    if(this._clip("wrong",0.42))return;              // real recorded "soft error"
    const ctx=this._ac();if(!ctx)return;const t=ctx.currentTime;
    try{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sawtooth";
      o.frequency.setValueAtTime(392,t);                 // G4
      o.frequency.exponentialRampToValueAtTime(196,t+0.22); // slide down to G3
      o.frequency.exponentialRampToValueAtTime(146.83,t+0.5); // to D3
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(0.2,t+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
      const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=1200;
      o.connect(lp);lp.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.62);
    }catch(e){ this._tone(ctx,311,t,0.2,"sawtooth",0.18); this._tone(ctx,208,t+0.18,0.3,"sawtooth",0.18); }
  },
  // gliding tone (for animal calls / bends)
  _slide(ctx,f0,f1,t0,dur,type="sine",gain=0.2){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;
    o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t0+dur);
    g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(gain,t0+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g);g.connect(ctx.destination);o.start(t0);o.stop(t0+dur+0.02);return o;
  },
  // short filtered-noise burst (for barks / roars / claps)
  _noise(ctx,t0,dur,gain=0.2,type="bandpass",freq=1500,q=1){
    try{const n=ctx.createBufferSource(),b=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*dur)),ctx.sampleRate);
      const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
      const g=ctx.createGain();g.gain.setValueAtTime(gain,t0);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
      const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
      n.buffer=b;n.connect(f);f.connect(g);g.connect(ctx.destination);n.start(t0);}catch(e){}
  },
  // tone with a vibrato wobble (for baa / buzz)
  _wobble(ctx,freq,rate,depth,t0,dur,type="sawtooth",gain=0.15){
    try{const o=ctx.createOscillator(),g=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();
      o.type=type;o.frequency.value=freq;lfo.frequency.value=rate;lg.gain.value=depth;
      lfo.connect(lg);lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(gain,t0+0.03);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
      o.connect(g);g.connect(ctx.destination);o.start(t0);o.stop(t0+dur+0.02);lfo.start(t0);lfo.stop(t0+dur+0.02);}catch(e){}
  },
  // ─── Animal calls (fully synthesized) ──────────────────────────────────────
  animal(kind){
    if(!setGet("sfx",true))return;
    const ctx=this._ac();if(!ctx)return;const t=ctx.currentTime,X=this;
    const A={
      dog(){ X._noise(ctx,t,0.12,0.22,"bandpass",760,1);X._slide(ctx,430,240,t,0.12,"sawtooth",0.16);
             X._noise(ctx,t+0.24,0.12,0.20,"bandpass",760,1);X._slide(ctx,430,240,t+0.24,0.12,"sawtooth",0.14); },
      cat(){ X._slide(ctx,680,900,t,0.16,"sawtooth",0.14);X._slide(ctx,900,520,t+0.16,0.3,"sawtooth",0.14); },
      cow(){ X._slide(ctx,250,175,t,0.75,"sawtooth",0.2); },
      bird(){ for(let k=0;k<5;k++)X._slide(ctx,2300+Math.random()*500,3100,t+k*0.08,0.05,"sine",0.10); },
      lion(){ X._noise(ctx,t,0.6,0.18,"lowpass",320,0.6);X._slide(ctx,150,88,t,0.6,"sawtooth",0.22); },
      elephant(){ X._slide(ctx,300,760,t,0.22,"sawtooth",0.18);X._slide(ctx,760,240,t+0.22,0.4,"sawtooth",0.18); },
      frog(){ for(let k=0;k<3;k++)X._slide(ctx,230,150,t+k*0.17,0.12,"square",0.16); },
      owl(){ X._slide(ctx,520,430,t,0.28,"sine",0.16);X._slide(ctx,520,430,t+0.42,0.32,"sine",0.15); },
      gecko(){ for(let k=0;k<4;k++)X._tone(ctx,1650-k*90,t+k*0.09,0.05,"square",0.11); },
      bee(){ X._wobble(ctx,175,32,45,t,0.7,"sawtooth",0.13); },
      duck(){ for(let k=0;k<3;k++)X._slide(ctx,520,380,t+k*0.14,0.1,"square",0.14); },
      sheep(){ X._wobble(ctx,380,14,26,t,0.6,"sawtooth",0.15); },
      horse(){ for(let k=0;k<6;k++)X._slide(ctx,920-k*45,720-k*45,t+k*0.05,0.05,"sawtooth",0.12);X._slide(ctx,520,200,t+0.34,0.3,"sawtooth",0.14); },
      fish(){ for(let k=0;k<3;k++)X._tone(ctx,600+k*130,t+k*0.06,0.05,"sine",0.08); },
    };
    (A[kind]||A.gecko)();
  },
  // ─── Per-subject jingle (plays when a subject is chosen) ────────────────────
  jingle(subject){
    if(!setGet("sfx",true))return;
    // real recorded pizzicato jingle per subject, then the mascot's animal call
    if(this._clip("jingle_"+subject,0.5)){
      const anim=MASCOT_ANIMAL[subject];
      if(anim)setTimeout(()=>{try{this.animal(anim);}catch(e){}},760);
      return;
    }
    const ctx=this._ac();if(!ctx)return;const t=ctx.currentTime,X=this;
    const M={
      english:[[523,0],[659,0.12],[784,0.24],[1047,0.36]],           // bright major climb
      hebrew: [[440,0],[554,0.14],[659,0.28],[554,0.44]],            // gentle wave
      math:   [[392,0],[523,0.1],[659,0.2],[784,0.3],[1047,0.42]],   // orderly ascent
      science:[[659,0],[988,0.1],[784,0.22],[1319,0.34],[1047,0.48]],// sparkly / curious
    };
    const notes=M[subject]||M.english;
    notes.forEach(([f,dt])=>X._tone(ctx,f,t+dt,0.28,"triangle",0.18));
    X._tone(ctx,notes[notes.length-1][0]*2,t+0.56,0.4,"sine",0.09);  // final shimmer
    const anim=MASCOT_ANIMAL[subject];                               // mascot "greets" after the tune
    if(anim)setTimeout(()=>{try{X.animal(anim);}catch(e){}},640);
  },
};
// which animal call belongs to each subject's mascot (math's mascot is human)
const MASCOT_ANIMAL={english:"frog",hebrew:"owl",science:"gecko",lashon:"bird",geo:"bird"};
// map a picture emoji to an animal call, so tapping/answering an animal roars/barks
const ANIMAL_FOR_EMOJI={"🐶":"dog","🐕":"dog","🦮":"dog","🐩":"dog","🐱":"cat","🐈":"cat","🐮":"cow","🐄":"cow","🐂":"cow",
  "🐦":"bird","🐤":"bird","🐥":"bird","🐣":"bird","🦜":"bird","🦁":"lion","🐘":"elephant","🐸":"frog","🦉":"owl","🦎":"gecko",
  "🦖":"lion","🐊":"lion","🐝":"bee","🦆":"duck","🐑":"sheep","🐏":"sheep","🐐":"sheep","🐴":"horse","🐎":"horse","🦄":"horse",
  "🐟":"fish","🐠":"fish","🐡":"fish","🐬":"fish","🐳":"cow","🐋":"cow"};
function animalForEmoji(e){ return e?ANIMAL_FOR_EMOJI[[...String(e)][0]]:null; }

// ─── Background music beds (soft, looping, low volume, varied) ──────────────
// Calm synthesized chord loops that play under the app. Each subject has its
// own distinct melody, and the home/menu has a brighter welcoming one, so the
// music feels varied. Kept quiet (low master gain) so the recorded correct/
// wrong sounds always cut through. Volume setting "musicVol": off/low/med.
// master bed volume from the setting (migrates the old boolean "music")
function musicGain(){
  let v=setGet("musicVol",null);
  if(v==null) v = (setGet("music",true)===false) ? "off" : "med";
  return v==="off" ? 0 : v==="low" ? 0.055 : 0.11;
}
const BGM = {
  _gain:null, _timer:null, _on:false, _step:0, _cycle:0, _track:null,
  _arpVars:["up","updown","down"],
  // chord palette (root-position triads, soft mid register)
  _ch:{
    C:[261.63,329.63,392.00], Am:[220.00,261.63,329.63], F:[174.61,220.00,261.63], G:[196.00,246.94,293.66],
    Dm:[146.83,174.61,220.00], Em:[164.81,196.00,246.94], Bb:[233.08,293.66,349.23], D:[146.83,185.00,220.00],
  },
  // one distinct melody per context — different chords, tempo and arpeggio feel
  _tracks:{
    menu:   {prog:["F","C","G","Am"], bar:2.0, wave:"triangle", arp:"updown"}, // bright, welcoming
    english:{prog:["C","Am","F","G"], bar:2.4, wave:"sine",     arp:"up"},     // easy pop feel
    hebrew: {prog:["Dm","Bb","F","C"],bar:2.7, wave:"sine",     arp:"down"},   // warm, reflective
    math:   {prog:["G","Em","C","D"], bar:2.1, wave:"triangle", arp:"up"},     // orderly, moving
    science:{prog:["Am","F","C","G"], bar:2.4, wave:"sine",     arp:"updown"}, // curious
    torah:  {prog:["C","G","Am","F"], bar:2.8, wave:"sine",     arp:"down"},   // calm, reverent
    lashon: {prog:["F","G","Em","Am"],bar:2.2, wave:"triangle", arp:"updown"}, // lively, chatty
  },
  start(name){
    name = this._tracks[name] ? name : "english";
    const lvl=musicGain();
    if(lvl<=0){ this.stop(); return; }
    const ctx=SFX._ac(); if(!ctx) return;
    if(this._on){
      if(this._track===name){ this.setLevel(); return; }  // same melody → match volume
      this._fadeOut(ctx);                                  // switching → crossfade out
    }
    this._on=true; this._track=name; this._step=0; this._cycle=0;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,ctx.currentTime);
    g.gain.linearRampToValueAtTime(lvl, ctx.currentTime+1.2);
    g.connect(ctx.destination); this._gain=g;
    const tr=this._tracks[name];
    const tick=()=>{
      if(!this._on) return;
      const idx=this._step % tr.prog.length;
      if(idx===0 && this._step>0) this._cycle++;          // count full loops → vary
      this._playBar(ctx, this._ch[tr.prog[idx]], tr);
      this._step++;
    };
    tick(); this._timer=setInterval(tick, tr.bar*1000);
  },
  // live-adjust bed volume (or stop) when the setting changes
  setLevel(){
    const ctx=SFX._ctx, lvl=musicGain();
    if(lvl<=0){ this.stop(); return; }
    if(ctx && this._gain){ try{
      this._gain.gain.cancelScheduledValues(ctx.currentTime);
      this._gain.gain.setValueAtTime(this._gain.gain.value, ctx.currentTime);
      this._gain.gain.linearRampToValueAtTime(lvl, ctx.currentTime+0.3);
    }catch(e){} }
  },
  _arpNotes(c,arp){
    const oct=c[0]*2;
    if(arp==="down")  return [oct,c[2],c[1],c[0]];
    if(arp==="updown")return [c[0],c[1],c[2],c[1]];
    return [c[0],c[1],c[2],oct];   // "up"
  },
  _playBar(ctx, chord, tr){
    if(!this._gain) return;
    const t=ctx.currentTime, dur=tr.bar;
    // rotate the arpeggio each full loop so the melody keeps evolving
    const _b=this._arpVars.indexOf(tr.arp), arp=this._arpVars[((_b<0?0:_b)+this._cycle)%3];
    chord.forEach(f=>{                                   // soft pad — slow swell
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type=tr.wave; o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(0.42, t+0.7);
      g.gain.linearRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(this._gain); o.start(t); o.stop(t+dur+0.1);
    });
    this._arpNotes(chord,arp).forEach((f,i)=>{           // gentle arpeggio on top
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type="triangle"; o.frequency.value=f*2;
      const st=t+i*(dur/4);
      g.gain.setValueAtTime(0.0001,st);
      g.gain.linearRampToValueAtTime(0.16, st+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, st+0.55);
      o.connect(g); g.connect(this._gain); o.start(st); o.stop(st+0.6);
    });
    if(this._cycle % 2 === 1){                           // alternate loops: soft high sparkle
      const o=ctx.createOscillator(), g=ctx.createGain(), st=t+dur*0.5;
      o.type="triangle"; o.frequency.value=chord[2]*4;
      g.gain.setValueAtTime(0.0001,st);
      g.gain.linearRampToValueAtTime(0.08, st+0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, st+0.7);
      o.connect(g); g.connect(this._gain); o.start(st); o.stop(st+0.75);
    }
  },
  _fadeOut(ctx){
    if(this._timer){ clearInterval(this._timer); this._timer=null; }
    const g=this._gain;
    if(g){ try{ g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime+0.5); }catch(e){}
      setTimeout(()=>{ try{g.disconnect();}catch(e){} }, 600); }
    this._gain=null;
  },
  stop(){
    if(!this._on && !this._gain) return;
    this._on=false; this._track=null;
    const ctx=SFX._ctx; if(ctx) this._fadeOut(ctx);
    else { if(this._timer){clearInterval(this._timer);this._timer=null;} this._gain=null; }
  },
  // pick the right melody for the current screen (called from render())
  sync(screen){
    if(musicGain()<=0){ this.stop(); return; }
    if(screen==="menu") return this.start("menu");
    if(curOrder().includes(screen) || screen==="gplay") return this.start(S.subject);
    this.stop();
  },
};

// שחרור AudioContext + מנוע הדיבור במגע ראשון (מדיניות דפדפנים)
window.addEventListener("pointerdown",()=>{ SFX._ac(); primeTTS(); },{once:true});
// don't leave music playing when the app is backgrounded; resume on return
if(typeof document!=="undefined") document.addEventListener("visibilitychange",()=>{
  if(document.hidden) BGM.stop();
  else if(musicGain()>0) BGM.sync(S.screen);
});

// ─── Mascot + micro-celebrations (visual life) ───────────────────────────────
function ensureMascot(){
  if(!document.getElementById("mascot")){
    const m=document.createElement("div");m.id="mascot";m.className="mascot";m.style.display="none";
    document.body.appendChild(m);
  }
  if(!document.getElementById("burst")){
    const b=document.createElement("div");b.id="burst";b.className="burst";document.body.appendChild(b);
  }
  if(!window._kbBound){
    window._kbBound=true;
    document.addEventListener("keydown",e=>{
      if(!OPTION_SCREENS.has(S.screen)&&S.screen!=="gplay")return;
      const n=({"1":1,"2":2,"3":3,"4":4})[e.key];if(!n)return;
      const opts=[...document.querySelectorAll("#q-opts .opt")].filter(b=>!b.disabled);
      if(opts[n-1]){e.preventDefault();opts[n-1].click();}
    });
  }
}
function showMascot(on){const m=document.getElementById("mascot");if(m){m.style.display=on?"flex":"none";m.textContent=S.avatar;}}
function mascotReact(mood){
  // prefer the in-card gameplay mascot; fall back to the floating corner one
  const gf=document.getElementById("gm-face");
  const m=(gf&&gf.offsetParent!==null)?gf:document.getElementById("mascot");
  if(!m||m.style.display==="none")return;
  if(m.id==="mascot")m.textContent=S.avatar;
  m.classList.remove("m-happy","m-sad");void m.offsetWidth;
  m.classList.add(mood==="happy"?"m-happy":"m-sad");
  const bub=document.getElementById("gm-bubble");
  if(bub)bub.textContent=(mood==="happy")?"יש! כל הכבוד 🎉":"כמעט! זה בסדר, ממשיכים 💪";
}
function burst(){
  const layer=document.getElementById("burst");if(!layer)return;
  const emo=["⭐","✨","🌟","💫","🎉","🌈"];
  for(let i=0;i<9;i++){
    const s=document.createElement("i");s.textContent=emo[i%emo.length];
    s.style.left=(46+Math.random()*8)+"%";s.style.top=(42+Math.random()*8)+"%";
    s.style.setProperty("--dx",(Math.random()*180-90)+"px");
    s.style.setProperty("--dy",(-70-Math.random()*110)+"px");
    s.style.animationDelay=(Math.random()*0.08)+"s";
    layer.appendChild(s);setTimeout(()=>s.remove(),950);
  }
}
const speakHe = text => {
  let rate=0.9,pitch=null;
  if(setGet("charVoices",true)){const pr=VOICE_PROFILES[S.subject];if(pr&&pr.lang==="he-IL"){pitch=pr.pitch;rate=pr.rate;}}
  _say(text,"he-IL",rate,pitch);
};

// ─── Character voices — synthesized voice profiles per mascot (device-safe) ───
// Works everywhere via SpeechSynthesis pitch/rate; no OS voice install needed.
const VOICE_PROFILES={
  dana:   {name:"הַמּוֹרָה דָּנָה",   role:"מקבלת אותך ומנחה",   emoji:"👩‍🏫", tone:"נשי", lang:"he-IL", pitch:1.25, rate:0.98,
           grad:"linear-gradient(150deg,#fde68a,#f59e0b)", shadow:"#b45309",
           hello:"שלום! אני המורה דנה, ואני כאן ללוות אותך. בואו נתחיל 😊"},
  math:   {name:"פְּרוֹפֶסוֹר חֶשְׁבּוֹן", role:"מלווה אותך בחשבון", emoji:"👨‍🏫", tone:"גברי", lang:"he-IL", pitch:0.8, rate:0.92,
           grad:"linear-gradient(150deg,#fda4af,#e11d48)", shadow:"#be123c",
           hello:"שלום, אני פרופסור חשבון. מספרים זה כיף — בואו נראה!"},
  english:{name:"פְרוֹגִי הַצְּפַרְדֵּעַ", role:"מלווה אותך באנגלית", emoji:"🐸", tone:"גבוה ומצחיק", lang:"en-US", pitch:1.6, rate:1.05,
           grad:"linear-gradient(150deg,#7dd3fc,#0284c7)", shadow:"#0369a1",
           hello:"Hi! I'm Froggy. Let's learn English together, ribbit!"},
  hebrew: {name:"אוּפִּי הַיַּנְשׁוּף",  role:"מלווה אותך בעברית", emoji:"🦉", tone:"עמוק ואיטי", lang:"he-IL", pitch:0.7, rate:0.85,
           grad:"linear-gradient(150deg,#a78bfa,#7c3aed)", shadow:"#6d28d9",
           hello:"שָׁלוֹם, אֲנִי אוּפִּי הַיַּנְשׁוּף. בּוֹאוּ נִלְמַד עִבְרִית יַחַד."},
  science:{name:"נִיבִּי הַחוֹקֶרֶת",   role:"מלווה אותך בטבע ומדע", emoji:"🦎", tone:"סקרני ונמרץ", lang:"he-IL", pitch:1.1, rate:0.95,
           grad:"linear-gradient(150deg,#6ee7b7,#059669)", shadow:"#047857",
           hello:"שָׁלוֹם, אֲנִי נִיבִּי הַחוֹקֶרֶת. בּוֹאוּ נְגַלֶּה אֶת סוֹדוֹת הַטֶּבַע!"},
  torah:  {name:"יוֹנָה הַחֲכָמָה",     role:"מלווה אותך בתורה", emoji:"🕊️", tone:"רך ונעים", lang:"he-IL", pitch:1.15, rate:0.9,
           grad:"linear-gradient(150deg,#fcd34d,#b45309)", shadow:"#92400e",
           hello:"שָׁלוֹם, אֲנִי יוֹנָה הַחֲכָמָה. בּוֹאוּ נִלְמַד סִפּוּרֵי תּוֹרָה יַחַד."},
  lashon: {name:"טוּקִי הַמְדַבֵּר",     role:"מלווה אותך בלשון", emoji:"🦜", tone:"פטפטן וזריז", lang:"he-IL", pitch:1.35, rate:1.0,
           grad:"linear-gradient(150deg,#67e8f9,#0891b2)", shadow:"#0e7490",
           hello:"שָׁלוֹם, אֲנִי טוּקִי הַמְדַבֵּר. בּוֹאוּ נְשַׂחֵק עִם הַמִּלִּים!"},
};
const TEAM_ORDER=["dana","math","hebrew","english","science","torah","lashon"];
function speakSample(key){
  const p=VOICE_PROFILES[key];if(!p)return;
  try{if(!("speechSynthesis"in window))return;window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(p.hello);u.lang=p.lang;u.pitch=p.pitch;u.rate=p.rate;
    window.speechSynthesis.speak(u);}catch(e){}
}
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// ─── Storage ──────────────────────────────────────────────
const sGet = k=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}};
const sSet = (k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const sDel = k=>{try{localStorage.removeItem(k);}catch(e){}};

// ─── Global State ─────────────────────────────────────────
const S = {screen:"login",name:"",phone:"",age:9,score:0,seen:[],history:[],found:null,busy:false,prog:{},subject:"english",parentCode:"",lastGain:null,avatar:"🦊",answerLog:[],partCounts:{}};
const AVATARS=["🦊","🐼","🦁","🐧","🐨","🦄","🐯","🐸","🐵","🐶","🐱","🐰","🐷","🐥","🐢","🦉"];

// ─── Realistic pictures (kid-safe, optional) ─────────────────────────────────
// If a Pixabay key is provided (window.PIC_KEY), concrete words show a real,
// safe-search photo; otherwise (and on any failure) the emoji is shown. This
// gives a natural mix: photos where available, emoji everywhere else.
const PIC_API=(typeof window!=="undefined"&&window.PIC_KEY)?String(window.PIC_KEY):"";
const _picCache={};
function _picFetch(word){
  if(!PIC_API)return Promise.resolve(null);
  if(word in _picCache)return Promise.resolve(_picCache[word]);
  const q=encodeURIComponent(word.replace(/^(a|an|the) /,""));
  return fetch(`https://pixabay.com/api/?key=${PIC_API}&q=${q}&image_type=photo&safesearch=true&per_page=3`)
    .then(r=>r.json()).then(j=>{
      const hit=j&&j.hits&&j.hits[0]&&(j.hits[0].webformatURL||j.hits[0].previewURL);
      _picCache[word]=hit||null;return _picCache[word];
    }).catch(()=>null);
}
function showPic(id,item){
  const c=document.getElementById(id);if(!c)return;
  c.innerHTML=`<span class="pic-emoji">${item.e||"❓"}</span>`;   // emoji first (instant)
  if(!PIC_API||!item.w)return;
  _picFetch(item.w).then(url=>{
    if(!url)return;
    const cur=document.getElementById(id);if(!cur)return;
    const img=new Image();img.className="pic-img";img.alt="";
    img.onload=()=>{const c2=document.getElementById(id);if(c2){c2.innerHTML="";c2.appendChild(img);}};
    img.src=url;   // if it errors, the emoji simply stays
  });
}
// Short kid-safe video clips (same Pixabay key). Used sparingly — muted,
// looping, autoplaying — so they add life without stealing attention or
// eating bandwidth during timed drills.
const _vidCache={};
function _vidFetch(query){
  if(!PIC_API)return Promise.resolve(null);
  if(query in _vidCache)return Promise.resolve(_vidCache[query]);
  const q=encodeURIComponent(query);
  return fetch(`https://pixabay.com/api/videos/?key=${PIC_API}&q=${q}&safesearch=true&per_page=8`)
    .then(r=>r.json()).then(j=>{
      const hits=(j&&j.hits)||[];
      const pick=hits.length?hits[Math.floor(Math.random()*hits.length)]:null;
      const v=pick&&pick.videos&&(pick.videos.tiny||pick.videos.small||pick.videos.medium);
      _vidCache[query]=(v&&v.url)||null;return _vidCache[query];
    }).catch(()=>null);
}
// Drop a tiny looping clip into a container, fading in over whatever was there.
function showClip(id,query){
  if(!PIC_API)return;
  _vidFetch(query).then(url=>{
    if(!url)return;
    const c=document.getElementById(id);if(!c)return;
    const v=document.createElement("video");
    v.className="clip-vid";v.src=url;
    v.muted=true;v.loop=true;v.autoplay=true;v.playsInline=true;
    v.setAttribute("muted","");v.setAttribute("playsinline","");
    v.onerror=()=>{ if(v.parentNode)v.parentNode.removeChild(v); };   // broken clip → vanish
    c.innerHTML="";c.appendChild(v);
    const p=v.play&&v.play();if(p&&p.catch)p.catch(()=>{});
  });
}
// A rotating set of cheerful, unmistakably kid-safe celebration searches.
const CELEBRATE_Q=["confetti","fireworks","balloons","celebration","party","happy kids"];

// ─── Mistakes store (spaced-repetition review) ───────────────────────────────
function missKey(){return `miss:${S.phone}:${S.subject}`;}
function missLoad(){return sGet(missKey())||[];}
function missSave(a){if(S.phone)sSet(missKey(),a);}
function recordMiss(item){
  if(!S.phone||!item||!item.w)return;
  const a=missLoad();
  if(!a.some(x=>x.w===item.w)){a.unshift(item);missSave(a.slice(0,50));}
}
function clearMiss(w){missSave(missLoad().filter(x=>x.w!==w));}
const RV={};

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
  // coins are awarded live per correct answer (see awardCoin); here we only
  // add XP and report how many coins the round earned for the summary screen.
  const xpGain=correct*10+(grade>=90?50:grade>=70?20:0), coinGain=correct;
  g.xp=(g.xp||0)+xpGain; g.tests=(g.tests||0)+1;
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
// Nature & Science (טבע ומדעים) content — loaded from science_data.js if present.
const SCI_VOCAB   = (typeof window!=="undefined" && Array.isArray(window.SCI_VOCAB))   ? window.SCI_VOCAB   : [];
const SCI_QUIZ    = (typeof window!=="undefined" && Array.isArray(window.SCI_QUIZ))    ? window.SCI_QUIZ    : [];
const SCI_STORIES = (typeof window!=="undefined" && Array.isArray(window.SCI_STORIES)) ? window.SCI_STORIES : [];
// Hebrew synonyms & antonyms (נרדפות והפכים) — a staple Israeli exercise type
const HEB_LEX = (typeof window!=="undefined" && Array.isArray(window.HEB_LEX)) ? window.HEB_LEX : [];
// Torah / Tanakh (תורה) and Hebrew grammar (לשון) — grounded, from data files
const TORAH_VOCAB   = (typeof window!=="undefined" && Array.isArray(window.TORAH_VOCAB))   ? window.TORAH_VOCAB   : [];
const TORAH_QUIZ    = (typeof window!=="undefined" && Array.isArray(window.TORAH_QUIZ))    ? window.TORAH_QUIZ    : [];
const TORAH_STORIES = (typeof window!=="undefined" && Array.isArray(window.TORAH_STORIES)) ? window.TORAH_STORIES : [];
const LASHON_QUIZ   = (typeof window!=="undefined" && Array.isArray(window.LASHON_QUIZ))   ? window.LASHON_QUIZ   : [];
// Israeli Ministry of Education curriculum map (from curriculum.js)
const CURRICULUM = (typeof window!=="undefined" && window.CURRICULUM) ? window.CURRICULUM : null;
// the curriculum grade (1–6) that matches the student's current level
function curGrade(){ return Math.max(1,Math.min(6, S.subject==="english" ? Math.max(3,curLevel()) : curLevel())); }
// build the "aligned to the curriculum" card for the current subject
function curriculumCardHTML(){
  if(!CURRICULUM||!CURRICULUM[S.subject])return "";
  const c=CURRICULUM[S.subject], g=curGrade();
  const gradeName={1:"א׳",2:"ב׳",3:"ג׳",4:"ד׳",5:"ה׳",6:"ו׳"};
  // show the current grade plus its neighbours so families see the sequence
  const near=[g-1,g,g+1].filter(x=>c.grades[x]);
  const rows=near.map(x=>`<div class="cur-grade${x===g?" cur-now":""}">
    <b>כיתה ${gradeName[x]||x}</b>
    <ul>${c.grades[x].map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>`).join("");
  return `<div class="mini-card cur-card">
    <div class="mini-label">📚 מותאם לתכנית הלימודים · ${esc(c.name)}</div>
    <div class="cur-strands">${c.strands.map(s=>`<span class="cur-chip">${esc(s)}</span>`).join("")}</div>
    <div class="cur-grades">${rows}</div>
    <p class="par-note">התכנים באפליקציה מותאמים ל${esc(CURRICULUM.source)}. הנושאים מעל הם עמודי התווך של המקצוע בכיתות הרלוונטיות.</p>
  </div>`;
}
// Niqqud (vocalized) content for young readers (grades 1–3). Shown only when
// the current level is 1–2 so early readers get the vowel points.
const HEB_NQ = (typeof window!=="undefined" && window.HEB_NQ) ? window.HEB_NQ : {words:{},stories:{}};
// Science vocab carries its own inline niqqud (wn/dn); fold it into one lookup.
const SCI_NQ_WORDS = (()=>{const m={};for(const x of SCI_VOCAB) if(x.w&&x.wn) m[x.w]={wn:x.wn,dn:x.dn||x.d};return m;})();
const GEO_VOCAB   = (typeof window!=="undefined" && Array.isArray(window.GEO_VOCAB))   ? window.GEO_VOCAB   : [];
const GEO_QUIZ    = (typeof window!=="undefined" && Array.isArray(window.GEO_QUIZ))    ? window.GEO_QUIZ    : [];
const GEO_STORIES = (typeof window!=="undefined" && Array.isArray(window.GEO_STORIES)) ? window.GEO_STORIES : [];
const HIST_VOCAB   = (typeof window!=="undefined" && Array.isArray(window.HIST_VOCAB))   ? window.HIST_VOCAB   : [];
const HIST_QUIZ    = (typeof window!=="undefined" && Array.isArray(window.HIST_QUIZ))    ? window.HIST_QUIZ    : [];
const HIST_STORIES = (typeof window!=="undefined" && Array.isArray(window.HIST_STORIES)) ? window.HIST_STORIES : [];
const GEO_NQ_WORDS = (()=>{const m={};for(const x of GEO_VOCAB) if(x.w&&x.wn) m[x.w]={wn:x.wn,dn:x.dn||x.d};return m;})();
const TORAH_NQ_WORDS = (()=>{const m={};for(const x of TORAH_VOCAB) if(x.w&&x.wn) m[x.w]={wn:x.wn,dn:x.dn||x.d};return m;})();
// which vocab pool the current subject draws from
function subjVocab(){ return S.subject==="science" ? SCI_VOCAB : S.subject==="torah" ? TORAH_VOCAB : S.subject==="geo" ? GEO_VOCAB : S.subject==="history" ? HIST_VOCAB : HEB_VOCAB; }
// young reader (grades א–ד) in a niqqud-bearing subject → show vowel points
function youngHeb(){ return (S.subject==="hebrew"||S.subject==="science"||S.subject==="torah"||S.subject==="geo") && curLevel()<=4; }
// Scoped to the active subject: the same word lives in several vocabularies
// with different wordings, and a flat merged lookup served whichever table
// happened to come first — so a Hebrew lesson could show the science
// definition of שורש, and vice versa.
function nqLookup(w){
  const m = S.subject==="science" ? SCI_NQ_WORDS
          : S.subject==="torah"   ? TORAH_NQ_WORDS
          : S.subject==="geo"     ? GEO_NQ_WORDS
          : HEB_NQ.words;
  return m[w] || null;
}
// niqqud marks only — stripping them must give back the plain text
const bareHeb = s => String(s||"").replace(/[֑-ׇ]/g,"").replace(/\s+/g," ").trim();
function nqW(w){                                       // display word
  const e=youngHeb()&&nqLookup(w);
  return (e && bareHeb(e.wn)===bareHeb(w)) ? e.wn : w;
}
function nqD(w,d){                                     // display definition
  // Vocalise the definition that is actually being asked about — never
  // substitute a different one, or the child reads a wording the app isn't
  // grading. Any drift in the data degrades to plain text, not to a lie.
  const e=youngHeb()&&nqLookup(w);
  return (e && e.dn && bareHeb(e.dn)===bareHeb(d)) ? e.dn : d;
}
// Vocalised stories exist only for the Hebrew reading screen. Looking them up
// by bare id let another subject's story pick up a Hebrew one with the same id.
function nqStory(id){ return (youngHeb() && S.screen==="hr") ? HEB_NQ.stories[id] : null; }

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
    // The server withholds the parent code when the number is already
    // registered under a different name — a bare phone number must not be
    // enough to unlock somebody else's file. Tell the child what to do.
    else if(j&&j.exists){S.regNameMismatch=true;}
  });
}
function syncResult(rec){
  if(!BACKEND)return;
  beacon("/api/results",{phone:S.phone,subject:rec.subject,grade:rec.g,correct:rec.correct,total:rec.total,ts:rec.t,
    dur:rec.dur||0,detail:Array.isArray(rec.detail)?rec.detail:[]});
}
// Pull this student's saved results from the server (any device) and merge them
// into the local history, so a child sees their full progress after logging in
// on a new phone. Guarded server-side by phone+name. Best-effort.
function syncFetchResults(){
  if(!BACKEND||!S.phone||!S.name)return Promise.resolve(false);
  const q="?phone="+encodeURIComponent(S.phone)+"&name="+encodeURIComponent(S.name);
  return fetch(BACKEND+"/api/student/results"+q).then(r=>r.json()).then(j=>{
    if(!j||!j.ok||!Array.isArray(j.results))return false;
    const local=S.history||[];
    const seenTs=new Set(local.map(r=>r.t));
    let merged=[...local];
    for(const row of j.results){
      const t=Number(row.ts)||0; if(!t||seenTs.has(t))continue;
      seenTs.add(t);
      merged.push({t,name:j.name||S.name,subject:row.subject||"english",
        lvl:0,correct:row.correct|0,total:row.total|0,g:row.grade|0});
    }
    if(merged.length===local.length)return false;
    merged.sort((a,b)=>b.t-a.t); merged=merged.slice(0,30);
    S.history=merged; sSet(K.results(S.phone),merged);
    // if the student is looking at a screen that shows history, refresh it
    if(S.screen==="subject"||S.screen==="parents"||S.screen==="done")render();
    return true;
  }).catch(()=>false);
}

// ─── Daily time-on-task tracker ──────────────────────────
// Counts one second per wall-clock second the child spends on an ACTIVE study
// screen (menus / pauses / the done screen don't count). Totals are kept per
// calendar day in localStorage and pushed to the backend so a parent can see
// how long the child practised each day. `sess` is this test's running
// duration, read at finish() as the test's `dur`.
const TT_IDLE=new Set(["login","subject","menu","paused","done","parents"]);
function ttDay(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
const TT={
  sess:0, _n:0, _wasActive:false,
  key(){return "time:"+(S.phone||"anon");},
  load(){try{return JSON.parse(localStorage.getItem(this.key()))||{};}catch(e){return {};}},
  save(m){try{
    // keep at most the last ~45 days so this never grows without bound
    const keys=Object.keys(m).sort();
    while(keys.length>45){delete m[keys.shift()];}
    localStorage.setItem(this.key(),JSON.stringify(m));
  }catch(e){}},
  tick(){
    const active=S.phone&&!TT_IDLE.has(S.screen)&&document.visibilityState!=="hidden";
    if(active&&!this._wasActive)this.sess=this.sess;   // continue current test
    this._wasActive=active;
    if(!active)return;
    const m=this.load(),d=ttDay();m[d]=(m[d]||0)+1;this.save(m);
    this.sess++;
    if(++this._n>=25){this._n=0;this.sync();}          // push roughly every 25s
  },
  sync(){
    if(!BACKEND||!S.phone)return;
    beacon("/api/time",{phone:S.phone,days:this.load()});
  },
  start(){setInterval(()=>{try{this.tick();}catch(e){}},1000);}
};

// ─── Practice-reminder push on the CHILD's device ────────────
// The trainer registers the student's own device for reminder pushes. There is
// intentionally NO opt-out here — only the parent can silence it, from the
// parent portal (server-side notify_child flag). We subscribe silently when
// permission is already granted, and ask once on a genuine tap (starting a
// test) otherwise. Everything is best-effort and never blocks the app.
let _pushAsked=false;
function _b64ToU8(s){const pad="=".repeat((4-s.length%4)%4);const b=(s+pad).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(b);const u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return u;}
async function childPushEnsure(gesture){
  try{
    if(!BACKEND||!S.phone||!S.name)return;
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))return;
    let perm=Notification.permission;
    if(perm==="denied")return;
    if(perm!=="granted"){
      if(!gesture||_pushAsked)return;      // only prompt on a real gesture, once
      _pushAsked=true;
      perm=await Notification.requestPermission();
      if(perm!=="granted")return;
    }
    const vr=await (await fetch(BACKEND+"/api/push/vapid")).json();
    if(!vr||!vr.ok||!vr.publicKey)return;   // server has no push configured
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:_b64ToU8(vr.publicKey)});
    await fetch(BACKEND+"/api/student/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phone:S.phone,name:S.name,subscription:sub})});
  }catch(e){}
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
  const lvl=levelForAge(S.age),playing=curOrder().includes(S.screen);
  const gm=gamLoad();
  return `<header class="topbar">
  <div class="tb-id">
    <span class="tb-av">${S.avatar}</span>
    <div class="tb-who"><b>${esc(S.name||"אורח/ת")}</b><span>${LEVEL_NAME[lvl]}</span></div>
  </div>
  <div class="tb-right">
    <span class="chip chip-coin">🪙 <b id="coin-count">${gm.coins||0}</b></span>
    <span class="chip chip-streak">🔥 ${gm.streak||0}</span>
    ${playing?`<div class="score" id="score-el" aria-label="ניקוד">${grade(S.score)}<small>/100</small></div>`:""}
    ${playing?'<button class="iconbtn" id="btn-pause" title="השהה ושמור">⏸</button>':""}
    ${playing?'<button class="iconbtn" id="btn-skip" title="דלג לשלב הבא">⏭</button>':""}
    ${playing?'<button class="iconbtn" id="btn-home" title="לתפריט הראשי">⌂</button>':""}
    <button class="iconbtn" id="btn-install-top" title="התקנת האפליקציה">⬇️</button>
    ${(!playing&&S.screen!=="catalog")?'<button class="iconbtn" id="btn-catalog" title="ספריית המשחקים">🎲</button>':""}
    ${(!playing&&S.screen!=="parents")?'<button class="iconbtn" id="btn-parents" title="אזור הורים ומורים">👪</button>':""}
  </div>
</header>`;
}

// age/level bands shown as design pills; each maps to a representative age
// one pill per grade — the student picks their exact class
const AGE_BANDS=Object.keys(GRADE_LETTER).map(k=>({lvl:+k,label:GRADE_LETTER[k],age:(+k)+5}));
const PARADE=["🐶","🐰","🦊","🐼","🐸","🦉","🐨","🐧","🐢","🦁"];

function loginHTML(){
  const lvl=levelForAge(S.age);
  const greet=S.name.trim()?`שלום, ${esc(S.name.trim())}!`:"ברוכים הבאים!";
  return `<div class="home kl-rise">
  <div class="home-greet">
    <div class="home-buddy">${S.avatar}</div>
    <div class="home-hello">
      <h1 id="greet-h1">${greet}</h1>
      <p>מה לומדים היום?</p>
    </div>
  </div>

  <div class="top-ctas">
    <button class="install-cta" id="btn-install">📲 התקנת האפליקציה למכשיר</button>
    <button class="parent-help-cta" id="btn-parent-help">👪 להורים · איך עוקבים אחרי ההתקדמות?</button>
  </div>

  <div class="subj-cards login-subjects" id="login-subjects">
    ${Object.entries(SUBJECTS).map(([k,s])=>subjectCard(k,s,S.subject===k)).join("")}
  </div>

  ${teamHTML()}

  <div class="home-grid">
    <div class="mini-card">
      <div class="mini-label">גיל ורמת קושי</div>
      <div class="pill-row" id="login-bands">
        ${AGE_BANDS.map(b=>`<button type="button" class="pill band-pill${lvl===b.lvl?" pill-on":""}" data-age="${b.age}">${b.label}</button>`).join("")}
      </div>
    </div>
    <div class="mini-card">
      <div class="mini-label">הדמות שלי</div>
      <div class="pill-row avatars" id="login-avatars">
        ${AVATARS.map(a=>`<button type="button" class="av-btn${S.avatar===a?" av-on":""}" data-av="${a}">${a}</button>`).join("")}
      </div>
    </div>
  </div>

  <div class="mini-card home-form" id="home-form">
    <div class="mini-label">הרשמה — כדי להתחיל</div>
    <div class="form-err" id="form-err" style="display:none"></div>
    <label class="fld2">שם<input id="inp-name" placeholder="איך קוראים לך?" value="${esc(S.name)}"></label>
    <label class="fld2">מספר טלפון<input id="inp-phone" type="tel" inputmode="numeric" dir="ltr" placeholder="0500000000" value="${esc(S.phone)}"></label>
  </div>

  <div class="parade" aria-hidden="true"><div class="parade-track">${PARADE.concat(PARADE).map(a=>`<span>${a}</span>`).join("")}</div></div>

  <button id="btn-enter" class="primary" ${(!S.name.trim()||S.phone.length<9||S.busy)?"disabled":""}>
    ${S.busy?"רגע…":"יאללה, מתחילים"}
  </button>
</div>`;
}

function resumeHTML(){
  const f=S.found;
  // grade against the SAVED session's subject, not the currently-selected one,
  // so the percentage isn't normalised to the wrong denominator.
  const fOrder=(SUBJECTS[f.subject]||curSubject()).order;
  const fTotal=fOrder.reduce((a,p)=>a+(PART_QUOTA[p]||0),0)||1;
  const fGrade=Math.round(((f.score||0)/fTotal)*100);
  return `<section class="card hero">
  <span class="eyebrow">נמצא מבחן פתוח</span>
  <h1>להמשיך?</h1>
  <p class="sub">נעצר ב<b>${esc(PART_NAME[f.screen]||"אמצע")}</b> בתאריך ${fmtDate(f.t)}, עם ${fGrade} מתוך 100.</p>
  <button class="primary" id="btn-resume">המשך מהמקום שנעצרתי</button>
  <button class="ghost" id="btn-fresh">התחל מבחן חדש</button>
</section>`;
}

const PART_DESC = {p1:"מילים · 5 דק׳",p2:"השלמות · 10 דק׳",p3:"שאלות · 10 דק׳",p4:"תמונות · 10 דק׳",
                   p5:"התאמות · 3.5 דק׳",p6:"בלונים · 3 דק׳",
                   hv:"מילים · 4 דק׳",hb:"התאמות · 3.5 דק׳",hw:"פירושים · 4 דק׳",hs:"מילים · 4 דק׳",wg:"משחק · 3.5 דק׳",hr:"שאלות · 10 דק׳",
                   ma1:"תרגילים · 4 דק׳",ma2:"תרגילים · 5 דק׳",ma5:"שברים · 6 דק׳",ma6:"צורות · 6 דק׳",ma3:"בעיות · 6 דק׳",ma4:"תרגילים · 4 דק׳",
                   sv:"מילים · 4 דק׳",sw:"מושגים · 4 דק׳",sq:"חידון · 5 דק׳",sr:"שאלות · 10 דק׳",
                   gv:"מושגים · 4 דק׳",gw:"פירוש · 4 דק׳",gq:"חידון · 5 דק׳",gr:"שאלות · 10 דק׳",
                   iv:"מושגים · 4 דק׳",iw:"פירוש · 4 דק׳",iq:"חידון · 5 דק׳",ir:"שאלות · 10 דק׳",
                   tv:"מושגים · 4 דק׳",tw:"פירושים · 4 דק׳",tq:"חידון · 5 דק׳",tr:"שאלות · 10 דק׳",
                   lp:"שאלות · 4 דק׳",lf:"שאלות · 4 דק׳",ln:"שאלות · 4 דק׳"};

function subjectHTML(){
  const gm=gamLoad();
  const wk=Math.max(0,Math.min(5,gm.streak||0)), wkPct=(wk/5)*100;
  return `<div class="home kl-rise">
  <div class="home-greet">
    <div class="home-buddy">${S.avatar}</div>
    <div class="home-hello"><h1>שלום, ${esc(S.name||"")}!</h1><p>מה לומדים היום?</p></div>
  </div>

  <div class="subj-cards" id="hub-subjects">
    ${Object.entries(SUBJECTS).map(([k,s])=>subjectCard(k,s,false)).join("")}
  </div>

  ${teamHTML()}

  <div class="weekly-card">
    <span class="weekly-buddy">${curSubject().mascot||"🦉"}</span>
    <div class="weekly-label">היעד השבועי</div>
    <div class="weekly-big">${wk} מתוך 5 ימים</div>
    <div class="weekly-bar"><i style="width:${wkPct}%"></i></div>
  </div>

  <div class="parade" aria-hidden="true"><div class="parade-track">${PARADE.concat(PARADE).map(a=>`<span>${a}</span>`).join("")}</div></div>
  <button class="ghost sm" id="btn-logout-hub">החלפת משתמש/ת</button>
</div>`;
}

// ─── Curriculum view (what's taught, aligned to משרד החינוך) ─────────────────
function curriculumHTML(){
  const subj=curSubject();
  return `<div class="parents-page kl-rise">
  <button class="link-back" id="btn-cur-back">↩ חזרה לתפריט</button>
  <h2 class="par-title">תכנית הלימודים · ${esc(subj.name)}</h2>
  <p class="par-sub">התכנים באפליקציה מותאמים לתכנית של משרד החינוך</p>
  ${curriculumCardHTML()}
  <p class="par-note" style="text-align:center">מקור: ${esc((CURRICULUM&&CURRICULUM.source)||"משרד החינוך")}</p>
</div>`;
}

// ─── Parents & Teachers area (in-app: local progress + working settings) ─────
function parentsHTML(){
  const name=esc(S.name||"התלמיד/ה");
  const subjRows=Object.entries(SUBJECTS).map(([k,s])=>{
    const rel=(S.history||[]).filter(r=>(r.subject||"english")===k);
    const last=rel.length?(rel[0].g|0):0;
    const avg=rel.length?Math.round(rel.reduce((a,r)=>a+(r.g|0),0)/rel.length):0;
    return `<div class="par-subj">
      <div class="par-subj-top"><span class="par-ic">${s.icon}</span><b>${esc(s.name)}</b><span class="par-pct">${last}%</span></div>
      <div class="par-bar"><i style="width:${last}%;background:${s.grad}"></i></div>
      <div class="par-meta">${rel.length} סבבים · ${avg}% דיוק ממוצע</div>
    </div>`;
  }).join("");
  // weekly activity — real rounds per day over the last 7 days
  const now=Date.now(), DAY=86400000, dn=["א","ב","ג","ד","ה","ו","ש"];
  const counts=new Array(7).fill(0);
  (S.history||[]).forEach(r=>{const d=Math.floor((now-r.t)/DAY);if(d>=0&&d<7)counts[6-d]++;});
  const max=Math.max(1,...counts);
  const bars=counts.map((c,i)=>{
    const dow=new Date(now-(6-i)*DAY).getDay();
    return `<div class="par-cbar"><i style="height:${Math.max(6,Math.round(c/max*100))}%"></i><span>${dn[dow]}</span></div>`;
  }).join("");
  const rows=[
    {k:"tts",label:"הקראה קולית (TTS)",def:true},
    {k:"sfx",label:"אפקטים קוליים (נכון/שגוי)",def:true},
    {k:"charVoices",label:"קול לכל דמות (מסונתז)",def:true},
  ].map(t=>{const on=setGet(t.k,t.def);
    return `<div class="par-row"><span>${t.label}</span><button class="tgl${on?" on":""}" data-set="${t.k}" role="switch" aria-checked="${on}"><i></i></button></div>`;}).join("");
  // background-music volume — a 3-way control (off / quiet / normal)
  const mv=setGet("musicVol", setGet("music",true)===false?"off":"med");
  const musicRow=`<div class="par-row"><span>מוזיקת רקע במהלך התרגול</span>
    <div class="seg" id="music-vol" role="group">
      ${[["off","כבוי"],["low","שקט"],["med","רגיל"]].map(([v,l])=>
        `<button type="button" class="seg-btn${mv===v?" seg-on":""}" data-v="${v}">${l}</button>`).join("")}
    </div></div>`;
  const voicePills=TEAM_ORDER.map(k=>{const p=VOICE_PROFILES[k];
    return `<button class="voice-pill" data-voice="${k}" style="background:${p.grad}">${p.emoji} ${esc(p.name.replace(/[֑-ׇ]/g,""))} · ${esc(p.tone)}</button>`;}).join("");
  return `<div class="parents-page kl-rise">
  <button class="link-back" id="btn-par-back">↩ חזרה למסך הילד</button>
  <h2 class="par-title">אזור הורים ומורים</h2>
  <p class="par-sub">מעקב אחרי ${name} · הפעילות במכשיר</p>

  <div class="mini-card"><div class="mini-label">התקדמות לפי מקצוע</div>${subjRows}</div>
  ${curriculumCardHTML()}
  <div class="mini-card"><div class="mini-label">פעילות בשבוע האחרון (סבבים ביום)</div><div class="par-chart">${bars}</div></div>
  <div class="mini-card"><div class="mini-label">קולות הדמויות — לחצו להאזנה</div>
    <div class="voice-row" id="voice-row">${voicePills}</div>
    <p class="par-note">כשמפעילים "קול לכל דמות" בהגדרות, ההקראה בעברית משתמשת בקול של הדמות המלווה את המקצוע. הקולות מסונתזים ועובדים בכל מכשיר.</p>
  </div>
  <div class="mini-card"><div class="mini-label">הגדרות</div>${rows}${musicRow}</div>
  ${BACKEND?`<div class="mini-card"><div class="mini-label">📲 שליחת מעקב להורה</div>
    <p class="par-note">שִׁלחו לטלפון של ההורה קישור + קוד — וההורה יוכל לעקוב אחרי ${name} מכל מכשיר.</p>
    <div class="psend">
      <input id="par-send-phone" inputmode="tel" autocomplete="tel" placeholder="טלפון ההורה · לדוגמה 0501234567">
      <button class="primary sm" id="btn-send-parent">שליחת קישור להורה</button>
    </div>
    <div class="err" id="par-send-err"></div>
    <p class="par-note">קוד ההורה: <b>${esc(S.parentCode||"…")}</b> · הקישור נפתח בעמוד המעקב</p>
  </div>`:""}
</div>`;
}

// ─── Games library (from games_library.js) — 28 activities, all playable ─────
const GL = (typeof window!=="undefined" && window.GL) ? window.GL : {CATALOG:[],LEVELS:["הכול"],ACTQ:{},BANK:{},NIK:{},SUBJECT_META:{}};
const GL_SUBJ={he:{app:"hebrew",name:"עברית",grad:"linear-gradient(150deg,#a78bfa,#7c3aed)",shadow:"#6d28d9"},
               en:{app:"english",name:"אנגלית",grad:"linear-gradient(150deg,#7dd3fc,#0284c7)",shadow:"#0369a1"},
               ma:{app:"math",name:"חשבון",grad:"linear-gradient(150deg,#fda4af,#e11d48)",shadow:"#be123c"}};
function catalogHTML(){
  const levels=GL.LEVELS||["הכול"];
  const cur=S.glevel||"הכול";
  const chips=levels.map(l=>`<button class="pill lv-pill${cur===l?" pill-on":""}" data-lv="${esc(l)}">${esc(l)}</button>`).join("");
  const items=(GL.CATALOG||[]).filter(a=>cur==="הכול"||a.lv===cur);
  const cards=items.map((a,idx)=>{const sj=GL_SUBJ[a.subj]||GL_SUBJ.he;
    return `<button class="game-card" data-gi="${(GL.CATALOG||[]).indexOf(a)}" style="box-shadow:inset 6px 0 0 ${sj.shadow}">
      <span class="game-ic">${a.ic||"🎮"}</span>
      <span class="game-body"><b>${esc(a.t)}</b><span>${esc(a.s||"")}</span></span>
      <span class="game-lv" style="background:${sj.grad}">${esc(a.lv)}</span>
    </button>`;}).join("");
  return `<div class="catalog-page kl-rise">
  <button class="link-back" id="btn-cat-back">↩ חזרה</button>
  <h2 class="par-title">ספריית המשחקים 🎲</h2>
  <p class="par-sub">${(GL.CATALOG||[]).length} פעילויות · בחרו רמה ומשחק — וקדימה לשחק!</p>
  <div class="pill-row lv-row" id="lv-row">${chips}</div>
  <div class="game-grid">${cards||'<p class="par-note">אין פעילויות ברמה זו.</p>'}</div>
</div>`;
}

// ─── Generic games player (multiple-choice, from the games library) ──────────
const GP={};
function launchGame(gi){
  const a=(GL.CATALOG||[])[gi];if(!a)return;
  const sj=GL_SUBJ[a.subj]||GL_SUBJ.he;
  let raw=(GL.getQuestions?GL.getQuestions({activity:a.t,subject:a.subj}):(GL.BANK[a.subj]||[]));
  const young=levelForAge(S.age)<=2;
  const fromBank=!(GL.ACTQ&&GL.ACTQ[a.t]&&GL.ACTQ[a.t].length);   // vocalized maps by BANK index
  // tag each question with its original bank index (for niqqud), then pick a
  // FRESH set so the same student isn't handed the same questions each time.
  const tagged=(raw||[]).map((q,i)=>({...q,_bi:fromBank?i:null}));
  if(!tagged.length){showToast("bad","למשחק הזה עוד אין שאלות");return;}
  const qs=pickFresh(tagged,"gplay:"+a.t,Math.min(8,tagged.length),q=>q.prompt);
  GP.gi=gi;GP.a=a;GP.sj=sj;GP.subj=a.subj;GP.young=young&&fromBank;GP.qs=qs;GP.i=0;GP.correct=0;GP.picked=false;
  S.returnTo="catalog";S.screen="gplay";render();
}
function gplayHTML(){
  const a=GP.a||{},sj=GP.sj||GL_SUBJ.he;
  if(GP.i>=GP.qs.length){
    const n=GP.qs.length,c=GP.correct,pct=Math.round(c/n*100);
    const msg=pct>=80?"מדהים! 🌟":pct>=50?"כל הכבוד! 👏":"יופי, ממשיכים! 💪";
    return `<section class="card hero done-card">
      <div class="confetti" id="confetti"></div>
      <div class="done-mascot">${a.ic||"🎲"}</div>
      <h1 class="done-title">${msg}</h1>
      <p class="sub">${esc(a.t)} — ${c} מתוך ${n} נכונות</p>
      <div class="done-stats"><div class="dstat"><span class="dstat-ic">🎯</span><b>${pct}%</b><small>דיוק</small></div></div>
      <button class="primary" id="btn-g-again">עוד סבב</button>
      <button class="ghost" id="btn-g-lib">חזרה לספריית המשחקים</button>
    </section>`;
  }
  let q=GP.qs[GP.i];
  if(GP.young&&GL.vocalized){const v=GL.vocalized(GP.subj,(q._bi!=null?q._bi:GP.i),q);q={...q,prompt:v.prompt,hint:v.hint,opts:v.opts};}
  GP._q=q;
  const order=GL.shuffleOptions?GL.shuffleOptions(q,GP.i,GP.subj):q.opts.map((_,i)=>i);
  GP._order=order;
  const opts=order.map(oi=>`<button class="opt" data-oi="${oi}" dir="${q.en?"ltr":"rtl"}"><span>${esc(q.opts[oi])}</span><span class="mark" style="display:none"></span></button>`).join("");
  const pic=q.pic?`<div class="pic">${q.pic}</div>`:"";
  return `${gameMascotFrame()}<section class="card">
    <div class="part-bar">
      <div><span class="eyebrow">${esc(a.t)}${q.kicker?` · ${esc(q.kicker)}`:""}</span><p class="lead">${esc(q.prompt)}</p></div>
      <div class="bar-side"><span class="counter" id="q-ctr">${GP.i+1}/${GP.qs.length}</span></div>
    </div>
    ${q.hint?`<p class="foot">${esc(q.hint)}</p>`:""}
    ${pic}
    <div class="opts" id="q-opts">${opts}</div>
    <button class="ghost sm" id="btn-g-speak">🔊 הקראה</button>
  </section>
  <p class="game-tip">טיפ: אפשר לענות גם עם המקשים <b>1–4</b> ⌨️</p>`;
}
function handleGAnswer(oi,btn){
  if(GP.picked)return;GP.picked=true;
  const q=GP._q,correct=oi===q.a;
  if(correct){GP.correct++;SFX.good();awardCoin(1);const g=gamLoad();g.xp=(g.xp||0)+3;gamSave(g);}
  else SFX.bad();
  document.querySelectorAll("#q-opts .opt").forEach(b=>{
    const boi=+b.dataset.oi,mk=b.querySelector(".mark");
    if(boi===q.a){b.classList.add("opt-good");mk.textContent="✓";mk.className="mark good";mk.style.display="";}
    else if(boi===oi&&!correct){b.classList.add("opt-bad");mk.textContent="✗";mk.className="mark bad";mk.style.display="";}
    else b.classList.add("opt-dim");
    b.disabled=true;
  });
  setTimeout(()=>{if(S.screen!=="gplay")return;GP.picked=false;GP.i++;render();},1150);
}

function menuHTML(){
  const subj=curSubject(), order=curOrder();
  const p=subjProgress(S.subject);
  // per-skill status from any saved mid-session (else all "ready")
  const ses=S.found||sGet(K.session(S.phone));
  const cur=(ses&&ses.subject===S.subject&&order.includes(ses.screen))?order.indexOf(ses.screen):-1;
  const skills=order.map((part,i)=>{
    let pill,cls;
    if(cur<0){pill="מוכן";cls="ready";}
    else if(i<cur){pill="✓ הושלם";cls="done";}
    else if(i===cur){pill="בהליך";cls="prog";}
    else{pill="מוכן";cls="ready";}
    return `<button class="skill-row" data-part="${part}">
      <span class="skill-num" style="background:${subj.grad}">${i+1}</span>
      <span class="skill-body"><b>${PART_NAME[part]}</b><span>${PART_QUOTA[part]} ${PART_DESC[part]||""}</span></span>
      <span class="skill-pill skill-${cls}">${pill}</span>
    </button>`;
  }).join("");
  const nextName=cur>=0&&cur<order.length?PART_NAME[order[cur]]:PART_NAME[order[0]];
  const rel=S.history.filter(r=>(r.subject||"english")===S.subject).slice(0,5);
  const hist=rel.length
    ?`<span class="eyebrow">מבחנים קודמים</span>
<ul class="hist">${rel.map(r=>`<li><span>${fmtDate(r.t)}</span><b>${r.g}/100</b></li>`).join("")}</ul>`:"";
  const gm=gamLoad();
  const wk=Math.max(0,Math.min(5,gm.streak||0)), wkPct=(wk/5)*100;
  return `<div class="skills-page kl-rise">
  <button class="link-back" id="btn-subj-back">↩ כל המקצועות</button>

  <div class="subj-header">
    <div class="subj-badge" style="background:${subj.grad};box-shadow:0 8px 0 ${subj.shadow}">${subj.icon}</div>
    <div class="subj-h-txt"><h2>${esc(subj.name)}</h2><p>${esc(subj.desc||"")}</p></div>
    <div class="mascot-bubble"><b>${esc(subj.mascotName||"")}</b> מחכה לך <span class="mb-paw">🐾</span><span class="mascot-emoji">${subj.mascot||"🦉"}</span></div>
  </div>

  <div class="progress-card" style="background:${subj.grad};box-shadow:0 8px 0 ${subj.shadow}">
    <div class="pc-head"><div class="pc-label">ההתקדמות שלך במקצוע</div><div class="pc-pct">${p.pct}%</div></div>
    <div class="pc-bar"><i style="width:${p.pct}%"></i></div>
    <div class="pc-note">${order.length} מיומנויות · הבאה בתור: ${esc(nextName)}</div>
  </div>

  <div class="skills-list">${skills}</div>

  ${CURRICULUM?`<button class="cur-banner" id="btn-curriculum">📚 מותאם לתכנית הלימודים של משרד החינוך · לצפייה בנושאים ›</button>`:""}

  <div class="weekly-card">
    <span class="weekly-buddy">${subj.mascot||subj.icon}</span>
    <div class="weekly-label">היעד השבועי</div>
    <div class="weekly-big">${wk} מתוך 5 ימים</div>
    <div class="weekly-bar"><i style="width:${wkPct}%"></i></div>
  </div>

  <div class="mini-card">
    <div class="mini-label">רמת קושי</div>
    <div class="pill-row" id="menu-levels">
      ${Object.keys(GRADE_LETTER).map(Number).map(L=>`<button type="button" class="pill${curLevel()===L?" pill-on":""}" data-lvl="${L}">${esc(GRADE_LETTER[L])}</button>`).join("")}
    </div>
  </div>

  ${missLoad().length?`<button class="ghost" id="btn-review">🔁 תרגול הטעויות שלי (${missLoad().length})</button>`:""}
  ${BACKEND?`<button class="ghost" id="btn-lead">🏆 לוח מובילים</button>`:""}
  ${hist}
  ${BACKEND?`<p class="foot">קוד להורים: <b id="parent-code">${esc(S.parentCode||"…")}</b> — למעקב מרחוק בעמוד ההורים</p>`:""}

  <button class="primary" id="btn-start">בואו נתחיל · ${esc(nextName)}</button>
  <button class="ghost sm" id="btn-logout">החלפת משתמש/ת / הרשמה מחדש</button>
</div>`;
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
  sv:{eyebrow:"טבע ומדעים · אוצר מילים", lead:"איזה מושג מתאים להגדרה?", prompt:"d", answer:"w"},
  sw:{eyebrow:"טבע ומדעים · פירוש מושגים", lead:"מה פירוש המושג?",       prompt:"w", answer:"d"},
  tv:{eyebrow:"תורה · אוצר מושגים",       lead:"איזה מושג מתאים להגדרה?", prompt:"d", answer:"w"},
  tw:{eyebrow:"תורה · פירוש מושגים",      lead:"מה פירוש המושג?",         prompt:"w", answer:"d"},
  gv:{eyebrow:"מולדת וסביבה · מושגים",    lead:"איזה מושג מתאים להגדרה?", prompt:"d", answer:"w"},
  gw:{eyebrow:"מולדת וסביבה · פירוש מושגים", lead:"מה פירוש המושג?",      prompt:"w", answer:"d"},
  iv:{eyebrow:"היסטוריה · מושגים",        lead:"איזה מושג מתאים להגדרה?", prompt:"d", answer:"w"},
  iw:{eyebrow:"היסטוריה · פירוש מושגים",  lead:"מה פירוש המושג?",         prompt:"w", answer:"d"},
};
function mcHTML(){
  const c=HEB_MC_CFG[S.screen]||HEB_MC_CFG.hv, t=TIME[S.screen]??240;
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">${c.eyebrow}</span><p class="lead">${c.lead}</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog[S.screen]?.left??t,t)}</span></div>
  </div>
  <div class="mc-prompt" id="mc-prompt"></div>
  <button class="ghost sm" id="mc-speak">🔊 שמע/י</button>
  <div class="opts" id="q-opts"></div>
</section>`;
}
function initHebMC(){
  const scr=S.screen,cfg=HEB_MC_CFG[scr]||HEB_MC_CFG.hv;
  const lvl=curLevel(),n=PART_QUOTA[scr]||10,t=TIME[scr]??240;
  const saved=S.prog[scr];
  const src=(subjVocab().length?subjVocab():[]).filter(x=>x.w&&x.d);
  if(saved&&saved.qs){HM.qs=saved.qs;HM.i=saved.i||0;}
  else{
    const pool=nearLevel(src,lvl,Math.max(n+4,8));
    HM.qs=pickFresh(pool,"hebmc:"+scr,n,x=>x.w).map(it=>{
      const answer=it[cfg.answer], opts=[answer];
      for(const o of shuffle(pool.filter(x=>x[cfg.answer]!==answer)).map(x=>x[cfg.answer])){
        if(opts.length>=4)break; if(!opts.includes(o))opts.push(o);
      }
      return {p:it[cfg.prompt],a:answer,o:shuffle(opts),w:it.w,d:it.d};
    });
    HM.i=0;
  }
  HM.picked=false;
  setPartCount(HM.qs.length);
  renderHebMCQ();
  TM.start(saved?.left??t,t,()=>gotoNext(scr));
}
function renderHebMCQ(){
  const q=HM.qs[HM.i], hv=(S.screen==="hv"||S.screen==="sv"||S.screen==="tv");
  // young readers (grades 1–3): show niqqud. hv prompt=definition, options=words
  const promptDisp = hv ? nqD(q.w,q.p) : q.p;
  const optDisp = o => hv ? nqW(o) : o;
  document.getElementById("q-ctr").textContent=`${HM.i+1}/${HM.qs.length}`;
  document.getElementById("mc-prompt").innerHTML=`<span dir="rtl">${esc(promptDisp)}</span>`;
  const sp=document.getElementById("mc-speak");if(sp)sp.onclick=()=>speakHe(promptDisp);
  document.getElementById("q-opts").innerHTML=q.o.map(o=>
    `<button class="opt" data-val="${esc(o)}" dir="rtl"><span>${esc(optDisp(o))}</span><span class="mark" style="display:none"></span></button>`).join("");
  HM.picked=false;
  document.getElementById("q-opts").onclick=e=>{
    const b=e.target.closest(".opt");if(!b||b.disabled||HM.picked)return;
    handleHebMC(b.dataset.val);
  };
}
function handleHebMC(val){
  if(HM.picked)return;HM.picked=true;
  const q=HM.qs[HM.i],correct=val===q.a;
  logAns("vocab",q.p,val,q.a,correct);
  if(correct){addScore(1);SFX.good();}else{SFX.bad();recordMiss({w:q.w,d:q.d,kind:"he"});}
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

// ─── Generic multiple-choice quiz engine (science · תורה · לשון) ────────────
// Driven by QUIZ_CFG per screen. Items may carry an "nq" (vocalized) form,
// shown to young readers (grades א–ד).
const SQ={};
const QUIZ_CFG={
  sq:{eyebrow:"טבע ומדעים · חידון",           lead:"מה התשובה הנכונה?", key:"sciq", pool:()=>SCI_QUIZ},
  tq:{eyebrow:"תורה · חידון תנ״ך",             lead:"מה התשובה הנכונה?", key:"toraq",pool:()=>TORAH_QUIZ},
  gq:{eyebrow:"מולדת וסביבה · חידון",          lead:"מה התשובה הנכונה?", key:"geoq", pool:()=>GEO_QUIZ},
  iq:{eyebrow:"היסטוריה · חידון",              lead:"מה התשובה הנכונה?", key:"histq",pool:()=>HIST_QUIZ},
  lp:{eyebrow:"לשון · חלקי הדיבר ומבנה המשפט", lead:"בחר/י את התשובה",    key:"lp",   pool:()=>LASHON_QUIZ.filter(x=>x.topic==="parts"||x.topic==="sentence")},
  lf:{eyebrow:"לשון · צורות הפועל והשם",       lead:"בחר/י את התשובה",    key:"lf",   pool:()=>LASHON_QUIZ.filter(x=>x.topic==="tense"||x.topic==="gender_num"||x.topic==="root")},
  ln:{eyebrow:"לשון · ניקוד ופיסוק",           lead:"בחר/י את התשובה",    key:"ln",   pool:()=>LASHON_QUIZ.filter(x=>x.topic==="punct"||x.topic==="spelling")},
};
function quizCfg(){ return QUIZ_CFG[S.screen]||QUIZ_CFG.sq; }
function sqHTML(){
  const c=quizCfg(), t=TIME[S.screen]??300;
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">${esc(c.eyebrow)}</span><p class="lead">${esc(c.lead)}</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog[S.screen]?.left??t,t)}</span></div>
  </div>
  <div class="mc-prompt" id="sq-prompt" dir="rtl"></div>
  <button class="ghost sm" id="sq-hint">💡 רמז / הקראה</button>
  <div class="opts" id="q-opts"></div>
</section>`;
}
function initSciQuiz(){
  const scr=S.screen,c=quizCfg(),lvl=curLevel(),n=PART_QUOTA[scr]||10,t=TIME[scr]??300,saved=S.prog[scr];
  const src=c.pool().filter(x=>x.q&&Array.isArray(x.o));
  if(!src.length){ gotoNext(scr); return; }   // no data → skip gracefully
  if(saved&&saved.qs){SQ.qs=saved.qs;SQ.i=saved.i||0;}
  else{
    const pool=nearLevel(src,lvl,Math.max(n+4,8));
    SQ.qs=pickFresh(pool,c.key,n,x=>x.q).map(shuffleOpts);
    SQ.i=0;
  }
  SQ.picked=false; SQ.scr=scr;
  setPartCount(SQ.qs.length);
  renderSciQ();
  TM.start(saved?.left??t,t,()=>gotoNext(scr));
}
function renderSciQ(){
  const q=SQ.qs[SQ.i], young=curLevel()<=4;       // young readers (א׳–ד׳) see vocalized text if present
  const qtext=(young&&q.nq&&q.nq.q)||q.q;
  const opts =(young&&q.nq&&Array.isArray(q.nq.o))?q.nq.o:q.o;
  document.getElementById("q-ctr").textContent=`${SQ.i+1}/${SQ.qs.length}`;
  document.getElementById("sq-prompt").innerHTML=`<span dir="rtl">${esc(qtext)}</span>`;
  const hb=document.getElementById("sq-hint");
  if(hb)hb.onclick=()=>{ if(q.hint)showToast("info",q.hint); speakHe(qtext); };
  document.getElementById("q-opts").innerHTML=opts.map((o,i)=>
    `<button class="opt" data-idx="${i}" dir="rtl"><span>${esc(o)}</span><span class="mark" style="display:none"></span></button>`).join("");
  SQ.picked=false;
  document.getElementById("q-opts").onclick=e=>{
    const b=e.target.closest(".opt");if(!b||b.disabled||SQ.picked)return;
    handleSciQ(parseInt(b.dataset.idx,10));
  };
}
function handleSciQ(idx){
  if(SQ.picked)return;SQ.picked=true;
  const scr=SQ.scr||S.screen, q=SQ.qs[SQ.i],correct=idx===q.c;
  logAns("quiz",q.q,(q.o||[])[idx],(q.o||[])[q.c],correct);
  if(correct){addScore(1);SFX.good();}else SFX.bad();
  document.querySelectorAll("#q-opts .opt").forEach(b=>{
    const bi=parseInt(b.dataset.idx,10),mk=b.querySelector(".mark");
    if(bi===q.c){b.classList.add("opt-good");mk.textContent="✓";mk.className="mark good";mk.style.display="";}
    else if(bi===idx&&!correct){b.classList.add("opt-bad");mk.textContent="✗";mk.className="mark bad";mk.style.display="";}
    else b.classList.add("opt-dim");
    b.disabled=true;
  });
  commitProg({[scr]:{qs:SQ.qs,i:SQ.i,left:TM.left}});
  setTimeout(()=>{
    if(S.screen!==scr)return;
    SQ.picked=false;SQ.i++;
    if(SQ.i>=SQ.qs.length)gotoNext(scr);else renderSciQ();
  },1200);
}

// ─── Hebrew synonyms & antonyms (hs · נרדפות והפכים) ─────────────────────────
// The most common Hebrew exercise on Israeli sites: pick the word closest in
// meaning (נרדף) or opposite (הפך). Shows niqqud for young readers (grades א–ד).
const HL={};
function hlHTML(){
  const t=TIME.hs;
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">עברית · נרדפות והפכים</span><p class="lead" id="hl-lead">בחר/י את המילה המתאימה</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.hs?.left??t,t)}</span></div>
  </div>
  <div class="mc-prompt" id="hl-prompt" dir="rtl"></div>
  <button class="ghost sm" id="hl-speak">🔊 שמע/י</button>
  <div class="opts" id="q-opts"></div>
</section>`;
}
function initHebLex(){
  const lvl=curLevel(),n=PART_QUOTA.hs,t=TIME.hs,saved=S.prog.hs;
  const src=HEB_LEX.filter(x=>x.w&&x.a&&Array.isArray(x.decoys)&&x.decoys.length>=3);
  if(!src.length){ gotoNext("hs"); return; }   // no data → skip gracefully
  if(saved&&saved.qs){HL.qs=saved.qs;HL.i=saved.i||0;}
  else{
    const pool=nearLevel(src,lvl,Math.max(n+4,8));
    HL.qs=pickFresh(pool,"heblex",n,x=>x.w).map(it=>{
      const disp={};
      if(it.wn)disp[it.w]=it.wn; if(it.an)disp[it.a]=it.an;
      if(Array.isArray(it.decoysN))it.decoys.forEach((d,k)=>{if(it.decoysN[k])disp[d]=it.decoysN[k];});
      return {type:it.type,w:it.w,a:it.a,o:shuffle([it.a,...it.decoys.slice(0,3)]),disp};
    });
    HL.i=0;
  }
  HL.picked=false;
  setPartCount(HL.qs.length);
  renderHebLexQ();
  TM.start(saved?.left??t,t,()=>gotoNext("hs"));
}
function renderHebLexQ(){
  const q=HL.qs[HL.i], young=youngHeb();
  const dw = young?(q.disp[q.w]||q.w):q.w;
  const le=document.getElementById("hl-lead");
  if(le)le.textContent = q.type==="ant" ? "איזו מילה הפוכה במשמעות?" : "איזו מילה קרובה במשמעות?";
  document.getElementById("q-ctr").textContent=`${HL.i+1}/${HL.qs.length}`;
  document.getElementById("hl-prompt").innerHTML=`<span dir="rtl">${q.type==="ant"?"הַהֵפֶךְ מ־":"נִרְדֶּפֶת ל־"}<b>${esc(dw)}</b></span>`;
  const sp=document.getElementById("hl-speak"); if(sp)sp.onclick=()=>speakHe(dw);
  document.getElementById("q-opts").innerHTML=q.o.map(o=>{
    const disp=young?(q.disp[o]||o):o;
    return `<button class="opt" data-val="${esc(o)}" dir="rtl"><span>${esc(disp)}</span><span class="mark" style="display:none"></span></button>`;
  }).join("");
  HL.picked=false;
  document.getElementById("q-opts").onclick=e=>{const b=e.target.closest(".opt");if(!b||b.disabled||HL.picked)return;handleHebLex(b.dataset.val);};
}
function handleHebLex(val){
  if(HL.picked)return;HL.picked=true;
  const q=HL.qs[HL.i],correct=val===q.a;
  logAns("lex",(q.type==="ant"?"ההיפך מ־":"נרדפת ל־")+q.w,val,q.a,correct);
  if(correct){addScore(1);SFX.good();}else{SFX.bad();recordMiss({w:q.w,d:q.a,kind:"he"});}
  document.querySelectorAll("#q-opts .opt").forEach(b=>{
    const bv=b.dataset.val,mk=b.querySelector(".mark");
    if(bv===q.a){b.classList.add("opt-good");mk.textContent="✓";mk.className="mark good";mk.style.display="";}
    else if(bv===val&&!correct){b.classList.add("opt-bad");mk.textContent="✗";mk.className="mark bad";mk.style.display="";}
    else b.classList.add("opt-dim");
    b.disabled=true;
  });
  commitProg({hs:{qs:HL.qs,i:HL.i,left:TM.left}});
  setTimeout(()=>{
    if(S.screen!=="hs")return;
    HL.picked=false;HL.i++;
    if(HL.i>=HL.qs.length)gotoNext("hs");else renderHebLexQ();
  },1100);
}

// ─── Word or Scribble (wg) — real Hebrew word vs. scrambled gibberish ─
// Inspired by "מילה או קשקוש": a fun, fast reading-fluency drill. The child
// sees one Hebrew string and decides — is it a real word, or nonsense?
const WG = {};
// build a lookup of every real word we know, so a scramble that accidentally
// spells a real word is rejected as gibberish.
function wgRealSet(){
  if(WG._real)return WG._real;
  const s=new Set();
  for(const x of HEB_VOCAB) if(x.w) s.add(x.w);
  for(const st of (typeof HEB_STORIES!=="undefined"?HEB_STORIES:[]))
    for(const tok of String(st.text||"").split(/[\s.,!?"'״׳()\n]+/)) if(tok.length>1) s.add(tok);
  WG._real=s;return s;
}
// scramble a word into obvious nonsense: shuffle letters, guarantee it differs
// from the original and isn't itself a real word.
function wgScramble(word){
  const letters=[...word];
  const real=wgRealSet();
  if(letters.length<3){                    // too short to shuffle convincingly →
    const pool="אבגדהוזחטיכלמנסעפצקרשת";     // swap in a random extra letter
    for(let tries=0;tries<12;tries++){
      const cand=[...letters];
      const pos=Math.floor(Math.random()*cand.length);
      let c; do{c=pool[Math.floor(Math.random()*pool.length)];}while(c===cand[pos]);
      cand[pos]=c;
      const s=cand.join("");
      if(s!==word && !real.has(s)) return s;
    }
    return letters.join("")+"ק";           // last resort: obvious nonsense
  }
  for(let tries=0;tries<12;tries++){
    const s=shuffle(letters).join("");
    if(s!==word && !real.has(s)) return s;
  }
  // fallback: force a difference by rotating
  return letters.slice(1).concat(letters[0]).join("");
}
function wgHTML(){
  const t=TIME.wg;
  return `<section class="card wg-card">
  <div class="part-bar">
    <div><span class="eyebrow">עברית · מילה או קשקוש</span><p class="lead">האם זו מילה אמיתית או קשקוש?</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span><span id="hg-wrap">${hgHTML(S.prog.wg?.left??t,t)}</span></div>
  </div>
  <div class="wg-stage">
    <div class="wg-word" id="wg-word" dir="rtl"></div>
    <button class="ghost sm wg-speak" id="wg-speak">🔊 שמע/י</button>
  </div>
  <div class="wg-choice">
    <button class="wg-btn wg-yes" data-ans="1"><span class="wg-ic">✅</span><b>מילה</b></button>
    <button class="wg-btn wg-no"  data-ans="0"><span class="wg-ic">🌀</span><b>קשקוש</b></button>
  </div>
  <div class="wg-fb" id="wg-fb"></div>
</section>`;
}
function initWordGame(){
  const scr="wg",lvl=curLevel(),n=PART_QUOTA.wg,t=TIME.wg;
  const saved=S.prog.wg;
  const src=HEB_VOCAB.filter(x=>x.w&&[...x.w].length>=2);
  if(saved&&saved.qs){WG.qs=saved.qs;WG.i=saved.i||0;}
  else{
    const pool=nearLevel(src,lvl,Math.max(n+4,10));
    const picks=pickFresh(pool,"wg",n,x=>x.w);
    WG.qs=picks.map((it,idx)=>{
      const real=(idx%2===0);                       // exactly half real, then shuffled
      return real
        ? {show:it.w,isWord:1,w:it.w,d:it.d}
        : {show:wgScramble(it.w),isWord:0,w:it.w,d:it.d};
    });
    WG.qs=shuffle(WG.qs);
    WG.i=0;
  }
  WG.picked=false;
  setPartCount(WG.qs.length);
  renderWordGame();
  TM.start(saved?.left??t,t,()=>gotoNext(scr));
}
function renderWordGame(){
  const q=WG.qs[WG.i];
  document.getElementById("q-ctr").textContent=`${WG.i+1}/${WG.qs.length}`;
  const wd=document.getElementById("wg-word");
  // real words get niqqud for young readers; scrambles stay bare
  const disp=q.isWord?nqW(q.w):q.show;
  wd.textContent=disp; wd.className="wg-word wg-in";
  document.getElementById("wg-fb").innerHTML="";
  const sp=document.getElementById("wg-speak");
  if(sp)sp.onclick=()=>speakHe(q.isWord?nqW(q.w):q.show);
  WG.picked=false;
  document.querySelectorAll(".wg-btn").forEach(b=>{
    b.disabled=false;b.className="wg-btn "+(b.dataset.ans==="1"?"wg-yes":"wg-no");
    b.onclick=()=>handleWordGame(+b.dataset.ans,b);
  });
}
function handleWordGame(ans,btn){
  if(WG.picked)return;WG.picked=true;
  const q=WG.qs[WG.i],correct=(ans===q.isWord);
  logAns("word",(q.isWord?q.w:q.show)||q.w,ans?"מילה אמיתית":"לא מילה",q.isWord?"מילה אמיתית":"לא מילה",correct);
  if(correct){addScore(1);SFX.good();btn.classList.add("wg-good");}
  else{SFX.bad();btn.classList.add("wg-bad");recordMiss({w:q.w,d:q.d,kind:"he"});}
  document.querySelectorAll(".wg-btn").forEach(b=>b.disabled=true);
  const fb=document.getElementById("wg-fb");
  if(q.isWord)
    fb.innerHTML=`<span class="wg-fb-in ${correct?"ok":"no"}">${correct?"✓ נכון!":"✗ טעות —"} <b dir="rtl">${esc(nqW(q.w))}</b> = ${esc(nqD(q.w,q.d))}</span>`;
  else
    fb.innerHTML=`<span class="wg-fb-in ${correct?"ok":"no"}">${correct?"✓ נכון, זה קשקוש!":"✗ טעות — זה קשקוש."} המילה האמיתית: <b dir="rtl">${esc(nqW(q.w))}</b></span>`;
  commitProg({wg:{qs:WG.qs,i:WG.i,left:TM.left}});
  setTimeout(()=>{
    if(S.screen!=="wg")return;
    WG.picked=false;WG.i++;
    if(WG.i>=WG.qs.length)gotoNext("wg");else renderWordGame();
  },1500);
}

const MATH_CFG = {
  ma1:{eyebrow:"חשבון · חיבור וחיסור",  lead:"בחר/י את התשובה הנכונה", type:"addsub"},
  ma2:{eyebrow:"חשבון · כפל וחילוק",    lead:"בחר/י את התשובה הנכונה", type:"muldiv"},
  ma5:{eyebrow:"חשבון · שברים",          lead:"בחר/י את התשובה הנכונה", type:"frac"},
  ma6:{eyebrow:"חשבון · הנדסה וגיאומטריה", lead:"בחר/י את התשובה הנכונה", type:"geom"},
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
  const foot=heb?"מתחו קו בין כל מילה לפירוש הנכון שלה"
                :"מתחו קו בין כל מילה באנגלית לפירוש הנכון בעברית";
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
  const lvl=curLevel();
  const partName=PART_NAME[S.pausedFrom]||"התרגיל";
  return `<section class="card hero pause-card kl-rise">
  <span class="eyebrow">הפסקה קטנה ⏸</span>
  <h1>מה עושים?</h1>
  <p class="sub">${esc(S.name||"")}, עצרנו ב<b>${esc(partName)}</b>. אפשר להמשיך, לקבל עוד זמן, לשנות רמה, או לעבור מסך.</p>
  <div class="pause-row">
    <button class="primary" id="pz-resume">▶ ממשיכים</button>
    <button class="pz-time" id="pz-time">⏱ עוד 2 דקות</button>
  </div>
  <div class="mini-card pz-lvl">
    <div class="mini-label">רמת קושי (תחול מהחלק הבא)</div>
    <div class="pill-row" id="pz-levels">
      ${Object.keys(GRADE_LETTER).map(Number).map(L=>`<button type="button" class="pill${lvl===L?" pill-on":""}" data-lvl="${L}">${esc(GRADE_LETTER[L])}</button>`).join("")}
    </div>
  </div>
  <button class="ghost" id="pz-plan">📋 לתפריט המקצוע</button>
  <button class="ghost" id="pz-hub">🏠 לתפריט המקצועות</button>
  <button class="ghost sm" id="pz-logout">🔁 החלפת משתמש/ת / הרשמה מחדש</button>
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
  const mascot=curSubject().mascot||"🦉";
  return `<section class="card hero done-card">
  <div class="confetti" id="confetti"></div>
  <div class="done-clip" id="done-clip"></div>
  <div class="done-mascot">${mascot}</div>
  <div class="stars">${stars}</div>
  <h1 class="done-title">כל הכבוד!</h1>
  <p class="sub">${msg} ${S.score} תשובות נכונות מתוך ${askedTotal()}.</p>
  <div class="done-stats">
    <div class="dstat"><span class="dstat-ic">🪙</span><b>+${lg.coinGain}</b><small>מטבעות</small></div>
    <div class="dstat"><span class="dstat-ic">🎯</span><b>${g}%</b><small>דיוק</small></div>
    <div class="dstat"><span class="dstat-ic">🔥</span><b>${lg.streak}</b><small>רצף ימים</small></div>
  </div>
  ${lvl}${badges}${hist}
  <button class="primary" id="btn-again">עוד סבב</button>
  <button class="ghost" id="btn-other">פעילות אחרת</button>
</section>`;
}

// ─── Core Render ──────────────────────────────────────────
const SCR_HTML={login:loginHTML,subject:subjectHTML,resume:resumeHTML,menu:menuHTML,
  p1:vocabHTML,p2:clozeHTML,p3:readingHTML,p4:describeHTML,p5:matchHTML,p6:balloonsHTML,
  hv:mcHTML,hb:matchHTML,hw:mcHTML,hs:hlHTML,wg:wgHTML,hr:readingHTML,
  ma1:mathHTML,ma2:mathHTML,ma5:mathHTML,ma6:mathHTML,ma3:mathHTML,ma4:mathHTML,
  sv:mcHTML,sw:mcHTML,sq:sqHTML,sr:readingHTML,
  tv:mcHTML,tw:mcHTML,tq:sqHTML,tr:readingHTML,
  lp:sqHTML,lf:sqHTML,ln:sqHTML,
  gv:mcHTML,gw:mcHTML,gq:sqHTML,gr:readingHTML,
  iv:mcHTML,iw:mcHTML,iq:sqHTML,ir:readingHTML,
  rv:rvHTML,lead:leadHTML,paused:pausedHTML,done:doneHTML,parents:parentsHTML,catalog:catalogHTML,gplay:gplayHTML,curriculum:curriculumHTML};

function gotoNext(cur){
  // adaptive difficulty — nudge the level for the NEXT part by this part's accuracy
  const q=PART_QUOTA[cur]||1, acc=(S.score-(S.partStart||0))/q;
  if(acc>=0.85) S.adaptLvl=Math.min(MAX_LVL,curLevel()+1);
  else if(acc<=0.4) S.adaptLvl=Math.max(1,curLevel()-1);
  const o=curOrder(),k=o.indexOf(cur);
  if(k>=0&&k<o.length-1){S.screen=o[k+1];render();}
  else finish();
}

// screens whose answers are 4 tappable options → show the "keys 1–4" tip and
// wire number-key answering. (p4 = free-text describe, so it is excluded.)
const OPTION_SCREENS=new Set(["p1","p3","hv","hw","hs","hr","ma1","ma2","ma5","ma6","ma3","ma4","sv","sw","sq","sr","tv","tw","tq","tr","lp","lf","ln","gv","gw","gq","gr"]);
const ENCOURAGE=["אני איתך! נסה/י לחשוב רגע 💭","קדימה, את/ה יכול/ה! 💪","קרא/י בעיון ובחר/י ✨","כל תשובה מקרבת אותך 🌟","אין לחץ — קח/י את הזמן 😊"];
function gameMascotFrame(){
  const m=curSubject().mascot||"🦉";
  const line=ENCOURAGE[Math.floor(Math.random()*ENCOURAGE.length)];
  return `<div class="game-mascot"><div class="gm-bubble" id="gm-bubble">${line}</div><div class="gm-face" id="gm-face">${m}</div></div>`;
}
function render(){
  TM.stop();
  const root=document.getElementById("exam-root");
  const isGame=curOrder().includes(S.screen);
  let body=topbarHTML();
  if(isGame) body+=gameMascotFrame();
  body+=(SCR_HTML[S.screen]||loginHTML)();
  if(isGame&&OPTION_SCREENS.has(S.screen)) body+=`<p class="game-tip">טיפ: אפשר לענות גם עם המקשים <b>1–4</b> ⌨️</p>`;
  body+=`<footer class="app-credits">© כל הזכויות שמורות ל־<b>OnyxApps</b> · אושר ששוני</footer>`;
  root.innerHTML=body;
  // tint the part eyebrow pill with the current subject's gradient
  root.style.setProperty("--subj-grad", isGame?curSubject().grad:"linear-gradient(180deg,#a78bfa,#7c3aed)");
  attachListeners();
  initPart();
  ensureMascot();
  showMascot(S.screen==="rv");   // corner mascot only on review; gameplay uses the in-card one
  BGM.sync(S.screen);   // varied soft background music (per subject + menu)
  saveSession();
}

function attachListeners(){
  const pb=document.getElementById("btn-pause");
  if(pb)pb.addEventListener("click",doPause);
  const sk=document.getElementById("btn-skip");
  if(sk)sk.addEventListener("click",()=>{TM.stop();gotoNext(S.screen);});
  const hb=document.getElementById("btn-home");
  if(hb)hb.addEventListener("click",doHome);
  const pn=document.getElementById("btn-parents");
  if(pn)pn.addEventListener("click",()=>{S.returnTo=S.screen;S.screen="parents";render();});
  const cn=document.getElementById("btn-catalog");
  if(cn)cn.addEventListener("click",()=>{S.returnTo=S.screen;S.screen="catalog";render();});
  const it=document.getElementById("btn-install-top");
  if(it)it.addEventListener("click",doInstall);
  const tg=document.getElementById("team-grid");
  if(tg)tg.addEventListener("click",e=>{const c=e.target.closest(".team-card");if(!c)return;
    const anim=MASCOT_ANIMAL[c.dataset.voice];if(anim)SFX.animal(anim);
    speakSample(c.dataset.voice);c.classList.remove("team-pop");void c.offsetWidth;c.classList.add("team-pop");});
  if(S.screen==="lead")loadLeaderboard();

  if(S.screen==="curriculum"){
    const cbk=document.getElementById("btn-cur-back");
    if(cbk)cbk.addEventListener("click",()=>{S.screen=S.returnTo||"menu";render();});
  }
  if(S.screen==="parents"){
    document.getElementById("btn-par-back").addEventListener("click",()=>{S.screen=S.returnTo||"subject";render();});
    if(BACKEND&&!S.parentCode)syncRegister();   // make sure a parent code exists to send
    const bsp=document.getElementById("btn-send-parent");
    if(bsp)bsp.addEventListener("click",sendParentLink);
    const spi=document.getElementById("par-send-phone");
    if(spi)spi.addEventListener("keydown",e=>{if(e.key==="Enter")sendParentLink();});
    document.querySelectorAll(".tgl[data-set]").forEach(t=>{
      t.addEventListener("click",()=>{
        const k=t.dataset.set,now=!setGet(k,true);
        setPut(k,now);
        t.classList.toggle("on",now);t.setAttribute("aria-checked",now);
        if(k==="music"&&!now)BGM.stop();   // silence the bed at once when turned off
      });
    });
    const vr=document.getElementById("voice-row");
    if(vr)vr.addEventListener("click",e=>{const b=e.target.closest(".voice-pill");if(b)speakSample(b.dataset.voice);});
    const mvol=document.getElementById("music-vol");
    if(mvol)mvol.addEventListener("click",e=>{
      const b=e.target.closest(".seg-btn");if(!b)return;
      setPut("musicVol",b.dataset.v);
      mvol.querySelectorAll(".seg-btn").forEach(x=>x.classList.toggle("seg-on",x===b));
      if(b.dataset.v==="off")BGM.stop(); else BGM.setLevel();  // applies next time on a music screen
    });
  }
  if(S.screen==="catalog"){
    document.getElementById("btn-cat-back").addEventListener("click",()=>{S.screen=S.returnTo||"subject";render();});
    const lvr=document.getElementById("lv-row");
    if(lvr)lvr.addEventListener("click",e=>{const b=e.target.closest(".lv-pill");if(!b)return;S.glevel=b.dataset.lv;render();});
    document.querySelectorAll(".game-card").forEach(c=>{
      c.addEventListener("click",()=>launchGame(+c.dataset.gi));
    });
  }
  if(S.screen==="gplay"){
    if(GP.i>=GP.qs.length){launchConfetti();if(GP.correct/GP.qs.length>=0.5)SFX.good();}
    const q=GP._q||{};
    const qo=document.getElementById("q-opts");
    if(qo)qo.addEventListener("click",e=>{const b=e.target.closest(".opt");if(b&&!b.disabled)handleGAnswer(+b.dataset.oi,b);});
    const sp=document.getElementById("btn-g-speak");
    if(sp)sp.addEventListener("click",()=>{q.en?speak(q.prompt):speakHe(q.prompt);});
    const ag=document.getElementById("btn-g-again");
    if(ag)ag.addEventListener("click",()=>launchGame(GP.gi));
    const lib=document.getElementById("btn-g-lib");
    if(lib)lib.addEventListener("click",()=>{S.screen="catalog";render();});
  }

  if(S.screen==="login"){
    const ni=document.getElementById("inp-name"),pi=document.getElementById("inp-phone");
    const eb=document.getElementById("btn-enter");
    const checkEb=()=>{eb.disabled=!S.name.trim()||S.phone.length<9||S.busy;};
    ni.addEventListener("input",e=>{
      S.name=e.target.value;checkEb();
      const g=document.getElementById("greet-h1");
      if(g)g.textContent=S.name.trim()?`שלום, ${S.name.trim()}!`:"ברוכים הבאים!";
    });
    pi.addEventListener("input",e=>{S.phone=e.target.value.replace(/\D/g,"");e.target.value=S.phone;checkEb();});
    const bands=document.getElementById("login-bands");
    if(bands)bands.addEventListener("click",e=>{
      const b=e.target.closest(".band-pill");if(!b)return;
      S.age=+b.dataset.age;S.lvlOverride=null;
      bands.querySelectorAll(".band-pill").forEach(x=>x.classList.toggle("pill-on",x===b));
    });
    const ls=document.getElementById("login-subjects");
    if(ls)ls.addEventListener("click",e=>{
      const b=e.target.closest(".subj-card");if(!b)return;
      S.subject=b.dataset.subj;
      SFX.jingle(S.subject);
      ls.querySelectorAll(".subj-card").forEach(x=>x.classList.toggle("subj-on",x===b));
      // clicking a subject is an attempt to START — if not registered yet,
      // explain and jump to the registration fields; otherwise go.
      if(S.name.trim()&&S.phone.length>=9){doEnter();return;}
      loginNeedRegister();
    });
    const la=document.getElementById("login-avatars");
    if(la)la.addEventListener("click",e=>{
      const b=e.target.closest(".av-btn");if(!b)return;
      S.avatar=b.dataset.av;
      la.querySelectorAll(".av-btn").forEach(x=>x.classList.toggle("av-on",x===b));
      const gb=document.querySelector(".home-buddy");if(gb)gb.textContent=S.avatar;
    });
    eb.addEventListener("click",()=>{if(S.name.trim()&&S.phone.length>=9)doEnter();else loginNeedRegister();});
    const ib=document.getElementById("btn-install");
    if(ib)ib.addEventListener("click",doInstall);
    const ph=document.getElementById("btn-parent-help");
    if(ph)ph.addEventListener("click",showParentHelp);
  }
  if(S.screen==="resume"){
    document.getElementById("btn-resume").addEventListener("click",doResume);
    document.getElementById("btn-fresh").addEventListener("click",doFresh);
  }
  if(S.screen==="subject"){
    document.querySelectorAll(".subj-card").forEach(b=>{
      b.addEventListener("click",()=>{
        S.subject=b.dataset.subj;SFX.jingle(S.subject);S.score=0;S.prog={};S.screen="menu";render();
      });
    });
    const lo=document.getElementById("btn-logout-hub");
    if(lo)lo.addEventListener("click",doLogout);
  }
  if(S.screen==="menu"){
    document.querySelectorAll(".skill-row").forEach(li=>{
      li.addEventListener("click",()=>{startFreshTest();S.adaptLvl=S.lvlOverride||levelForAge(S.age);S.screen=li.dataset.part;render();});
    });
    const sb=document.getElementById("btn-subj-back");
    if(sb)sb.addEventListener("click",()=>{S.screen="subject";render();});
    const cb=document.getElementById("btn-curriculum");
    if(cb)cb.addEventListener("click",()=>{S.returnTo="menu";S.screen="curriculum";render();});
    const ml=document.getElementById("menu-levels");
    if(ml)ml.addEventListener("click",e=>{const b=e.target.closest(".pill");if(!b)return;
      S.lvlOverride=+b.dataset.lvl;S.adaptLvl=S.lvlOverride;
      if(S.phone)sSet("lvl:"+S.phone,S.lvlOverride);   // remember this student's level
      ml.querySelectorAll(".pill").forEach(x=>x.classList.toggle("pill-on",x===b));
      showToast("good","הרמה עודכנה ונשמרה");});
    document.getElementById("btn-start").addEventListener("click",()=>{startFreshTest();S.adaptLvl=S.lvlOverride||levelForAge(S.age);S.screen=curOrder()[0];render();});
    const rvb=document.getElementById("btn-review");
    if(rvb)rvb.addEventListener("click",()=>{S.screen="rv";render();});
    const lo=document.getElementById("btn-logout");
    if(lo)lo.addEventListener("click",doLogout);
    const ld=document.getElementById("btn-lead");
    if(ld)ld.addEventListener("click",()=>{S.screen="lead";render();});
  }
  if(S.screen==="paused"){
    const back=S.pausedFrom||curOrder()[0];
    document.getElementById("pz-resume").addEventListener("click",()=>{S.screen=back;render();});
    document.getElementById("pz-time").addEventListener("click",()=>{pauseAddTime(120);showToast("good","נוספו 2 דקות ⏱");S.screen=back;render();});
    const pl=document.getElementById("pz-levels");
    if(pl)pl.addEventListener("click",e=>{const b=e.target.closest(".pill");if(!b)return;
      const L=+b.dataset.lvl;S.lvlOverride=L;S.adaptLvl=L;
      if(S.phone)sSet("lvl:"+S.phone,L);   // remember this student's level
      pl.querySelectorAll(".pill").forEach(x=>x.classList.toggle("pill-on",x===b));
      showToast("good","הרמה תשתנה מהחלק הבא");});
    document.getElementById("pz-plan").addEventListener("click",()=>{S.screen="menu";render();});
    document.getElementById("pz-hub").addEventListener("click",()=>{S.screen="subject";render();});
    document.getElementById("pz-logout").addEventListener("click",doLogout);
  }
  if(S.screen==="done"){
    document.getElementById("btn-again").addEventListener("click",()=>{S.score=0;S.prog={};S.lastGain=null;S.screen="menu";render();});
    const other=document.getElementById("btn-other");
    if(other)other.addEventListener("click",()=>{S.score=0;S.prog={};S.lastGain=null;S.screen="subject";render();});
    launchConfetti();
    if((S.lastGain?.stars||0)>=2){
      SFX.good();
      // reward a good round with a short, kid-safe celebration clip
      showClip("done-clip",CELEBRATE_Q[Math.floor(Math.random()*CELEBRATE_Q.length)]);
    }
  }
}

function initPart(){
  if(curOrder().includes(S.screen))S.partStart=S.score;   // for adaptive accuracy
  if(S.screen==="p1")initVocab();
  else if(S.screen==="p2")initCloze();
  else if(S.screen==="p3")initReading();
  else if(S.screen==="p4")initDescribe();
  else if(S.screen==="p5")initMatch();
  else if(S.screen==="p6")initBalloons();
  else if(S.screen==="hv"||S.screen==="hw"||S.screen==="sv"||S.screen==="sw"||S.screen==="tv"||S.screen==="tw"||S.screen==="gv"||S.screen==="gw"||S.screen==="iv"||S.screen==="iw")initHebMC();
  else if(S.screen==="hb")initHebMatch();
  else if(S.screen==="wg")initWordGame();
  else if(S.screen==="hs")initHebLex();
  else if(S.screen==="hr"||S.screen==="sr"||S.screen==="tr"||S.screen==="gr"||S.screen==="ir")initReading();
  else if(S.screen==="sq"||S.screen==="tq"||S.screen==="lp"||S.screen==="lf"||S.screen==="ln"||S.screen==="gq"||S.screen==="iq")initSciQuiz();
  else if(S.screen[0]==="m"&&S.screen[1]==="a")initMath();
  else if(S.screen==="rv")initReview();
}

// ─── Session Helpers ──────────────────────────────────────
function saveSession(){
  // Only persist a session while the child is ON a real part screen. Saving
  // transient screens (menu/paused/catalog/parents/rv/lead/gplay/done) would
  // overwrite the saved part with a non-part screen — so pausing or going
  // home mid-part would lose the resume point (and the app would keep offering
  // to "resume" a menu). doPause/doHome save the part progress first, then
  // switch screens; this guard keeps that saved part intact.
  if(!S.phone||!curOrder().includes(S.screen))return;
  sSet(K.session(S.phone),{name:S.name,age:S.age,score:S.score,screen:S.screen,subject:S.subject,prog:S.prog,partCounts:S.partCounts,t:Date.now()});
}
function commitProg(slice){S.prog={...S.prog,...slice};saveSession();}
// Record one answered question so a parent can later review exactly what was
// asked and what the child answered. Fully defensive: never throws into
// gameplay, and self-caps so a long test can't bloat the synced payload.
function logAns(part,prompt,chosen,answer,ok){
  try{
    if(!Array.isArray(S.answerLog))S.answerLog=[];
    if(S.answerLog.length>=80)return;
    const clip=(v,n)=>String(v==null?"":v).slice(0,n);
    S.answerLog.push({t:part,p:clip(prompt,160),a:clip(chosen,80),k:clip(answer,80),ok:ok?1:0});
  }catch(e){}
}
// Begin a brand-new test: clear score/progress and the per-question log, and
// reset the active-time stopwatch so this test's duration starts at zero.
function startFreshTest(){
  S.score=0;S.prog={};S.answerLog=[];S.partCounts={};
  try{TT.sess=0;}catch(e){}
  try{childPushEnsure(true);}catch(e){}   // this tap is a good moment to enable reminders
}
// Randomise the option order of an index-based multiple-choice question so the
// correct answer isn't always in the same slot. Returns a NEW question with
// `o` permuted, `c` remapped, and any parallel vocalised options (`nq.o`) kept
// in step. Defensive: returns the question untouched if its shape is unexpected.
function shuffleOpts(q){
  try{
    if(!q||!Array.isArray(q.o)||q.o.length<2||typeof q.c!=="number")return q;
    const order=shuffle(q.o.map((_,i)=>i));
    const out={...q,o:order.map(i=>q.o[i]),c:order.indexOf(q.c)};
    if(q.nq&&Array.isArray(q.nq.o)&&q.nq.o.length===q.o.length)
      out.nq={...q.nq,o:order.map(i=>q.nq.o[i])};
    return out;
  }catch(e){return q;}
}
function addScore(n){
  S.score+=n;
  const el=document.getElementById("score-el");
  if(el)el.innerHTML=`${grade(S.score)}<small>/100</small>`;
  if(n>0)awardCoin(n);   // one coin per correct answer, shown live in the top bar
}
// Add coins and reflect the new total immediately in the top-bar chip, with a
// little pop + floating "+n" so the child SEES the coins being collected.
function awardCoin(n){
  const g=gamLoad();g.coins=(g.coins||0)+n;gamSave(g);
  const el=document.getElementById("coin-count");
  if(el){
    el.textContent=g.coins;
    const chip=el.closest(".chip");
    if(chip){chip.classList.remove("coin-pop");void chip.offsetWidth;chip.classList.add("coin-pop");
      const fly=document.createElement("span");fly.className="coin-fly";fly.textContent="+"+n+" 🪙";
      chip.appendChild(fly);setTimeout(()=>fly.remove(),900);}
  }
}

// ─── Toast ────────────────────────────────────────────────
function showToast(kind,text){
  let t=document.getElementById("app-toast");if(t)t.remove();
  t=document.createElement("div");t.id="app-toast";
  t.className=`toast toast-${kind}`;
  t.innerHTML=`<span class="toast-mark">${kind==="good"?"✓":kind==="info"?"💡":"✗"}</span><span>${esc(text)}</span>`;
  document.body.appendChild(t);
  setTimeout(()=>{if(t.parentNode)t.remove();},1600);
}

// ─── Part 1: Vocab ────────────────────────────────────────
function initVocab(){
  const saved=S.prog.vocab,lvl=curLevel();
  V.pool=nearLevel(VOCAB.filter(x=>x.e),lvl,6);  // picture prompt needs an emoji
  if(saved&&saved.round&&saved.round.length){V.round=saved.round;V.i=saved.i??0;}
  else{
    const fresh=V.pool.filter(x=>!S.seen.includes(x.w));
    const src=fresh.length>=QUOTA.vocab?fresh:V.pool;
    V.round=shuffle(src).slice(0,QUOTA.vocab).map(x=>x.w);V.i=0;
  }
  V.picked=null;
  setPartCount(V.round.length);
  renderVQ();
  TM.start(saved?.left??TIME.vocab,TIME.vocab,onVocabDone);
}

function renderVQ(){
  const w=V.round[V.i];
  V.item=V.pool.find(x=>x.w===w)||VOCAB.find(x=>x.w===w);
  if(!V.item)return;
  V.opts=shuffle([V.item,...shuffle(V.pool.filter(x=>x.w!==V.item.w)).slice(0,4)]);
  document.getElementById("q-ctr").textContent=`${V.i+1}/${V.round.length}`;
  showPic("q-pic",V.item);
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
  logAns("vocab",V.item.h||V.item.w,word,V.item.w,correct);
  if(correct){addScore(1);SFX.good();}else SFX.bad();
  speak(V.item.w);
  // if the picture is an animal, let it call out too (barks, moos, chirps…)
  const animal=animalForEmoji(V.item.e);
  if(animal)setTimeout(()=>SFX.animal(animal),correct?540:60);
  document.querySelectorAll("#q-opts .opt").forEach(btn=>{
    const bw=btn.dataset.word,mark=btn.querySelector(".mark");
    if(bw===V.item.w){btn.classList.add("opt-good");mark.textContent="✓";mark.className="mark good";mark.style.display="";}
    else if(bw===word&&!correct){btn.classList.add("opt-bad");mark.textContent="✗";mark.className="mark bad";mark.style.display="";}
    else btn.classList.add("opt-dim");
    btn.disabled=true;
  });
  // Hebrew-translation feedback for English up to grade ו (level ≤3): on a
  // correct pick show the word + its meaning; on a wrong pick show BOTH the
  // meaning of what they chose and the meaning of the correct word.
  const showTr=(S.subject==="english"&&curLevel()<=6);
  const hint=document.getElementById("q-hint");
  if(correct){
    if(showTr&&hint) hint.innerHTML=`<span class="fb-right"><b dir="ltr">${esc(V.item.w)}</b> = <b>${esc(V.item.h||"")}</b> ✓</span>`;
  }else{
    recordMiss({w:V.item.w,e:V.item.e,kind:"en"});
    const chosen=V.opts.find(o=>o.w===word)||VOCAB.find(o=>o.w===word);
    if(hint){
      const wrongTr=(showTr&&chosen)?`<span class="fb-wrong">בחרת <b dir="ltr">${esc(chosen.w)}</b> = ${esc(chosen.h||"?")}</span>`:"";
      const rightTr=showTr?` = <b>${esc(V.item.h||"")}</b>`:"";
      hint.innerHTML=`${wrongTr}<span class="fb-right">${esc(S.name)}, הנכונה: <b dir="ltr">${esc(V.item.w)}</b>${rightTr}</span>`;
    }
  }
  const sb=document.getElementById("btn-speak");sb.disabled=false;sb.onclick=()=>{speak(V.item.w);if(animal)SFX.animal(animal);};
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
  gotoNext("p1");   // → p2, and lets adaptive difficulty react to part 1
}

// ─── Part 2: Cloze ────────────────────────────────────────
function initCloze(){
  const saved=S.prog.cloze,lvl=curLevel();
  if(saved&&saved.id)C.item=CLOZE.find(x=>x.id===saved.id)||CLOZE[0];
  else{
    const pool=CLOZE.filter(x=>Math.abs(x.lvl-lvl)<=2);
    const src=pool.length?pool:CLOZE;
    C.item=pickFreshOne(src,"cloze");
  }
  C.bank  =saved?.bank??shuffle([...C.item.answers,...C.item.decoys]);
  C.filled=saved?.filled??{};
  C.used  =saved?.used??[];
  C.sel=null;C.num="";C.sheetN=null;
  document.getElementById("cloze-ttl").textContent=C.item.title;
  setPartCount((C.item.answers||[]).length);
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
    logAns("cloze","השלמת מילה מס' "+n,w,w,true);
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
// A reading question in its DISPLAYED option order (shuffled per R.ord), with
// the correct index remapped and niqqud options kept in step. Used by both the
// renderer and the answer handler so they always agree on slot ↔ answer.
function qDispFor(k){
  const nq=R.nq&&R.nq.nqpool&&R.nq.nqpool[k];
  const base=R.story.qpool[k];
  const o0=(nq&&nq.o)||base.o;
  const ord=(R.ord&&R.ord[k])||o0.map((_,i)=>i);
  return {q:(nq&&nq.q)||base.q, o:ord.map(i=>o0[i]), c:ord.indexOf(base.c)};
}
function initReading(){
  const saved=S.prog.reading,lvl=curLevel();
  const heRead=(S.screen==="hr"||S.screen==="sr"||S.screen==="tr"||S.screen==="gr"||S.screen==="ir");   // right-to-left Hebrew reading
  const set=(S.screen==="hr")?HEB_STORIES:(S.screen==="sr")?SCI_STORIES:(S.screen==="tr")?TORAH_STORIES:(S.screen==="gr")?GEO_STORIES:(S.screen==="ir")?HIST_STORIES:STORIES;
  const src0=set.length?set:STORIES;
  const qquota=heRead?PART_QUOTA[S.screen]:QUOTA.reading;
  if(saved&&saved.id)R.story=src0.find(x=>x.id===saved.id)||src0[0];
  else{
    const pool=src0.filter(x=>Math.abs(x.lvl-lvl)<=2);
    let src=pool.length?pool:src0;
    // young readers (grades א–ד): only serve passages that carry niqqud, so the
    // reading-comprehension text is always vocalized for them.
    if(S.screen==="hr" && lvl<=4){ const voc=src.filter(x=>HEB_NQ.stories[x.id]); if(voc.length) src=voc; }
    R.story=pickFreshOne(src,"story:"+S.screen);
  }
  R.rtl=heRead;
  R.nq=heRead?nqStory(R.story.id):null;   // vocalized story for young readers
  R.qIdx   =saved?.qIdx??shuffle(R.story.qpool.map((_,k)=>k)).slice(0,qquota);
  // per-question option permutation so the correct answer isn't always slot A;
  // keyed by qpool index and persisted so a resumed test keeps the same order
  R.ord    =saved?.ord??(()=>{const m={};R.qIdx.forEach(k=>{const q=R.story.qpool[k];m[k]=shuffle((q.o||[]).map((_,i)=>i));});return m;})();
  R.qi     =saved?.qi??0;
  R.reading=saved?.qi?false:true;
  R.picked =null;
  document.getElementById("story-ttl").textContent=R.story.title;
  setPartCount((R.qIdx||[]).length);
  refreshRV();
  const rt=TIME[heRead?S.screen:"reading"];
  TM.start(saved?.left??rt,rt,()=>gotoNext(S.screen));
}

function refreshRV(){
  const ctr=document.getElementById("q-ctr"),body=document.getElementById("reading-body");if(!body)return;
  const dir=R.rtl?"rtl":"ltr";
  const storyText=(R.nq&&R.nq.ntext)||R.story.text;
  // niqqud question/options for young Hebrew readers (fall back to plain)
  const qDisp=qDispFor;
  if(R.reading){
    if(ctr)ctr.textContent="";
    body.innerHTML=`<div class="story scroll" dir="${dir}">${storyText.split("\n\n").map(p=>`<p>${esc(p)}</p>`).join("")}</div>
${R.rtl?`<button class="ghost sm" id="btn-read-r">🔊 הקראה</button>`:""}
<button class="primary" id="btn-done-r">סיימתי לקרוא — לשאלות</button>`;
    const rr=document.getElementById("btn-read-r");
    if(rr)rr.addEventListener("click",()=>speakHe(storyText.replace(/\n+/g," ")));
    document.getElementById("btn-done-r").addEventListener("click",()=>{R.reading=false;refreshRV();});
  }else{
    const q=qDisp(R.qIdx[R.qi]);
    if(ctr)ctr.textContent=`${R.qi+1}/${R.qIdx.length}`;
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
  // read the question in its DISPLAYED (shuffled) option order so idx, the
  // correct index, and the logged answer all line up with what the child saw
  const q=qDispFor(R.qIdx[R.qi]);
  logAns("reading",q.q,(q.o||[])[idx],(q.o||[])[q.c],idx===q.c);
  if(idx===q.c){addScore(1);SFX.good();}else SFX.bad();
  document.querySelectorAll("#q-opts .opt").forEach(btn=>{
    const bi=parseInt(btn.dataset.idx,10),mark=btn.querySelector(".mark");
    if(bi===q.c){btn.classList.add("opt-good");mark.textContent="✓";mark.className="mark good";mark.style.display="";}
    else if(bi===idx&&idx!==q.c){btn.classList.add("opt-bad");mark.textContent="✗";mark.className="mark bad";mark.style.display="";}
    else btn.classList.add("opt-dim");
    btn.disabled=true;
  });
  commitProg({reading:{id:R.story.id,qIdx:R.qIdx,ord:R.ord,qi:R.qi,left:TM.left}});
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
  setPartCount((D.idxs||[]).length);
  renderDI();
  TM.start(saved?.left??TIME.pics,TIME.pics,()=>gotoNext("p4"));
}

function renderDI(){
  const item=PICTURES[D.idxs[D.i]];
  document.getElementById("q-ctr").textContent=`${D.i+1}/${D.idxs.length}`;
  showPic("q-pic",item);
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
  logAns("pics",item.he||("תיאור: "+item.ok[0]),val,item.ok[0],ok);
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

// The board must never contain two identical words OR two identical meanings:
// duplicates (e.g. both "געגוע" and "ערגה" defined as "כיסופים") render two
// identical right-hand cards, and the pair the child correctly picks is then
// rejected — leaving items that look matchable but can't be solved.
function dedupePairs(pairs){
  const w=new Set(), h=new Set(), out=[];
  for(const p of pairs||[]){
    const kw=String(p.w||"").trim(), kh=String(p.h||"").trim();
    if(!kw||!kh||w.has(kw)||h.has(kh))continue;
    w.add(kw);h.add(kh);out.push(p);
  }
  return out;
}
const _mDef=p=>String((p&&p.h)||"").trim();
// a right-hand card counts as solved when some solved left item carries the
// same meaning (compare by VALUE, never by index)
function rightSolvedJ(j){
  const t=_mDef(M.pairs[M.rightOrder[j]]);
  return [...M.solved].some(i=>_mDef(M.pairs[M.leftOrder[i]])===t);
}
function selectLeft(i){
  M.sel=(M.sel===i)?null:i;
  document.querySelectorAll(".mitem").forEach(b=>b.classList.toggle("sel",+b.dataset.i===M.sel));
}

function initMatch(){
  const saved=S.prog.match,lvl=curLevel();
  if(saved&&saved.pairs){M.pairs=saved.pairs;M.leftOrder=saved.leftOrder;M.rightOrder=saved.rightOrder;M.solved=new Set(saved.solved||[]);}
  else{
    const pool=nearLevel(VOCAB,lvl,QUOTA.match+6).filter(x=>x.h);
    M.pairs=dedupePairs(pickFresh(pool,"match:en",QUOTA.match+6,x=>x.w).map(x=>({w:x.w,h:x.h}))).slice(0,QUOTA.match);
    M.leftOrder=shuffle(M.pairs.map((_,k)=>k));
    M.rightOrder=shuffle(M.pairs.map((_,k)=>k));
    M.solved=new Set();
  }
  M.dragging=false;M.dragI=null;M.sel=null;
  setPartCount((M.pairs||[]).length);
  renderMatch();
  TM.start(saved?.left??TIME[S.screen==="hb"?"hb":"match"],TIME[S.screen==="hb"?"hb":"match"],()=>gotoNext(S.screen));
}

// Hebrew word ↔ Hebrew definition matching (reuses the match engine)
function initHebMatch(){
  const saved=S.prog.match,lvl=curLevel(),n=PART_QUOTA.hb;
  if(saved&&saved.pairs){M.pairs=saved.pairs;M.leftOrder=saved.leftOrder;M.rightOrder=saved.rightOrder;M.solved=new Set(saved.solved||[]);}
  else{
    const src=HEB_VOCAB.length?HEB_VOCAB:[{w:"בית",d:"מקום מגורים",lvl:3},{w:"שמח",d:"מרוצה",lvl:3},{w:"גדול",d:"רב־ממדים",lvl:3},{w:"מהיר",d:"זריז",lvl:3},{w:"יפה",d:"נאה",lvl:3},{w:"חכם",d:"נבון",lvl:3},{w:"קר",d:"צונן",lvl:3},{w:"חזק",d:"איתן",lvl:3}];
    const pool=nearLevel(src.filter(x=>x.d),lvl,n+6);
    M.pairs=dedupePairs(pickFresh(pool,"match:he",n+6,x=>x.w).map(x=>({w:x.w,h:x.d}))).slice(0,n);
    M.leftOrder=shuffle(M.pairs.map((_,k)=>k));
    M.rightOrder=shuffle(M.pairs.map((_,k)=>k));
    M.solved=new Set();
  }
  M.dragging=false;M.dragI=null;M.sel=null;
  setPartCount((M.pairs||[]).length);
  renderMatch();
  TM.start(saved?.left??TIME.hb,TIME.hb,()=>gotoNext(S.screen));
}

function renderMatch(){
  const L=document.getElementById("mcol-left"),Rr=document.getElementById("mcol-right");
  if(!L||!Rr)return;
  const heb=(S.screen==="hb");
  const wDisp=p=>heb?nqW(p.w):p.w;                 // Hebrew words get niqqud (young)
  const hDisp=p=>heb?nqD(p.w,p.h):p.h;
  L.innerHTML=M.leftOrder.map((pi,i)=>
    `<button class="mitem${M.solved.has(i)?" solved":""}${M.sel===i?" sel":""}" data-i="${i}" dir="${heb?"rtl":"ltr"}"><span>${esc(wDisp(M.pairs[pi]))}</span><i class="dot dot-r"></i></button>`).join("");
  Rr.innerHTML=M.rightOrder.map((pi,j)=>
    `<button class="ritem${rightSolvedJ(j)?" solved":""}" data-j="${j}"><i class="dot dot-l"></i><span>${esc(hDisp(M.pairs[pi]))}</span></button>`).join("");
  updateMatchCtr();
  const wrap=document.getElementById("match-wrap"),svg=document.getElementById("match-svg");
  [...svg.querySelectorAll(".match-line")].forEach(l=>l.remove());
  requestAnimationFrame(()=>{
    const used=new Set();
    [...M.solved].forEach(i=>{
      const t=_mDef(M.pairs[M.leftOrder[i]]);
      const j=M.rightOrder.findIndex((pi,jj)=>!used.has(jj)&&_mDef(M.pairs[pi])===t);
      if(j>=0){used.add(j);drawMatchLine(i,j);}
    });
  });
  // Tap-to-select: tap a word, then tap its meaning. Works alongside dragging
  // and, unlike dragging, leaves vertical scrolling to the page.
  const tapGuard=()=>{ if(wrap._moved){wrap._moved=false;return true;} return false; };
  L.onclick=e=>{const b=e.target.closest(".mitem");if(!b||b.classList.contains("solved")||tapGuard())return;selectLeft(+b.dataset.i);};
  Rr.onclick=e=>{const b=e.target.closest(".ritem");if(!b||b.classList.contains("solved")||tapGuard())return;
    if(M.sel==null){showToast("info","קודם בחר/י מילה מימין ✋");return;}
    attemptMatch(M.sel,+b.dataset.j);};
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
  if(M.solved.has(i)||rightSolvedJ(j))return;
  // compare the MEANINGS, not the indices, so an answer that is visibly correct
  // is always accepted
  const ok=_mDef(M.pairs[M.leftOrder[i]])===_mDef(M.pairs[M.rightOrder[j]]);
  M.sel=null;
  document.querySelectorAll(".mitem.sel").forEach(b=>b.classList.remove("sel"));
  if(ok){
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
  const saved=S.prog.balloons,lvl=curLevel();
  if(saved&&saved.pairs){B.pairs=saved.pairs;B.topOrder=saved.topOrder;B.botOrder=saved.botOrder;B.solved=new Set(saved.solved||[]);}
  else{
    const pool=nearLevel(VOCAB.filter(x=>x.e),lvl,QUOTA.balloons);
    B.pairs=pickFresh(pool,"balloons",QUOTA.balloons,x=>x.w).map(x=>({w:x.w,e:x.e,h:x.h}));
    B.topOrder=shuffle(B.pairs.map((_,k)=>k));
    B.botOrder=shuffle(B.pairs.map((_,k)=>k));
    B.solved=new Set();
  }
  B.dragging=false;B.dragI=null;
  setPartCount((B.pairs||[]).length);
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
    wrap._from=from;wrap._moved=false;wrap._x0=e.clientX;wrap._y0=e.clientY;setDragging(true);
    const a=ptFn(from);
    temp.setAttribute("x1",a.x);temp.setAttribute("y1",a.y);
    temp.setAttribute("x2",a.x);temp.setAttribute("y2",a.y);temp.style.display="";
    try{wrap.setPointerCapture(e.pointerId);}catch(_){}
    // NOTE: no preventDefault here — it would also cancel the page's vertical
    // scrolling. touch-action (CSS) already reserves horizontal drags for us.
  };
  wrap.onpointermove=e=>{
    if(!isDragging())return;
    if(Math.abs(e.clientX-(wrap._x0||0))>6||Math.abs(e.clientY-(wrap._y0||0))>6)wrap._moved=true;
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
// Number ranges per school grade, following the MoE "תחום המספר" ladder
// (100 in א׳ → 1,000 in ב׳ → 10,000 in ג׳ → מיליון in ד׳), kept one step below
// the domain so the drill stays mental arithmetic. Beyond ו׳ the operands stop
// growing — difficulty there comes from the other topics, not bigger numbers.
const MATH_RANGE={
  addsub : {1:20,2:100,3:1000,4:10000,5:100000,6:100000},
  muldiv : {1:5, 2:10, 3:10,  4:20,   5:25,    6:30},
  missing: {1:20,2:100,3:1000,4:1000, 5:10000, 6:100000},
};
const mathMax=(kind,g)=>MATH_RANGE[kind][Math.max(1,Math.min(6,g|0))] ?? MATH_RANGE[kind][6];
function _genMathQ(lvl,type){
  // lvl is the school grade; sub-generators convert it themselves — converting
  // here too would map it twice and make their upper branches unreachable.
  type=type||"addsub";
  const R=_mrand;
  if(type==="addsub"){
    const mx = mathMax("addsub",lvl);
    // keep the SUM inside the grade's number domain, not just each operand
    if(Math.random()<0.5){const x=R(1,mx-1),y=R(1,mx-x);return {t:`${x} + ${y}`,a:x+y,eq:true};}
    const x=R(2,mx),y=R(1,x);return {t:`${x} − ${y}`,a:x-y,eq:true};
  }
  if(type==="muldiv"){
    const top = mathMax("muldiv",lvl);
    if(Math.random()<0.5){const x=R(2,top),y=R(2,top);return {t:`${x} × ${y}`,a:x*y,eq:true};}
    const y=R(2,top),q=R(2,top);return {t:`${y*q} ÷ ${y}`,a:q,eq:true};
  }
  if(type==="missing"){
    const mx = mathMax("missing",lvl);
    // every number shown must stay inside the grade's domain — including the total
    if(Math.random()<0.5){const x=R(1,mx-1),y=R(1,mx-x);return {t:`${x} + ? = ${x+y}`,a:y,eq:false};}
    const x=R(2,mx),y=R(1,x-1);return {t:`${x} − ? = ${x-y}`,a:y,eq:false};
  }
  if(type==="frac") return _genFracQ(lvl);
  if(type==="geom") return _genGeomQ(lvl);
  return _genWordProblem(lvl);            // type === "word"
}
// ── Geometry & engineering (הנדסה וגיאומטריה) ──
// Grounded in the Israeli curriculum (גאומטריה ומדידות): shapes & properties,
// the four angle types, perimeter, area (rectangle/triangle/parallelogram/
// trapezoid), 3-D solids (faces/edges/vertices), volume, symmetry, Pythagoras.
function _genGeomQ(lvl){
  lvl=gradeTier(lvl);
  const R=_mrand, pick=a=>a[R(0,a.length-1)];
  const T=[];
  if(lvl<=1){
    T.push(
      ()=>{const s=pick([["מְשֻׁלָּשׁ","משולש",3],["מְרֻבָּע","מרובע",4],["מְחֻמָּשׁ","מחומש",5],["מְשֻׁשֶּׁה","משושה",6]]);
        return {t:`כמה צלעות יש ל${s[1]}?`,a:s[2],rtl:true};},
      ()=>{const s=pick([["ריבוע",4],["משולש",3],["מלבן",4],["מחומש",5]]);
        return {t:`כמה פינות (קדקודים) יש ל${s[0]}?`,a:s[1],rtl:true};},
      ()=>({t:"לאיזו צורה יש 3 צלעות?",opts:shuffle(["משולש","ריבוע","עיגול","מלבן"]),ans:"משולש",rtl:true}),
      ()=>({t:"לאיזו צורה אין פינות כלל?",opts:shuffle(["עיגול","ריבוע","משולש","מלבן"]),ans:"עיגול",rtl:true}),
      ()=>({t:"כמה זוויות ישרות יש בריבוע?",a:4,rtl:true}),
    );
  } else if(lvl===2){
    T.push(
      ()=>{const w=R(2,12),h=R(2,12);return {t:`למלבן אורך ${w} ורוחב ${h} ס״מ. מה ההיקף?`,a:2*(w+h),rtl:true};},
      ()=>{const s=R(3,15);return {t:`לריבוע צלע ${s} ס״מ. מה ההיקף?`,a:4*s,rtl:true};},
      ()=>{const a=R(3,9),b=R(3,9);                         // third side kept within
           const lo=Math.abs(a-b)+1,hi=a+b-1,c=R(Math.max(2,lo),Math.max(Math.max(2,lo),Math.min(12,hi)));
           return {t:`למשולש צלעות ${a}, ${b} ו-${c} ס״מ. מה ההיקף?`,a:a+b+c,rtl:true};},
      ()=>{const z=pick([[90,"זווית ישרה"],[45,"זווית חדה"],[30,"זווית חדה"],[120,"זווית קהה"],[150,"זווית קהה"],[180,"זווית שטוחה"]]);
        return {t:`זווית של ${z[0]} מעלות היא…`,opts:shuffle(["זווית ישרה","זווית חדה","זווית קהה","זווית שטוחה"]),ans:z[1],rtl:true};},
      ()=>{const s=pick([["ריבוע","4"],["מלבן","2"],["משולש שווה־צלעות","3"]]);
        return {t:`כמה צירי סימטריה יש ל${s[0]}?`,opts:shuffle(["1","2","3","4"]),ans:s[1],rtl:true};},
      ()=>({t:"כמה פאות יש לקובייה?",a:6,rtl:true}),
      ()=>({t:"כמה מקצועות (צלעות) יש לקובייה?",a:12,rtl:true}),
      ()=>({t:"כמה קדקודים יש לקובייה?",a:8,rtl:true}),
    );
  } else if(lvl===3){
    T.push(
      ()=>{const w=R(3,14),h=R(2,12);return {t:`למלבן אורך ${w} ורוחב ${h} ס״מ. מה השטח?`,a:w*h,rtl:true};},
      ()=>{const s=R(3,12);return {t:`לריבוע צלע ${s} ס״מ. מה השטח?`,a:s*s,rtl:true};},
      ()=>{const b=R(3,12),h=R(1,6)*2;return {t:`למשולש בסיס ${b} ס״מ וגובה ${h} ס״מ. מה השטח? (בסיס×גובה÷2)`,a:b*h/2,rtl:true};},
      ()=>{const l=R(2,8),w=R(2,8),h=R(2,8);return {t:`לתיבה מידות ${l}×${w}×${h} ס״מ. מה הנפח?`,a:l*w*h,rtl:true};},
      ()=>{const s=R(2,7);return {t:`לקובייה צלע ${s} ס״מ. מה הנפח? (צלע בשלישית)`,a:s*s*s,rtl:true};},
    );
  } else if(lvl===4){
    T.push(
      ()=>{const a=R(30,80),b=R(30,90);return {t:`במשולש שתי זוויות הן ${a}° ו-${b}°. מה הזווית השלישית? (סכום=180°)`,a:180-a-b,rtl:true};},
      ()=>{const base=R(3,14),h=R(2,10);return {t:`למקבילית בסיס ${base} וגובה ${h} ס״מ. מה השטח? (בסיס×גובה)`,a:base*h,rtl:true};},
      ()=>{const a=R(3,10),b=R(3,10),h=R(1,5)*2;return {t:`לטרפז בסיסים ${a} ו-${b} וגובה ${h} ס״מ. מה השטח? ((סכום הבסיסים)×גובה÷2)`,a:(a+b)*h/2,rtl:true};},
      ()=>{const tr=pick([[3,4,5],[6,8,10],[5,12,13],[8,15,17],[9,12,15]]);return {t:`במשולש ישר־זווית הניצבים ${tr[0]} ו-${tr[1]} ס״מ. מה אורך היתר? (משפט פיתגורס)`,a:tr[2],rtl:true};},
      ()=>{const l=R(3,12),w=R(2,10),h=R(2,10);return {t:`לתיבה מידות ${l}×${w}×${h} ס״מ. מה הנפח?`,a:l*w*h,rtl:true};},
    );
  } else {
    T.push(
      ()=>{const r=R(2,12);return {t:`למעגל רדיוס ${r} ס״מ. מה ההיקף? (2·π·r, π≈3)`,a:6*r,rtl:true};},
      ()=>{const r=R(2,10);return {t:`למעגל רדיוס ${r} ס״מ. מה השטח? (π·r², π≈3)`,a:3*r*r,rtl:true};},
      ()=>{const tr=pick([[3,4,5],[6,8,10],[5,12,13],[8,15,17],[7,24,25],[20,21,29]]);return {t:`במשולש ישר־זווית הניצבים ${tr[0]} ו-${tr[1]}. מה היתר? (פיתגורס)`,a:tr[2],rtl:true};},
      ()=>{const a=R(40,80),b=R(40,80);return {t:`במשולש שתי זוויות ${a}° ו-${b}°. מה השלישית?`,a:180-a-b,rtl:true};},
      ()=>{const r=R(2,8),h=R(2,10);return {t:`לגליל רדיוס ${r} וגובה ${h} ס״מ. מה הנפח? (π·r²·h, π≈3)`,a:3*r*r*h,rtl:true};},
    );
  }
  return pick(T)();
}
// ── Fractions (שברים): grows from "a fraction of a whole" up to +−×÷ of fractions
const _gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){const t=a%b;a=b;b=t;}return a||1;};
function _fr(n,d){const g=_gcd(n,d);n=n/g;d=d/g;return d===1?String(n):`${n}/${d}`;}
function _fracOpts(n,d){
  const ans=_fr(n,d),set=new Set([ans]);
  const cands=[[n+d,d],[n,d+1],[n+1,d],[Math.max(1,n-1),d],[n,Math.max(2,d-1)],[n+1,d+1],[d,Math.max(1,n)]];
  for(const [a,b] of cands){ if(set.size>=4)break; const f=_fr(a,b); if(f!==ans&&!set.has(f))set.add(f); }
  let k=2; while(set.size<4){ set.add(_fr(n+k,d)); k++; if(k>20)break; }
  return shuffle([...set]).slice(0,4);
}
function _genFracQ(lvl){
  lvl=gradeTier(lvl);
  const R=_mrand;
  if(lvl<=2){                                   // "רבע מ-12" → whole-number answer
    const opts=lvl<=1?[[2,"חצי"],[4,"רבע"]]:[[2,"חצי"],[3,"שליש"],[4,"רבע"]];
    const [d,name]=opts[R(0,opts.length-1)],q=R(2,9),whole=d*q;
    return {t:`כמה זה ${name} מ-${whole}?`,a:q,rtl:true,eq:false};
  }
  let rn,rd,t;
  if(lvl===3){                                  // same-denominator add / subtract, or simplify
    const d=R(3,9);
    if(Math.random()<0.4){const g=R(2,4),n=R(1,d-1);rn=n;rd=d;t=`${n*g}/${d*g}`;return {t:`כמה זה ${t} בצורה מצומצמת?`,rtl:false,frac:true,ans:_fr(rn,rd),opts:_fracOpts(rn,rd)};}
    const a=R(1,d-1),b=R(1,d-1);
    if(Math.random()<0.5){rn=a+b;rd=d;t=`${a}/${d} + ${b}/${d}`;}
    else{const hi=Math.max(a,b),lo=Math.min(a,b);rn=hi-lo;rd=d;t=`${hi}/${d} − ${lo}/${d}`;}
  }else if(lvl===4){                            // different denominators: add or multiply
    const d1=R(2,5),n1=R(1,d1-1),d2=R(2,5),n2=R(1,d2-1);
    if(Math.random()<0.5){rn=n1*n2;rd=d1*d2;t=`${n1}/${d1} × ${n2}/${d2}`;}
    else{rn=n1*d2+n2*d1;rd=d1*d2;t=`${n1}/${d1} + ${n2}/${d2}`;}
  }else{                                        // lvl 5 — fraction division & mixed
    const d1=R(2,6),n1=R(1,d1),d2=R(2,6),n2=R(1,d2);
    rn=n1*d2;rd=d1*n2;t=`${n1}/${d1} ÷ ${n2}/${d2}`;
  }
  return {t,rtl:false,frac:true,ans:_fr(rn,rd),opts:_fracOpts(rn,rd)};
}

function _genWordProblem(lvl){
  // scaled by school grade, following the same number domain as the drills
  const R=_mrand, big = mathMax("missing",lvl);
  const tmpls=[
    ()=>{const a=R(18,34),b=R(1,Math.min(a-1,12));return {t:`בכיתה יש ${a} תלמידים. ${b} מהם יצאו להפסקה. כמה תלמידים נשארו בכיתה?`,a:a-b};},
    ()=>{const a=R(3,big),b=R(1,big);return {t:`לרוני יש ${a} שקלים, והוא קיבל עוד ${b} שקלים. כמה שקלים יש לו עכשיו?`,a:a+b};},
    ()=>{const per=R(2,9),g=R(2,9);return {t:`בכל שולחן יושבים ${per} ילדים, ויש ${g} שולחנות. כמה ילדים בסך הכול?`,a:per*g};},
    ()=>{const per=R(2,9),g=R(2,9);return {t:`${per*g} עפרונות חולקו שווה בשווה ל-${g} ילדים. כמה עפרונות קיבל כל ילד?`,a:per};},
    ()=>{const price=R(3,Math.max(4,Math.min(25,Math.round(big/8)))),n=R(2,9);return {t:`מחיר מחברת אחת הוא ${price} שקלים. כמה יעלו ${n} מחברות?`,a:price*n};},
    ()=>{const start=R(8,Math.max(12,Math.min(60,big))),ate=R(2,Math.min(start-1,9));return {t:`בקופסה היו ${start} עוגיות, ודנה אכלה ${ate}. כמה עוגיות נשארו?`,a:start-ate};},
  ];
  // ── Curriculum strands: גאומטריה ומדידות + חקר נתונים (משרד החינוך) ──
  // From grade ג׳ (level 2) up: perimeter/area, measurement units, average & data.
  if(lvl>=2){
    tmpls.push(
      ()=>{const w=R(2,12),h=R(2,12);return {t:`למלבן אורך ${w} ס״מ ורוחב ${h} ס״מ. מה היקף המלבן?`,a:2*(w+h)};},
      ()=>{const s=R(2,15);return {t:`לריבוע צלע באורך ${s} ס״מ. מה היקף הריבוע?`,a:4*s};},
      ()=>{const m=R(1,9);return {t:`כמה סנטימטרים יש ב-${m} מטרים?`,a:m*100};},
      ()=>{const h=R(1,8);return {t:`כמה דקות יש ב-${h} שעות?`,a:h*60};},
      ()=>{const a=R(2,20),b=R(2,20),c=R(2,20);const s=a+b+c;return {t:`בשלושה ימים נמכרו ${a}, ${b} ו-${c} כרטיסים. כמה כרטיסים נמכרו בסך הכול?`,a:s};},
    );
  }
  // ── added strands: מדידות, כסף, סדרות, זוגיות, השוואה, עיגול, זמן ──
  if(lvl>=2){
    tmpls.push(
      // number sequences — read the step and continue it
      ()=>{const st=R(2,5),a0=R(1,9),n=a0+st*4;return {t:`${a0}, ${a0+st}, ${a0+st*2}, ${a0+st*3}, ?`,a:n};},
      // odd / even recognition (four candidates, one of the requested parity)
      ()=>{const even=Math.random()<0.5;
           const pick=()=>R(1,Math.min(90,Math.max(10,big)));
           let ans=pick(); while((ans%2===0)!==even)ans=pick();
           const o=new Set([ans]); while(o.size<4){const d=pick(); if((d%2===0)!==even)o.add(d);}
           return {t:`איזה מספר ${even?"זוגי":"אי-זוגי"}?`,opts:shuffle([...o].map(String)),ans:String(ans),rtl:true};},
      // comparing magnitudes
      ()=>{const o=new Set(); while(o.size<4)o.add(R(2,Math.max(20,Math.min(999,big))));
           const arr=[...o],mx=Math.max(...arr);
           return {t:`איזה מספר הגדול ביותר?`,opts:shuffle(arr.map(String)),ans:String(mx),rtl:true};},
      // calendar facts
      ()=>{const w=R(2,9);return {t:`כמה ימים יש ב-${w} שבועות?`,a:w*7};},
      ()=>{const y=R(2,6);return {t:`כמה חודשים יש ב-${y} שנים?`,a:y*12};},
      // elapsed time on the clock
      ()=>{const m=R(1,9)*5,st=R(1,10);return {t:`שיעור התחיל ב-${st}:00 ונמשך ${m} דקות. כמה דקות נשארו עד השעה ${st+1}:00?`,a:60-m};},
    );
  }
  if(lvl>=3){
    tmpls.push(
      // money — change from a payment
      ()=>{const cost=R(7,Math.max(12,Math.min(95,big)));
           let paid=Math.ceil(cost/10)*10+R(0,1)*10; if(paid<=cost)paid+=10;   // always give change
           return {t:`קנית ב-${cost} שקלים ושילמת ב-${paid} שקלים. כמה עודף תקבל?`,a:paid-cost};},
      // volume
      ()=>{const l=R(2,9);return {t:`כמה מיליליטרים יש ב-${l} ליטרים?`,a:l*1000};},
      // weight, the other way round
      ()=>{const g=R(2,9);return {t:`כמה גרמים יש ב-${g} חצאי קילוגרם?`,a:g*500};},
    );
  }
  if(lvl>=4){
    tmpls.push(
      // rounding
      ()=>{const n=R(21,Math.max(99,Math.min(999,big)));return {t:`עגל/י את ${n} לעשרת הקרובה`,a:Math.round(n/10)*10};},
      ()=>{const n=R(120,Math.max(200,Math.min(9999,big)));return {t:`עגל/י את ${n} למאה הקרובה`,a:Math.round(n/100)*100};},
      // fraction of a quantity, in words
      ()=>{const d=R(2,5),q=R(2,12);return {t:`${d===2?"חצי":d===3?"שליש":d===4?"רבע":"חמישית"} מ-${d*q} שקלים הוא…`,a:q};},
    );
  }
  if(lvl>=3){
    tmpls.push(
      ()=>{const w=R(2,14),h=R(2,14);return {t:`למלבן אורך ${w} ס״מ ורוחב ${h} ס״מ. מה שטח המלבן?`,a:w*h};},
      ()=>{const s=R(2,12);return {t:`לריבוע צלע באורך ${s} ס״מ. מה שטח הריבוע?`,a:s*s};},
      ()=>{const n=R(3,4),base=R(4,20);const nums=Array.from({length:n},(_,i)=>base+i*R(1,4));const sum=nums.reduce((x,y)=>x+y,0);const avg=Math.round(sum/n);const adj=nums.slice();adj[0]+= (avg*n-sum);return {t:`הציונים היו ${adj.join(", ")}. מה הממוצע?`,a:Math.round(adj.reduce((x,y)=>x+y,0)/n)};},
      ()=>{const km=R(1,9);return {t:`כמה מטרים יש ב-${km} קילומטרים?`,a:km*1000};},
      ()=>{const kg=R(1,9);return {t:`כמה גרמים יש ב-${kg} קילוגרמים?`,a:kg*1000};},
    );
  }
  const q=tmpls[R(0,tmpls.length-1)]();
  q.rtl=true; q.eq=false; return q;
}
function initMath(){
  const scr=S.screen,cfg=MATH_CFG[scr]||MATH_CFG.ma1;
  const saved=S.prog[scr],lvl=curLevel(),n=PART_QUOTA[scr]||10,t=TIME[scr]??300;
  if(saved&&saved.qs){MA.qs=saved.qs;MA.i=saved.i||0;}
  else{MA.qs=Array.from({length:n},()=>_genMathQ(lvl,cfg.type));MA.i=0;}
  MA.picked=false;
  setPartCount(MA.qs.length);
  renderMathQ();
  TM.start(saved?.left??t,t,()=>gotoNext(scr));
}
function renderMathQ(){
  const q=MA.qs[MA.i];
  MA.opts=q.opts?q.opts:_mkOpts(q.a);   // explicit options (fractions, geometry) or numeric
  document.getElementById("q-ctr").textContent=`${MA.i+1}/${MA.qs.length}`;
  document.getElementById("math-q").innerHTML = q.rtl
    ? `<span dir="rtl" class="math-word">${esc(q.t)}</span>`
    : `<span dir="ltr">${esc(q.t)}${q.eq?" =":q.frac?" =":""}</span>`;
  document.getElementById("q-opts").innerHTML=MA.opts.map(o=>
    `<button class="opt opt-center" data-val="${esc(String(o))}"><span dir="ltr">${esc(String(o))}</span><span class="mark" style="display:none"></span></button>`).join("");
  MA.picked=false;
  document.getElementById("q-opts").onclick=e=>{
    const b=e.target.closest(".opt");if(!b||b.disabled||MA.picked)return;
    handleMA(b.dataset.val);
  };
}
function handleMA(val){
  if(MA.picked)return;MA.picked=true;
  const q=MA.qs[MA.i];
  const isAns=b=>q.opts?(b===q.ans):(Math.abs(parseFloat(b)-q.a)<1e-9);
  const correct=isAns(val);
  logAns("math",q.t,val,q.opts?q.ans:q.a,correct);
  if(correct){addScore(1);SFX.good();}else SFX.bad();
  document.querySelectorAll("#q-opts .opt").forEach(b=>{
    const bv=b.dataset.val,mk=b.querySelector(".mark");
    if(isAns(bv)){b.classList.add("opt-good");mk.textContent="✓";mk.className="mark good";mk.style.display="";}
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

// ─── Review my mistakes (bonus practice, not part of the graded flow) ────────
function rvHTML(){
  return `<section class="card">
  <div class="part-bar">
    <div><span class="eyebrow">תרגול הטעויות שלי</span><p class="lead">חזרה על מה שפספסת</p></div>
    <div class="bar-side"><span class="counter" id="q-ctr"></span></div>
  </div>
  <div class="mc-prompt" id="rv-prompt"></div>
  <div class="opts" id="q-opts"></div>
  <button class="ghost" id="btn-rv-exit">↩ חזרה לתפריט</button>
</section>`;
}
function initReview(){
  const items=missLoad();
  if(!items.length){S.screen="menu";render();return;}
  const pool=[...new Set(items.map(x=>x.w))];
  const extra=((S.subject==="hebrew"||S.subject==="science")?subjVocab().map(x=>x.w):VOCAB.map(x=>x.w));
  RV.items=items.slice(0,12);
  RV.qs=RV.items.map(it=>{
    const answer=it.w;
    const cands=shuffle([...new Set([...pool,...extra])].filter(w=>w!==answer));
    return {w:answer, prompt: it.kind==="he"?(it.d||it.w):(it.e||it.w), en: it.kind!=="he", o:shuffle([answer,...cands.slice(0,3)])};
  });
  RV.i=0;RV.picked=false;RV.fixed=0;
  document.getElementById("btn-rv-exit").onclick=()=>{S.screen="menu";render();};
  renderReviewQ();
}
function renderReviewQ(){
  if(RV.i>=RV.qs.length){
    showToast("good",RV.fixed?`תיקנת ${RV.fixed} מילים! 🎉`:"כל הכבוד!");
    setTimeout(()=>{if(S.screen==="rv"){S.screen="menu";render();}},1400);return;
  }
  const q=RV.qs[RV.i];
  document.getElementById("q-ctr").textContent=`${RV.i+1}/${RV.qs.length}`;
  const isEmoji=q.en&&/\p{Extended_Pictographic}/u.test(q.prompt);
  document.getElementById("rv-prompt").innerHTML=isEmoji
    ?`<span style="font-size:64px">${q.prompt}</span>`
    :`<span dir="${q.en?"ltr":"rtl"}">${esc(q.prompt)}</span>`;
  document.getElementById("q-opts").innerHTML=q.o.map(o=>
    `<button class="opt" data-val="${esc(o)}" dir="ltr"><span>${esc(o)}</span><span class="mark" style="display:none"></span></button>`).join("");
  RV.picked=false;
  document.getElementById("q-opts").onclick=e=>{const b=e.target.closest(".opt");if(!b||b.disabled||RV.picked)return;handleReview(b.dataset.val);};
}
function handleReview(val){
  if(RV.picked)return;RV.picked=true;
  const q=RV.qs[RV.i],correct=val===q.w;
  if(correct){SFX.good();clearMiss(q.w);RV.fixed++;awardCoin(1);const g=gamLoad();g.xp=(g.xp||0)+5;gamSave(g);}
  else SFX.bad();
  document.querySelectorAll("#q-opts .opt").forEach(b=>{
    const bv=b.dataset.val,mk=b.querySelector(".mark");
    if(bv===q.w){b.classList.add("opt-good");mk.textContent="✓";mk.className="mark good";mk.style.display="";}
    else if(bv===val&&!correct){b.classList.add("opt-bad");mk.textContent="✗";mk.className="mark bad";mk.style.display="";}
    else b.classList.add("opt-dim");
    b.disabled=true;
  });
  setTimeout(()=>{if(S.screen!=="rv")return;RV.picked=false;RV.i++;renderReviewQ();},1100);
}

// ─── Leaderboard (uses the learning backend) ─────────────────────────────────
function leadHTML(){
  return `<section class="card">
  <div class="menu-head"><button class="ghost sm" id="btn-lead-back">↩ תפריט</button><span class="eyebrow">🏆 לוח מובילים · ${esc(curSubject().name)}</span></div>
  <div id="lead-body"><p class="foot">טוען…</p></div>
</section>`;
}
function loadLeaderboard(){
  const back=document.getElementById("btn-lead-back");if(back)back.onclick=()=>{S.screen="menu";render();};
  const el=document.getElementById("lead-body");if(!el)return;
  if(!BACKEND){el.innerHTML='<p class="foot">לוח המובילים זמין כשהאפליקציה מחוברת לשרת.</p>';return;}
  fetch(BACKEND+"/api/leaderboard?subject="+encodeURIComponent(S.subject))
    .then(r=>r.json()).then(j=>{
      const box=document.getElementById("lead-body");if(!box)return;
      const top=(j&&j.top)||[];
      if(!top.length){box.innerHTML='<p class="foot">אין עדיין תוצאות — תהיה/י הראשון/ה! 🎯</p>';return;}
      const me=(S.name||"").split(" ")[0];
      const medal=i=>i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`;
      box.innerHTML=`<ol class="lead-list">${top.map((r,i)=>
        `<li class="lead-row${r.name===me?" me":""}"><span class="lead-rank">${medal(i)}</span><span class="lead-name">${esc(r.name)}</span><b class="lead-grade">${r.grade}/100</b></li>`).join("")}</ol>`;
    }).catch(()=>{const box=document.getElementById("lead-body");if(box)box.innerHTML='<p class="foot">לא ניתן לטעון כרגע.</p>';});
}

// ─── Actions ──────────────────────────────────────────────
function doEnter(){
  if(!S.name.trim()||S.phone.length<9||S.busy)return;
  S.busy=true;
  const be=document.getElementById("btn-enter");
  if(be){be.disabled=true;be.textContent="רגע…";}
  const ses=sGet(K.session(S.phone)),hist=sGet(K.results(S.phone)),seen=sGet(K.seen(S.phone));
  S.history=hist||[];S.seen=seen||[];S.busy=false;
  S.parentCode=sGet("pcode:"+S.phone)||"";
  S.avatar=sGet("avatar:"+S.phone)||S.avatar;
  sSet("avatar:"+S.phone,S.avatar);
  const savedLvl=sGet("lvl:"+S.phone);   // a level the student picked earlier sticks
  if(savedLvl){S.lvlOverride=savedLvl;S.adaptLvl=savedLvl;}
  // remember this student on THIS device so they skip login next time
  sSet("me",{name:S.name,phone:S.phone,subject:S.subject,avatar:S.avatar,age:S.age});
  syncRegister();
  syncFetchResults();   // pull any results saved from other devices
  if(ses&&ses.screen&&ses.screen!=="done"){S.found=ses;S.screen="resume";}
  else{S.prog={};S.score=0;S.screen="menu";}   // subject already chosen on the login screen
  render();
}

function doResume(){
  const f=S.found;
  S.name=f.name||S.name;S.age=f.age||S.age;S.score=f.score||0;
  S.subject=f.subject||"english";
  S.partCounts=f.partCounts||{};
  S.prog=f.prog||{};S.screen=f.screen;S.found=null;render();
}

function doFresh(){
  sDel(K.session(S.phone));S.prog={};S.score=0;S.found=null;S.screen="subject";render();
}

function saveCurrentProg(){
  if(S.screen==="p1"&&V.item)commitProg({vocab:{round:V.round,i:V.i,left:TM.left}});
  else if(S.screen==="p2"&&C.item)commitProg({cloze:{id:C.item.id,bank:C.bank,filled:C.filled,used:C.used,left:TM.left}});
  else if(S.screen==="p3"&&R.story)commitProg({reading:{id:R.story.id,qIdx:R.qIdx,ord:R.ord,qi:R.qi,left:TM.left}});
  else if(S.screen==="p4"&&D.idxs)commitProg({pics:{idxs:D.idxs,i:D.i,left:TM.left}});
  else if((S.screen==="p5"||S.screen==="hb")&&M.pairs)commitProg({match:matchState()});
  else if(S.screen==="p6"&&B.pairs)commitProg({balloons:balloonState()});
  else if(S.screen[0]==="m"&&S.screen[1]==="a"&&MA.qs)commitProg({[S.screen]:mathState()});
  else if((S.screen==="hv"||S.screen==="hw"||S.screen==="sv"||S.screen==="sw"||S.screen==="tv"||S.screen==="tw"||S.screen==="gv"||S.screen==="gw"||S.screen==="iv"||S.screen==="iw")&&HM.qs)commitProg({[S.screen]:{qs:HM.qs,i:HM.i,left:TM.left}});
  else if(S.screen==="wg"&&WG.qs)commitProg({wg:{qs:WG.qs,i:WG.i,left:TM.left}});
  else if(S.screen==="hs"&&HL.qs)commitProg({hs:{qs:HL.qs,i:HL.i,left:TM.left}});
  else if((S.screen==="sq"||S.screen==="tq"||S.screen==="lp"||S.screen==="lf"||S.screen==="ln"||S.screen==="gq"||S.screen==="iq")&&SQ.qs)commitProg({[S.screen]:{qs:SQ.qs,i:SQ.i,left:TM.left}});
  else if((S.screen==="hr"||S.screen==="sr"||S.screen==="tr"||S.screen==="gr"||S.screen==="ir")&&R.story)commitProg({reading:{id:R.story.id,qIdx:R.qIdx,ord:R.ord,qi:R.qi,left:TM.left}});
}
// which S.prog key holds a given part's saved state (for the "+time" feature)
function progKeyFor(scr){
  return ({p1:"vocab",p2:"cloze",p3:"reading",p4:"pics",p5:"match",hb:"match",
           p6:"balloons",hr:"reading",sr:"reading",tr:"reading",wg:"wg"})[scr] || scr;
}
function pauseAddTime(sec){
  const k=progKeyFor(S.pausedFrom);
  if(S.prog[k]) S.prog[k].left=(S.prog[k].left||0)+sec;
}
function doPause(){
  TM.stop();saveCurrentProg();
  S.pausedFrom=S.screen;
  S.screen="paused";render();
}
function doHome(){
  TM.stop();saveCurrentProg();
  S.screen="menu";render();
}

function finish(){
  TM.stop();
  const g=grade(S.score);
  const dur=Math.max(0,Math.round(TT.sess||0));
  const detail=Array.isArray(S.answerLog)?S.answerLog.slice(0,80):[];
  // keep dur/detail only on the synced copy — local history stays lean
  const rec={t:Date.now(),name:S.name,subject:S.subject,lvl:levelForAge(S.age),correct:S.score,total:askedTotal(),g};
  S.history=[rec,...S.history].slice(0,30);
  sSet(K.results(S.phone),S.history);sDel(K.session(S.phone));
  syncResult({...rec,dur,detail});
  TT.sync();   // flush the day's minutes now that a test just ended
  S.lastGain=gamAward(g,S.score);
  S.prog={};S.screen="done";render();
  SFX._clip("celebrate",0.45);   // real recorded celebration jingle
}

// ─── Boot ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded",()=>{
  const me=sGet("me");
  if(me&&me.phone&&me.name){
    // auto-login the remembered student — but land on the HOME hub, not
    // straight into a subject's plan or an exam. Restore their data first.
    S.name=me.name;S.phone=me.phone;S.subject=me.subject||"english";
    S.avatar=me.avatar||S.avatar;S.age=me.age||S.age;
    S.history=sGet(K.results(S.phone))||[];
    S.seen=sGet(K.seen(S.phone))||[];
    S.parentCode=sGet("pcode:"+S.phone)||"";
    const savedLvl=sGet("lvl:"+S.phone);   // restore a previously chosen level
    if(savedLvl){S.lvlOverride=savedLvl;S.adaptLvl=savedLvl;}
    syncRegister();
    syncFetchResults();   // pull any results saved from other devices
    const ses=sGet(K.session(S.phone));
    if(ses&&ses.screen&&ses.screen!=="done"){S.found=ses;S.screen="resume";}
    else S.screen="subject";   // the main home hub
    render();
  }else render();
  TT.start();   // begin counting daily time-on-task
  childPushEnsure(false);   // silently (re)subscribe this device if already allowed
  // flush the day's minutes when the app is backgrounded or closed
  const flush=()=>{try{if(document.visibilityState==="hidden")TT.sync();}catch(e){}};
  document.addEventListener("visibilitychange",flush);
  window.addEventListener("pagehide",()=>{try{TT.sync();}catch(e){}});
});
function doLogout(){
  sDel("me");
  S.name="";S.phone="";S.history=[];S.seen=[];S.prog={};S.score=0;S.found=null;S.lastGain=null;
  S.screen="login";render();
}

// Install the app on the device (PWA). Uses the native prompt when the
// browser offers it; otherwise shows platform "Add to Home Screen" steps.
// login: not registered yet → show an inline error and jump to the fields
function loginNeedRegister(){
  const err=document.getElementById("form-err");
  if(err){err.textContent="כדי להתחיל צריך להירשם — מלאו שם ומספר טלפון 👇";err.style.display="";}
  const form=document.getElementById("home-form");
  if(form){form.classList.remove("shake");void form.offsetWidth;form.classList.add("shake");
    form.scrollIntoView({behavior:"smooth",block:"center"});}
  const which=!S.name.trim()?"inp-name":"inp-phone";
  const inp=document.getElementById(which);if(inp)setTimeout(()=>{try{inp.focus();}catch(e){}},350);
}
// build the parent tracking link (student phone + parent code prefilled)
function parentTrackLink(){
  const base=(BACKEND||location.origin).replace(/\/+$/,"");
  return base+"/parent?s="+encodeURIComponent(S.phone)+"&c="+encodeURIComponent(S.parentCode||"");
}
// send the parent a link + code via the phone's own SMS composer (no gateway).
// The parent's number must differ from the child's local number.
function sendParentLink(){
  const inp=document.getElementById("par-send-phone"), errEl=document.getElementById("par-send-err");
  if(errEl)errEl.textContent="";
  const raw=((inp&&inp.value)||"").replace(/\D/g,"");
  if(raw.length<9){ if(errEl)errEl.textContent="מספר טלפון לא תקין"; return; }
  if(raw===S.phone){ if(errEl)errEl.textContent="מספר ההורה חייב להיות שונה ממספר הילד/ה"; return; }
  if(!S.parentCode){
    if(errEl)errEl.textContent = S.regNameMismatch
      ? "המספר הזה כבר רשום בשם אחר. יש להתחבר עם השם שנרשם במקור."
      : "רק רגע — נרשם לשרת, נסו שוב בעוד רגע";
    syncRegister(); return;
  }
  const link=parentTrackLink();
  const msg=`מעקב אחר ${S.name||"הילד/ה"} באפליקציית Onyx לימודי 📚\nקישור: ${link}\nקוד הורה: ${S.parentCode}`;
  const sms="sms:"+raw+"?body="+encodeURIComponent(msg);
  try{ window.location.href=sms; }catch(e){}
  // fallback path: copy the message so it can be pasted anywhere
  try{ if(navigator.clipboard) navigator.clipboard.writeText(msg).catch(()=>{}); }catch(e){}
  showToast("good","נפתחה הודעת SMS להורה (וגם הועתקה)");
}
// parents: how to track a child's progress
function showParentHelp(){
  let s=document.getElementById("phelp");if(s)s.remove();
  s=document.createElement("div");s.id="phelp";s.className="sheet-overlay";
  s.innerHTML=`<div class="sheet install-sheet">
    <div class="sheet-head"><span>👪 מעקב הורים אחרי ההתקדמות</span><button class="ghost sm" id="ph-close">סגירה</button></div>
    <p class="par-note">כך תוכלו לעקוב מרחוק אחרי הילד/ה, מכל מכשיר:</p>
    <ol class="install-steps">
      <li>רשמו את הילד/ה עם <b>שם ומספר טלפון</b> והתחילו ללמוד.</li>
      <li>אחרי ההרשמה מופיע <b>קוד הורים</b> בתפריט המקצוע (למשל <b>3F9A2C</b>).</li>
      <li>מהמכשיר <b>שלכם</b> היכנסו לכתובת <b>onyx-study.com/parent</b>.</li>
      <li>הזינו את הטלפון שלכם, את הטלפון של הילד/ה ואת <b>קוד ההורים</b>, ולחצו "קשר".</li>
      <li>מעכשיו תראו את ההתקדמות, הדיוק והזמן לכל מקצוע 📊</li>
    </ol>
    <p class="par-note">בתוך האפליקציה, כפתור <b>👪</b> בכותרת מציג גם התקדמות מקומית והגדרות קול.</p>
  </div>`;
  document.body.appendChild(s);
  const close=()=>s.remove();
  s.addEventListener("click",e=>{if(e.target===s)close();});
  document.getElementById("ph-close").addEventListener("click",close);
}
function doInstall(){
  const dp=window.__installPrompt;
  if(dp&&dp.prompt){
    dp.prompt();
    dp.userChoice&&dp.userChoice.finally?dp.userChoice.finally(()=>{window.__installPrompt=null;}):0;
    return;
  }
  if(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone){
    showToast("good","האפליקציה כבר מותקנת 🎉");return;
  }
  showInstallSheet();
}
function showInstallSheet(){
  const ua=navigator.userAgent||"";
  const isIOS=/iphone|ipad|ipod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const iosOtherBrowser=isIOS&&/crios|fxios|edgios|opios/i.test(ua);   // iOS Chrome/FF etc. can't install PWAs
  let title,steps;
  if(isIOS&&iosOtherBrowser){
    title="התקנה — צריך את Safari 🧭";
    steps=`<li>העתיקו את הכתובת ופתחו אותה ב-<b>Safari</b> (רק ב-Safari אפשר להתקין באייפון)</li>
           <li>הקישו על כפתור <b>השיתוף</b> <span class="ins-ic">⬆︎</span> בתחתית המסך</li>
           <li>בחרו <b>הוספה למסך הבית</b> ➕ ואשרו</li>`;
  }else if(isIOS){
    title="התקנה באייפון 🍎";
    steps=`<li>הקישו על כפתור <b>השיתוף</b> <span class="ins-ic">⬆︎</span> בתחתית המסך</li>
           <li>גללו ובחרו <b>הוספה למסך הבית</b> <span class="ins-ic">➕</span></li>
           <li>הקישו <b>הוספה</b> — והאייקון יופיע במסך הבית 🎉</li>`;
  }else{
    title="התקנה באנדרואיד 🤖";
    steps=`<li>הקישו על תפריט הדפדפן <span class="ins-ic">⋮</span> (למעלה)</li>
           <li>בחרו <b>התקנת האפליקציה</b> או <b>הוספה למסך הבית</b></li>
           <li>אשרו — והאייקון יופיע במסך הבית 🎉</li>`;
  }
  let s=document.getElementById("install-sheet");if(s)s.remove();
  s=document.createElement("div");s.id="install-sheet";s.className="sheet-overlay";
  s.innerHTML=`<div class="sheet install-sheet">
    <div class="sheet-head"><span>📲 ${title}</span><button class="ghost sm" id="inst-close">סגירה</button></div>
    <div class="ins-hero"><img src="/static/img/onyx_learn_icon-192.png" alt="" width="64" height="64" style="border-radius:16px"><p class="par-note">מתקינים פעם אחת — ואז נכנסים בלחיצה אחת מהמסך הראשי, בלי דפדפן ובלי כתובת.</p></div>
    <ol class="install-steps">${steps}</ol>
  </div>`;
  document.body.appendChild(s);
  const close=()=>s.remove();
  s.addEventListener("click",e=>{if(e.target===s)close();});
  document.getElementById("inst-close").addEventListener("click",close);
}
