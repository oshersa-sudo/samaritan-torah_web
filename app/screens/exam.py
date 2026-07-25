# -*- coding: utf-8 -*-
"""
מאמן אנגלית — English Trainer  (Kivy screen)
4 parts: vocab (10) · cloze (25) · reading (6) · describe (10) → 51 q, score /100
"""
import os, json, random, re
from kivy.app import App
from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.textinput import TextInput
from kivy.uix.slider import Slider
from kivy.uix.progressbar import ProgressBar
from kivy.uix.widget import Widget
from kivy.uix.floatlayout import FloatLayout
from kivy.clock import Clock
from kivy.graphics import Color, RoundedRectangle, Rectangle, Line
from kivy.metrics import dp, sp
from kivy.utils import platform
from app.widgets import HoverButton, RoundedHoverButton
try:
    from app.services.rtl import rtl
except ImportError:
    rtl = lambda x: x

# ── Palette ───────────────────────────────────────────────────────────────────
EX_VIOLET = (0.424, 0.361, 0.906, 1)
EX_MANGO  = (1.000, 0.714, 0.153, 1)
EX_LIME   = (0.247, 0.749, 0.435, 1)
EX_CORAL  = (0.949, 0.329, 0.357, 1)
EX_DEEP   = (0.043, 0.141, 0.188, 1)
EX_PAPER  = (0.949, 0.980, 0.988, 1)
EX_WHITE  = (1, 1, 1, 1)
EX_BORDER = (0.863, 0.914, 0.933, 1)
EX_BG     = (0.918, 0.969, 0.984, 1)
EX_INK    = (0.071, 0.192, 0.247, 1)
EX_GOOD_BG= (0.929, 0.984, 0.945, 1)
EX_BAD_BG = (0.992, 0.929, 0.933, 1)

# ── Content ───────────────────────────────────────────────────────────────────
VOCAB = [
    # ── lvl 1 · יסוד (גיל 5–7) ──
    {"w":"apple","e":"🍎","lvl":1,"h":"תפוח"},{"w":"banana","e":"🍌","lvl":1,"h":"בננה"},
    {"w":"dog","e":"🐶","lvl":1,"h":"כלב"},{"w":"cat","e":"🐱","lvl":1,"h":"חתול"},
    {"w":"sun","e":"☀️","lvl":1,"h":"שמש"},{"w":"moon","e":"🌙","lvl":1,"h":"ירח"},
    {"w":"star","e":"⭐","lvl":1,"h":"כוכב"},{"w":"book","e":"📕","lvl":1,"h":"ספר"},
    {"w":"ball","e":"⚽","lvl":1,"h":"כדור"},{"w":"house","e":"🏠","lvl":1,"h":"בית"},
    {"w":"fish","e":"🐟","lvl":1,"h":"דג"},{"w":"car","e":"🚗","lvl":1,"h":"מכונית"},
    {"w":"tree","e":"🌳","lvl":1,"h":"עץ"},{"w":"milk","e":"🥛","lvl":1,"h":"חלב"},
    {"w":"shoe","e":"👟","lvl":1,"h":"נעל"},{"w":"hat","e":"🧢","lvl":1,"h":"כובע"},
    {"w":"bird","e":"🐦","lvl":1,"h":"ציפור"},{"w":"flower","e":"🌸","lvl":1,"h":"פרח"},
    {"w":"hand","e":"✋","lvl":1,"h":"יד"},{"w":"egg","e":"🥚","lvl":1,"h":"ביצה"},
    {"w":"bread","e":"🍞","lvl":1,"h":"לחם"},{"w":"cake","e":"🍰","lvl":1,"h":"עוגה"},
    {"w":"bed","e":"🛏️","lvl":1,"h":"מיטה"},{"w":"door","e":"🚪","lvl":1,"h":"דלת"},
    {"w":"key","e":"🔑","lvl":1,"h":"מפתח"},{"w":"sock","e":"🧦","lvl":1,"h":"גרב"},
    # ── lvl 2 · בית ספר, בית, אוכל, חיות (גיל 8–9) ──
    {"w":"teacher","e":"🧑‍🏫","lvl":2,"h":"מורה"},{"w":"school","e":"🏫","lvl":2,"h":"בית ספר"},
    {"w":"pencil","e":"✏️","lvl":2,"h":"עיפרון"},{"w":"notebook","e":"📓","lvl":2,"h":"מחברת"},
    {"w":"backpack","e":"🎒","lvl":2,"h":"תיק"},{"w":"ruler","e":"📏","lvl":2,"h":"סרגל"},
    {"w":"window","e":"🪟","lvl":2,"h":"חלון"},{"w":"clock","e":"🕐","lvl":2,"h":"שעון"},
    {"w":"bus","e":"🚌","lvl":2,"h":"אוטובוס"},{"w":"train","e":"🚆","lvl":2,"h":"רכבת"},
    {"w":"bicycle","e":"🚲","lvl":2,"h":"אופניים"},{"w":"umbrella","e":"☂️","lvl":2,"h":"מטרייה"},
    {"w":"kitchen","e":"🍳","lvl":2,"h":"מטבח"},{"w":"garden","e":"🌻","lvl":2,"h":"גינה"},
    {"w":"guitar","e":"🎸","lvl":2,"h":"גיטרה"},{"w":"camera","e":"📷","lvl":2,"h":"מצלמה"},
    {"w":"orange","e":"🍊","lvl":2,"h":"תפוז"},{"w":"grapes","e":"🍇","lvl":2,"h":"ענבים"},
    {"w":"carrot","e":"🥕","lvl":2,"h":"גזר"},{"w":"tomato","e":"🍅","lvl":2,"h":"עגבנייה"},
    {"w":"chicken","e":"🐔","lvl":2,"h":"תרנגולת"},{"w":"cow","e":"🐄","lvl":2,"h":"פרה"},
    {"w":"horse","e":"🐴","lvl":2,"h":"סוס"},{"w":"rabbit","e":"🐰","lvl":2,"h":"ארנב"},
    {"w":"elephant","e":"🐘","lvl":2,"h":"פיל"},{"w":"rain","e":"🌧️","lvl":2,"h":"גשם"},
    {"w":"snow","e":"❄️","lvl":2,"h":"שלג"},{"w":"cloud","e":"☁️","lvl":2,"h":"ענן"},
    {"w":"mountain","e":"⛰️","lvl":2,"h":"הר"},{"w":"rainbow","e":"🌈","lvl":2,"h":"קשת"},
    # ── lvl 3 · מקצועות, כלים, רכב, כלי מטבח, פירות/ירקות, רהיטים, מקצועות לימוד (גיל 10–11) ──
    {"w":"doctor","e":"🧑‍⚕️","lvl":3,"h":"רופא"},{"w":"nurse","e":"👩‍⚕️","lvl":3,"h":"אחות"},
    {"w":"farmer","e":"🧑‍🌾","lvl":3,"h":"חקלאי"},{"w":"pilot","e":"🧑‍✈️","lvl":3,"h":"טייס"},
    {"w":"engineer","e":"👷","lvl":3,"h":"מהנדס"},{"w":"chef","e":"🧑‍🍳","lvl":3,"h":"שף"},
    {"w":"police officer","e":"👮","lvl":3,"h":"שוטר"},{"w":"firefighter","e":"🧑‍🚒","lvl":3,"h":"כבאי"},
    {"w":"scientist","e":"🔬","lvl":3,"h":"מדען"},{"w":"dentist","e":"🦷","lvl":3,"h":"רופא שיניים"},
    {"w":"judge","e":"⚖️","lvl":3,"h":"שופט"},{"w":"baker","e":"🥖","lvl":3,"h":"אופה"},
    {"w":"carpenter","e":"🪚","lvl":3,"h":"נגר"},{"w":"painter","e":"🎨","lvl":3,"h":"צַבָּע"},
    {"w":"hammer","e":"🔨","lvl":3,"h":"פטיש"},{"w":"screwdriver","e":"🪛","lvl":3,"h":"מברג"},
    {"w":"wrench","e":"🔧","lvl":3,"h":"מפתח ברגים"},{"w":"drill","e":"🛠️","lvl":3,"h":"מקדחה"},
    {"w":"ladder","e":"🪜","lvl":3,"h":"סולם"},{"w":"scissors","e":"✂️","lvl":3,"h":"מספריים"},
    {"w":"nail","e":"🔩","lvl":3,"h":"מסמר"},{"w":"brush","e":"🖌️","lvl":3,"h":"מברשת"},
    {"w":"truck","e":"🚚","lvl":3,"h":"משאית"},{"w":"airplane","e":"✈️","lvl":3,"h":"מטוס"},
    {"w":"helicopter","e":"🚁","lvl":3,"h":"מסוק"},{"w":"ship","e":"🚢","lvl":3,"h":"אונייה"},
    {"w":"tractor","e":"🚜","lvl":3,"h":"טרקטור"},{"w":"motorcycle","e":"🏍️","lvl":3,"h":"אופנוע"},
    {"w":"ambulance","e":"🚑","lvl":3,"h":"אמבולנס"},{"w":"rocket","e":"🚀","lvl":3,"h":"טיל חלל"},
    {"w":"pot","e":"🍲","lvl":3,"h":"סיר"},{"w":"knife","e":"🔪","lvl":3,"h":"סכין"},
    {"w":"kettle","e":"🫖","lvl":3,"h":"קומקום"},{"w":"spoon","e":"🥄","lvl":3,"h":"כף"},
    {"w":"fork","e":"🍴","lvl":3,"h":"מזלג"},{"w":"plate","e":"🍽️","lvl":3,"h":"צלחת"},
    {"w":"strawberry","e":"🍓","lvl":3,"h":"תות"},{"w":"watermelon","e":"🍉","lvl":3,"h":"אבטיח"},
    {"w":"lemon","e":"🍋","lvl":3,"h":"לימון"},{"w":"pineapple","e":"🍍","lvl":3,"h":"אננס"},
    {"w":"potato","e":"🥔","lvl":3,"h":"תפוח אדמה"},{"w":"onion","e":"🧅","lvl":3,"h":"בצל"},
    {"w":"corn","e":"🌽","lvl":3,"h":"תירס"},{"w":"cucumber","e":"🥒","lvl":3,"h":"מלפפון"},
    {"w":"pepper","e":"🫑","lvl":3,"h":"פלפל"},{"w":"eggplant","e":"🍆","lvl":3,"h":"חציל"},
    {"w":"broccoli","e":"🥦","lvl":3,"h":"ברוקולי"},{"w":"mushroom","e":"🍄","lvl":3,"h":"פטרייה"},
    {"w":"sofa","e":"🛋️","lvl":3,"h":"ספה"},{"w":"mirror","e":"🪞","lvl":3,"h":"מראה"},
    {"w":"lamp","e":"💡","lvl":3,"h":"מנורה"},{"w":"drawer","e":"🗄️","lvl":3,"h":"מגירה"},
    {"w":"mathematics","e":"➗","lvl":3,"h":"מתמטיקה"},{"w":"science","e":"🧪","lvl":3,"h":"מדעים"},
    {"w":"history","e":"📜","lvl":3,"h":"היסטוריה"},{"w":"geography","e":"🗺️","lvl":3,"h":"גאוגרפיה"},
    {"w":"music","e":"🎵","lvl":3,"h":"מוזיקה"},{"w":"homework","e":"📚","lvl":3,"h":"שיעורי בית"},
    # ── lvl 4 · חטיבה ──
    {"w":"microscope","e":"🔬","lvl":4,"h":"מיקרוסקופ"},{"w":"volcano","e":"🌋","lvl":4,"h":"הר געש"},
    {"w":"compass","e":"🧭","lvl":4,"h":"מצפן"},{"w":"harvest","e":"🌾","lvl":4,"h":"קציר"},
    {"w":"anchor","e":"⚓","lvl":4,"h":"עוגן"},{"w":"telescope","e":"🔭","lvl":4,"h":"טלסקופ"},
    {"w":"laboratory","e":"⚗️","lvl":4,"h":"מעבדה"},{"w":"puzzle","e":"🧩","lvl":4,"h":"פאזל"},
    {"w":"lighthouse","e":"🗼","lvl":4,"h":"מגדלור"},{"w":"vaccine","e":"💉","lvl":4,"h":"חיסון"},
    {"w":"satellite","e":"🛰️","lvl":4,"h":"לוויין"},{"w":"sculpture","e":"🗿","lvl":4,"h":"פסל"},
    {"w":"orchestra","e":"🎻","lvl":4,"h":"תזמורת"},{"w":"skeleton","e":"💀","lvl":4,"h":"שלד"},
    {"w":"magnet","e":"🧲","lvl":4,"h":"מגנט"},{"w":"battery","e":"🔋","lvl":4,"h":"סוללה"},
    # ── lvl 5 · תיכון ──
    {"w":"manuscript","e":"📜","lvl":5,"h":"כתב יד"},{"w":"infrastructure","e":"🏗️","lvl":5,"h":"תשתית"},
    {"w":"diplomacy","e":"🕊️","lvl":5,"h":"דיפלומטיה"},{"w":"commerce","e":"🏦","lvl":5,"h":"מסחר"},
    {"w":"specimen","e":"🦠","lvl":5,"h":"דגימה"},{"w":"expedition","e":"🧗","lvl":5,"h":"משלחת"},
    {"w":"observatory","e":"🔭","lvl":5,"h":"מצפה כוכבים"},{"w":"currency","e":"💱","lvl":5,"h":"מטבע"},
    {"w":"parliament","e":"🏛️","lvl":5,"h":"פרלמנט"},{"w":"reservoir","e":"🌊","lvl":5,"h":"מאגר מים"},
]

