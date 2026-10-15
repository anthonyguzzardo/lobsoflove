// Shared offline canvas artwork for the study and app startup.
window.createLoveIntro=function(canvas){
'use strict';
const ctx=canvas.getContext('2d'),size=900;
const dpr=Math.min(window.devicePixelRatio||1,2);
canvas.width=size*dpr;canvas.height=size*dpr;ctx.scale(dpr,dpr);
let state={};
const mix=(a,b,t)=>a+(b-a)*t,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const sample=(fn,n=220)=>Array.from({length:n+1},(_,i)=>fn(i/n));
const colors=['#e8664f','#508cc3','#e9ac45','#a27ac5','#439779'];
const curls=colors.map((color,i)=>{
 const start=i*Math.PI*2/5-1.8;
 return {color:i===4?'#c4476b':color,pattern:i===4?0:i%3,pts:sample(u=>{const a=start+u*4.8,r=340-175*u+28*Math.sin(u*6+i)+12*Math.sin(u*17+i*.7);return [450+Math.cos(a)*r,445+Math.sin(a)*r*.88];}),delay:i*.45,width:16+(i%3)*3};
});
function stroke(pts,progress,color,width,pattern=0,alpha=1,t=0){
 if(progress<=0)return;const end=Math.min(pts.length-1,progress*(pts.length-1));
 const actual=[];for(let i=0;i<=Math.floor(end);i++){const p=pts[i];actual.push([p[0]+Math.sin(i*.14+Math.floor(t*7)*.8)*.55,p[1]+Math.cos(i*.12+Math.floor(t*7)*.7)*.55]);}
 if(actual.length<2)return;ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();actual.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();
 let distance=0;for(let i=1;i<actual.length;i++){const a=actual[i-1],b=actual[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);distance+=len;if(distance<14)continue;distance=0;ctx.save();ctx.translate(...b);ctx.rotate(Math.atan2(dy,dx));ctx.fillStyle=pattern===1?'#244f7c':'#fff2d7';ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=2.2;if(pattern===1){ctx.beginPath();ctx.moveTo(-2,-width*.29);ctx.lineTo(2,width*.29);ctx.stroke();}else if(pattern===2){ctx.fillRect(-2,-1,4,2);}else{ctx.beginPath();ctx.arc(0,0,width*.12,0,Math.PI*2);ctx.fill();}ctx.restore();}ctx.restore();
}
const circle=sample(u=>{const a=-Math.PI/2+u*Math.PI*2,r=169+Math.sin(a*3)*2+Math.sin(a*7)*1.4;return [450+Math.cos(a)*r,445+Math.sin(a)*r];},320);
const seams=[-1,1].map(side=>sample(u=>{const y=-137+274*u;return [450+side*(99-66*Math.sin(Math.PI*u)),445+y];}));

const line=(a,b,n=35)=>sample(u=>[mix(a[0],b[0],u),mix(a[1],b[1],u)],n);
const letter=side=>{const x=450+side*255;return [...line([x,239],[x+side*3,646],80),...sample(u=>[x+side*3-side*155*u,646+Math.sin(u*Math.PI)*3],45)];};
// Silhouettes follow FighterAvatar: a single goblin body and the compact Serve Bot.
function friend(kind,x,y,t,active,side,celebrate,effort=0,scale=.56){
 const hop=active?Math.max(0,Math.sin(t*6+side))*9:celebrate?Math.max(0,Math.sin(t*8))*15:0;
 ctx.save();ctx.translate(x,y-hop);ctx.rotate(active?Math.sin(t*6+side)*.055:Math.sin(t*2+side)*.018);
 ctx.rotate(side*effort*.16);ctx.scale(scale*(1+hop*.004+effort*.14),scale*(1-hop*.003-effort*.12));ctx.translate(-100,-174);
 const ink='#314e59',color=({goblin:'#62b997',bot:'#81b5da',rabbit:'#d69bc0',grunter:'#e9ac45',ghost:'#b5a1d4',wall:'#e98b71'})[kind];ctx.fillStyle=color;ctx.strokeStyle=ink;ctx.lineWidth=4;
 const shape=path=>{ctx.fill(path);ctx.stroke(path);};
 const rect=(x,y,w,h,r)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.stroke();};
 if(kind==='goblin'){
 shape(new Path2D('M48 96 8 62 52 74Z M152 96 192 62 148 74Z'));
 ctx.beginPath();ctx.ellipse(100,106,58,62,0,0,Math.PI*2);ctx.fill();ctx.stroke();
 }else if(kind==='rabbit'){
 for(const x of [74,126]){ctx.beginPath();ctx.ellipse(x,52,15,40,0,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.beginPath();ctx.ellipse(100,124,62,54,0,0,Math.PI*2);ctx.fill();ctx.stroke();
 }else if(kind==='grunter'){ctx.beginPath();ctx.arc(100,100,72,0,Math.PI*2);ctx.fill();ctx.stroke();
 }else if(kind==='ghost'){shape(new Path2D('M42 176V88a58 58 0 0 1 116 0v88l-23-14-18 16-17-16-17 16-18-16Z'));
 }else if(kind==='wall'){rect(38,36,124,130,10);ctx.globalAlpha*=.6;for(const y of [68,100,132]){ctx.beginPath();ctx.moveTo(38,y);ctx.lineTo(162,y);ctx.stroke();}ctx.globalAlpha/=.6;
 }else{
 ctx.strokeStyle=color;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(100,14);ctx.lineTo(100,38);ctx.stroke();ctx.beginPath();ctx.arc(100,14,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=4;
 rect(46,38,108,82,16);rect(62,126,76,46,10);rect(30,66,12,28,5);rect(158,66,12,28,5);
 }
 const fy=({goblin:100,bot:78,rabbit:120,grunter:86,ghost:88,wall:92})[kind];
 for(const eye of [80,120]){ctx.fillStyle='#fffdf0';ctx.beginPath();ctx.ellipse(eye,fy,9,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(eye+side*2,fy+2,4.5,6.5,0,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle=ink;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();if(kind==='bot'){ctx.moveTo(83,fy+26);ctx.lineTo(117,fy+26);}else{ctx.arc(100,fy+20,15,.15,Math.PI-.15);}ctx.stroke();
 if(kind==='goblin'){ctx.beginPath();ctx.moveTo(68,fy-24);ctx.lineTo(90,fy-16);ctx.moveTo(132,fy-24);ctx.lineTo(110,fy-16);ctx.stroke();}ctx.restore();
}
const glyphs={L:[[[0,0],[0,1],[.65,1]]],O:[sample(u=>[.35+Math.cos(-Math.PI/2+u*6.283)*.35,.5+Math.sin(-Math.PI/2+u*6.283)*.5],65)],B:[[[0,1],[0,0]],sample(u=>[Math.sin(u*Math.PI)*.6,u*.48],30),sample(u=>[Math.sin(u*Math.PI)*.7,.48+u*.52],30)],S:[[[.65,.07],[.48,0],[.22,.01],[.05,.12],[.02,.27],[.12,.39],[.52,.55],[.65,.68],[.65,.83],[.5,.97],[.22,1],[.02,.92]]],F:[[[.65,0],[0,0],[0,1]],[[0,.46],[.52,.46]]],V:[[[0,0],[.35,1],[.7,0]]],E:[[[.65,0],[0,0],[0,1],[.65,1]],[[0,.48],[.5,.48]]]};
// Each letter follows the arch's tangent, preserving the hand-drawn strokes.
const titlePaths=[],titleColors=[];let pen=165,word=0;
for(const char of 'LOBS OF LOVE'){
 if(char===' '){pen+=20;word++;continue;}
 const cx=pen+19,base=112+.00112*(cx-450)**2,angle=Math.atan(.00224*(cx-450));
 const place=p=>{const x=(p[0]-.35)*54,y=(p[1]-1)*58;return [cx+x*Math.cos(angle)-y*Math.sin(angle),base+x*Math.sin(angle)+y*Math.cos(angle)];};
 for(const path of glyphs[char]){titleColors.push(word===0?'#c4476b':colors[Math.floor(titlePaths.length/3)%5]);titlePaths.push(path.flatMap((point,i)=>i?line(place(path[i-1]),place(point),8):[]));}
 pen+=53;
}
const teams=[['goblin','grunter','rabbit'],['bot','wall','ghost']];
function teamPose(side,t){
 const delay=side<0?0:.7,push=ease((t-10-delay)/3),lift=ease((t-13-delay)/3.7),settle=Math.max(0,t-16.7-delay);
 const wobble=settle>0?Math.sin(settle*8)*Math.exp(-settle*2.1)*.11:0;
 return {x:mix(side<0?65:835,450+side*258,push),y:mix(side<0?595:675,646,push),angle:-side*(Math.PI/2*(1-lift)+wobble),push,lift};
}
function assemble(t,fade,titleTime=t){
 const crew=[];
 for(const side of [-1,1]){
 const pose=teamPose(side,t),reveal=ease((t-7.5-(side>0?.7:0))/1.2);
 const local=letter(side).map(p=>[p[0]-(450+side*258),p[1]-646]);
 ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);if(side>0){const flip=ease((t-20)/2.3);ctx.translate(0,-Math.sin(flip*Math.PI)*16);ctx.scale(-Math.cos(flip*Math.PI),1);}stroke(local,reveal,side<0?colors[0]:colors[1],32,side<0?0:1,fade,t);ctx.restore();
 for(let i=0;i<3;i++){
 const gather=ease((t-8.5-i*.18)/1.4),park=ease((t-19-i*.15)/2);
 const workingX=pose.x-side*(45+i*69),workingY=pose.y+64+(i%2)*9;
 const finalX=side<0?207+i*94:693-i*94;
 const x=mix(mix(450+side*(285-i*66),workingX,gather),finalX,park);
 const y=mix(mix(806,workingY,gather),776,park);
 crew.push({kind:teams[side<0?0:1][i],x,y,side,i,visible:ease((t-8-i*.15)/.7),active:t>8.5&&t<21,scale:mix(.56,.476,park),celebrate:t>24+i*.12&&t<26+i*.12});
 }
 }
 crew.sort((a,b)=>a.y-b.y).forEach(c=>{ctx.save();ctx.globalAlpha=fade*c.visible;friend(c.kind,c.x,c.y,t+c.i*.22,c.active,-c.side,c.celebrate,(c.side>0&&t>20&&t<22.3?.85:0)+Math.sin(clamp((t-12.4-(c.side>0?.7:0))/4.3)*Math.PI),c.scale);ctx.restore();});
 titlePaths.forEach((p,i)=>stroke(p,ease((titleTime-23-i*.12)/.65),titleColors[i],9,2,fade,t));
 state={time:t,leftPlaced:t>=18.5,rightPlaced:t>=19.2,titleComplete:titleTime>=26,crew:crew.map(c=>({kind:c.kind,x:c.x,y:c.y})),poses:[teamPose(-1,t),teamPose(1,t)]};
}
function draw(t,options={}){
 ctx.fillStyle='#eee9df';ctx.fillRect(0,0,size,size);
 ctx.save();if(options.icon){ctx.translate(450,450);ctx.scale(1.08,1.08);ctx.translate(-450,-445);}
 const fade=1-ease((t-34)/2),arrive=ease((t-5)/3);
 ctx.save();ctx.globalAlpha=fade;
 // Broad colored gestures arrive first, then leave room for the ball.
 for(let i=0;i<curls.length;i++){const s=curls[i];stroke(s.pts,ease((t-s.delay)/3.7),s.color,s.width,s.pattern,(1-arrive*.82)*fade,t);}
 const bounce=t>10?Math.sin((t-10)*2.3)*Math.exp(-(t-10)*.45)*13:0;
 ctx.save();ctx.translate(0,-bounce);
 ctx.globalAlpha=fade*arrive;ctx.fillStyle='#c7d96c';ctx.beginPath();circle.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();ctx.globalAlpha=fade;
 stroke(circle,ease((t-4)/3.2),'#51966f',13,2,fade,t);
 for(let i=0;i<2;i++)stroke(seams[i],ease((t-7-i*.6)/1.7),'#fff5d9',12,2,fade,t);
 // Small handmade marks keep the filled ball lively without crowding it.
 ctx.globalAlpha=arrive*fade*.4;ctx.fillStyle='#6c9c53';for(let i=0;i<15;i++){const x=450+Math.sin(i*14.3)*65,y=445+Math.cos(i*8.7)*110;ctx.beginPath();ctx.ellipse(x,y,2.5,1.2,-.5,0,Math.PI*2);ctx.fill();}
 ctx.restore();ctx.restore();
 if(options.icon){for(const side of [-1,1])stroke(letter(side),1,side<0?colors[0]:colors[1],32,side<0?0:1,1,30);}else assemble(t,fade,options.titleTime??t);
 ctx.restore();

}

return {draw,drawMark:()=>draw(30,{icon:true}),getState:()=>state};
};
