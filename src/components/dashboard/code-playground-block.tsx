"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, ChevronRight, Download, FilePlus,
  FolderOpen, Globe, Maximize2, Minimize2, Package, Play, RotateCcw,
  Send, Terminal, UserPlus, Users, Wifi, X,
} from "lucide-react";
import { zipSync } from "fflate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Monaco is large — load only on client, never on server
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

// ── Constants ─────────────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { value: "python",      label: "Python 3",        monacoLang: "python" },
  { value: "javascript",  label: "JavaScript",      monacoLang: "javascript" },
  { value: "typescript",  label: "TypeScript",      monacoLang: "typescript" },
  { value: "java",        label: "Java",            monacoLang: "java" },
  { value: "c",           label: "C",               monacoLang: "c" },
  { value: "cpp",         label: "C++",             monacoLang: "cpp" },
  { value: "csharp",      label: "C#",              monacoLang: "csharp" },
  { value: "go",          label: "Go",              monacoLang: "go" },
  { value: "rust",        label: "Rust",            monacoLang: "rust" },
  { value: "kotlin",      label: "Kotlin",          monacoLang: "kotlin" },
  { value: "swift",       label: "Swift",           monacoLang: "swift" },
  { value: "php",         label: "PHP",             monacoLang: "php" },
  { value: "ruby",        label: "Ruby",            monacoLang: "ruby" },
  { value: "scala",       label: "Scala",           monacoLang: "scala" },
  { value: "r",           label: "R",               monacoLang: "r" },
  { value: "bash",        label: "Bash",            monacoLang: "shell" },
  { value: "sql",         label: "SQL",             monacoLang: "sql" },
  { value: "lua",         label: "Lua",             monacoLang: "lua" },
  { value: "perl",        label: "Perl",            monacoLang: "perl" },
  { value: "haskell",     label: "Haskell",         monacoLang: "plaintext" },
  { value: "clojure",     label: "Clojure",         monacoLang: "clojure" },
  { value: "elixir",      label: "Elixir",          monacoLang: "elixir" },
  { value: "erlang",      label: "Erlang",          monacoLang: "plaintext" },
  { value: "fsharp",      label: "F#",              monacoLang: "fsharp" },
  { value: "commonlisp",  label: "Common Lisp",     monacoLang: "scheme" },
  { value: "ocaml",       label: "OCaml",           monacoLang: "plaintext" },
  { value: "groovy",      label: "Groovy",          monacoLang: "java" },
  { value: "d",           label: "D",               monacoLang: "plaintext" },
  { value: "objectivec",  label: "Objective-C",     monacoLang: "objective-c" },
  { value: "assembly",    label: "Assembly (NASM)",  monacoLang: "plaintext" },
  { value: "python2",     label: "Python 2",        monacoLang: "python" },
  { value: "fortran",     label: "Fortran",         monacoLang: "plaintext" },
  { value: "pascal",      label: "Pascal",          monacoLang: "pascal" },
  { value: "cobol",       label: "COBOL",           monacoLang: "plaintext" },
  { value: "basic",       label: "Basic",           monacoLang: "vb" },
  { value: "vbnet",       label: "VB.Net",          monacoLang: "vb" },
  { value: "prolog",      label: "Prolog",          monacoLang: "plaintext" },
  { value: "octave",      label: "Octave",          monacoLang: "matlab" },
  { value: "html",        label: "HTML",            monacoLang: "html" },
  { value: "css",         label: "CSS",             monacoLang: "css" },
] as const;

// Languages that render in the browser iframe — no Judge0 needed
const WEB_LANGUAGES = new Set(["html", "css"]);

// ── Turtle shim — injected into Pyodide's sys.modules before user code runs ──
// Implements the standard turtle API on top of an HTML5 Canvas via JS interop.
const TURTLE_SHIM = `
import sys as _sys, types as _types, math as _math

try:
    from js import document as _doc
    _el  = _doc.getElementById('kat-turtle-canvas')
    _ctx = _el.getContext('2d')
    _W   = int(_el.width)
    _H   = int(_el.height)
    _OK  = True
except Exception:
    _OK = False
    _W  = 480
    _H  = 360

class _State:
    def __init__(self):
        self.x   = 0.0;  self.y  = 0.0;  self.a   = 90.0
        self.pen = True; self.pc = 'black'; self.fc = 'black'
        self.bg  = 'white'; self.ps = 1
        self.fl  = False; self.fp = []; self.vis = True

_s = _State()

def _cv(x, y):
    return _W / 2 + x, _H / 2 - y

def _clr():
    if not _OK: return
    _ctx.clearRect(0, 0, _W, _H)
    _ctx.fillStyle = _s.bg
    _ctx.fillRect(0, 0, _W, _H)

_clr()

def _stroke(x1, y1, x2, y2):
    if not (_OK and _s.pen): return
    cx1, cy1 = _cv(x1, y1); cx2, cy2 = _cv(x2, y2)
    _ctx.beginPath(); _ctx.moveTo(cx1, cy1); _ctx.lineTo(cx2, cy2)
    _ctx.strokeStyle = _s.pc; _ctx.lineWidth = _s.ps; _ctx.stroke()

def _mv(d):
    r = _math.radians(_s.a)
    nx = _s.x + d * _math.cos(r); ny = _s.y + d * _math.sin(r)
    _stroke(_s.x, _s.y, nx, ny)
    if _s.fl: _s.fp.append(_cv(nx, ny))
    _s.x = nx; _s.y = ny

def forward(d): _mv(d)
def fd(d): _mv(d)
def backward(d): _mv(-d)
def bk(d): _mv(-d)
def back(d): _mv(-d)
def right(a): _s.a -= a
def rt(a): right(a)
def left(a): _s.a += a
def lt(a): left(a)

def goto(x, y=None):
    if y is None: x, y = x[0], x[1]
    ox, oy = _s.x, _s.y; _s.x = float(x); _s.y = float(y)
    _stroke(ox, oy, _s.x, _s.y)
    if _s.fl: _s.fp.append(_cv(_s.x, _s.y))

def setpos(x, y=None): goto(x, y)
def setposition(x, y=None): goto(x, y)
def setx(x): goto(x, _s.y)
def sety(y): goto(_s.x, y)

def home():
    goto(0, 0); _s.a = 90.0

def pos():      return (_s.x, _s.y)
def position(): return pos()
def xcor():     return _s.x
def ycor():     return _s.y
def heading():  return _s.a % 360

def setheading(a): _s.a = float(a)
def seth(a): setheading(a)

def towards(x, y=None):
    if y is None: x, y = x[0], x[1]
    return _math.degrees(_math.atan2(y - _s.y, x - _s.x)) % 360

def distance(x, y=None):
    if y is None: x, y = x[0], x[1]
    return _math.hypot(x - _s.x, y - _s.y)

def penup():  _s.pen = False
def pu():     penup()
def up():     penup()
def pendown(): _s.pen = True
def pd():     pendown()
def down():   pendown()
def isdown(): return _s.pen

def pencolor(*a):
    if   len(a) == 1: _s.pc = a[0]
    elif len(a) == 3: _s.pc = 'rgb({},{},{})'.format(int(a[0]*255), int(a[1]*255), int(a[2]*255))
    else: return _s.pc

def fillcolor(*a):
    if   len(a) == 1: _s.fc = a[0]
    elif len(a) == 3: _s.fc = 'rgb({},{},{})'.format(int(a[0]*255), int(a[1]*255), int(a[2]*255))
    else: return _s.fc

def color(*a):
    if   len(a) == 1: pencolor(a[0]);    fillcolor(a[0])
    elif len(a) == 2: pencolor(a[0]);    fillcolor(a[1])
    elif len(a) == 3: pencolor(*a);      fillcolor(*a)
    else:             return (_s.pc, _s.fc)

def pensize(w=None):
    if w is None: return _s.ps
    _s.ps = w
def width(w=None): return pensize(w)
def speed(s=None):
    if s is None: return 6
def begin_fill():
    _s.fl = True; _s.fp = [_cv(_s.x, _s.y)]

def end_fill():
    if not (_OK and _s.fl): _s.fl = False; return
    pts = _s.fp
    if len(pts) < 2: _s.fl = False; return
    _ctx.beginPath(); _ctx.moveTo(pts[0][0], pts[0][1])
    for px, py in pts[1:]: _ctx.lineTo(px, py)
    _ctx.closePath(); _ctx.fillStyle = _s.fc; _ctx.fill()
    _s.fl = False; _s.fp = []

def dot(sz=None, *col):
    if not _OK: return
    if sz is None: sz = max(4, _s.ps + 4)
    c = col[0] if col else _s.pc
    cx, cy = _cv(_s.x, _s.y)
    _ctx.beginPath(); _ctx.arc(cx, cy, sz / 2, 0, 2 * _math.pi)
    _ctx.fillStyle = c; _ctx.fill()

def circle(r, extent=None, steps=None):
    if extent is None: extent = 360
    n = steps or max(int(abs(r) * abs(extent) / _math.pi / 8), 8)
    sa = float(extent) / n
    dist = 2 * abs(r) * _math.sin(_math.radians(abs(sa) / 2))
    sign = 1 if r >= 0 else -1
    left(sign * sa / 2)
    for _ in range(n):
        forward(dist)
        left(sign * sa)
    left(-sign * sa / 2)

def write(txt, move=False, align='left', font=('Arial', 12, 'normal')):
    if not _OK: return
    cx, cy = _cv(_s.x, _s.y)
    fn  = font[0] if font else 'Arial'
    fs  = font[1] if len(font) > 1 else 12
    fst = font[2] if len(font) > 2 else 'normal'
    _ctx.font = '{} {}px {}'.format(fst, fs, fn)
    _ctx.fillStyle = _s.pc
    _ctx.fillText(str(txt), cx, cy)

def stamp():       pass
def shape(s=None): pass

def clear():
    global _s
    saved_bg = _s.bg
    _s = _State(); _s.bg = saved_bg
    if _OK: _clr()

def reset():
    global _s
    _s = _State()
    if _OK: _clr()

def clearscreen(): reset()
def hideturtle():  _s.vis = False
def ht():          hideturtle()
def showturtle():  _s.vis = True
def st():          showturtle()
def isvisible():   return _s.vis

def bgcolor(c=None):
    if c is None: return _s.bg
    _s.bg = c
    if _OK:
        _ctx.fillStyle = c
        _ctx.fillRect(0, 0, _W, _H)

def title(t):         pass
def done():           pass
def mainloop():       pass
def bye():            pass
def exitonclick():    pass
def tracer(*a, **kw): pass
def update():         pass
def delay(d=None):    pass
def setup(*a, **kw):  pass
def screensize(*a, **kw): pass
def mode(m=None):     pass
def window_width():   return _W
def window_height():  return _H

class Turtle:
    def forward(self, d):              forward(d)
    def fd(self, d):                   forward(d)
    def backward(self, d):             backward(d)
    def bk(self, d):                   backward(d)
    def back(self, d):                 backward(d)
    def right(self, a):                right(a)
    def rt(self, a):                   right(a)
    def left(self, a):                 left(a)
    def lt(self, a):                   left(a)
    def goto(self, x, y=None):         goto(x, y)
    def setpos(self, x, y=None):       goto(x, y)
    def setposition(self, x, y=None):  goto(x, y)
    def setx(self, x):                 setx(x)
    def sety(self, y):                 sety(y)
    def setheading(self, a):           setheading(a)
    def seth(self, a):                 setheading(a)
    def home(self):                    home()
    def pos(self):                     return pos()
    def position(self):                return pos()
    def xcor(self):                    return xcor()
    def ycor(self):                    return ycor()
    def heading(self):                 return heading()
    def towards(self, x, y=None):      return towards(x, y)
    def distance(self, x, y=None):     return distance(x, y)
    def penup(self):                   penup()
    def pu(self):                      penup()
    def up(self):                      penup()
    def pendown(self):                 pendown()
    def pd(self):                      pendown()
    def down(self):                    pendown()
    def isdown(self):                  return isdown()
    def pencolor(self, *a):            pencolor(*a)
    def fillcolor(self, *a):           fillcolor(*a)
    def color(self, *a):               color(*a)
    def pensize(self, w=None):         return pensize(w)
    def width(self, w=None):           return pensize(w)
    def speed(self, s=None):           pass
    def begin_fill(self):              begin_fill()
    def end_fill(self):                end_fill()
    def dot(self, sz=None, *c):        dot(sz, *c)
    def circle(self, r, e=None, s=None): circle(r, e, s)
    def write(self, t, move=False, align='left', font=('Arial',12,'normal')): write(t, move, align, font)
    def clear(self):                   clear()
    def reset(self):                   reset()
    def stamp(self):                   pass
    def shape(self, s=None):           pass
    def hideturtle(self):              hideturtle()
    def ht(self):                      hideturtle()
    def showturtle(self):              showturtle()
    def st(self):                      showturtle()
    def isvisible(self):               return isvisible()
    def __repr__(self):                return '<Turtle>'

class _Screen:
    def bgcolor(self, c=None):           return bgcolor(c)
    def title(self, t):                  pass
    def setup(self, *a, **kw):           pass
    def tracer(self, *a, **kw):          pass
    def update(self):                    pass
    def mainloop(self):                  pass
    def exitonclick(self):               pass
    def bye(self):                       pass
    def window_width(self):              return _W
    def window_height(self):             return _H
    def screensize(self, *a, **kw):      pass
    def delay(self, d=None):             pass
    def mode(self, m=None):              pass
    def listen(self, *a, **kw):          pass
    def onkey(self, *a, **kw):           pass
    def onkeypress(self, *a, **kw):      pass
    def onkeyrelease(self, *a, **kw):    pass
    def onclick(self, *a, **kw):         pass
    def ontimer(self, *a, **kw):         pass
    def setworldcoordinates(self, *a):   pass
    def __repr__(self):                  return '<Screen>'

def Screen():    return _Screen()
def getscreen(): return _Screen()

_m = _types.ModuleType('turtle')
_m.__dict__.update({k: v for k, v in list(globals().items()) if not k.startswith('_')})
_m.Turtle    = Turtle
_m._Screen   = _Screen
_m.Screen    = Screen
_m.getscreen = getscreen
_sys.modules['turtle'] = _m
`;