CLOZE = [
  {
    "id":"c1","lvl":1,"title":"A Day at the Park",
    "text":"On Sunday morning Dana went to the {1} near her house. The {2} was warm and the sky was very {3}. "
           "She took her red {4} and a bottle of cold {5}. Her little {6} Tom ran after a butterfly. "
           "Dana sat under a big {7} and opened her {8}. She read three {9} before lunch. "
           "Then she saw her {10} Maya near the swings. They played together and {11} a lot. "
           "At noon they ate {12} and shared an {13}. A small {14} came close and Tom gave it some bread. "
           "Later the wind became {15} and grey clouds covered the {16}. "
           "Dana put on her {17} and closed her bag. They walked {18} slowly along the path. "
           "Tom was {19} but happy. Dana promised to come back {20} week. "
           "At the gate they said {21} to Maya. The {22} home was short. "
           "Mother opened the {23} and asked about their day. Dana said it was the best {24} of the whole {25}.",
    "answers":["park","sun","blue","ball","water","brother","tree","book","pages","friend",
               "laughed","sandwiches","apple","bird","strong","sky","jacket","home","tired","next",
               "goodbye","walk","door","day","month"],
    "decoys":["mountain","teacher","purple","airplane","silent","kitchen"],
  },
  {
    "id":"c2","lvl":3,"title":"The Old Lighthouse",
    "text":"The lighthouse stood on a rocky {1} above the grey sea. For ninety {2} its lamp had warned every passing {3}. "
           "Its keeper, an old man named Elias, climbed the narrow {4} twice each night. "
           "He carried a heavy {5} of oil and a small {6}. The stairs were {7} and the wind was {8}. "
           "From the top he could see the whole {9} and, on clear nights, the lights of the distant {10}. "
           "Elias kept a {11} where he wrote the weather, the {12} of every ship, and anything {13}. "
           "One winter a terrible {14} broke the eastern {15}. The waves rose higher than the {16}. "
           "Elias worked all night to keep the {17} burning. In the morning the village {18} came to help him. "
           "They found him {19} but alive, still holding the {20}. The newspaper called him a {21}. "
           "Elias only said that the {22} needed the light, and that was {23}. "
           "Today the lighthouse is a {24}, and children read his diary in the small {25} downstairs.",
    "answers":["cliff","years","ship","stairs","can","lantern","steep","cold","bay","harbour",
               "diary","name","unusual","storm","window","roof","flame","fishermen","exhausted","matches",
               "hero","sailors","enough","museum","room"],
    "decoys":["desert","sandals","chocolate","guitar","quietly","birthday"],
  },
]

