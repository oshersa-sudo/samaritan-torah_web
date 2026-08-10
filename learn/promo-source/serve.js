const http=require("http"),fs=require("fs"),path=require("path");
const ROOT="/tmp/claude-0/-home-user-samaritan-torah-web/600a0a39-fe1c-5671-aa13-aafcd45a293d/scratchpad/vid";
const FONTS=ROOT+"/node_modules/@fontsource/rubik/files";
const MT={".html":"text/html; charset=utf-8",".js":"text/javascript",".png":"image/png",
          ".woff2":"font/woff2",".woff":"font/woff",".mp3":"audio/mpeg"};
http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split("?")[0]);
  let f = u==="/" ? ROOT+"/ad.html" : u.startsWith("/f/") ? FONTS+u.slice(2) : ROOT+u;
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404);return res.end("nf "+f);}
    res.writeHead(200,{"Content-Type":MT[path.extname(f)]||"application/octet-stream"});
    res.end(d);
  });
}).listen(8501,()=>console.log("ad server on 8501"));
