const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dist=path.join(__dirname,'dist'),docs=path.join(__dirname,'docs');
let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
html=html.replace(/(href|src)="([a-z-]+\.(?:css|js))(?:\?v=[a-f0-9]+)?"/g,(_,attr,file)=>{
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,file))).digest('hex').slice(0,12);
 return `${attr}="${file}?v=${hash}"`;
});
fs.writeFileSync(path.join(dist,'index.html'),html);
fs.cpSync(dist,docs,{recursive:true});
console.log('Pages prepared with content-versioned CSS and scripts.');