STORIES = [
  {
    "id":"s1","lvl":2,"title":"The Boy Who Fixed Clocks",
    "text":("Sami was eleven years old and lived above his father's small repair shop on a narrow street. "
            "Every afternoon, when school ended, he sat on a wooden stool behind the counter and watched his father work. "
            "His father repaired clocks — big wall clocks, tiny silver watches, and old alarm clocks that no one else wanted to touch.\n\n"
            "\"A clock is honest,\" his father liked to say. \"It tells you exactly when you are wrong.\"\n\n"
            "One rainy Tuesday a woman brought in a clock shaped like a small house. It had a wooden bird inside that was supposed "
            "to come out every hour and sing. The bird had not sung for eleven years, she said.\n\n"
            "Sami's father opened the back of the clock and looked inside for a long time. Then he shook his head. "
            "\"The spring is broken,\" he said. \"I cannot find this part any more. They stopped making it before I was born.\"\n\n"
            "But Sami could not stop thinking about the silent bird. For three weeks he worked in secret. "
            "He cut, bent, measured, and failed. He failed sixteen times. The seventeenth spring was ugly, but it was the right shape.\n\n"
            "When the woman came back, Sami placed the house-shaped clock on the counter and wound it carefully. "
            "At exactly four o'clock the small wooden door opened and the bird came out and sang.\n\n"
            "The woman did not say anything for a moment. Then she began to cry, and then she laughed.\n\n"
            "Sami's father looked at his son for a long time. \"A clock is honest,\" he said quietly. \"And so is patience.\""),
    "qpool":[
      {"q":"Where did Sami live?","o":["Above his father's repair shop","In a village near the sea","Behind the school","In the metal workshop"],"c":0},
      {"q":"What did Sami's father repair?","o":["Bicycles","Clocks and watches","Shoes","Radios"],"c":1},
      {"q":"How long had the wooden bird been silent?","o":["Three weeks","One year","Eleven years","Ninety years"],"c":2},
      {"q":"Why couldn't the father fix the clock?","o":["He was too busy","The part was no longer made","The woman could not pay","The clock was too small"],"c":1},
      {"q":"How many times did Sami fail?","o":["Sixteen","Seventeen","Three","Eleven"],"c":0},
      {"q":"The new spring was described as","o":["perfect and shiny","ugly but the right shape","too short","made of silver"],"c":1},
      {"q":"At what time did the bird finally sing?","o":["Four o'clock","Noon","Midnight","Eight o'clock"],"c":0},
      {"q":"What was the woman's first reaction?","o":["She laughed loudly","She said nothing, then cried","She asked for money back","She left the shop"],"c":1},
      {"q":"What does the father's last sentence suggest?","o":["Patience is as reliable as a clock","Clocks are hard to fix","Sami should study more","The woman was wrong"],"c":0},
      {"q":"The story mainly shows that","o":["old clocks are valuable","persistence can solve what experts give up on","children should not work","rain brings good luck"],"c":1},
    ],
  },
  {
    "id":"s2","lvl":4,"title":"The Map That Was Wrong",
    "text":("For two hundred years, every map of the northern coast showed an island called Sable Rock. "
            "It appeared on charts printed in London, copied in Lisbon, and reprinted in Boston. "
            "Captains marked it, avoided it, and warned each other about it.\n\n"
            "The island did not exist.\n\n"
            "The mistake began in 1799, when a young officer named Carter recorded a \"low dark mass\" during a night of heavy fog. "
            "He was tired, the sea was rough, and what he almost certainly saw was a whale. "
            "A clerk in the naval office copied the entry onto the master chart. From that chart, every later map was drawn.\n\n"
            "Several sailors reported that they had passed through the exact position of Sable Rock and seen nothing but open water. "
            "Their reports were filed away. One editor wrote in the margin: \"Instrument error — the island is well established.\"\n\n"
            "Once information is repeated often enough, it stops being evidence and starts being background. "
            "New facts are then tested against it, instead of the other way around.\n\n"
            "The island was finally removed in 1957, after a survey ship spent four days sailing back and forth across the position. "
            "Even then, two shipping companies kept the old charts in use for another decade, because reprinting them was expensive.\n\n"
            "Historians of navigation call these \"phantom islands.\" More than two hundred have been erased from official maps. "
            "Sable Rock lasted a hundred and fifty-eight years.\n\n"
            "The lesson is that a careful system built on a single unchecked observation will produce careful, confident, and wrong results for a very long time."),
    "qpool":[
      {"q":"What was Sable Rock?","o":["A dangerous reef","An island that never existed","A naval base","A type of ship"],"c":1},
      {"q":"When did the error begin?","o":["1799","1957","1899","1750"],"c":0},
      {"q":"What did Carter most likely see?","o":["A rock","Another ship","A whale","A storm cloud"],"c":2},
      {"q":"How did the error spread?","o":["Sailors invented stories","A clerk copied it to the master chart","Insurance companies added it","It was a deliberate hoax"],"c":1},
      {"q":"How were the sailors' reports treated?","o":["Investigated at once","Filed away and dismissed","Published widely","Sent to Carter"],"c":1},
      {"q":"How long did Sable Rock survive on maps?","o":["Ten years","Fifty-eight years","A hundred and fifty-eight years","Two hundred years"],"c":2},
      {"q":"Why did two companies keep the old charts?","o":["They doubted the survey","Reprinting cost too much","The government required it","Their captains preferred them"],"c":1},
      {"q":"The author's main point is that","o":["mapmakers were lazy","careful systems can preserve a single error","night navigation is dangerous","modern equipment is unnecessary"],"c":1},
      {"q":"What finally removed the island?","o":["A captain's complaint","A four-day modern survey","A new insurance rule","Carter's confession"],"c":1},
      {"q":"\"Stops being evidence and starts being background\" means","o":["is forgotten","is no longer questioned","becomes secret","is proven true"],"c":1},
    ],
  },
]

PICTURES = [
    {"e":"🐘","ok":["elephant","an elephant","the elephant"]},
    {"e":"🚲","ok":["bicycle","a bicycle","bike","a bike"]},
    {"e":"🌧️","ok":["rain","raining","it is raining","it's raining"]},
    {"e":"🏫","ok":["school","a school","school building"]},
    {"e":"🍕","ok":["pizza","a pizza","slice of pizza"]},
    {"e":"🧑‍🍳","ok":["cook","a cook","chef","a chef"]},
    {"e":"⛵","ok":["boat","a boat","sailboat","a sailboat","ship"]},
    {"e":"🎂","ok":["cake","a cake","birthday cake"]},
    {"e":"🦁","ok":["lion","a lion","the lion"]},
    {"e":"🌉","ok":["bridge","a bridge","the bridge"]},
]

# ── Constants ──────────────────────────────────────────────────────────────────
QUOTA      = {"vocab":10,"cloze":25,"reading":6,"pics":10}
TOTAL      = 51
TIME_SECS  = {"vocab":300,"cloze":600,"reading":600,"pics":600}
ORDER      = ["p1","p2","p3","p4"]
LEVEL_NAME = {1:"כיתות א׳–ב׳",2:"כיתות ג׳–ד׳",3:"כיתות ה׳–ו׳",4:"חטיבה",5:"תיכון"}
PART_NAME  = {"p1":"אוצר מילים","p2":"השלמת מילים","p3":"הבנת הנקרא","p4":"תיאור תמונה"}

# ── Utilities ─────────────────────────────────────────────────────────────────
def _shuffle(a):
    r = list(a); random.shuffle(r); return r

def _level_for_age(age):
    return 1 if age<=7 else 2 if age<=9 else 3 if age<=11 else 4 if age<=14 else 5

def _near_level(items, lvl, min_count=6):
    out = [i for i in items if i["lvl"]==lvl]; span = 1
    while len(out)<min_count and span<5:
        out = [i for i in items if abs(i["lvl"]-lvl)<=span]; span+=1
    return out if out else items

def _grade(correct): return round((correct/TOTAL)*100)

def _fmt_date(ts):
    import datetime
    return datetime.datetime.fromtimestamp(ts/1000).strftime("%d/%m/%y")

def _fmt_time(secs):
    return f"{secs//60:02d}:{secs%60:02d}"

# ── Storage ───────────────────────────────────────────────────────────────────
_DATA_FILE = None

def _data_path():
    global _DATA_FILE
    if _DATA_FILE: return _DATA_FILE
    app = App.get_running_app()
    d = app.user_data_dir if app else "."
    _DATA_FILE = os.path.join(d, "exam_data.json")
    return _DATA_FILE