// ── Pygame shim — canvas-backed pygame API for Pyodide ────────────────────────
const PYGAME_SHIM = `
import sys as _sys, types as _types, math as _math

try:
    from js import document as _doc
    _canvas = _doc.getElementById('kat-turtle-canvas')
    _ctx    = _canvas.getContext('2d')
    _W      = int(_canvas.width)
    _H      = int(_canvas.height)
    _OK     = True
except Exception:
    _OK = False
    _W, _H  = 480, 360

_frame   = 0
_MAX_FRM = 500   # ~8 s at 60 fps — enough to see the result

# ── Color helpers ───────────────────────────────────────────────────────────────
def _css(c):
    if isinstance(c, str): return c
    if hasattr(c, 'r'): return f'rgba({int(c.r)},{int(c.g)},{int(c.b)},{int(getattr(c,"a",255))/255:.3f})'
    r,g,b = int(c[0]),int(c[1]),int(c[2])
    a = int(c[3]) if len(c)>3 else 255
    return f'rgb({r},{g},{b})' if a==255 else f'rgba({r},{g},{b},{a/255:.3f})'

# ── Constants ───────────────────────────────────────────────────────────────────
QUIT=12; KEYDOWN=2; KEYUP=3; MOUSEBUTTONDOWN=5; MOUSEBUTTONUP=6; MOUSEMOTION=4
K_UP=273; K_DOWN=274; K_LEFT=276; K_RIGHT=275; K_SPACE=32; K_RETURN=13
K_ESCAPE=27; K_a=97; K_b=98; K_c=99; K_d=100; K_e=101; K_f=102
K_g=103; K_h=104; K_i=105; K_j=106; K_k=107; K_l=108; K_m=109
K_n=110; K_o=111; K_p=112; K_q=113; K_r=114; K_s=115; K_t=116
K_u=117; K_v=118; K_w=119; K_x=120; K_y=121; K_z=122
K_0=48; K_1=49; K_2=50; K_3=51; K_4=52; K_5=53; K_6=54; K_7=55; K_8=56; K_9=57
RESIZABLE=1; FULLSCREEN=2; NOFRAME=4; DOUBLEBUF=1; HWSURFACE=1
SRCALPHA=65536

# ── Color class ─────────────────────────────────────────────────────────────────
class Color:
    def __init__(self,r,g=0,b=0,a=255):
        if isinstance(r,(list,tuple)): r,g,b=int(r[0]),int(r[1]),int(r[2]); a=int(r[3]) if len(r)>3 else 255
        self.r=int(r); self.g=int(g); self.b=int(b); self.a=int(a)
    def __iter__(self): return iter((self.r,self.g,self.b,self.a))
    def __len__(self): return 4
    def __getitem__(self,i): return (self.r,self.g,self.b,self.a)[i]
    def __repr__(self): return f'Color({self.r},{self.g},{self.b},{self.a})'

# ── Rect class ──────────────────────────────────────────────────────────────────
class Rect:
    def __init__(self,x,y=0,w=0,h=0):
        if isinstance(x,(list,tuple)) and isinstance(y,(list,tuple)): x,y,w,h=int(x[0]),int(x[1]),int(y[0]),int(y[1])
        elif isinstance(x,(list,tuple)): x,y,w,h=int(x[0]),int(x[1]),int(x[2]),int(x[3])
        self.x=int(x); self.y=int(y); self.width=int(w); self.height=int(h)
        self._sync()
    def _sync(self):
        self.left=self.x; self.top=self.y; self.right=self.x+self.width; self.bottom=self.y+self.height
        self.centerx=self.x+self.width//2; self.centery=self.y+self.height//2
        self.center=(self.centerx,self.centery); self.topleft=(self.x,self.y)
        self.topright=(self.right,self.top); self.bottomleft=(self.left,self.bottom)
        self.bottomright=(self.right,self.bottom); self.midleft=(self.left,self.centery)
        self.midright=(self.right,self.centery); self.midtop=(self.centerx,self.top)
        self.midbottom=(self.centerx,self.bottom); self.size=(self.width,self.height)
    def __repr__(self): return f'Rect({self.x},{self.y},{self.width},{self.height})'
    def colliderect(self,o):
        if isinstance(o,(list,tuple)): o=Rect(*o)
        return not(self.right<=o.left or o.right<=self.left or self.bottom<=o.top or o.bottom<=self.top)
    def collidepoint(self,x,y=None):
        if y is None: x,y=x[0],x[1]
        return self.left<=x<=self.right and self.top<=y<=self.bottom
    def inflate(self,dx,dy): return Rect(self.x-dx//2,self.y-dy//2,self.width+dx,self.height+dy)
    def move(self,dx,dy): return Rect(self.x+dx,self.y+dy,self.width,self.height)
    def clip(self,o):
        if isinstance(o,(list,tuple)): o=Rect(*o)
        x=max(self.x,o.x); y=max(self.y,o.y)
        return Rect(x,y,max(0,min(self.right,o.right)-x),max(0,min(self.bottom,o.bottom)-y))
    def copy(self): return Rect(self.x,self.y,self.width,self.height)
    def contains(self,o): return self.left<=o.left and self.top<=o.top and self.right>=o.right and self.bottom>=o.bottom

# ── Surface class ───────────────────────────────────────────────────────────────
class Surface:
    def __init__(self,size,flags=0,depth=0,masks=None):
        self._w=max(1,int(size[0])); self._h=max(1,int(size[1]))
        if _OK:
            self._el=_doc.createElement('canvas')
            self._el.width=self._w; self._el.height=self._h
            self._c=self._el.getContext('2d')
        self._alpha=255
    def fill(self,color,rect=None):
        if not _OK: return
        self._c.fillStyle=_css(color)
        if rect:
            r=rect if hasattr(rect,'x') else Rect(*rect)
            self._c.fillRect(r.x,r.y,r.width,r.height)
        else: self._c.fillRect(0,0,self._w,self._h)
    def blit(self,src,dest,area=None):
        if not _OK: return Rect(0,0,src._w,src._h)
        dx=int(dest[0]) if isinstance(dest,(list,tuple)) else int(dest.x)
        dy=int(dest[1]) if isinstance(dest,(list,tuple)) else int(dest.y)
        self._c.drawImage(src._el,dx,dy)
        return Rect(dx,dy,src._w,src._h)
    def get_width(self): return self._w
    def get_height(self): return self._h
    def get_size(self): return (self._w,self._h)
    def get_rect(self,**kw):
        r=Rect(0,0,self._w,self._h)
        for k,v in kw.items():
            if k=='center': r.x=int(v[0])-self._w//2; r.y=int(v[1])-self._h//2
            elif k=='topleft': r.x=int(v[0]); r.y=int(v[1])
            elif k=='topright': r.x=int(v[0])-self._w; r.y=int(v[1])
            elif k=='centerx': r.x=int(v)-self._w//2
            elif k=='centery': r.y=int(v)-self._h//2
            elif k=='midtop': r.x=int(v[0])-self._w//2; r.y=int(v[1])
        r._sync(); return r
    def convert(self): return self
    def convert_alpha(self): return self
    def set_alpha(self,a): self._alpha=a
    def get_alpha(self): return self._alpha
    def copy(self):
        s=Surface((self._w,self._h))
        if _OK: s._c.drawImage(self._el,0,0)
        return s
    def subsurface(self,rect):
        if isinstance(rect,(list,tuple)): rect=Rect(*rect)
        s=Surface((rect.width,rect.height))
        if _OK: s._c.drawImage(self._el,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height)
        return s

# ── Event class ─────────────────────────────────────────────────────────────────
class _Event:
    def __init__(self,t,**kw): self.type=t; self.__dict__.update(kw)

class _EventModule:
    def get(self,*a):
        global _frame; _frame+=1
        if _frame>=_MAX_FRM: return [_Event(QUIT)]
        return []
    def pump(self): pass
    def clear(self): pass
    def set_allowed(self,*a): pass
    def set_blocked(self,*a): pass
    def post(self,e): pass
    def wait(self): return _Event(0)
    def peek(self,*a): return False
    Event=_Event

# ── Clock ───────────────────────────────────────────────────────────────────────
class _Clock:
    def tick(self,fps=60): return 16
    def tick_busy_loop(self,fps=60): return 16
    def get_fps(self): return 60
    def get_time(self): return 16
    def get_rawtime(self): return 16

class _TimeModule:
    def Clock(self): return _Clock()
    def delay(self,ms): pass
    def wait(self,ms): return ms
    def get_ticks(self): return _frame*16
    def set_timer(self,*a): pass

# ── Display ──────────────────────────────────────────────────────────────────────
class _DisplayModule:
    _screen=None
    def set_mode(self,size,flags=0,depth=0):
        s=Surface((min(int(size[0]),_W),min(int(size[1]),_H)))
        self._screen=s; return s
    def set_caption(self,t,i=None): pass
    def get_caption(self): return ('',)
    def flip(self):
        if _OK and self._screen: _ctx.drawImage(self._screen._el,0,0)
    def update(self,rect=None): self.flip()
    def get_surface(self): return self._screen
    def get_init(self): return True
    def list_modes(self): return [(800,600),(640,480),(480,360)]
    def toggle_fullscreen(self): pass
    def iconify(self): pass
    def set_icon(self,*a): pass
    def Info(self): return type('Info',(),{'current_w':_W,'current_h':_H})()

# ── Draw ────────────────────────────────────────────────────────────────────────
class _DrawModule:
    def _surf_ctx(self,s): return s._c if _OK else None
    def rect(self,s,c,r,w=0):
        if not _OK: return Rect(0,0,0,0)
        if isinstance(r,(list,tuple)): r=Rect(*r)
        s._c.beginPath(); s._c.rect(r.x,r.y,r.width,r.height)
        if w==0: s._c.fillStyle=_css(c); s._c.fill()
        else: s._c.strokeStyle=_css(c); s._c.lineWidth=w; s._c.stroke()
        return Rect(r.x,r.y,r.width,r.height)
    def circle(self,s,c,pos,rad,w=0):
        if not _OK: return Rect(0,0,0,0)
        s._c.beginPath(); s._c.arc(int(pos[0]),int(pos[1]),abs(rad),0,2*_math.pi)
        if w==0: s._c.fillStyle=_css(c); s._c.fill()
        else: s._c.strokeStyle=_css(c); s._c.lineWidth=max(1,w); s._c.stroke()
        return Rect(int(pos[0])-rad,int(pos[1])-rad,rad*2,rad*2)
    def line(self,s,c,p1,p2,w=1):
        if not _OK: return Rect(0,0,0,0)
        s._c.beginPath(); s._c.moveTo(int(p1[0]),int(p1[1])); s._c.lineTo(int(p2[0]),int(p2[1]))
        s._c.strokeStyle=_css(c); s._c.lineWidth=max(1,w); s._c.stroke()
        return Rect(min(p1[0],p2[0]),min(p1[1],p2[1]),abs(p2[0]-p1[0]),abs(p2[1]-p1[1]))
    def lines(self,s,c,closed,pts,w=1):
        if not _OK or len(pts)<2: return Rect(0,0,0,0)
        s._c.beginPath(); s._c.moveTo(int(pts[0][0]),int(pts[0][1]))
        for p in pts[1:]: s._c.lineTo(int(p[0]),int(p[1]))
        if closed: s._c.closePath()
        s._c.strokeStyle=_css(c); s._c.lineWidth=max(1,w); s._c.stroke()
        xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
        return Rect(min(xs),min(ys),max(xs)-min(xs),max(ys)-min(ys))
    def aaline(self,s,c,p1,p2,blend=1): return self.line(s,c,p1,p2,1)
    def aalines(self,s,c,closed,pts,blend=1): return self.lines(s,c,closed,pts,1)
    def polygon(self,s,c,pts,w=0):
        if not _OK or len(pts)<3: return Rect(0,0,0,0)
        s._c.beginPath(); s._c.moveTo(int(pts[0][0]),int(pts[0][1]))
        for p in pts[1:]: s._c.lineTo(int(p[0]),int(p[1]))
        s._c.closePath()
        if w==0: s._c.fillStyle=_css(c); s._c.fill()
        else: s._c.strokeStyle=_css(c); s._c.lineWidth=max(1,w); s._c.stroke()
        xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
        return Rect(min(xs),min(ys),max(xs)-min(xs),max(ys)-min(ys))
    def ellipse(self,s,c,r,w=0):
        if not _OK: return Rect(0,0,0,0)
        if isinstance(r,(list,tuple)): r=Rect(*r)
        cx=r.x+r.width/2; cy=r.y+r.height/2
        s._c.beginPath(); s._c.ellipse(cx,cy,r.width/2,r.height/2,0,0,2*_math.pi)
        if w==0: s._c.fillStyle=_css(c); s._c.fill()
        else: s._c.strokeStyle=_css(c); s._c.lineWidth=max(1,w); s._c.stroke()
        return r
    def arc(self,s,c,r,a1,a2,w=1):
        if not _OK: return Rect(0,0,0,0)
        if isinstance(r,(list,tuple)): r=Rect(*r)
        cx=r.x+r.width/2; cy=r.y+r.height/2; rad=min(r.width,r.height)/2
        s._c.beginPath(); s._c.arc(cx,cy,rad,-a2,-a1)
        s._c.strokeStyle=_css(c); s._c.lineWidth=max(1,w); s._c.stroke()
        return r

# ── Font ────────────────────────────────────────────────────────────────────────
class _FontObj:
    def __init__(self,size=16,bold=False,italic=False):
        self._sz=int(size); self._bold=bold; self._italic=italic
    def render(self,text,aa,c,bg=None):
        txt=str(text); w=max(1,int(self._sz*0.65*len(txt))+8); h=self._sz+8
        s=Surface((w,h))
        if _OK:
            if bg: s._c.fillStyle=_css(bg); s._c.fillRect(0,0,w,h)
            style=('bold ' if self._bold else '')+('italic ' if self._italic else '')
            s._c.font=f'{style}{self._sz}px Arial'
            s._c.fillStyle=_css(c); s._c.fillText(txt,2,self._sz+2)
        return s
    def size(self,t): return (int(self._sz*0.65*len(str(t)))+8,self._sz+8)
    def get_height(self): return self._sz
    def get_linesize(self): return self._sz+4
    def get_ascent(self): return self._sz
    def get_descent(self): return 2

class _FontModule:
    def init(self): pass
    def quit(self): pass
    def get_init(self): return True
    def get_default_font(self): return 'Arial'
    def get_fonts(self): return ['arial','courier','times']
    def match_font(self,n,bold=False,italic=False): return n
    def SysFont(self,name,size,bold=False,italic=False): return _FontObj(size,bold,italic)
    def Font(self,path,size): return _FontObj(size)

# ── Key / Mouse ─────────────────────────────────────────────────────────────────
class _KeyModule:
    def get_pressed(self): return {}
    def get_mods(self): return 0
    def set_repeat(self,*a): pass
    def name(self,k): return str(k)
    def key_code(self,n): return 0

class _MouseModule:
    def get_pos(self): return (0,0)
    def get_pressed(self,buttons=3): return (False,False,False)
    def get_rel(self): return (0,0)
    def set_visible(self,v): pass
    def set_pos(self,p): pass

# ── Mixer (no-op) ───────────────────────────────────────────────────────────────
class _Sound:
    def __init__(self,*a,**kw): pass
    def play(self,loops=0,maxtime=0,fade_ms=0): pass
    def stop(self): pass
    def set_volume(self,v): pass
    def get_volume(self): return 1.0
    def fadeout(self,ms): pass

class _Music:
    def load(self,*a): pass
    def play(self,loops=0,start=0.0): pass
    def stop(self): pass
    def pause(self): pass
    def unpause(self): pass
    def fadeout(self,ms): pass
    def set_volume(self,v): pass
    def get_volume(self): return 1.0
    def get_busy(self): return False
    def set_pos(self,pos): pass
    def rewind(self): pass

class _MixerModule:
    music=_Music()
    def init(self,*a,**kw): pass
    def quit(self): pass
    def get_init(self): return False
    def pre_init(self,*a,**kw): pass
    def Sound(self,*a,**kw): return _Sound()
    def find_channel(self,force=False): return None
    def get_num_channels(self): return 0
    def set_num_channels(self,n): pass
    def set_reserved(self,n): pass
    def stop(self): pass
    def pause(self): pass
    def unpause(self): pass
    def fadeout(self,ms): pass
    def get_busy(self): return False

# ── Image (stubs) ───────────────────────────────────────────────────────────────
class _ImageModule:
    def load(self,path): return Surface((32,32))
    def save(self,s,path): pass
    def fromstring(self,*a): return Surface((1,1))
    def tostring(self,*a): return b''
    def frombuffer(self,*a): return Surface((1,1))

# ── Transform ───────────────────────────────────────────────────────────────────
class _TransformModule:
    def scale(self,s,size):
        n=Surface(size)
        if _OK: n._c.drawImage(s._el,0,0,size[0],size[1])
        return n
    def scale2x(self,s): return self.scale(s,(s._w*2,s._h*2))
    def rotate(self,s,angle): return s.copy()
    def rotozoom(self,s,angle,scale): return s.copy()
    def flip(self,s,x,y): return s.copy()
    def smoothscale(self,s,size): return self.scale(s,size)
    def chop(self,s,rect): return s.copy()

# ── Assemble module ──────────────────────────────────────────────────────────────
display  = _DisplayModule()
draw     = _DrawModule()
event    = _EventModule()
time     = _TimeModule()
font     = _FontModule()
key      = _KeyModule()
mouse    = _MouseModule()
mixer    = _MixerModule()
image    = _ImageModule()
transform= _TransformModule()

def init(*a,**kw):
    font.init()
def quit(): pass
def get_init(): return True
def get_error(): return ''
def get_ticks(): return _frame*16
def version_info(): return (2,0,0)

_m = _types.ModuleType('pygame')
_exports = {k:v for k,v in list(globals().items()) if not k.startswith('_')}
_m.__dict__.update(_exports)
for _n in ['display','draw','event','time','font','key','mouse','mixer','image','transform',
           'Color','Rect','Surface','QUIT','KEYDOWN','KEYUP','MOUSEBUTTONDOWN','MOUSEBUTTONUP',
           'MOUSEMOTION','RESIZABLE','FULLSCREEN','NOFRAME','DOUBLEBUF','HWSURFACE','SRCALPHA']:
    setattr(_m,_n,globals()[_n])

_sys.modules['pygame']           = _m
_sys.modules['pygame.display']   = type(_m)('pygame.display'); _sys.modules['pygame.display'].__dict__.update(display.__class__.__dict__)
_sys.modules['pygame.draw']      = type(_m)('pygame.draw')
_sys.modules['pygame.font']      = type(_m)('pygame.font'); _sys.modules['pygame.font'].__dict__.update(vars(font))
_sys.modules['pygame.time']      = type(_m)('pygame.time')
_sys.modules['pygame.event']     = type(_m)('pygame.event')
_sys.modules['pygame.key']       = type(_m)('pygame.key')
_sys.modules['pygame.mouse']     = type(_m)('pygame.mouse')
_sys.modules['pygame.mixer']     = type(_m)('pygame.mixer')
_sys.modules['pygame.image']     = type(_m)('pygame.image')
_sys.modules['pygame.transform'] = type(_m)('pygame.transform')
_sys.modules['pygame.locals']    = _m
`;