def _load_all():
    try:
        with open(_data_path(), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def _save_all(data):
    try:
        with open(_data_path(), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception:
        pass

def s_get(key):
    return _load_all().get(key)

def s_set(key, val):
    d = _load_all(); d[key] = val; _save_all(d)

def s_del(key):
    d = _load_all(); d.pop(key, None); _save_all(d)

def _k_session(p): return f"session:{p}"
def _k_results(p): return f"results:{p}"
def _k_seen(p):    return f"seen:{p}"

# ── Widget helpers ─────────────────────────────────────────────────────────────
def _card(padding=dp(14), spacing=dp(10)):
    box = BoxLayout(orientation="vertical", size_hint_y=None,
                    padding=padding, spacing=spacing)
    box.bind(minimum_height=box.setter("height"))
    with box.canvas.before:
        Color(*EX_PAPER)
        box._bg = RoundedRectangle(pos=box.pos, size=box.size, radius=[dp(18)])
    box.bind(pos=lambda w,v: setattr(w._bg,"pos",v))
    box.bind(size=lambda w,v: setattr(w._bg,"size",v))
    return box

def _lbl(text, font="Hebrew", size=sp(14), color=EX_INK, bold=False,
         halign="right", height=None):
    lbl = Label(text=rtl(text) if font=="Hebrew" else text,
                font_name=font, font_size=size, color=color, bold=bold,
                halign=halign, valign="top", size_hint_y=None)
    lbl.bind(width=lambda i,w: setattr(i,"text_size",(w,None)))
    if height:
        lbl.height = height
    else:
        lbl.bind(texture_size=lambda i,v: setattr(i,"height",v[1]+dp(2)))
    return lbl

def _primary_btn(text, font="Hebrew", on_press=None, height=dp(48), disabled=False):
    btn = Button(text=rtl(text) if font=="Hebrew" else text,
                 font_name=font, font_size=sp(16), bold=True,
                 background_normal="", background_color=EX_VIOLET,
                 color=EX_WHITE, size_hint_y=None, height=height,
                 disabled=disabled)
    with btn.canvas.before:
        Color(0,0,0,0)  # no extra canvas; rely on background_color
    if on_press:
        btn.bind(on_press=lambda *_: on_press())
    return btn

def _ghost_btn(text, font="Hebrew", on_press=None, height=dp(42)):
    btn = Button(text=rtl(text) if font=="Hebrew" else text,
                 font_name=font, font_size=sp(14),
                 background_normal="", background_color=(0,0,0,0),
                 color=(*EX_DEEP[:3], 0.65), size_hint_y=None, height=height)
    if on_press:
        btn.bind(on_press=lambda *_: on_press())
    return btn

def _spacer(h=dp(6)):
    w = Widget(size_hint_y=None, height=h)
    return w


# ══════════════════════════════════════════════════════════════════════════════
class ExamScreen(Screen):
    """Main Kivy screen for the English Trainer."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # ── Global state ──
        self.S = {"screen":"login","name":"","phone":"","age":9,"score":0,
                  "seen":[],"history":[],"found":None,"prog":{}}
        self.V = {}; self.C = {}; self.R = {}; self.D = {}
        # ── Timer ──
        self._timer_ev    = None
        self._timer_left  = 0
        self._timer_total = 1
        self._on_time_up  = None
        self._timer_lbl   = None
        self._timer_bar   = None
        self._counter_lbl = None
        # ── Score display ──
        self._score_lbl   = None
        # ── Toast ──
        self._toast_ev    = None
        self._toast_lbl   = None
        # ── Root layout ──
        root = BoxLayout(orientation="vertical")
        with root.canvas.before:
            Color(*EX_BG)
            root._bg = Rectangle(pos=root.pos, size=root.size)
        root.bind(pos=lambda w,v: setattr(w._bg,"pos",v))
        root.bind(size=lambda w,v: setattr(w._bg,"size",v))
        # ── Exam header (shown on non-login screens) ──
        self._hdr = BoxLayout(size_hint_y=None, height=dp(46), spacing=dp(4),
                              padding=(dp(8),dp(4)))
        with self._hdr.canvas.before:
            Color(*EX_DEEP)
            self._hdr._bg = Rectangle(pos=self._hdr.pos, size=self._hdr.size)
        self._hdr.bind(pos=lambda w,v: setattr(w._bg,"pos",v))
        self._hdr.bind(size=lambda w,v: setattr(w._bg,"size",v))
        brand = Label(text="English·Trainer", font_size=sp(15),
                      color=EX_WHITE, size_hint_x=None, width=dp(130),
                      halign="center", valign="middle")
        brand.bind(size=lambda i,s: setattr(i,"text_size",s))
        self._hdr_name = Label(text="", font_name="Hebrew", font_size=sp(12),
                               color=(1,1,1,0.7), halign="right", valign="middle")
        self._hdr_name.bind(size=lambda i,s: setattr(i,"text_size",s))
        self._pause_btn = Button(text="⏸", font_size=sp(18),
                                 background_normal="", background_color=(1,1,1,0.15),
                                 color=EX_WHITE, size_hint=(None,None),
                                 width=dp(38), height=dp(38))
        self._pause_btn.bind(on_press=lambda *_: self._pause())
        self._score_lbl = Label(text="0/100", font_size=sp(16), bold=True,
                                color=EX_MANGO, size_hint=(None,1), width=dp(70),
                                halign="center", valign="middle")
        self._score_lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        self._back_btn = Button(text="←", font_size=sp(20),
                                background_normal="", background_color=(1,1,1,0.15),
                                color=EX_WHITE, size_hint=(None,None),
                                width=dp(38), height=dp(38))
        self._back_btn.bind(on_press=lambda *_: self._go_home())
        self._hdr.add_widget(self._back_btn)
        self._hdr.add_widget(brand)
        self._hdr.add_widget(self._hdr_name)
        self._hdr.add_widget(self._pause_btn)
        self._hdr.add_widget(self._score_lbl)
        root.add_widget(self._hdr)
        # ── Scrollable body ──
        self._scroll = ScrollView(size_hint=(1,1), do_scroll_x=False,
                                  bar_width=dp(4))
        self._body = BoxLayout(orientation="vertical", size_hint_y=None,
                               spacing=dp(10), padding=(dp(10),dp(10),dp(10),dp(20)))
        self._body.bind(minimum_height=self._body.setter("height"))
        self._scroll.add_widget(self._body)
        root.add_widget(self._scroll)
        # ── Toast overlay ──
        self._float = FloatLayout(size_hint=(1,None), height=0)
        root.add_widget(self._float)
        self.add_widget(root)
        # ── Initial render ──
        self._go("login")

    def on_leave(self, *args):
        if self.S["screen"] in ORDER:
            self._pause()

    def _go_home(self):
        if self.S["screen"] in ORDER:
            self._pause()
        app = App.get_running_app()
        if app:
            app.sm.current = 'browse'

    # ── Navigation ────────────────────────────────────────────────────────────
    def _go(self, screen):
        self._stop_timer()
        self.S["screen"] = screen
        self._body.clear_widgets()
        self._timer_lbl = None
        self._timer_bar = None
        self._counter_lbl = None
        # Header visibility
        on_login = screen == "login"
        self._hdr.opacity = 0 if on_login else 1
        self._hdr.disabled = on_login
        self._pause_btn.opacity = 1 if screen in ORDER else 0
        self._pause_btn.disabled = screen not in ORDER
        self._update_header()
        # Render sub-screen
        renders = {"login":self._render_login,"resume":self._render_resume,
                   "menu":self._render_menu,"p1":self._render_vocab,
                   "p2":self._render_cloze,"p3":self._render_reading,
                   "p4":self._render_describe,"paused":self._render_paused,
                   "done":self._render_done}
        renders.get(screen, self._render_login)()
        self._scroll.scroll_y = 1
        self._save_session()

    def _update_header(self):
        lvl = _level_for_age(self.S["age"])
        name = self.S["name"]
        self._hdr_name.text = rtl(f"{name} · {LEVEL_NAME[lvl]}") if name else rtl(LEVEL_NAME[lvl])
        if self._score_lbl:
            self._score_lbl.text = f"{_grade(self.S['score'])}/100"

    # ── Sub-screen renderers ──────────────────────────────────────────────────
    def _render_login(self):
        b = self._body
        b.add_widget(_spacer(dp(10)))
        card = _card(padding=dp(18))
        card.add_widget(_lbl("אימון אנגלית יומי", size=sp(11), color=EX_VIOLET, bold=True))
        card.add_widget(_lbl("ארבעה חלקים.\nארבעה שעוני חול.", size=sp(26), bold=True))
        card.add_widget(_lbl("מילים, השלמות, סיפור ותיאור תמונה — לפי הגיל והרמה.", size=sp(13), color=(*EX_INK[:3],0.7)))
        card.add_widget(_spacer(dp(4)))
        card.add_widget(_lbl("שם", size=sp(13)))
        self._inp_name = TextInput(text=self.S["name"], hint_text="איך קוראים לך?",
                                   size_hint_y=None, height=dp(44), font_size=sp(15),
                                   multiline=False)
        card.add_widget(self._inp_name)
        card.add_widget(_lbl("מספר טלפון", size=sp(13)))
        self._inp_phone = TextInput(text=self.S["phone"], hint_text="0500000000",
                                    input_filter="int", size_hint_y=None, height=dp(44),
                                    font_size=sp(15), multiline=False)
        card.add_widget(self._inp_phone)
        age_row = BoxLayout(size_hint_y=None, height=dp(30), spacing=dp(8))
        self._age_lbl = Label(text=self._age_text(), font_name="Hebrew",
                              font_size=sp(14), color=EX_INK, size_hint_x=None, width=dp(180),
                              halign="right", valign="middle")
        self._age_lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        age_row.add_widget(self._age_lbl)
        self._age_slider = Slider(min=5, max=18, value=self.S["age"], step=1,
                                  cursor_size=(dp(24),dp(24)))
        self._age_slider.bind(value=self._on_age_change)
        age_row.add_widget(self._age_slider)
        card.add_widget(age_row)
        card.add_widget(_spacer(dp(4)))
        self._enter_btn = _primary_btn("יאללה, מתחילים", on_press=self._do_enter,
                                       disabled=not self._login_ok())
        self._inp_name.bind(text=lambda *_: self._check_enter_btn())
        self._inp_phone.bind(text=lambda *_: self._check_enter_btn())
        card.add_widget(self._enter_btn)
        b.add_widget(card)

    def _age_text(self):
        return f"{self.S['age']} · {LEVEL_NAME[_level_for_age(self.S['age'])]}"

    def _on_age_change(self, slider, val):
        self.S["age"] = int(val)
        if self._age_lbl:
            self._age_lbl.text = rtl(self._age_text())

    def _login_ok(self):
        return bool(self.S["name"].strip()) and len(self.S["phone"]) >= 9

    def _check_enter_btn(self):
        self.S["name"] = self._inp_name.text
        self.S["phone"] = self._inp_phone.text
        if self._enter_btn:
            self._enter_btn.disabled = not self._login_ok()

    def _render_resume(self):
        f = self.S["found"]
        b = self._body
        b.add_widget(_spacer())
        card = _card()
        card.add_widget(_lbl("נמצא מבחן פתוח", size=sp(11), color=EX_VIOLET, bold=True))
        card.add_widget(_lbl("להמשיך?", size=sp(28), bold=True))
        part = PART_NAME.get(f.get("screen",""), "אמצע")
        date = _fmt_date(f.get("t", 0))
        g    = _grade(f.get("score",0))
        card.add_widget(_lbl(f"נעצר ב{part} בתאריך {date}, עם {g} מתוך 100.", size=sp(13)))
        card.add_widget(_spacer())
        card.add_widget(_primary_btn("המשך מהמקום שנעצרתי", on_press=self._do_resume))
        card.add_widget(_ghost_btn("התחל מבחן חדש", on_press=self._do_fresh))
        b.add_widget(card)

    def _render_menu(self):
        b = self._body
        b.add_widget(_spacer())
        card = _card()
        card.add_widget(_lbl("התוכנית שלך היום", size=sp(11), color=EX_VIOLET, bold=True))
        plan_items = [
            ("p1", "אוצר מילים",   f"{QUOTA['vocab']} מילים · 5 דק׳"),
            ("p2", "השלמת מילים",  f"{QUOTA['cloze']} השלמות · 10 דק׳"),
            ("p3", "הבנת הנקרא",   f"{QUOTA['reading']} שאלות · 10 דק׳"),
            ("p4", "תיאור תמונה",  f"{QUOTA['pics']} תמונות · 10 דק׳"),
        ]
        for pid, title, sub in plan_items:
            row = BoxLayout(size_hint_y=None, height=dp(52), spacing=dp(8))
            with row.canvas.before:
                Color(*EX_WHITE)
                row._bg = RoundedRectangle(pos=row.pos, size=row.size, radius=[dp(12)])
            row.bind(pos=lambda w,v: setattr(w._bg,"pos",v))
            row.bind(size=lambda w,v: setattr(w._bg,"size",v))
            row.padding = (dp(12),dp(4))
            lbl_main = Label(text=rtl(title), font_name="Hebrew", font_size=sp(15),
                             bold=True, color=EX_INK, halign="right", valign="middle",
                             size_hint_x=0.6)
            lbl_main.bind(size=lambda i,s: setattr(i,"text_size",s))
            lbl_sub  = Label(text=rtl(sub), font_name="Hebrew", font_size=sp(12),
                             color=(*EX_INK[:3],0.6), halign="left", valign="middle",
                             size_hint_x=0.4)
            lbl_sub.bind(size=lambda i,s: setattr(i,"text_size",s))
            row.add_widget(lbl_sub)
            row.add_widget(lbl_main)
            # Invisible button overlay
            _p = pid
            btn_overlay = Button(background_color=(0,0,0,0), background_normal="",
                                 size_hint=(1,1))
            btn_overlay.bind(on_press=lambda *_, p=_p: self._go(p))
            row.add_widget(btn_overlay)
            card.add_widget(row)
        card.add_widget(_lbl(f"{TOTAL} תשובות · הציון מוצג מתוך 100",
                             size=sp(12), color=(*EX_INK[:3],0.55)))
        if self.S["history"]:
            card.add_widget(_lbl("מבחנים קודמים", size=sp(11), color=EX_VIOLET, bold=True))
            for r in self.S["history"][:5]:
                hrow = BoxLayout(size_hint_y=None, height=dp(34), spacing=dp(8))
                with hrow.canvas.before:
                    Color(*EX_WHITE)
                    hrow._bg2 = RoundedRectangle(pos=hrow.pos, size=hrow.size, radius=[dp(8)])
                hrow.bind(pos=lambda w,v: setattr(w._bg2,"pos",v))
                hrow.bind(size=lambda w,v: setattr(w._bg2,"size",v))
                hrow.padding = (dp(10),dp(2))
                hrow.add_widget(Label(text=str(r["g"])+"/100", font_size=sp(14),
                                      bold=True, color=EX_VIOLET, size_hint_x=None, width=dp(70),
                                      halign="center", valign="middle"))
                hrow.add_widget(Label(text=_fmt_date(r["t"]), font_size=sp(13),
                                      color=EX_INK, halign="center", valign="middle"))
                card.add_widget(hrow)
        card.add_widget(_spacer())
        card.add_widget(_primary_btn("התחלה מחלק 1", on_press=lambda: self._go("p1")))
        b.add_widget(card)

    # ── Part 1: Vocab ─────────────────────────────────────────────────────────
    def _render_vocab(self):
        saved = self.S["prog"].get("vocab")
        lvl   = _level_for_age(self.S["age"])
        self.V["pool"] = _near_level(VOCAB, lvl, 6)
        if saved and saved.get("round"):
            self.V["round"] = saved["round"]
            self.V["i"]     = saved.get("i", 0)
        else:
            fresh = [x for x in self.V["pool"] if x["w"] not in self.S["seen"]]
            src   = fresh if len(fresh)>=QUOTA["vocab"] else self.V["pool"]
            self.V["round"] = [x["w"] for x in _shuffle(src)[:QUOTA["vocab"]]]
            self.V["i"] = 0
        self.V["picked"] = None
        self._build_vocab_ui()
        self._start_timer(saved.get("left") if saved else None,
                          TIME_SECS["vocab"], self._on_vocab_done)

    def _build_vocab_ui(self):
        self._body.clear_widgets()
        b = self._body
        hdr = self._part_bar("חלק 1 · אוצר מילים", "מה רואים בתמונה?",
                             f"{self.V['i']+1}/{len(self.V['round'])}")
        b.add_widget(hdr)
        word = self.V["round"][self.V["i"]]
        item = next((x for x in self.V["pool"] if x["w"]==word),
                    next((x for x in VOCAB if x["w"]==word), None))
        if not item:
            self._on_vocab_done(); return
        self.V["item"] = item
        opts = _shuffle([item]+_shuffle([x for x in self.V["pool"] if x["w"]!=item["w"]])[:4])
        self.V["opts"] = opts
        # Emoji
        emoji_lbl = Label(text=item["e"], font_size=sp(72),
                          size_hint_y=None, height=dp(110), halign="center", valign="middle")
        emoji_lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        b.add_widget(emoji_lbl)
        # Options
        self.V["opt_btns"] = []
        for o in opts:
            btn = Button(text=o["w"], font_size=sp(16),
                         background_normal="", background_color=EX_WHITE,
                         color=EX_INK, size_hint_y=None, height=dp(52),
                         halign="center")
            with btn.canvas.before:
                btn._cc = Color(*EX_BORDER)
                btn._rr = Line(width=1.5, rounded_rectangle=[btn.x,btn.y,btn.width,btn.height,dp(12)])
            btn.bind(pos=lambda w,v: setattr(w._rr,"rounded_rectangle",[w.x,w.y,w.width,w.height,dp(12)]))
            btn.bind(size=lambda w,v: setattr(w._rr,"rounded_rectangle",[w.x,w.y,w.width,w.height,dp(12)]))
            _w = o["w"]
            btn.bind(on_press=lambda b2, w=_w: self._handle_vocab_ans(w))
            b.add_widget(btn)
            self.V["opt_btns"].append((o["w"], btn))
        self.V["hint_lbl"] = _lbl("", size=sp(13), color=EX_CORAL)
        b.add_widget(self.V["hint_lbl"])

    def _handle_vocab_ans(self, word):
        if self.V.get("picked"): return
        self.V["picked"] = word
        item = self.V["item"]
        correct = word == item["w"]
        if correct: self._add_score(1)
        for w, btn in self.V["opt_btns"]:
            btn.disabled = True
            if w == item["w"]:
                btn.background_color = EX_GOOD_BG
                btn._cc.rgba = EX_LIME
            elif w == word and not correct:
                btn.background_color = EX_BAD_BG
                btn._cc.rgba = EX_CORAL
            else:
                btn.color = (*EX_INK[:3], 0.3)
        if not correct and self.V.get("hint_lbl"):
            self.V["hint_lbl"].text = rtl(f"{self.S['name']}, התשובה הנכונה היא: {item['w']}")
        self._commit_prog({"vocab":{"round":self.V["round"],"i":self.V["i"],"left":self._timer_left}})
        Clock.schedule_once(lambda *_: self._vocab_next(), 2.2)

    def _vocab_next(self):
        if self.S["screen"] != "p1": return
        self.V["picked"] = None
        self.V["i"] += 1
        if self.V["i"] >= len(self.V["round"]):
            self._on_vocab_done()
        else:
            self._build_vocab_ui()

    def _on_vocab_done(self, *_):
        self._stop_timer()
        ns = list(set(self.S["seen"]+self.V.get("round",[])))
        self.S["seen"] = ns
        s_set(_k_seen(self.S["phone"]), ns)
        self._go("p2")

    # ── Part 2: Cloze ─────────────────────────────────────────────────────────
    def _render_cloze(self):
        saved = self.S["prog"].get("cloze")
        lvl   = _level_for_age(self.S["age"])
        if saved and saved.get("id"):
            self.C["item"] = next((x for x in CLOZE if x["id"]==saved["id"]), CLOZE[0])
        else:
            pool = [x for x in CLOZE if abs(x["lvl"]-lvl)<=2]
            src  = pool if pool else CLOZE
            self.C["item"] = random.choice(src)
        item = self.C["item"]
        self.C["bank"]   = saved["bank"]   if saved and "bank"   in saved else _shuffle(item["answers"]+item["decoys"])
        self.C["filled"] = saved["filled"] if saved and "filled" in saved else {}
        self.C["used"]   = saved["used"]   if saved and "used"   in saved else []
        self.C["sel"]    = None
        self.C["num_inp"]= None
        self._build_cloze_ui()
        self._start_timer(saved.get("left") if saved else None,
                          TIME_SECS["cloze"], lambda *_: self._go("p3"))

    def _cloze_story_markup(self):
        parts = re.split(r'(\{\d+\})', self.C["item"]["text"])
        out = []
        for p in parts:
            m = re.match(r'^\{(\d+)\}$', p)
            if m:
                n = int(m.group(1))
                w = self.C["filled"].get(n)
                if w:
                    out.append(f"[color=3fbf6f][b]{w}[/b][/color]")
                else:
                    out.append(f"[color=6c5ce7][b][{n}][/b][/color]")
            else:
                out.append(p.replace("[","\\[").replace("]","\\]"))
        return "".join(out)

    def _build_cloze_ui(self):
        self._body.clear_widgets()
        b = self._body
        filled_count = len(self.C["filled"])
        hdr = self._part_bar("חלק 2 · השלמת מילים", self.C["item"]["title"],
                             f"{filled_count}/{len(self.C['item']['answers'])}")
        b.add_widget(hdr)
        # Story with markup
        story_lbl = Label(text=self._cloze_story_markup(), markup=True,
                          font_size=sp(13), halign="left", valign="top",
                          size_hint_y=None, color=EX_INK)
        story_lbl.bind(width=lambda i,w: setattr(i,"text_size",(w,None)))
        story_lbl.bind(texture_size=lambda i,v: setattr(i,"height",v[1]+dp(4)))
        with story_lbl.canvas.before:
            Color(*EX_WHITE)
            story_lbl._sbg = RoundedRectangle(pos=story_lbl.pos, size=story_lbl.size, radius=[dp(12)])
        story_lbl.bind(pos=lambda w,v: setattr(w._sbg,"pos",v))
        story_lbl.bind(size=lambda w,v: setattr(w._sbg,"size",v))
        story_lbl.padding = (dp(10), dp(8))
        b.add_widget(story_lbl)
        self.C["story_lbl"] = story_lbl
        # Word bank (4 columns)
        cols = 4
        bank_grid = GridLayout(cols=cols, size_hint_y=None, spacing=dp(6))
        bank_grid.bind(minimum_height=bank_grid.setter("height"))
        self.C["chip_btns"] = {}
        for w in self.C["bank"]:
            used = w in self.C["used"]
            chip = Button(text=w, font_size=sp(13),
                          background_normal="", background_color=EX_WHITE if not used else (0.9,0.9,0.9,0.5),
                          color=(*EX_INK[:3],0.3) if used else EX_INK,
                          size_hint_y=None, height=dp(36), disabled=used)
            with chip.canvas.before:
                chip._cc = Color(*EX_BORDER if not used else (0.8,0.8,0.8,1))
                chip._rr = Line(width=1.2, rounded_rectangle=[chip.x,chip.y,chip.width,chip.height,dp(8)])
            chip.bind(pos=lambda w2,v,c=chip: setattr(c._rr,"rounded_rectangle",[c.x,c.y,c.width,c.height,dp(8)]))
            chip.bind(size=lambda w2,v,c=chip: setattr(c._rr,"rounded_rectangle",[c.x,c.y,c.width,c.height,dp(8)]))
            _word = w
            chip.bind(on_press=lambda b2, ww=_word: self._select_chip(ww))
            bank_grid.add_widget(chip)
            self.C["chip_btns"][w] = chip
        b.add_widget(bank_grid)
        # Placer area (rebuilt when chip selected)
        self.C["placer_box"] = BoxLayout(orientation="vertical", size_hint_y=None, height=0)
        b.add_widget(self.C["placer_box"])

    def _select_chip(self, word):
        self.C["sel"] = word
        for w, chip in self.C["chip_btns"].items():
            chip._cc.rgba = EX_VIOLET if w==word else (EX_BORDER if w not in self.C["used"] else (0.8,0.8,0.8,1))
        self._build_placer()

    def _build_placer(self):
        pb = self.C.get("placer_box")
        if not pb: return
        pb.clear_widgets()
        if not self.C["sel"]:
            pb.height = 0; return
        pb.spacing = dp(6); pb.padding = (0,dp(4))
        row = BoxLayout(size_hint_y=None, height=dp(44), spacing=dp(6))
        lbl = Label(text=rtl(f"לאיזה מספר לשבץ את: {self.C['sel']}"),
                    font_name="Hebrew", font_size=sp(13), color=EX_INK,
                    halign="right", valign="middle")
        lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        num_inp = TextInput(hint_text="#", input_filter="int",
                            multiline=False, font_size=sp(16),
                            size_hint=(None,1), width=dp(64))
        self.C["num_inp"] = num_inp
        place_btn = _primary_btn("שבץ", height=dp(44))
        place_btn.size_hint_x = None; place_btn.width = dp(70)
        place_btn.bind(on_press=lambda *_: self._handle_cloze_place())
        cancel_btn = _ghost_btn("ביטול", height=dp(44))
        cancel_btn.size_hint_x = None; cancel_btn.width = dp(70)
        cancel_btn.bind(on_press=lambda *_: self._clear_cloze_sel())
        row.add_widget(cancel_btn)
        row.add_widget(place_btn)
        row.add_widget(num_inp)
        row.add_widget(lbl)
        pb.add_widget(row)
        pb.height = dp(44)+dp(10)
        num_inp.focus = True

    def _clear_cloze_sel(self):
        self.C["sel"] = None
        for w, chip in self.C["chip_btns"].items():
            chip._cc.rgba = EX_BORDER if w not in self.C["used"] else (0.8,0.8,0.8,1)
        pb = self.C.get("placer_box")
        if pb: pb.clear_widgets(); pb.height = 0

    def _handle_cloze_place(self):
        ni = self.C.get("num_inp")
        sel = self.C.get("sel","")
        if not ni or not sel: return
        try: n = int(ni.text)
        except ValueError: return
        answers = self.C["item"]["answers"]
        if n < 1 or n > len(answers): return
        if answers[n-1]==sel and n not in self.C["filled"]:
            self.C["filled"][n] = sel
            self.C["used"].append(sel)
            self._add_score(1)
            self._show_toast("good","נכון מאוד!")
            self._commit_prog({"cloze":{"id":self.C["item"]["id"],"bank":self.C["bank"],
                                        "filled":self.C["filled"],"used":self.C["used"],
                                        "left":self._timer_left}})
            if len(self.C["filled"]) >= len(answers):
                self._stop_timer()
                Clock.schedule_once(lambda *_: self._go("p3"), 1.2)
            else:
                self.C["sel"] = None
                self._build_cloze_ui()
        else:
            self._show_toast("bad",f"{self.S['name']}, נסה/י שוב")
            self._clear_cloze_sel()

    # ── Part 3: Reading ───────────────────────────────────────────────────────
    def _render_reading(self):
        saved = self.S["prog"].get("reading")
        lvl   = _level_for_age(self.S["age"])
        if saved and saved.get("id"):
            self.R["story"] = next((x for x in STORIES if x["id"]==saved["id"]), STORIES[0])
        else:
            pool = [x for x in STORIES if abs(x["lvl"]-lvl)<=2]
            src  = pool if pool else STORIES
            self.R["story"] = random.choice(src)
        qpool = self.R["story"]["qpool"]
        self.R["qIdx"]   = saved["qIdx"] if saved and "qIdx" in saved else _shuffle(list(range(len(qpool))))[:QUOTA["reading"]]
        self.R["qi"]     = saved.get("qi",0) if saved else 0
        self.R["reading"]= True if not saved else (saved.get("qi",0)==0)
        self.R["picked"] = None
        self._build_reading_ui()
        self._start_timer(saved.get("left") if saved else None,
                          TIME_SECS["reading"], lambda *_: self._go("p4"))

    def _build_reading_ui(self):
        self._body.clear_widgets()
        b = self._body
        qs = [self.R["story"]["qpool"][k] for k in self.R["qIdx"]]
        ctr = "" if self.R["reading"] else f"{self.R['qi']+1}/{len(qs)}"
        hdr = self._part_bar("חלק 3 · הבנת הנקרא", self.R["story"]["title"], ctr)
        b.add_widget(hdr)
        if self.R["reading"]:
            # Story view
            story_text = self.R["story"]["text"].replace("\n\n","\n\n")
            lbl = Label(text=story_text, font_size=sp(13), halign="left", valign="top",
                        size_hint_y=None, color=EX_INK)
            lbl.bind(width=lambda i,w: setattr(i,"text_size",(w,None)))
            lbl.bind(texture_size=lambda i,v: setattr(i,"height",v[1]+dp(4)))
            with lbl.canvas.before:
                Color(*EX_WHITE)
                lbl._bg = RoundedRectangle(pos=lbl.pos, size=lbl.size, radius=[dp(12)])
            lbl.bind(pos=lambda w,v: setattr(w._bg,"pos",v))
            lbl.bind(size=lambda w,v: setattr(w._bg,"size",v))
            lbl.padding = (dp(10),dp(8))
            b.add_widget(lbl)
            b.add_widget(_primary_btn("סיימתי לקרוא — לשאלות",
                                      on_press=lambda: self._set_reading_questions()))
        else:
            # Question view
            q = qs[self.R["qi"]]
            q_lbl = Label(text=q["q"], font_size=sp(15), halign="left", valign="top",
                          size_hint_y=None, color=EX_INK)
            q_lbl.bind(width=lambda i,w: setattr(i,"text_size",(w,None)))
            q_lbl.bind(texture_size=lambda i,v: setattr(i,"height",v[1]+dp(4)))
            with q_lbl.canvas.before:
                Color(*EX_WHITE)
                q_lbl._bg = RoundedRectangle(pos=q_lbl.pos, size=q_lbl.size, radius=[dp(12)])
            q_lbl.bind(pos=lambda w,v: setattr(w._bg,"pos",v))
            q_lbl.bind(size=lambda w,v: setattr(w._bg,"size",v))
            q_lbl.padding = (dp(10),dp(8))
            b.add_widget(q_lbl)
            self.R["opt_btns"] = []
            for idx, o_text in enumerate(q["o"]):
                btn = Button(text=o_text, font_size=sp(14),
                             background_normal="", background_color=EX_WHITE,
                             color=EX_INK, size_hint_y=None, height=dp(52),
                             halign="left")
                btn.text_size = (None, None)
                with btn.canvas.before:
                    btn._cc = Color(*EX_BORDER)
                    btn._rr = Line(width=1.5, rounded_rectangle=[btn.x,btn.y,btn.width,btn.height,dp(12)])
                btn.bind(pos=lambda w,v: setattr(w._rr,"rounded_rectangle",[w.x,w.y,w.width,w.height,dp(12)]))
                btn.bind(size=lambda w,v: setattr(w._rr,"rounded_rectangle",[w.x,w.y,w.width,w.height,dp(12)]))
                _i = idx
                btn.bind(on_press=lambda b2, i=_i: self._handle_reading_ans(i))
                b.add_widget(btn)
                self.R["opt_btns"].append((idx, btn))
            b.add_widget(_ghost_btn("חזרה לסיפור", on_press=lambda: self._set_reading_story()))

    def _set_reading_questions(self):
        self.R["reading"] = False; self._build_reading_ui()

    def _set_reading_story(self):
        self.R["reading"] = True; self._build_reading_ui()

    def _handle_reading_ans(self, idx):
        if self.R.get("picked") is not None: return
        self.R["picked"] = idx
        q = [self.R["story"]["qpool"][k] for k in self.R["qIdx"]][self.R["qi"]]
        if idx == q["c"]: self._add_score(1)
        for i, btn in self.R["opt_btns"]:
            btn.disabled = True
            if i == q["c"]:
                btn.background_color = EX_GOOD_BG; btn._cc.rgba = EX_LIME
            elif i == idx and idx != q["c"]:
                btn.background_color = EX_BAD_BG; btn._cc.rgba = EX_CORAL
            else:
                btn.color = (*EX_INK[:3],0.3)
        self._commit_prog({"reading":{"id":self.R["story"]["id"],"qIdx":self.R["qIdx"],
                                      "qi":self.R["qi"],"left":self._timer_left}})
        Clock.schedule_once(lambda *_: self._reading_next(), 1.8)

    def _reading_next(self):
        if self.S["screen"] != "p3": return
        self.R["picked"] = None; self.R["qi"] += 1
        qs = [self.R["story"]["qpool"][k] for k in self.R["qIdx"]]
        if self.R["qi"] >= len(qs):
            self._stop_timer(); self._go("p4")
        else:
            self._build_reading_ui()

    # ── Part 4: Describe ──────────────────────────────────────────────────────
    def _render_describe(self):
        saved = self.S["prog"].get("pics")
        self.D["idxs"]   = saved["idxs"] if saved and "idxs" in saved else _shuffle(list(range(len(PICTURES))))[:QUOTA["pics"]]
        self.D["i"]      = saved.get("i",0) if saved else 0
        self.D["locked"] = False
        self._build_describe_ui()
        self._start_timer(saved.get("left") if saved else None,
                          TIME_SECS["pics"], self._finish)

    def _build_describe_ui(self):
        self._body.clear_widgets()
        b = self._body
        hdr = self._part_bar("חלק 4 · תיאור תמונה", "כתוב/כתבי באנגלית מה רואים",
                             f"{self.D['i']+1}/{len(self.D['idxs'])}")
        b.add_widget(hdr)
        item = PICTURES[self.D["idxs"][self.D["i"]]]
        emoji_lbl = Label(text=item["e"], font_size=sp(72),
                          size_hint_y=None, height=dp(110), halign="center", valign="middle")
        emoji_lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        b.add_widget(emoji_lbl)
        row = BoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        self.D["inp"] = TextInput(hint_text="type here…", multiline=False,
                                  font_size=sp(16), size_hint_x=0.72)
        self.D["inp"].bind(on_text_validate=lambda *_: self._handle_describe_check())
        check_btn = _primary_btn("בדיקה", height=dp(48))
        check_btn.size_hint_x = 0.28
        check_btn.bind(on_press=lambda *_: self._handle_describe_check())
        self.D["check_btn"] = check_btn
        row.add_widget(self.D["inp"])
        row.add_widget(check_btn)
        b.add_widget(row)

    def _handle_describe_check(self):
        if self.D.get("locked"): return
        val = (self.D["inp"].text or "").strip().lower()
        if not val: return
        item = PICTURES[self.D["idxs"][self.D["i"]]]
        ok = val in item["ok"]
        self.D["locked"] = True
        self.D["inp"].disabled = True
        self.D["check_btn"].disabled = True
        if ok:
            self._add_score(1); self._show_toast("good","נכון מאוד!")
        else:
            self._show_toast("bad",f"{self.S['name']}, התשובה: {item['ok'][0]}")
        self._commit_prog({"pics":{"idxs":self.D["idxs"],"i":self.D["i"],"left":self._timer_left}})
        Clock.schedule_once(lambda *_: self._describe_next(), 1.9)

    def _describe_next(self):
        if self.S["screen"] != "p4": return
        self.D["locked"] = False; self.D["i"] += 1
        if self.D["i"] >= len(self.D["idxs"]):
            self._finish()
        else:
            self._build_describe_ui()

    # ── Paused / Done ─────────────────────────────────────────────────────────
    def _render_paused(self):
        b = self._body; b.add_widget(_spacer())
        card = _card()
        card.add_widget(_lbl("נשמר במכשיר", size=sp(11), color=EX_VIOLET, bold=True))
        card.add_widget(_lbl("המבחן ממתין לך", size=sp(26), bold=True))
        card.add_widget(_lbl("בכניסה הבאה עם אותו מספר טלפון תחזור/י לנקודה הזו.", size=sp(13)))
        card.add_widget(_spacer())
        card.add_widget(_primary_btn("לתפריט", on_press=lambda: self._go("menu")))
        b.add_widget(card)

    def _render_done(self):
        b = self._body; b.add_widget(_spacer())
        card = _card()
        card.add_widget(_lbl("סיימת", size=sp(11), color=EX_VIOLET, bold=True))
        score_row = BoxLayout(size_hint_y=None, height=dp(60))
        score_lbl = Label(text=str(_grade(self.S["score"])), font_size=sp(42), bold=True,
                          color=EX_DEEP, halign="center", valign="middle")
        score_lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        of_lbl = Label(text="/100", font_size=sp(20), color=(*EX_INK[:3],0.5),
                       halign="left", valign="middle")
        score_row.add_widget(score_lbl)
        score_row.add_widget(of_lbl)
        card.add_widget(score_row)
        card.add_widget(_lbl(f"{self.S['score']} תשובות נכונות מתוך {TOTAL}. כל הכבוד, {self.S['name']}!", size=sp(14)))
        if len(self.S["history"]) > 1:
            card.add_widget(_lbl("מבחנים קודמים", size=sp(11), color=EX_VIOLET, bold=True))
            for r in self.S["history"][:5]:
                hrow = BoxLayout(size_hint_y=None, height=dp(34))
                hrow.add_widget(Label(text=str(r["g"])+"/100", font_size=sp(14),
                                      bold=True, color=EX_VIOLET, halign="center", valign="middle"))
                hrow.add_widget(Label(text=_fmt_date(r["t"]), font_size=sp(13),
                                      color=EX_INK, halign="center", valign="middle"))
                card.add_widget(hrow)
        card.add_widget(_spacer())
        card.add_widget(_primary_btn("סבב נוסף", on_press=lambda: self._new_round()))
        b.add_widget(card)

    def _new_round(self):
        self.S["score"] = 0; self.S["prog"] = {}; self._go("menu")

    # ── Part bar ──────────────────────────────────────────────────────────────
    def _part_bar(self, eyebrow, lead, counter=""):
        bar = BoxLayout(size_hint_y=None, height=dp(60), spacing=dp(8))
        left = BoxLayout(orientation="vertical", spacing=dp(2))
        ey = _lbl(eyebrow, size=sp(10), color=EX_VIOLET, bold=True)
        ld = _lbl(lead, size=sp(15), bold=True)
        left.add_widget(ey); left.add_widget(ld)
        right = BoxLayout(orientation="vertical", size_hint_x=None, width=dp(90),
                          spacing=dp(2))
        self._counter_lbl = Label(text=rtl(counter), font_name="Hebrew", font_size=sp(11),
                                  color=(*EX_INK[:3],0.65), halign="right", valign="middle",
                                  size_hint_y=None, height=dp(22))
        self._counter_lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        self._timer_lbl = Label(text="--:--", font_size=sp(14), bold=True,
                                color=EX_DEEP, halign="center", valign="middle",
                                size_hint_y=None, height=dp(24))
        self._timer_lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        self._timer_bar = ProgressBar(max=100, value=100, size_hint_y=None, height=dp(6))
        right.add_widget(self._counter_lbl)
        right.add_widget(self._timer_lbl)
        right.add_widget(self._timer_bar)
        bar.add_widget(right)
        bar.add_widget(left)
        return bar

    # ── Timer ─────────────────────────────────────────────────────────────────
    def _start_timer(self, saved_left, total, on_end):
        self._stop_timer()
        self._timer_total = total
        self._timer_left  = int(saved_left) if saved_left is not None else total
        self._on_time_up  = on_end
        self._update_timer_ui()
        self._timer_ev = Clock.schedule_interval(self._tick, 1)

    def _stop_timer(self):
        if self._timer_ev:
            self._timer_ev.cancel(); self._timer_ev = None

    def _tick(self, dt):
        self._timer_left = max(0, self._timer_left-1)
        self._update_timer_ui()
        if self._timer_left <= 0:
            self._stop_timer()
            if self._on_time_up: self._on_time_up()

    def _update_timer_ui(self):
        t = self._timer_left
        if self._timer_lbl:
            self._timer_lbl.text = _fmt_time(t)
            self._timer_lbl.color = EX_CORAL if t<=30 else EX_DEEP
        if self._timer_bar:
            self._timer_bar.value = (t/max(1,self._timer_total))*100

    # ── Score ──────────────────────────────────────────────────────────────────
    def _add_score(self, n):
        self.S["score"] += n
        if self._score_lbl:
            self._score_lbl.text = f"{_grade(self.S['score'])}/100"

    # ── Toast ──────────────────────────────────────────────────────────────────
    def _show_toast(self, kind, text):
        if self._toast_ev: self._toast_ev.cancel()
        if self._toast_lbl and self._toast_lbl.parent:
            self._toast_lbl.parent.remove_widget(self._toast_lbl)
        icon = "✓" if kind=="good" else "✗"
        color = EX_LIME if kind=="good" else EX_CORAL
        lbl = Label(text=f"{icon}  {rtl(text)}", font_name="Hebrew", font_size=sp(15),
                    bold=True, color=EX_WHITE, size_hint=(None,None),
                    size=(dp(260),dp(48)), pos_hint={"center_x":0.5},
                    halign="center", valign="middle")
        lbl.bind(size=lambda i,s: setattr(i,"text_size",s))
        with lbl.canvas.before:
            Color(*EX_DEEP)
            lbl._tbg = RoundedRectangle(pos=lbl.pos, size=lbl.size, radius=[dp(14)])
        lbl.bind(pos=lambda w,v: setattr(w._tbg,"pos",v))
        lbl.bind(size=lambda w,v: setattr(w._tbg,"size",v))
        # Position above bottom
        lbl.pos = (Window.width/2-dp(130), dp(30))
        self._toast_lbl = lbl
        from kivy.core.window import Window as _W
        _W.add_widget(lbl)
        self._toast_ev = Clock.schedule_once(lambda *_: self._remove_toast(), 1.6)

    def _remove_toast(self):
        if self._toast_lbl and self._toast_lbl.parent:
            self._toast_lbl.parent.remove_widget(self._toast_lbl)
        self._toast_lbl = None

    # ── Persist ───────────────────────────────────────────────────────────────
    def _commit_prog(self, sl):
        self.S["prog"].update(sl); self._save_session()

    def _save_session(self):
        sc = self.S["screen"]
        if not self.S["phone"] or sc in ("login","resume"): return
        s_set(_k_session(self.S["phone"]),
              {"name":self.S["name"],"age":self.S["age"],"score":self.S["score"],
               "screen":sc,"prog":self.S["prog"],"t":__import__("time").time()*1000})

    # ── Actions ────────────────────────────────────────────────────────────────
    def _do_enter(self):
        self.S["name"]  = self._inp_name.text.strip()
        self.S["phone"] = self._inp_phone.text.strip()
        self.S["age"]   = int(self._age_slider.value)
        if not self._login_ok(): return
        ses  = s_get(_k_session(self.S["phone"]))
        hist = s_get(_k_results(self.S["phone"]))
        seen = s_get(_k_seen(self.S["phone"]))
        self.S["history"] = hist or []
        self.S["seen"]    = seen or []
        if ses and ses.get("screen") and ses["screen"]!="done":
            self.S["found"] = ses; self._go("resume")
        else:
            self.S["prog"] = {}; self.S["score"] = 0; self._go("menu")

    def _do_resume(self):
        f = self.S["found"]
        self.S["name"]   = f.get("name") or self.S["name"]
        self.S["age"]    = f.get("age")  or self.S["age"]
        self.S["score"]  = f.get("score",0)
        self.S["prog"]   = f.get("prog",{})
        self.S["found"]  = None
        self._go(f["screen"])

    def _do_fresh(self):
        s_del(_k_session(self.S["phone"]))
        self.S["prog"] = {}; self.S["score"] = 0
        self.S["found"] = None; self._go("menu")

    def _pause(self):
        sc = self.S["screen"]
        if sc=="p1" and self.V.get("item"):
            self._commit_prog({"vocab":{"round":self.V["round"],"i":self.V["i"],"left":self._timer_left}})
        elif sc=="p2" and self.C.get("item"):
            self._commit_prog({"cloze":{"id":self.C["item"]["id"],"bank":self.C["bank"],
                                        "filled":self.C["filled"],"used":self.C["used"],"left":self._timer_left}})
        elif sc=="p3" and self.R.get("story"):
            self._commit_prog({"reading":{"id":self.R["story"]["id"],"qIdx":self.R["qIdx"],
                                          "qi":self.R["qi"],"left":self._timer_left}})
        elif sc=="p4" and self.D.get("idxs"):
            self._commit_prog({"pics":{"idxs":self.D["idxs"],"i":self.D["i"],"left":self._timer_left}})
        self._go("paused")

    def _finish(self):
        self._stop_timer()
        import time
        rec = {"t":time.time()*1000,"name":self.S["name"],
               "lvl":_level_for_age(self.S["age"]),
               "correct":self.S["score"],"total":TOTAL,"g":_grade(self.S["score"])}
        self.S["history"] = ([rec]+self.S["history"])[:30]
        s_set(_k_results(self.S["phone"]), self.S["history"])
        s_del(_k_session(self.S["phone"]))
        self.S["prog"] = {}
        self._go("done")