// ── Pygame Zero shim ─────────────────────────────────────────────────────────────
const PGZERO_SHIM = `
import sys as _sys, types as _types
_pg = _sys.modules.get('pygame')
if not _pg:
    raise ImportError('pygame shim must be loaded before pgzrun')

_W = _pg.display._DisplayModule and 480
try:
    from js import document as _doc
    _cv = _doc.getElementById('kat-turtle-canvas')
    _W  = int(_cv.width); _H = int(_cv.height)
except Exception:
    _W = 480; _H = 360

# Pygame Zero screen object
class _PgzDraw:
    def __init__(self,surf): self._s=surf
    def circle(self,pos,radius,color,width=1):
        _pg.draw.circle(self._s,color,pos,radius,width)
    def filled_circle(self,pos,radius,color):
        _pg.draw.circle(self._s,color,pos,radius,0)
    def rect(self,rect,color,width=1):
        r=_pg.Rect(*rect) if isinstance(rect,(list,tuple)) else rect
        _pg.draw.rect(self._s,color,r,width)
    def filled_rect(self,rect,color):
        r=_pg.Rect(*rect) if isinstance(rect,(list,tuple)) else rect
        _pg.draw.rect(self._s,color,r,0)
    def line(self,start,end,color,width=1):
        _pg.draw.line(self._s,color,start,end,width)
    def lines(self,pts,color,closed=False,width=1):
        _pg.draw.lines(self._s,color,closed,pts,width)
    def polygon(self,pts,color,width=0):
        _pg.draw.polygon(self._s,color,pts,width)
    def text(self,txt,pos=None,color='white',fontsize=24,**kw):
        f=_pg.font.SysFont('Arial',fontsize)
        s=f.render(str(txt),True,color)
        dest=pos if pos else (_W//2-s.get_width()//2,_H//2-s.get_height()//2)
        self._s.blit(s,dest)
    def textbox(self,txt,rect,color='white',fontsize=20):
        r=_pg.Rect(*rect) if isinstance(rect,(list,tuple)) else rect
        self.text(txt,(r.x,r.y),color,fontsize)

class _PgzScreen:
    def __init__(self,surf):
        self._surf=surf
        self.draw=_PgzDraw(surf)
        self.width=surf._w; self.height=surf._h
    def fill(self,color): self._surf.fill(color)
    def clear(self): self._surf.fill((0,0,0))
    def blit(self,img,pos):
        if isinstance(img,str): img=_pg.image.load(img)
        self._surf.blit(img,pos)
    def surface(self): return self._surf

class _Keyboard:
    def __getattr__(self,n): return False

class _Mouse:
    pos=(0,0)
    def __getattr__(self,n): return False

class _Actor:
    def __init__(self,img,pos=None,**kw):
        self.image=img; self.pos=pos or (_W//2,_H//2)
        self.x=self.pos[0]; self.y=self.pos[1]
        self.angle=0; self.width=64; self.height=64
        self._surf=_pg.Surface((64,64))
        self._surf.fill((80,80,200))
    def draw(self):
        import __main__ as _main
        s=getattr(_main,'screen',None)
        if s: s._surf.blit(self._surf,(int(self.x-32),int(self.y-32)))
    @property
    def left(self): return self.x-self.width//2
    @property
    def right(self): return self.x+self.width//2
    @property
    def top(self): return self.y-self.height//2
    @property
    def bottom(self): return self.y+self.height//2
    def colliderect(self,o): return abs(self.x-o.x)<(self.width+o.width)//2 and abs(self.y-o.y)<(self.height+o.height)//2
    def distance_to(self,o):
        import math
        ox,oy=(o.x,o.y) if hasattr(o,'x') else o
        return math.hypot(self.x-ox,self.y-oy)

_MAX_FRAMES=500

def go():
    import __main__ as _main
    _surf=_pg.display.set_mode((_W,_H))
    _scr=_PgzScreen(_surf)
    _main.screen=_scr
    _main.keyboard=_Keyboard()
    _main.mouse=_Mouse()
    _draw_fn=getattr(_main,'draw',None)
    _update_fn=getattr(_main,'update',None)
    for _i in range(_MAX_FRAMES):
        if _update_fn:
            import inspect
            try:
                sig=inspect.signature(_update_fn)
                if len(sig.parameters)>0: _update_fn(1/60)
                else: _update_fn()
            except Exception: pass
        if _draw_fn:
            try: _draw_fn()
            except Exception: pass
        _pg.display.flip()

_m=_types.ModuleType('pgzrun')
_m.go=go; _m.Actor=_Actor
_sys.modules['pgzrun']=_m
_sys.modules['pgzero']=_m
_sys.modules['pgzero.runner']=_m
`;

// Language value → file extension
const LANG_EXT: Record<string, string> = {
  python: "py", python2: "py", javascript: "js", typescript: "ts",
  java: "java", c: "c", cpp: "cpp", csharp: "cs", go: "go", rust: "rs",
  kotlin: "kt", swift: "swift", php: "php", ruby: "rb", scala: "scala",
  r: "r", bash: "sh", sql: "sql", lua: "lua", perl: "pl", haskell: "hs",
  clojure: "clj", elixir: "ex", erlang: "erl", fsharp: "fs", ocaml: "ml",
  groovy: "groovy", d: "d", objectivec: "m", assembly: "asm",
  fortran: "f90", pascal: "pas", cobol: "cob", basic: "bas", prolog: "pl",
  octave: "m", commonlisp: "lisp", vbnet: "vb", html: "html", css: "css",
};

// File extension → Monaco language (for multi-file syntax highlighting)
const EXT_TO_MONACO: Record<string, string> = {
  py: "python", js: "javascript", ts: "typescript", jsx: "javascript",
  tsx: "typescript", java: "java", c: "c", cpp: "cpp", cc: "cpp",
  cs: "csharp", go: "go", rs: "rust", kt: "kotlin", swift: "swift",
  php: "php", rb: "ruby", scala: "scala", r: "r", sh: "shell",
  bash: "shell", sql: "sql", lua: "lua", pl: "perl", hs: "haskell",
  ml: "plaintext", ex: "elixir", exs: "elixir", html: "html",
  css: "css", json: "json", md: "markdown", txt: "plaintext",
};

// Likely entry-point filenames by language, in priority order
const ENTRY_CANDIDATES: Record<string, string[]> = {
  python:     ["main.py", "app.py", "index.py", "solution.py", "run.py"],
  javascript: ["index.js", "main.js", "app.js", "solution.js"],
  typescript: ["index.ts", "main.ts", "app.ts", "solution.ts"],
  java:       ["Main.java", "Solution.java", "App.java"],
  c:          ["main.c", "solution.c"],
  cpp:        ["main.cpp", "solution.cpp", "main.cc"],
  csharp:     ["Program.cs", "Main.cs", "Solution.cs"],
  go:         ["main.go"],
  rust:       ["main.rs"],
  html:       ["index.html", "main.html"],
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

function monacoLangFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MONACO[ext] ?? "plaintext";
}

function detectEntryFile(files: Record<string, string>, lang: string): string | null {
  for (const candidate of ENTRY_CANDIDATES[lang] ?? []) {
    if (files[candidate] !== undefined) return candidate;
  }
  return null;
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  compileOutput: string | null;
  time: string | null;
  memory: number | null;
};

type PeerParticipant = {
  userId: string;
  user: { id: string; firstName: string; lastName: string };
};

type PeerSessionData = {
  id: string;
  currentCode: string;
  hostId: string;
  status: string;
  participants: PeerParticipant[];
};

type LinkedProject = {
  id: string;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "NEEDS_WORK" | "REJECTED";
  updatedAt: string;
};

type AssignmentMatch = {
  id: string;
  title: string;
  linkedProject: LinkedProject | null;
};

type EnrolledStudent = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

type PlaygroundInvite = {
  id: string;
  sessionId: string | null;
  message: string | null;
  createdAt: string;
  invitedBy: { firstName: string; lastName: string };
  content: { title: string };
};

// Minimal Pyodide surface we use
type PyodideInstance = {
  runPython:              (code: string) => unknown;
  runPythonAsync:         (code: string) => Promise<unknown>;
  loadPackagesFromImports:(code: string) => Promise<void>;
  loadPackage:            (pkg: string | string[]) => Promise<void>;
  pyimport:               (name: string) => { install: (pkg: string) => Promise<void> };
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CodePlaygroundBlock({
  contentId,
  starterCode,
  language,
  isCreator = false,
  userId,
  programId,
  moduleId,
}: {
  contentId: string;
  starterCode: string;
  language: string;
  isCreator?: boolean;
  userId?: string;
  programId?: string;
  moduleId?: string;
}) {
  // ── Storage keys ──────────────────────────────────────────────────────────
  const KEY_CODE    = `kat:pg:${contentId}:code`;
  const KEY_PROJECT = `kat:pg:${contentId}:project`;

  // ── Single-file state ──────────────────────────────────────────────────────
  const [code, setCode] = useState(starterCode);

  // ── Multi-file project state ───────────────────────────────────────────────
  const [projectFiles, setProjectFiles]           = useState<Record<string, string>>({});
  const [activeProjectFile, setActiveProjectFile] = useState<string | null>(null);
  const [entryFile, setEntryFile]                 = useState<string | null>(null);

  // ── Execution state ────────────────────────────────────────────────────────
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState<RunResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [showStdin, setShowStdin] = useState(false);
  const [stdin, setStdin]         = useState("");

  // ── Web preview state ──────────────────────────────────────────────────────
  // (no extra state needed — iframe uses srcdoc, updated via ref)

  // ── Pyodide state ──────────────────────────────────────────────────────────
  const [pyodideMode, setPyodideMode]         = useState(false);
  const [pyodideReady, setPyodideReady]       = useState(false);
  const [pyodideLoading, setPyodideLoading]   = useState(false);
  const [showPackages, setShowPackages]       = useState(false);
  const [packageInput, setPackageInput]       = useState("");
  const [installingPkg, setInstallingPkg]     = useState(false);
  const [installedPkgs, setInstalledPkgs]     = useState<string[]>([]);
  const [outputTab, setOutputTab]             = useState<"output" | "turtle">("output");
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [turtleFullscreen, setTurtleFullscreen]   = useState(false);

  // ── Peer session state ─────────────────────────────────────────────────────
  const [peerSessionId, setPeerSessionId]         = useState<string | null>(null);
  const [inPeerSession, setInPeerSession]         = useState(false);
  const [peerParticipants, setPeerParticipants]   = useState<PeerParticipant[]>([]);
  const [startingPeer, setStartingPeer]           = useState(false);
  const [joiningPeer, setJoiningPeer]             = useState(false);
  const [availableSessionId, setAvailableSessionId] = useState<string | null>(null);

  // ── Auto-save indicator ────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // ── Submit state (students only) ───────────────────────────────────────────
  const [showSubmitForm, setShowSubmitForm]   = useState(false);
  const [submitTitle, setSubmitTitle]         = useState("");
  const [submitDesc, setSubmitDesc]           = useState("");
  const [submitting, setSubmitting]           = useState(false);
  const [checkingAssignment, setCheckingAssignment] = useState(false);
  const [assignmentMatch, setAssignmentMatch] = useState<AssignmentMatch | null | "none">(null);
  const assignmentFetched = useRef(false);

  // ── Invite modal state (instructors) ──────────────────────────────────────
  const [showInviteModal, setShowInviteModal]   = useState(false);
  const [studentSearch, setStudentSearch]       = useState("");
  const [studentResults, setStudentResults]     = useState<EnrolledStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<EnrolledStudent[]>([]);
  const [inviteMessage, setInviteMessage]       = useState("");
  const [sendingInvites, setSendingInvites]     = useState(false);
  const [loadingStudents, setLoadingStudents]   = useState(false);
  const studentSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pending invite state (students) ───────────────────────────────────────
  const [pendingInvite, setPendingInvite]       = useState<PlaygroundInvite | null>(null);
  const [dismissingInvite, setDismissingInvite] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const editorRef              = useRef<unknown>(null);
  const runRef                 = useRef<() => void>(() => {});
  const lastLocalEdit          = useRef(0);
  const pushTimeout            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInterval           = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkInterval          = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingFromServer      = useRef(false);
  const peerSessionIdRef       = useRef<string | null>(null);
  const inPeerSessionRef       = useRef(false);
  const folderInputRef         = useRef<HTMLInputElement>(null);
  const fileInputRef           = useRef<HTMLInputElement>(null);
  const saveDebounce           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDebounce        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef              = useRef<HTMLIFrameElement>(null);
  const pyodideRef             = useRef<PyodideInstance | null>(null);
  const turtleCanvasRef        = useRef<HTMLCanvasElement>(null);
  const turtleShimInjected     = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { peerSessionIdRef.current = peerSessionId; }, [peerSessionId]);
  useEffect(() => { inPeerSessionRef.current = inPeerSession; }, [inPeerSession]);

  const langConfig    = SUPPORTED_LANGUAGES.find((l) => l.value === language);
  const monacoLang    = langConfig?.monacoLang ?? "plaintext";
  const langLabel     = langConfig?.label ?? language;
  const fileExtension = LANG_EXT[language] ?? language;

  // Derived flags
  const isProjectMode = Object.keys(projectFiles).length > 0;
  const isPython      = language === "python" || language === "python2";

  // Web mode: html/css always; project mode if it contains an html file
  const isWebMode = WEB_LANGUAGES.has(language)
    || (isProjectMode && Object.keys(projectFiles).some((k) => k.endsWith(".html")));

  const editorValue = isProjectMode && activeProjectFile
    ? (projectFiles[activeProjectFile] ?? "")
    : code;
  const activeMonacoLang = isProjectMode && activeProjectFile
    ? monacoLangFromFilename(activeProjectFile)
    : monacoLang;
  const sortedFiles = Object.keys(projectFiles).sort((a, b) =>
    a === entryFile ? -1 : b === entryFile ? 1 : a.localeCompare(b),
  );

  // ── Build web document from current code / project files ──────────────────
  const buildWebDoc = useCallback((): string => {
    if (isProjectMode) {
      const htmlEntry = Object.entries(projectFiles).find(([k]) => k.endsWith(".html"));
      if (!htmlEntry) return "<html><body><p style='font-family:sans-serif;padding:16px;color:#888'>No HTML file found in project.</p></body></html>";
      let html = htmlEntry[1];

      // Inline CSS files that aren't already linked
      const cssFiles = Object.entries(projectFiles).filter(([k]) => k.endsWith(".css"));
      if (cssFiles.length) {
        const css = cssFiles.map(([, v]) => v).join("\n");
        html = html.includes("</head>")
          ? html.replace("</head>", `<style>\n${css}\n</style>\n</head>`)
          : `<style>${css}</style>${html}`;
      }

      // Inline JS files that aren't already scripted
      const jsFiles = Object.entries(projectFiles).filter(([k]) => k.endsWith(".js") || k.endsWith(".mjs"));
      if (jsFiles.length) {
        const js = jsFiles.map(([, v]) => v).join("\n");
        html = html.includes("</body>")
          ? html.replace("</body>", `<script>\n${js}\n</script>\n</body>`)
          : `${html}<script>${js}</script>`;
      }
      return html;
    }

    if (language === "css") {
      return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
body { margin: 16px; font-family: sans-serif; }
${code}
</style></head>
<body>
  <h1>Heading 1</h1>
  <h2>Heading 2</h2>
  <p>A paragraph of sample text. <a href="#">A link</a>.</p>
  <button>Button</button>
  <ul><li>List item 1</li><li>List item 2</li><li>List item 3</li></ul>
  <div class="box">div.box</div>
</body></html>`;
    }

    // html — raw
    return code;
  }, [isProjectMode, projectFiles, language, code]);

  // ── Live preview auto-update (600 ms debounce) ────────────────────────────
  useEffect(() => {
    if (!isWebMode) return;
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    previewDebounce.current = setTimeout(() => {
      if (iframeRef.current) iframeRef.current.srcdoc = buildWebDoc();
    }, 600);
    return () => { if (previewDebounce.current) clearTimeout(previewDebounce.current); };
  }, [code, projectFiles, isWebMode, buildWebDoc]);

  // ── Restore from localStorage on mount ────────────────────────────────────
  useEffect(() => {
    try {
      const savedProject = localStorage.getItem(KEY_PROJECT);
      if (savedProject) {
        const parsed = JSON.parse(savedProject) as {
          files: Record<string, string>;
          entryFile: string | null;
          activeFile: string | null;
        };
        if (Object.keys(parsed.files).length > 0) {
          setProjectFiles(parsed.files);
          setEntryFile(parsed.entryFile);
          setActiveProjectFile(parsed.activeFile);
          return;
        }
      }
      const savedCode = localStorage.getItem(KEY_CODE);
      if (savedCode !== null) setCode(savedCode);
    } catch { /* localStorage unavailable */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save project mode (1 s debounce) ─────────────────────────────────
  useEffect(() => {
    if (!isProjectMode) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    setSaveState("saving");
    saveDebounce.current = setTimeout(() => {
      try {
        localStorage.setItem(
          KEY_PROJECT,
          JSON.stringify({ files: projectFiles, entryFile, activeFile: activeProjectFile }),
        );
        setSaveState("saved");
        if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
        savedIndicatorTimeout.current = setTimeout(() => setSaveState("idle"), 2000);
      } catch { setSaveState("idle"); }
    }, 1000);
  }, [projectFiles, entryFile, activeProjectFile, isProjectMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set webkitdirectory imperatively (not in TS JSX types)
  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.setAttribute("webkitdirectory", "");
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollInterval.current)          clearInterval(pollInterval.current);
      if (checkInterval.current)         clearInterval(checkInterval.current);
      if (pushTimeout.current)           clearTimeout(pushTimeout.current);
      if (saveDebounce.current)          clearTimeout(saveDebounce.current);
      if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
      if (previewDebounce.current)       clearTimeout(previewDebounce.current);
    };
  }, []);

  // ── Fetch linked assignment when submit form opens ─────────────────────────
  useEffect(() => {
    if (!showSubmitForm || isCreator || assignmentFetched.current) return;
    assignmentFetched.current = true;
    setCheckingAssignment(true);
    fetch("/api/projects/assignments")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { assignments: Array<{ id: string; title: string; module: { id: string } | null; linkedProject: LinkedProject | null }> } | null) => {
        if (!data) { setAssignmentMatch("none"); return; }
        const match = data.assignments.find((a) => moduleId && a.module?.id === moduleId);
        setAssignmentMatch(match ? { id: match.id, title: match.title, linkedProject: match.linkedProject } : "none");
      })
      .catch(() => setAssignmentMatch("none"))
      .finally(() => setCheckingAssignment(false));
  }, [showSubmitForm, isCreator, moduleId]);

  // ── Student: fetch pending invite for this playground on mount ────────────
  useEffect(() => {
    if (isCreator) return;
    fetch(`/api/playground-invites?contentId=${contentId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { invite: PlaygroundInvite | null } | null) => {
        if (data?.invite) setPendingInvite(data.invite);
      })
      .catch(() => { /* ignore */ });
  }, [contentId, isCreator]);

  // ── Instructor: search enrolled students (debounced 300 ms) ───────────────
  useEffect(() => {
    if (!showInviteModal || !programId) return;
    if (studentSearchDebounce.current) clearTimeout(studentSearchDebounce.current);
    setLoadingStudents(true);
    studentSearchDebounce.current = setTimeout(() => {
      const q = encodeURIComponent(studentSearch);
      fetch(`/api/programs/${programId}/students?search=${q}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: { students: EnrolledStudent[] } | null) => {
          setStudentResults(data?.students ?? []);
        })
        .catch(() => setStudentResults([]))
        .finally(() => setLoadingStudents(false));
    }, 300);
    return () => { if (studentSearchDebounce.current) clearTimeout(studentSearchDebounce.current); };
  }, [showInviteModal, studentSearch, programId]);

  // ── File loading ───────────────────────────────────────────────────────────

  const loadFilesFromInput = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const newFiles: Record<string, string> = { ...projectFiles };

    for (const file of files) {
      const rawPath = file.webkitRelativePath || file.name;
      const parts   = rawPath.split("/");
      const relativePath = parts.length > 1 ? parts.slice(1).join("/") : parts[0]!;
      if (!relativePath || relativePath.startsWith(".")) continue;
      newFiles[relativePath] = await file.text();
    }

    const cleanFiles = Object.fromEntries(
      Object.entries(newFiles).filter(([p]) => p && !p.includes("__pycache__")),
    );
    const detected  = detectEntryFile(cleanFiles, language);
    const firstFile = Object.keys(cleanFiles)[0] ?? null;
    const newEntry  = detected ?? entryFile ?? firstFile;
    const newActive = activeProjectFile && cleanFiles[activeProjectFile] !== undefined
      ? activeProjectFile
      : (detected ?? firstFile);

    setProjectFiles(cleanFiles);
    setEntryFile(newEntry);
    setActiveProjectFile(newActive);
    try { localStorage.removeItem(KEY_CODE); } catch { /* ignore */ }
    toast.success(`${Object.keys(cleanFiles).length} file(s) loaded.`);
  };

  const createNewFile = () => {
    const name = window.prompt("File name (e.g. helpers.py):");
    if (!name?.trim()) return;
    const path = name.trim();
    if (projectFiles[path] !== undefined) { toast.error("A file with that name already exists."); return; }
    setProjectFiles((prev) => ({ ...prev, [path]: "" }));
    if (!isProjectMode) setEntryFile(path);
    setActiveProjectFile(path);
  };

  const removeFile = (path: string) => {
    setProjectFiles((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    if (activeProjectFile === path) {
      const remaining = Object.keys(projectFiles).filter((p) => p !== path);
      setActiveProjectFile(remaining[0] ?? null);
    }
    if (entryFile === path) {
      const remaining = Object.keys(projectFiles).filter((p) => p !== path);
      setEntryFile(remaining[0] ?? null);
    }
  };

  const closeProject = () => {
    setProjectFiles({});
    setActiveProjectFile(null);
    setEntryFile(null);
    try { localStorage.removeItem(KEY_PROJECT); } catch { /* ignore */ }
  };

  // ── Pyodide helpers ────────────────────────────────────────────────────────

  const initPyodide = async (): Promise<PyodideInstance> => {
    if (pyodideRef.current) return pyodideRef.current;
    setPyodideLoading(true);
    try {
      if (!document.getElementById("kat-pyodide-script")) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.id    = "kat-pyodide-script";
          script.src   = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
          script.onload  = () => resolve();
          script.onerror = () => reject(new Error("Failed to fetch Pyodide"));
          document.head.appendChild(script);
        });
      }
      const instance = await (
        window as unknown as {
          loadPyodide: (opts: { indexURL: string }) => Promise<PyodideInstance>;
        }
      ).loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" });

      pyodideRef.current = instance;
      turtleShimInjected.current = false; // fresh instance — shim must be re-injected
      setPyodideReady(true);
      return instance;
    } catch {
      toast.error("Failed to load Pyodide — check your connection.");
      setPyodideMode(false);
      throw new Error("Pyodide load failed");
    } finally {
      setPyodideLoading(false);
    }
  };

  const installPackage = async () => {
    const pkg = packageInput.trim();
    if (!pkg) return;
    setInstallingPkg(true);
    try {
      const py = await initPyodide();
      await py.loadPackage("micropip");
      const micropip = py.pyimport("micropip");
      await micropip.install(pkg);
      setInstalledPkgs((prev) => [...prev, pkg]);
      setPackageInput("");
      toast.success(`${pkg} installed.`);
    } catch {
      toast.error(`Failed to install ${pkg}. It may not be available in Pyodide.`);
    } finally {
      setInstallingPkg(false);
    }
  };

  const runPyodide = async () => {
    setRunning(true);
    setResult(null);
    setError(null);

    const usesTurtle = /\bimport\s+turtle\b|from\s+turtle\s+import/.test(code);
    const usesPygame  = /\bimport\s+pygame\b|from\s+pygame\s+import/.test(code);
    const usesPgzrun  = /\bimport\s+pgzrun\b|from\s+pgzrun\s+import/.test(code);
    const usesCanvas  = usesTurtle || usesPygame || usesPgzrun;

    // Switch to the correct output tab before running
    setOutputTab(usesCanvas ? "turtle" : "output");

    try {
      const py = await initPyodide();

      // Always clear the canvas and re-inject shims so state is fresh each run
      if (usesCanvas) {
        const canvas = turtleCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        }
      }
      if (usesTurtle) await py.runPythonAsync(TURTLE_SHIM);
      if (usesPygame || usesPgzrun) {
        await py.runPythonAsync(PYGAME_SHIM);
        if (usesPgzrun) await py.runPythonAsync(PGZERO_SHIM);
      }

      // Auto-load packages detected from imports (skip canvas libs — handled by shims)
      try { await py.loadPackagesFromImports(code); } catch { /* best effort */ }

      // Redirect stdout/stderr
      py.runPython(
        "import sys\nfrom io import StringIO\nsys.stdout = StringIO()\nsys.stderr = StringIO()",
      );
      let pyError: string | null = null;
      try {
        await py.runPythonAsync(code);
      } catch (e) {
        pyError = String(e);
      }
      const stdout = String(py.runPython("sys.stdout.getvalue()") ?? "");
      const stderr = String(py.runPython("sys.stderr.getvalue()") ?? "");
      setResult({
        stdout,
        stderr: pyError ? `${stderr}${pyError}`.trim() : stderr,
        exitCode: pyError ? 1 : 0,
        compileOutput: null,
        time: null,
        memory: null,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  // ── Invite helpers ─────────────────────────────────────────────────────────

  const toggleStudent = (s: EnrolledStudent) => {
    setSelectedStudents((prev) =>
      prev.some((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s],
    );
  };

  const sendInvites = async () => {
    if (selectedStudents.length === 0) { toast.error("Select at least one student."); return; }
    setSendingInvites(true);
    try {
      const res = await fetch("/api/playground-invites", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          inviteeIds: selectedStudents.map((s) => s.id),
          ...(peerSessionId ? { sessionId: peerSessionId } : {}),
          ...(inviteMessage.trim() ? { message: inviteMessage.trim() } : {}),
        }),
      });
      if (!res.ok) { toast.error("Failed to send invites."); return; }
      toast.success(`Invite sent to ${selectedStudents.map((s) => s.firstName).join(", ")}.`);
      setShowInviteModal(false);
      setSelectedStudents([]);
      setStudentSearch("");
      setInviteMessage("");
    } catch {
      toast.error("Failed to send invites.");
    } finally {
      setSendingInvites(false);
    }
  };

  const dismissInvite = async () => {
    if (!pendingInvite) return;
    setDismissingInvite(true);
    try {
      await fetch(`/api/playground-invites/${pendingInvite.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      setPendingInvite(null);
    } catch { /* ignore */ } finally { setDismissingInvite(false); }
  };

  const acceptInviteSession = async () => {
    if (!pendingInvite?.sessionId) return;
    await fetch(`/api/playground-invites/${pendingInvite.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "JOINED" }),
    }).catch(() => { /* best effort */ });
    setPendingInvite(null);
    void joinPeerSession(pendingInvite.sessionId);
  };

  // ── Download ───────────────────────────────────────────────────────────────

  const downloadCode = () => {
    if (isProjectMode && Object.keys(projectFiles).length > 0) {
      const encoder = new TextEncoder();
      const entries: Record<string, Uint8Array> = {};
      for (const [path, content] of Object.entries(projectFiles)) {
        entries[path] = encoder.encode(content);
      }
      const zipped = zipSync(entries, { level: 6 });
      triggerDownload(new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" }), "project.zip");
    } else {
      triggerDownload(new Blob([code], { type: "text/plain" }), `main.${fileExtension}`);
    }
  };

  // ── Code execution ─────────────────────────────────────────────────────────

  const run = async () => {
    // Web mode — just refresh the preview iframe
    if (isWebMode) {
      if (iframeRef.current) iframeRef.current.srcdoc = buildWebDoc();
      return;
    }

    // Python browser mode — use Pyodide
    if (pyodideMode && isPython) {
      await runPyodide();
      return;
    }

    // Server-side execution via Judge0
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      let requestBody: Record<string, unknown>;

      if (isProjectMode && entryFile) {
        const entryCode    = projectFiles[entryFile] ?? "";
        const otherEntries = Object.entries(projectFiles).filter(([p]) => p !== entryFile);
        let additionalFiles: string | undefined;
        if (otherEntries.length > 0) {
          const encoder = new TextEncoder();
          const zipEntries: Record<string, Uint8Array> = {};
          for (const [path, content] of otherEntries) zipEntries[path] = encoder.encode(content);
          additionalFiles = uint8ToBase64(zipSync(zipEntries));
        }
        requestBody = { code: entryCode, stdin, ...(additionalFiles ? { additional_files: additionalFiles } : {}) };
      } else {
        requestBody = { code, stdin };
      }

      const res  = await fetch(`/api/curriculum/contents/${contentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json() as RunResult & { error?: string };
      if (!res.ok) setError(data.error ?? "Execution failed.");
      else setResult(data);
    } catch {
      setError("Network error — could not reach execution service.");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => { runRef.current = run; });

  const reset = () => {
    if (isProjectMode) {
      closeProject();
    } else {
      setCode(starterCode);
      try { localStorage.removeItem(KEY_CODE); } catch { /* ignore */ }
    }
    setResult(null);
    setError(null);
    setSaveState("idle");
  };

  // ── Peer session helpers ───────────────────────────────────────────────────

  const applyServerCode = (serverCode: string) => {
    settingFromServer.current = true;
    setCode(serverCode);
    setTimeout(() => { settingFromServer.current = false; }, 50);
  };

  const pushCodeToSession = async (sid: string, codeToSend: string) => {
    try {
      await fetch(`/api/peer-sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToSend }),
      });
    } catch { /* best-effort */ }
  };

  const handleCodeChange = (val: string | undefined) => {
    const newCode = val ?? "";

    if (isProjectMode && activeProjectFile) {
      setProjectFiles((prev) => ({ ...prev, [activeProjectFile]: newCode }));
      return;
    }

    setCode(newCode);

    // Auto-save single-file
    setSaveState("saving");
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY_CODE, newCode);
        setSaveState("saved");
        if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
        savedIndicatorTimeout.current = setTimeout(() => setSaveState("idle"), 2000);
      } catch { setSaveState("idle"); }
    }, 1000);

    // Peer session sync (student only)
    if (inPeerSessionRef.current && peerSessionIdRef.current && !settingFromServer.current) {
      lastLocalEdit.current = Date.now();
      if (!isCreator) {
        if (pushTimeout.current) clearTimeout(pushTimeout.current);
        pushTimeout.current = setTimeout(() => {
          if (peerSessionIdRef.current) void pushCodeToSession(peerSessionIdRef.current, newCode);
        }, 500);
      }
    }
  };

  const pollSession = async () => {
    const sid = peerSessionIdRef.current;
    if (!sid) return;
    try {
      const res  = await fetch(`/api/peer-sessions?contentId=${contentId}`);
      if (!res.ok) return;
      const data = await res.json() as { session: PeerSessionData | null };
      if (!data.session || data.session.status === "ENDED") {
        if (pollInterval.current) clearInterval(pollInterval.current);
        setInPeerSession(false);
        setPeerSessionId(null);
        setPeerParticipants([]);
        toast.info("Peer programming session has ended.");
        return;
      }
      setPeerParticipants(data.session.participants);
      if (Date.now() - lastLocalEdit.current > 1500) applyServerCode(data.session.currentCode);
    } catch { /* ignore */ }
  };

  const startPeerSession = async () => {
    setStartingPeer(true);
    try {
      const res = await fetch("/api/peer-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, starterCode: code }),
      });
      if (!res.ok) { toast.error("Failed to start peer session."); return; }
      const data = await res.json() as { session: PeerSessionData };
      setPeerSessionId(data.session.id);
      setInPeerSession(true);
      setPeerParticipants(data.session.participants);
      setAvailableSessionId(null);
      pollInterval.current = setInterval(() => void pollSession(), 2000);
      toast.success("Peer session started — students can now join.");
    } catch {
      toast.error("Failed to start peer session.");
    } finally {
      setStartingPeer(false);
    }
  };

  const endPeerSession = async () => {
    const sid = peerSessionIdRef.current;
    if (!sid) return;
    try {
      await fetch(`/api/peer-sessions/${sid}`, { method: "DELETE" });
      if (pollInterval.current) clearInterval(pollInterval.current);
      setInPeerSession(false);
      setPeerSessionId(null);
      setPeerParticipants([]);
      toast.success("Peer session ended.");
    } catch {
      toast.error("Failed to end session.");
    }
  };

  const joinPeerSession = async (sid: string) => {
    setJoiningPeer(true);
    try {
      const res = await fetch(`/api/peer-sessions/${sid}/join`, { method: "POST" });
      if (!res.ok) { toast.error("Failed to join peer session."); return; }
      const data = await res.json() as { session: PeerSessionData };
      setPeerSessionId(data.session.id);
      setInPeerSession(true);
      setPeerParticipants(data.session.participants);
      setAvailableSessionId(null);
      applyServerCode(data.session.currentCode);
      pollInterval.current = setInterval(() => void pollSession(), 2000);
      toast.success("Joined peer programming session!");
    } catch {
      toast.error("Failed to join session.");
    } finally {
      setJoiningPeer(false);
    }
  };

  // ── Student: check for available session every 5 s ─────────────────────────
  useEffect(() => {
    if (isCreator) return;
    const check = async () => {
      if (inPeerSessionRef.current) return;
      try {
        const res  = await fetch(`/api/peer-sessions?contentId=${contentId}`);
        if (!res.ok) return;
        const data = await res.json() as { session: { id: string } | null };
        setAvailableSessionId(data.session?.id ?? null);
      } catch { /* ignore */ }
    };
    void check();
    checkInterval.current = setInterval(() => void check(), 5000);
    return () => { if (checkInterval.current) clearInterval(checkInterval.current); };
  }, [contentId, isCreator]);

  // ── Submit code as project ─────────────────────────────────────────────────

  const submitCodeAsProject = async () => {
    if (!submitTitle.trim()) { toast.error("Please enter a project title."); return; }
    if (submitDesc.trim().length < 10) { toast.error("Description must be at least 10 characters."); return; }
    setSubmitting(true);
    try {
      const encoder = new TextEncoder();
      let zipBlob: Blob;
      if (isProjectMode && Object.keys(projectFiles).length > 0) {
        const entries: Record<string, Uint8Array> = {};
        for (const [path, content] of Object.entries(projectFiles)) {
          entries[path] = encoder.encode(content);
        }
        zipBlob = new Blob([zipSync(entries, { level: 6 }).buffer as ArrayBuffer], { type: "application/zip" });
      } else {
        const entries: Record<string, Uint8Array> = { [`main.${fileExtension}`]: encoder.encode(code) };
        zipBlob = new Blob([zipSync(entries, { level: 6 }).buffer as ArrayBuffer], { type: "application/zip" });
      }

      const assessmentId = typeof assignmentMatch === "object" && assignmentMatch !== null
        ? assignmentMatch.id
        : undefined;

      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       submitTitle.trim(),
          description: submitDesc.trim(),
          ...(programId    ? { programId }    : {}),
          ...(assessmentId ? { assessmentId } : {}),
        }),
      });
      if (!createRes.ok) {
        const err = (await createRes.json()) as { error?: string };
        toast.error(err.error ?? "Could not create project.");
        return;
      }
      const { project } = (await createRes.json()) as { project: { id: string } };
      const projectId   = project.id;

      const urlRes = await fetch(`/api/projects/${projectId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "source-code.zip", mimeType: "application/zip", size: zipBlob.size }),
      });
      if (!urlRes.ok) {
        const err = (await urlRes.json()) as { error?: string };
        toast.error(err.error ?? "Could not get upload URL.");
        return;
      }
      const { uploadUrl, key, publicUrl } = (await urlRes.json()) as { uploadUrl: string; key: string; publicUrl: string };

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/zip" },
        body: zipBlob,
      });
      if (!uploadRes.ok) { toast.error("Upload to storage failed."); return; }

      await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "source-code.zip", mimeType: "application/zip", size: zipBlob.size, storageKey: key, url: publicUrl }),
      });

      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });

      const newLinked: LinkedProject = {
        id: projectId, title: submitTitle.trim(), status: "SUBMITTED", updatedAt: new Date().toISOString(),
      };
      setAssignmentMatch((prev) =>
        prev && prev !== "none"
          ? { ...prev, linkedProject: newLinked }
          : { id: assessmentId ?? "", title: "", linkedProject: newLinked },
      );
      setShowSubmitForm(false);
      setSubmitTitle("");
      setSubmitDesc("");
      toast.success("Code submitted! Your instructor will review it soon.");
    } catch {
      toast.error("Submission failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived UI state ───────────────────────────────────────────────────────

  const success = result && result.exitCode === 0 && !result.stderr;
  const linkedProject = typeof assignmentMatch === "object" && assignmentMatch !== null
    ? assignmentMatch.linkedProject
    : null;

  const STATUS_LABEL: Record<LinkedProject["status"], string> = {
    DRAFT: "Draft", SUBMITTED: "Under Review", APPROVED: "Approved ✓",
    NEEDS_WORK: "Needs Work", REJECTED: "Rejected",
  };
  const STATUS_COLOR: Record<LinkedProject["status"], string> = {
    DRAFT:      "bg-slate-100 text-slate-600",
    SUBMITTED:  "bg-blue-100 text-blue-700",
    APPROVED:   "bg-emerald-100 text-emerald-700",
    NEEDS_WORK: "bg-amber-100 text-amber-700",
    REJECTED:   "bg-rose-100 text-rose-700",
  };

  const runBtnLabel = () => {
    if (pyodideLoading) return "Loading…";
    if (running) return "Running…";
    if (isWebMode) return "Preview";
    return "Run";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-[#1e1e1e] px-3 py-2">

        {/* Left — language label + badges */}
        <div className="flex min-w-0 items-center gap-2">
          {isWebMode
            ? <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            : <Terminal className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
          <span className="truncate text-xs font-medium text-slate-300">
            {isProjectMode ? (
              <span className="flex items-center gap-1">
                <span className="text-slate-500">Project</span>
                <ChevronRight className="h-3 w-3 text-slate-600" />
                <span>{entryFile ?? "—"}</span>
              </span>
            ) : langLabel}
          </span>
          {isWebMode && (
            <span className="hidden shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-400 sm:inline">
              Live Preview
            </span>
          )}
          {pyodideMode && isPython && !isWebMode && (
            <span className="hidden shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 sm:inline">
              Pyodide
            </span>
          )}
          {inPeerSession && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Wifi className="h-2.5 w-2.5" /> Live
            </span>
          )}
          {saveState !== "idle" && (
            <span className={`shrink-0 text-[10px] transition-opacity ${saveState === "saved" ? "text-emerald-500" : "text-slate-500"}`}>
              {saveState === "saving" ? "Saving…" : "Saved"}
            </span>
          )}
        </div>

        {/* Right — actions */}
        <div className="flex shrink-0 items-center gap-1">

          {/* Python: Server ↔ Browser toggle */}
          {isPython && (
            <button
              onClick={() => { setPyodideMode((v) => !v); setResult(null); setError(null); }}
              title={pyodideMode ? "Switch to server execution (Judge0)" : "Switch to browser execution (Pyodide)"}
              className={`hidden items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition sm:flex ${pyodideMode ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:bg-white/10 hover:text-slate-300"}`}
            >
              <Globe className="h-3 w-3" />
              {pyodideMode ? "Browser" : "Server"}
            </button>
          )}

          {/* Packages panel (Python + Pyodide only) */}
          {isPython && pyodideMode && (
            <button
              onClick={() => setShowPackages((v) => !v)}
              title="Manage Python packages"
              className={`hidden items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition sm:flex ${showPackages ? "bg-violet-500/20 text-violet-400" : "text-slate-500 hover:bg-white/10 hover:text-slate-300"}`}
            >
              <Package className="h-3 w-3" />
              Packages{installedPkgs.length > 0 ? ` (${installedPkgs.length})` : ""}
            </button>
          )}

          {/* Peer session controls */}
          {isCreator && !inPeerSession && (
            <button
              onClick={() => void startPeerSession()}
              disabled={startingPeer}
              title="Start peer programming session"
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/10 hover:text-slate-300 disabled:opacity-50"
            >
              <Users className="h-3 w-3" />
              {startingPeer ? "Starting…" : "Peer"}
            </button>
          )}
          {isCreator && inPeerSession && (
            <button
              onClick={() => void endPeerSession()}
              title="End peer session"
              className="rounded px-2 py-1 text-[10px] font-medium text-rose-400 transition hover:bg-white/10"
            >
              End Session
            </button>
          )}

          {/* Invite students (instructor/admin only) */}
          {isCreator && programId && (
            <button
              onClick={() => setShowInviteModal(true)}
              title="Invite students to this playground"
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
            >
              <UserPlus className="h-3 w-3" />
              Invite
            </button>
          )}

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void loadFilesFromInput(e.target.files).then(() => { e.target.value = ""; })}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void loadFilesFromInput(e.target.files).then(() => { e.target.value = ""; })}
          />

          <button onClick={() => folderInputRef.current?.click()} title="Open project folder" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/10 hover:text-slate-300">
            <FolderOpen className="h-3 w-3" />
            <span className="hidden sm:inline">Folder</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Add files" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/10 hover:text-slate-300">
            <FilePlus className="h-3 w-3" />
            <span className="hidden sm:inline">Files</span>
          </button>
          <button onClick={downloadCode} title={isProjectMode ? "Download project as zip" : `Download as main.${fileExtension}`} className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300">
            <Download className="h-3.5 w-3.5" />
          </button>
          {!isWebMode && (
            <button
              onClick={() => setShowStdin((v) => !v)}
              title="Toggle stdin"
              className={`rounded px-2 py-1 text-[10px] font-medium transition ${showStdin ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:bg-white/10 hover:text-slate-300"}`}
            >
              stdin
            </button>
          )}
          <button
            onClick={reset}
            title={isProjectMode ? "Close project" : "Reset to starter code"}
            className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <Button
            size="sm"
            onClick={() => void run()}
            disabled={running || pyodideLoading}
            title={isWebMode ? "Refresh preview" : "Run (Ctrl+Enter)"}
            className="h-7 gap-1.5 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
          >
            <Play className="h-3 w-3" />
            {runBtnLabel()}
          </Button>
        </div>
      </div>

      {/* ── File tabs (project mode) ─────────────────────────────────────────── */}
      {isProjectMode && (
        <div className="flex items-center gap-0 overflow-x-auto border-b border-slate-700 bg-[#252526] scrollbar-none">
          {sortedFiles.map((path) => {
            const isActive = path === activeProjectFile;
            const isEntry  = path === entryFile;
            const basename = path.split("/").pop() ?? path;
            return (
              // div instead of button — avoids illegal nested <button> which breaks inner click handlers
              <div
                key={path}
                role="button"
                tabIndex={0}
                onClick={() => setActiveProjectFile(path)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveProjectFile(path); }}
                className={`group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-slate-700 px-3 py-1.5 text-[11px] transition ${isActive ? "bg-[#1e1e1e] text-slate-200" : "text-slate-500 hover:bg-[#2d2d2d] hover:text-slate-300"}`}
              >
                {isEntry ? (
                  <span title="Entry point" className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-[8px] font-bold text-white">▶</span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setEntryFile(path); }} title="Set as entry point" className="h-3.5 w-3.5 shrink-0 rounded-sm text-[8px] text-slate-600 opacity-0 transition hover:bg-emerald-600/30 hover:text-emerald-400 group-hover:opacity-100">▶</button>
                )}
                <span className="max-w-[120px] truncate" title={path}>{basename}</span>
                <button onClick={(e) => { e.stopPropagation(); removeFile(path); }} title="Remove file" className="ml-0.5 shrink-0 rounded text-slate-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
          <button onClick={createNewFile} title="New file" className="shrink-0 px-2 py-1.5 text-slate-600 transition hover:text-slate-300">
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button onClick={closeProject} title="Close project" className="ml-auto shrink-0 px-2 py-1.5 text-slate-600 transition hover:text-rose-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Participants strip (peer session) ────────────────────────────────── */}
      {inPeerSession && peerParticipants.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-700 bg-[#1a1a1a] px-4 py-1.5">
          <Users className="h-3 w-3 shrink-0 text-slate-500" />
          {peerParticipants.map((p) => (
            <span key={p.userId} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.userId === userId ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
              {p.userId === userId ? "You" : `${p.user.firstName} ${p.user.lastName}`}
            </span>
          ))}
        </div>
      )}

      {/* ── Student join banner (open peer session) ──────────────────────────── */}
      {!isCreator && availableSessionId && !inPeerSession && (
        <div className="flex items-center justify-between gap-3 border-b border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Wifi className="h-3.5 w-3.5" />
            Your instructor started a live peer programming session
          </span>
          <button onClick={() => void joinPeerSession(availableSessionId)} disabled={joiningPeer} className="shrink-0 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
            {joiningPeer ? "Joining…" : "Join Session"}
          </button>
        </div>
      )}

      {/* ── Student invite banner (from instructor) ───────────────────────────── */}
      {!isCreator && pendingInvite && !inPeerSession && (
        <div className="flex items-center justify-between gap-3 border-b border-violet-500/30 bg-violet-950/40 px-4 py-2.5">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-medium text-violet-300">
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              {pendingInvite.invitedBy.firstName} {pendingInvite.invitedBy.lastName}
              {pendingInvite.sessionId ? " invited you to a live session" : " assigned you to this playground"}
            </span>
            {pendingInvite.message && (
              <p className="mt-0.5 truncate pl-5 text-[10px] text-violet-400/70">"{pendingInvite.message}"</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pendingInvite.sessionId && (
              <button onClick={() => void acceptInviteSession()} disabled={joiningPeer} className="rounded bg-violet-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50">
                {joiningPeer ? "Joining…" : "Join Session"}
              </button>
            )}
            <button onClick={() => void dismissInvite()} disabled={dismissingInvite} className="rounded px-2 py-1 text-[10px] text-violet-400/60 transition hover:text-violet-300 disabled:opacity-50" title="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Python Packages panel ─────────────────────────────────────────────── */}
      {showPackages && isPython && pyodideMode && (
        <div className="border-b border-slate-700 bg-[#1a1a1a] px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Python Packages — Pyodide
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Package name (e.g. numpy, pandas)"
              value={packageInput}
              onChange={(e) => setPackageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void installPackage(); }}
              className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              onClick={() => void installPackage()}
              disabled={installingPkg || !packageInput.trim()}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {installingPkg ? "Installing…" : "Install"}
            </button>
          </div>
          {installedPkgs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {installedPkgs.map((pkg) => (
                <span key={pkg} className="rounded-full bg-violet-900/40 px-2 py-0.5 text-[10px] text-violet-300">{pkg}</span>
              ))}
            </div>
          )}
          {!pyodideReady && (
            <p className="mt-1.5 text-[10px] text-slate-500">
              Pyodide loads on first run (~10 MB, cached afterwards). Pure-Python packages only.
            </p>
          )}
        </div>
      )}

      {/* ── Stdin panel ───────────────────────────────────────────────────────── */}
      {showStdin && !isWebMode && (
        <div className="border-b border-slate-700 bg-[#1e1e1e] px-4 py-2.5">
          <p className="mb-1.5 text-[10px] font-medium text-slate-500">stdin — one value per line</p>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder={"e.g. 5\nhello world"}
            className="w-full resize-none rounded bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
          />
        </div>
      )}

      {/* ── Split pane: Editor + Output/Preview ──────────────────────────────── */}
      <div className="flex flex-col lg:h-[500px] lg:flex-row">

        {/* Editor pane */}
        <div className="h-[420px] lg:h-full lg:flex-1">
          <MonacoEditor
            height="100%"
            language={activeMonacoLang}
            value={editorValue}
            onChange={handleCodeChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
            }}
            theme="vs-dark"
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "all",
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
              overviewRulerLanes: 0,
            }}
          />
        </div>

        {/* Output / Preview pane */}
        <div className="flex h-[320px] flex-col border-t border-slate-700 lg:h-full lg:w-[45%] lg:border-l lg:border-t-0">
          {isWebMode ? (
            /* ── Web Preview ── */
            <>
              {/* Fullscreen backdrop — closes on click outside */}
              {previewFullscreen && (
                <div
                  className="fixed inset-0 z-[59] bg-black/40"
                  onClick={() => setPreviewFullscreen(false)}
                />
              )}
              <div
                className={
                  previewFullscreen
                    ? "fixed inset-4 z-[60] flex flex-col overflow-hidden rounded-xl border border-slate-700 shadow-2xl sm:inset-8"
                    : "flex h-full flex-col"
                }
              >
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-[#1a1a1a] px-3 py-1.5">
                  <Globe className="h-3 w-3 text-sky-400" />
                  <span className="text-[10px] font-medium text-slate-400">Preview</span>
                  <button
                    onClick={() => { if (iframeRef.current) iframeRef.current.srcdoc = buildWebDoc(); }}
                    title="Refresh preview"
                    className="ml-auto text-[10px] text-slate-500 transition hover:text-slate-300"
                  >
                    ↺ Refresh
                  </button>
                  <button
                    onClick={() => setPreviewFullscreen((v) => !v)}
                    title={previewFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
                    className="rounded p-0.5 text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
                  >
                    {previewFullscreen
                      ? <Minimize2 className="h-3.5 w-3.5" />
                      : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <iframe
                  ref={iframeRef}
                  title="Web Preview"
                  sandbox="allow-scripts"
                  className="flex-1 w-full bg-white"
                  srcDoc={buildWebDoc()}
                />
              </div>
            </>
          ) : (
            /* ── Terminal Output + Turtle Canvas ── */
            <div className="flex h-full flex-col bg-slate-950">

              {/* Tab bar — only when Python + Pyodide */}
              {isPython && pyodideMode ? (
                <div className="flex shrink-0 items-center border-b border-slate-800 bg-[#1a1a1a]">
                  <button
                    onClick={() => setOutputTab("output")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium transition border-b-2 ${outputTab === "output" ? "border-emerald-500 text-slate-200" : "border-transparent text-slate-500 hover:text-slate-300"}`}
                  >
                    <Terminal className="h-3 w-3" />
                    Output
                    {result && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${result.exitCode === 0 && !result.stderr ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                        {result.exitCode === 0 && !result.stderr ? "✓" : "✗"}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setOutputTab("turtle")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium transition border-b-2 ${outputTab === "turtle" ? "border-emerald-500 text-slate-200" : "border-transparent text-slate-500 hover:text-slate-300"}`}
                  >
                    {/\bimport\s+pgzrun\b|from\s+pgzrun\s+import/.test(code)
                      ? "🎮 Pygame Zero"
                      : /\bimport\s+pygame\b|from\s+pygame\s+import/.test(code)
                        ? "🎮 Pygame"
                        : "🐢 Turtle"}
                  </button>
                  {outputTab === "turtle" && (
                    <button
                      onClick={() => setTurtleFullscreen((v) => !v)}
                      title={turtleFullscreen ? "Exit fullscreen" : "Fullscreen canvas"}
                      className="ml-auto rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
                    >
                      {turtleFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {result && (result.time ?? result.memory) && (
                    <span className="ml-auto flex items-center gap-2 px-3 text-[10px] text-slate-500">
                      {result.time   && <span>{result.time}s</span>}
                      {result.memory && <span>{Math.round(result.memory / 1024)} KB</span>}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-[#1a1a1a] px-3 py-1.5">
                  <Terminal className="h-3 w-3 text-slate-500" />
                  <span className="text-[10px] font-medium text-slate-400">Output</span>
                  {result && (
                    <span className={`ml-auto text-[10px] font-semibold ${success ? "text-emerald-400" : "text-rose-400"}`}>
                      {success ? "✓ Exit 0" : `✗ Exit ${result.exitCode}`}
                    </span>
                  )}
                  {result && (result.time ?? result.memory) && (
                    <span className="flex items-center gap-2 text-[10px] text-slate-500">
                      {result.time   && <span>{result.time}s</span>}
                      {result.memory && <span>{Math.round(result.memory / 1024)} KB</span>}
                    </span>
                  )}
                </div>
              )}

              {/* Turtle canvas — always in DOM so Pyodide can find it; hidden when tab not active */}
              {turtleFullscreen && outputTab === "turtle" && isPython && pyodideMode && (
                <div
                  className="fixed inset-0 z-[59] bg-black/40"
                  onClick={() => setTurtleFullscreen(false)}
                />
              )}
              <div
                className={
                  turtleFullscreen && outputTab === "turtle" && isPython && pyodideMode
                    ? "fixed inset-4 z-[60] flex items-center justify-center overflow-auto rounded-xl border border-slate-700 bg-white shadow-2xl sm:inset-8"
                    : outputTab === "turtle" && isPython && pyodideMode
                      ? "flex-1 overflow-auto bg-white flex items-start justify-center"
                      : "hidden"
                }
              >
                <canvas
                  ref={turtleCanvasRef}
                  id="kat-turtle-canvas"
                  width={480}
                  height={360}
                  className="block"
                  style={{ background: "#fff" }}
                />
              </div>

              {/* Terminal output — hidden when turtle tab is active */}
              <div className={`flex-1 overflow-auto ${outputTab === "turtle" && isPython && pyodideMode ? "hidden" : ""}`}>
                {!result && !error && !running && (
                  <div className="flex h-full items-center justify-center px-4 text-center">
                    <p className="text-xs text-slate-600">
                      {pyodideMode && isPython ? "Browser execution via Pyodide" : "Press Run or Ctrl+Enter"}
                    </p>
                  </div>
                )}
                {running && (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {pyodideLoading ? "Loading Pyodide…" : "Running…"}
                    </div>
                  </div>
                )}
                {(result ?? error) && !running && (
                  <div className="p-4 space-y-3">
                    {result?.compileOutput && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Compiler</p>
                        <pre className="whitespace-pre-wrap font-mono text-xs text-amber-300">{result.compileOutput}</pre>
                      </div>
                    )}
                    {result?.stdout && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">stdout</p>
                        <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-300">{result.stdout}</pre>
                      </div>
                    )}
                    {result?.stderr && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">stderr</p>
                        <pre className="whitespace-pre-wrap font-mono text-xs text-rose-400">{result.stderr}</pre>
                      </div>
                    )}
                    {error && (
                      <pre className="whitespace-pre-wrap font-mono text-xs text-rose-400">{error}</pre>
                    )}
                    {result && !result.stdout && !result.stderr && !result.compileOutput && !error && (
                      <p className="font-mono text-xs text-slate-600">(no output)</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Invite Students Modal ─────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-slate-700 bg-[#1e1e1e] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">Invite Students</p>
                <p className="text-[11px] text-slate-400">
                  {inPeerSession ? "Invite to this live session" : "Assign to this playground"}
                </p>
              </div>
              <button
                onClick={() => { setShowInviteModal(false); setSelectedStudents([]); setStudentSearch(""); setInviteMessage(""); }}
                className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search by name or email…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              autoFocus
            />

            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-700">
              {loadingStudents ? (
                <div className="p-4 text-center text-xs text-slate-500">Searching…</div>
              ) : studentResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  {programId ? "No enrolled students found." : "No program linked to this lesson."}
                </div>
              ) : (
                studentResults.map((s) => {
                  const selected = selectedStudents.some((x) => x.id === s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStudent(s)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/5 ${selected ? "bg-violet-900/30" : ""}`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition ${selected ? "border-violet-500 bg-violet-600 text-white" : "border-slate-600 text-transparent"}`}>
                        ✓
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">
                          {s.firstName} {s.lastName}
                          <span className="ml-1.5 text-[10px] font-normal text-slate-500">{s.role}</span>
                        </p>
                        <p className="truncate text-[10px] text-slate-500">{s.email}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedStudents.map((s) => (
                  <span key={s.id} className="flex items-center gap-1 rounded-full bg-violet-900/40 px-2.5 py-0.5 text-[11px] text-violet-300">
                    {s.firstName}
                    <button onClick={() => toggleStudent(s)} className="ml-0.5 text-violet-400 hover:text-violet-200">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              placeholder="Optional message (e.g. Practice the loop exercise from today's class)"
              maxLength={500}
              rows={2}
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />

            {inPeerSession && (
              <p className="flex items-center gap-1.5 rounded-lg bg-emerald-900/30 px-3 py-2 text-[11px] text-emerald-400">
                <Wifi className="h-3 w-3 shrink-0" />
                Students will be invited directly into your active live session.
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">{selectedStudents.length} selected</span>
              <button
                onClick={() => void sendInvites()}
                disabled={sendingInvites || selectedStudents.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {sendingInvites ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit section (students only) ────────────────────────────────────── */}
      {!isCreator && (
        <div className="border-t border-slate-200 dark:border-slate-700">

          {linkedProject && !showSubmitForm && (
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  Submitted: <span className="font-medium text-slate-800 dark:text-slate-200">{linkedProject.title}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[linkedProject.status]}`}>
                  {STATUS_LABEL[linkedProject.status]}
                </span>
              </div>
              <button
                onClick={() => setShowSubmitForm(true)}
                className="shrink-0 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                Submit again
              </button>
            </div>
          )}

          {showSubmitForm ? (
            <div className="space-y-2.5 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Submit code to instructor</p>
                {checkingAssignment && (
                  <span className="text-[10px] text-slate-400">Checking for linked assignment…</span>
                )}
                {!checkingAssignment && typeof assignmentMatch === "object" && assignmentMatch !== null && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    Linked to: {assignmentMatch.title}
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Project title (e.g. Calculator App)"
                maxLength={120}
                value={submitTitle}
                onChange={(e) => setSubmitTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <textarea
                placeholder="Short description — what does your project do? (min. 10 characters)"
                maxLength={500}
                rows={2}
                value={submitDesc}
                onChange={(e) => setSubmitDesc(e.target.value)}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void submitCodeAsProject()}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting
                    ? <><AlertCircle className="h-3 w-3 animate-pulse" /> Submitting…</>
                    : <><Send className="h-3 w-3" /> Submit to Instructor</>}
                </button>
                <button
                  onClick={() => { setShowSubmitForm(false); setSubmitTitle(""); setSubmitDesc(""); }}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : !linkedProject ? (
            <button
              onClick={() => setShowSubmitForm(true)}
              className="flex w-full items-center justify-center gap-1.5 px-4 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-blue-600 dark:hover:bg-slate-800/50 dark:hover:text-blue-400"
            >
              <Send className="h-3 w-3" />
              Submit code to instructor
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
