// fmt.js —— 三种"视频类型"的专用镜头（新闻速报 / 榜单盘点 / 知识科普）和贯穿全片的常驻元素（HUD）。
// 载入顺序：vert.js、vpro.js 后面；样式在 fmt.css。颜色全部跟 KIT_VPRO.theme 的变量走，所以五套画面风格都能套。
// 跟 vpro 的"讲故事"镜头不同，这里每个镜头有固定的结构，程序按内容拼（app/lib/formats.mjs），模型只写内容。
//   新闻：fx-news-open（今天 N 件事）→ fx-news-item × N → fx-news-wrap（打勾回顾）；常驻 顶栏日期 + 条数进度 + 底部滚动快讯
//   榜单：fx-rank-open（TOP N）→ fx-rank-item × N（从第 N 名倒数到第 1）→ fx-rank-final（总榜）；常驻 右侧名次栏
//   科普：fx-exp-open（抛问题 + 章节）→ fx-exp-step × N（流程 / 类比 / 要点）→ fx-exp-sum（总结）；常驻 顶部章节导航
// 规矩同 vpro：每样东西只做一个有意思的入场动作，落定后不动；同一个 t 永远画出同一帧。
(()=>{
const {S,W,ZH,A,fitH,plain}=KIT_VERT;
const {TH,pword,tail,oc,oe}=KIT_VPRO;
const c01=x=>Math.max(0,Math.min(1,x)),f1=x=>(+x).toFixed(1),f3=x=>(+x).toFixed(3),lerp=(a,b,k)=>a+(b-a)*k;
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
const rich=s=>String(s??'').replace(/<(?!\/?em>)/g,'&lt;');          // 只放行 <em>
const ein=k=>c01(k)**2;
// 数字滚上去：'1158' '-6.9%' '$104' '3.2万亿' 都认，前后缀原样留着
function countUp(v,k){
 const m=/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/.exec(String(v??''));if(!m)return esc(v);
 const num=parseFloat(m[2].replace(/,/g,'')),dec=(m[2].split('.')[1]??'').length,x=num*oc(k);
 return esc(m[1])+(m[2].includes(',')?x.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec}):x.toFixed(dec))+esc(m[3]);
}
// 带 <em> 的标题按字数切成两行，重点在哪一行就在哪一行包回 <em>（直接切字符串会把标签切坏）
function splitRich(s,max=11){
 const cs=[];let on=false;String(s??'').replace(/<em>|<\/em>|[\s\S]/g,m=>{if(m==='<em>')on=true;else if(m==='</em>')on=false;else cs.push([m,on]);return '';});
 const n=cs.length;let at=Math.ceil(n/2);
 if(n>max){let best=-1;cs.forEach(([c],i)=>{if(/[，,、：:；;！!？?s]/.test(c)&&i>=n*.3&&i<=n*.7&&(best<0||Math.abs(i-n/2)<Math.abs(best-n/2)))best=i;});if(best>=0)at=best+1;}
 const parts=n>max?[cs.slice(0,at),cs.slice(at)].map(p=>p.filter(([c],i,a)=>!(/[，,、s]/.test(c)&&(i===a.length-1||i===0)))):[cs];
 return parts.map(p=>p.map(([c,e],i)=>(e&&!(p[i-1]?.[1])?'<em>':'')+esc(c)+(e&&!(p[i+1]?.[1])?'</em>':'')).join(''));
}
const numOf=v=>{const m=/-?[\d,]*\.?\d+/.exec(String(v??''));return m?parseFloat(m[0].replace(/,/g,'')):0;};
const timesOf=(p,c,n,lead=.35)=>Array.from({length:n},(_,i)=>c.at(A(p.at)[i])??c.t0+lead+i*Math.max(.3,Math.min(.9,(c.d-lead-.6)/Math.max(1,n))));

// ---------- 底：有图垫图（虚化压暗），没图就是风格的底纹；全部用 vpro 的类，五套风格的 CSS 都管得到 ----------
function bg(p,c,t,o={}){
 const src=p.bg??TH.bg;
 const im=src?`<div class="v-band" style="top:0;height:${ZH}px;box-shadow:none"><img class="m" src="${src}" style="object-position:${p.bgpos??'50% 35%'};transform:scale(${f3((o.s??1.12)+.01*(t-c.t0))});filter:blur(${o.blur??10}px) brightness(${o.bri??.42}) saturate(.6)"></div>`:'';
 return im+`<div class="vp-tint${o.g?' g':''}"></div><div class="vp-dots"></div>`;
}
const fxText=(txt,x,y,fs,extra='',cls='')=>`<div class="fx-t ${cls}" style="left:${x}px;top:${f1(y)}px;font-size:${f1(fs)}px;${extra}">${rich(txt)}</div>`;

// ================= 常驻元素（每一镜都画，位置、样子全片一致；跑马灯按全片时间算，切镜头也连着） =================
function hudNews(p,c,t){
 const h=p.hud??{};if(!h.n&&!h.ticker)return '';
 let s=`<div class="fx-nbar"><b>${esc(h.kicker??'快讯')}</b><span>${esc(h.date??'')}</span>`;
 if(h.n){s+=`<i>`;for(let k=1;k<=h.n;k++)s+=`<u class="${k<h.i?'d':k===h.i?'on':''}"></u>`;s+=`</i><em>${h.i?String(h.i).padStart(2,'0'):'--'}<small>/${String(h.n).padStart(2,'0')}</small></em>`;}
 s+=`</div>`;
 const tk=A(h.ticker).map(esc).join('　●　');
 if(tk){const unit=([...plain(tk)].length+4)*34,x=-((t*110)%unit);
  s+=`<div class="fx-tick"><b>${esc(h.tickLabel??'滚动')}</b><div class="w"><div class="r" style="transform:translateX(${f1(x)}px)">${tk}　●　${tk}　●　${tk}</div></div></div>`;}
 return s;
}
function hudRank(p,c,t){
 const h=p.hud??{};if(!h.n)return '';
 const n=h.n,top=360,gap=Math.min(150,760/n);let s=`<div class="fx-rail"><div class="ln" style="top:${top+20}px;height:${f1(gap*(n-1))}px"></div>`;
 for(let r=n;r>=1;r--){const y=top+(n-r)*gap,cur=r===h.cur,done=h.cur!=null&&r>h.cur,k=cur?oe((t-c.t0)/.4):1;
  s+=`<div class="sl ${cur?'on':done?'d':''}" style="top:${f1(y)}px;transform:scale(${f3(cur?lerp(1,1.18,k):1)})">${r}</div>`;
  if(done&&h.names?.[r])s+=`<div class="nm" style="top:${f1(y+8)}px">${esc(h.names[r])}</div>`;}
 return s+'</div>';
}
function hudExp(p,c,t){
 const h=p.hud??{};const ch=A(h.chapters);if(!ch.length)return '';
 const w=Math.floor((W-80-(ch.length-1)*10)/ch.length);
 return `<div class="fx-nav">${ch.map((x,i)=>{const k=i+1,st=k<h.cur?'d':k===h.cur?'on':'';
  return `<div class="tb ${st}" style="width:${w}px"><b>${k<h.cur?'✓':k}</b><span>${esc(x)}</span>${k===h.cur?`<i style="width:${f1(100*oc((t-c.t0)/.5))}%"></i>`:''}</div>`;}).join('')}</div>`;
}
const HUD={news:hudNews,rank:hudRank,exp:hudExp};
const hud=(p,c,t)=>p.hud?HUD[p.hud.kind]?.(p,c,t)??'':'';
const HELP_HUD="常驻元素，程序自动填，不用手写";

// ===================================== 新闻速报 =====================================
S('fx-news-open',{real:()=>true,minDur:1.5,
 says:'栏目开场：大日期、"今天 N 件事"，几条标题一条条预告出来',use:'新闻速报的第一镜',avoid:'别的类型',
 need:['title'],help:{date:"'11月23日'",kicker:"栏目名 '早报'",title:"'今天 4 件事'",heads:'几条新闻的短标题（预告）',at:'每条预告出现的时刻',hud:HELP_HUD,bg:'垫底的图'},
 beats:p=>A(p.heads).length+1,
 draw(p,c){const hs=A(p.heads),ts=timesOf(p,c,hs.length,.9);
  return t=>{const th=t-c.t0,k1=tail(th,.12),k2=oc((th-.25)/.4);
   let s=bg(p,c,t,{bri:.32,blur:16});
   s+=`<div class="fx-date" style="opacity:${f3(c01(th*5))};transform:translateX(${f1(-160*(1-k1))}px)">${esc(p.date??'')}</div>`;
   if(p.kicker)s+=`<div class="fx-kick" style="opacity:${f3(k2)};transform:translateY(${f1(30*(1-k2))}px)">${esc(p.kicker)}</div>`;
   const k3=(th-.35)/.22;if(k3>0)s+=`<div class="vp-word" style="left:0;top:470px;width:${W}px;font-size:${f1(fitH(p.title,150,960))}px;transform:perspective(1200px) rotateY(-10deg) rotate(-3deg) scale(${f3(1+.5*(1-oe(k3)))});opacity:${f3(c01(k3*3))}">${pword(plain(p.title),'accent')}</div>`;
   hs.forEach((h,i)=>{const k=tail(t-ts[i],.1);if(t<ts[i])return;
    s+=`<div class="fx-pv" style="top:${700+i*118}px;transform:translateX(${f1(700*(1-k))}px)"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(h)}</span></div>`;});
   return s+hud(p,c,t);};}
});

S('fx-news-item',{real:()=>true,minDur:2.4,
 says:'一条新闻：编号、标题、媒体、配图，关键数字滚上来，最后一句点评砸下',use:'新闻速报里的每一条',avoid:'别的类型',
 need:['headline'],help:{no:'第几条',headline:'标题（≤18 字，可用 <em>重点</em>）',source:'媒体名',img:'配图',value:"关键数字 '1158'",unit:'单位',label:'数字说明',comment:'点评（≤14 字）',at:'[数字出现的时刻, 点评出现的时刻]',hud:HELP_HUD,bg:'垫底的图'},
 beats:p=>1+(p.value?1:0)+(p.comment?1:0),
 draw(p,c){const tN=c.at(A(p.at)[0])??c.t0+c.d*.4,tC=c.at(A(p.at)[1])??c.t0+c.d*.72,hasImg=!!p.img;
  const lines=splitRich(p.headline,11);
  return t=>{const th=t-c.t0;let s=bg(p,c,t,{bri:.3,blur:18,g:true});
   const kn=tail(th,.1);s+=`<div class="fx-no" style="opacity:${f3(c01(th*6))};transform:translateX(${f1(-120*(1-kn))}px)">${String(p.no??1).padStart(2,'0')}</div>`;
   if(p.source){const k=oc((th-.15)/.3);s+=`<div class="fx-src" style="opacity:${f3(k)}">${esc(p.source)}</div>`;}
   lines.forEach((l,i)=>{const k=oc((th-.12-i*.12)/.35);s+=`<div class="fx-hl" style="top:${300+i*112}px;font-size:${f1(fitH(l.replace(/<\/?em>/g,''),96,950))}px;clip-path:inset(-20% ${f1(100*(1-k))}% -20% -2%)">${l}</div>`;});
   const y0=300+lines.length*112+40;
   if(hasImg){const k=oc((th-.3)/.45);s+=`<div class="fx-win" style="top:${y0}px;height:${f1(Math.min(520,1180-y0-60))}px;opacity:${f3(k)};transform:translateY(${f1(60*(1-k))}px) rotate(${f1(-1.5*(1-k))}deg)"><img src="${p.img}" style="transform:scale(${f3(1.04+.01*th)})"></div>`;}
   if(p.value&&t>=tN-.05){const k=tail(t-tN+.05,.09),kc=(t-tN)/.7;
    if(hasImg){const yN=Math.min(1000,y0+400);
     s+=`<div class="fx-read" style="top:${f1(yN)}px;transform:translateY(${f1(120*(1-k))}px) scale(${f3(.9+.1*k)});opacity:${f3(c01((t-tN+.05)*8))}"><b>${countUp(p.value,kc)}</b><span><i>${esc(p.unit??'')}</i><u>${esc(p.label??'')}</u></span></div>`;}
    else{const kb=(t-tN+.05)/.3;   // 没有配图：数字就是这一镜的主角，放大到画面中间砸下来
     s+=`<div class="fx-big" style="top:${f1(y0+30)}px;transform:scale(${f3(1+.9*(1-oe(kb)))});opacity:${f3(c01(kb*4))};filter:blur(${f1(8*(1-c01(kb)))}px)"><b class="vp-back lit">${countUp(p.value,kc)}</b><span><i>${esc(p.unit??'')}</i>${esc(p.label??'')}</span></div>`;}}
   if(p.comment&&t>=tC){const k=(t-tC)/.18;s+=`<div class="fx-cmt" style="transform:rotate(-2deg) scale(${f3(1+.35*(1-oe(k)))});opacity:${f3(c01(k*3))}"><b>点评</b>${rich(p.comment)}</div>`;}
   return s+hud(p,c,t);};}
});

S('fx-news-wrap',{real:()=>true,minDur:1.6,
 says:'回顾：几条标题打勾，最后盖一句今天的结论',use:'新闻速报的最后一镜',avoid:'别的类型',
 need:['heads'],help:{title:"'今天就这些'",heads:'几条短标题',takeaway:'一句结论（≤12 字）',at:'[结论出现的时刻]',hud:HELP_HUD,bg:'垫底的图'},
 beats:p=>A(p.heads).length+1,
 draw(p,c){const hs=A(p.heads),tT=c.at(A(p.at)[0])??c.t0+c.d*.65,ts=hs.map((_,i)=>c.t0+.3+i*Math.min(.5,(tT-c.t0-.4)/Math.max(1,hs.length)));
  return t=>{const th=t-c.t0;let s=bg(p,c,t,{bri:.3,blur:18,g:true});
   if(p.title)s+=`<div class="v-h v-shadow" style="left:60px;top:200px;font-size:84px;opacity:${f3(oc(th/.3))}">${rich(p.title)}</div>`;
   hs.forEach((h,i)=>{if(t<ts[i]-.1)return;const k=oc((t-ts[i]+.1)/.3),kt=oe((t-ts[i]-.15)/.25);
    s+=`<div class="fx-chk" style="top:${340+i*130}px;opacity:${f3(k)};transform:translateX(${f1(80*(1-k))}px)"><i style="transform:scale(${f3(kt)})">✓</i><span>${esc(h)}</span></div>`;});
   if(p.takeaway&&t>=tT){const k=(t-tT)/.2;s+=`<div class="fx-take" style="font-size:${f1(fitH(plain(p.takeaway),110,980))}px;top:${Math.min(1060,380+hs.length*130+40)}px;transform:rotate(-3deg) scale(${f3(1+.4*(1-oe(k)))});opacity:${f3(c01(k*3))}">${rich(p.takeaway)}</div>`;}
   return s+hud(p,c,t);};}
});

// ===================================== 榜单盘点 =====================================
S('fx-rank-open',{real:()=>true,minDur:1.5,
 says:'榜单开场：巨大的 TOP N，榜单名和按什么排',use:'榜单盘点的第一镜',avoid:'别的类型',
 need:['title','n'],help:{title:"榜单名 '全球最赚钱的公司'",n:'几名',metric:"按什么排 '按 2025 年净利润'",at:'[榜单名出现的时刻]',hud:HELP_HUD,bg:'垫底的图'},
 beats:()=>2,
 draw(p,c){const tT=c.at(A(p.at)[0])??c.t0+.5;
  return t=>{const th=t-c.t0,k=(th)/.3;let s=bg(p,c,t,{bri:.28,blur:18});
   s+=`<div class="fx-top" style="transform:scale(${f3(1+.8*(1-oe(k)))});opacity:${f3(c01(k*4))}"><span>TOP</span><b class="vp-back lit" style="position:static;width:auto">${esc(p.n)}</b></div>`;
   if(t>=tT){const k2=(t-tT)/.22;s+=`<div class="vp-word" style="left:0;top:880px;width:${W-120}px;font-size:${f1(fitH(p.title,130,880))}px;transform:perspective(1200px) rotateY(-10deg) rotate(-3deg) scale(${f3(1+.5*(1-oe(k2)))});opacity:${f3(c01(k2*3))}">${pword(plain(p.title),'white')}</div>`;}
   if(p.metric){const k3=oc((th-.6)/.4);s+=`<div class="fx-metric" style="opacity:${f3(k3)}">${esc(p.metric)}</div>`;}
   return s+hud(p,c,t);};}
});

S('fx-rank-item',{real:()=>true,minDur:2.2,
 says:'一个名次：巨大的名次数字砸下来，名字、配图，数据条按比例长出来，一句点评',use:'榜单盘点里的每一名',avoid:'别的类型',
 need:['rank','name'],help:{rank:'第几名',name:'名字（≤8 字）',sub:'小字（国家、行业）',img:'配图（圆窗）',value:"数值 '4.2'",unit:'单位',max:'榜上最大的数值（算条长）',comment:'点评（≤14 字）',at:'[数据条开始长的时刻, 点评出现的时刻]',hero:'第一名',hud:HELP_HUD,bg:'垫底的图'},
 beats:p=>2+(p.comment?1:0),
 draw(p,c){const tB=c.at(A(p.at)[0])??c.t0+c.d*.35,tC=c.at(A(p.at)[1])??c.t0+c.d*.7,ratio=c01(numOf(p.value)/Math.max(1e-9,numOf(p.max??p.value))),one=+p.rank===1;
  return t=>{const th=t-c.t0;let s=bg(p,c,t,{bri:.3,blur:16,g:true});
   if(one){const k=oc(th/.6);s+=`<div class="fx-rays" style="opacity:${f3(.55*k)};transform:scale(${f3(.6+.4*k)})"></div>`;}
   const kn=th/.32;s+=`<div class="fx-rk vp-back lit" style="filter:blur(${f1(10*(1-c01(kn)))}px);transform:scale(${f3(1+1.4*(1-oe(kn)))});opacity:${f3(c01(kn*3))}"><small>#</small>${esc(p.rank)}</div>`;
   const kN=oc((th-.25)/.35);
   s+=`<div class="fx-rname" style="opacity:${f3(kN)};transform:translateX(${f1(90*(1-kN))}px);font-size:${f1(fitH(p.name,118,p.img?560:820))}px;left:${p.img?420:100}px">${esc(p.name)}</div>`;
   if(p.sub)s+=`<div class="fx-rsub" style="left:${p.img?424:104}px;opacity:${f3(oc((th-.4)/.35))}">${esc(p.sub)}</div>`;
   if(p.img){const k=tail(th-.2,.12);s+=`<div class="fx-disc" style="transform:scale(${f3(k)}) rotate(${f1(-20*(1-k))}deg)"><img src="${p.img}"></div>`;}
   if(p.value!=null&&t>=tB-.1){const k=(t-tB)/.8,w=820*Math.max(.06,ratio)*oc(k);
    s+=`<div class="fx-bar"><i style="width:${f1(w)}px"></i><b style="left:${f1(Math.min(w+20,640))}px">${countUp(p.value,k)}<small>${esc(p.unit??'')}</small></b></div>`;}
   if(p.comment&&t>=tC){const k=(t-tC)/.18;s+=`<div class="fx-cmt" style="top:1150px;transform:rotate(-2deg) scale(${f3(1+.35*(1-oe(k)))});opacity:${f3(c01(k*3))}"><b>${one?'冠军':'点评'}</b>${rich(p.comment)}</div>`;}
   return s+hud(p,c,t);};}
});

S('fx-rank-final',{real:()=>true,minDur:1.8,
 says:'总榜：所有名次的横条依次长出来，第一名用强调色，最后一句结论',use:'榜单盘点的最后一镜',avoid:'别的类型',
 need:['items'],help:{title:'标题',items:"[{rank, name, value}]，按名次排",unit:'单位',takeaway:'一句结论（≤12 字）',at:'[结论出现的时刻]',hud:HELP_HUD,bg:'垫底的图'},
 beats:p=>A(p.items).length+1,
 draw(p,c){const its=[...A(p.items)].sort((a,b)=>a.rank-b.rank),mx=Math.max(...its.map(i=>numOf(i.value)),1e-9),tT=c.at(A(p.at)[0])??c.t0+c.d*.7;
  const gap=Math.min(130,620/its.length);
  return t=>{const th=t-c.t0;let s=bg(p,c,t,{bri:.28,blur:18,g:true});
   if(p.title)s+=`<div class="v-h v-shadow" style="left:60px;top:190px;font-size:${fitH(p.title,84,960)}px;opacity:${f3(oc(th/.3))}">${rich(p.title)}</div>`;
   its.forEach((it,i)=>{const t0=c.t0+.25+(its.length-1-i)*.22,k=oc((t-t0)/.6);if(t<t0)return;const w=470*Math.max(.05,numOf(it.value)/mx)*k;
    s+=`<div class="fx-fb ${+it.rank===1?'one':''}" style="top:${f1(340+i*gap)}px;opacity:${f3(c01((t-t0)*6))}"><span>${esc(it.rank)}</span><b>${esc(it.name)}</b><i style="width:${f1(w)}px"></i><em>${countUp(it.value,k)}<small>${esc(p.unit??'')}</small></em></div>`;});
   if(p.takeaway&&t>=tT){const k=(t-tT)/.2;s+=`<div class="fx-take" style="font-size:${f1(fitH(plain(p.takeaway),110,980))}px;top:${f1(Math.min(1080,360+its.length*gap+30))}px;transform:rotate(-3deg) scale(${f3(1+.4*(1-oe(k)))});opacity:${f3(c01(k*3))}">${rich(p.takeaway)}</div>`;}
   return s+hud(p,c,t);};}
});

// ===================================== 知识科普 =====================================
S('fx-exp-open',{real:()=>true,minDur:1.6,
 says:'抛出问题，几个章节卡片排出来：今天分几步讲',use:'知识科普的第一镜',avoid:'别的类型',
 need:['question'],help:{question:'问题（≤12 字，不写问号）',chapters:'几个章节名',at:'每个章节出现的时刻',hud:HELP_HUD,bg:'垫底的图'},
 beats:p=>A(p.chapters).length+1,
 draw(p,c){const ch=A(p.chapters),ts=timesOf(p,c,ch.length,.9);
  return t=>{const th=t-c.t0,kq=tail(th-.05,.12);let s=bg(p,c,t,{bri:.3,blur:16});
   s+=`<div class="vp-askq" style="left:560px;top:150px;transform:rotate(${f1(14+40*(1-kq))}deg) scale(${f3(.6+.4*kq)});opacity:${f3(c01(th*6)*.75)}">？</div>`;
   const k=(th-.15)/.2,fs=fitH(p.question,140,900);
   if(k>0){const q=String(p.question??''),ls=q.length>9?[q.slice(0,Math.ceil(q.length/2)),q.slice(Math.ceil(q.length/2))]:[q];
    ls.forEach((l,i)=>{s+=`<div class="vp-word" style="left:${i%2?10:-30}px;top:${f1(330+i*fs*1.15)}px;width:${W}px;font-size:${f1(fitH(l,140,900))}px;transform:perspective(1200px) rotateY(-12deg) rotate(-3deg) scale(${f3(1+.6*(1-oe(k-i*.4)))});opacity:${f3(c01((k-i*.4)*3))}">${pword(l,i===ls.length-1?'accent':'white')}</div>`;});}
   ch.forEach((x,i)=>{if(t<ts[i])return;const kk=tail(t-ts[i],.1);s+=`<div class="fx-chap" style="top:${780+i*120}px;transform:translateX(${f1(-700*(1-kk))}px)"><b>${i+1}</b><span>${esc(x)}</span></div>`;});
   return s+hud(p,c,t);};}
});

S('fx-exp-step',{real:()=>true,minDur:2.2,
 says:'一步：标题，然后按内容演——流程图一个框一个框连起来 / "打个比方"两边对照 / 一句要点',use:'知识科普里的每一步',avoid:'别的类型',
 need:['title'],help:{no:'第几步',title:'这一步叫什么（≤8 字）',kind:"'flow' 流程 / 'analogy' 类比 / 'point' 要点",nodes:'流程的 2–4 个框（每个 ≤8 字）',a:'类比：要讲的东西',b:'类比：像生活里的什么',point:'一句要点（≤16 字，可用 <em>）',at:'流程每个框 / 类比两边 / 要点出现的时刻',hud:HELP_HUD,bg:'垫底的图'},
 beats:p=>p.kind==='flow'?A(p.nodes).length:p.kind==='analogy'?2:1,
 draw(p,c){const kind=p.kind??'point',nodes=A(p.nodes),n=kind==='flow'?nodes.length:kind==='analogy'?2:0,ts=timesOf(p,c,n+(p.point?1:0),.6);
  return t=>{const th=t-c.t0;let s=bg(p,c,t,{bri:.3,blur:18,g:true});
   const kh=oc(th/.35);
   s+=`<div class="fx-step" style="opacity:${f3(kh)};transform:translateX(${f1(-80*(1-kh))}px)"><b>STEP ${esc(p.no??1)}</b><span>${rich(p.title)}</span></div>`;
   if(kind==='flow'){const gap=Math.min(230,700/Math.max(1,nodes.length));
    nodes.forEach((x,i)=>{if(t<ts[i])return;const k=tail(t-ts[i],.1),y=420+i*gap;
     if(i>0){const ka=oc((t-ts[i]+.05)/.25);s+=`<div class="fx-arrow" style="top:${f1(y-gap+150)}px;height:${f1((gap-150)*ka)}px"></div>`;}
     s+=`<div class="fx-node ${i===nodes.length-1?'last':''}" style="top:${f1(y)}px;transform:scale(${f3(.7+.3*k)});opacity:${f3(c01((t-ts[i])*6))}"><i>${i+1}</i>${rich(x)}</div>`;});}
   else if(kind==='analogy'){
    [[p.a,'它'],[p.b,'就像']].forEach(([x,lab],i)=>{if(t<ts[i])return;const k=tail(t-ts[i],.11);
     s+=`<div class="fx-ana ${i?'b':''}" style="top:${i?760:430}px;transform:translateX(${f1((i?1:-1)*700*(1-k))}px) rotate(${i?2:-2}deg)"><u>${lab}</u>${rich(x)}</div>`;});
    if(t>=ts[1]){const k=oe((t-ts[1]-.1)/.25);s+=`<div class="fx-eq" style="transform:scale(${f3(k)})">≈</div>`;}}
   if(kind==='point'){const kg=oc((th-.1)/.5);s+=`<div class="fx-ghost" style="opacity:${f3(kg)};transform:translateY(${f1(80*(1-kg))}px)">${esc(p.no??1)}</div>`;}
   if(p.point){const tp=ts[n]??c.t0+.6;if(t>=tp){const k=(t-tp)/.18,y=kind==='point'?560:Math.min(1120,kind==='flow'?420+nodes.length*Math.min(230,700/Math.max(1,nodes.length))+10:1050);
    s+=`<div class="fx-point ${kind==='point'?'big':''}" style="top:${f1(y)}px;transform:rotate(-1.5deg) scale(${f3(1+.3*(1-oe(k)))});opacity:${f3(c01(k*3))}">${rich(p.point)}</div>`;}}
   return s+hud(p,c,t);};}
});

S('fx-exp-sum',{real:()=>true,minDur:1.6,
 says:'总结：几条要点一条条打勾，最后一句话收住',use:'知识科普的最后一镜',avoid:'别的类型',
 need:['items'],help:{title:"'一张图记住'",items:'2–4 条要点（每条 ≤14 字）',takeaway:'一句话（≤12 字）',at:'[结论出现的时刻]',hud:HELP_HUD,bg:'垫底的图'},
 beats:p=>A(p.items).length+1,
 draw(p,c){const its=A(p.items),tT=c.at(A(p.at)[0])??c.t0+c.d*.7,ts=its.map((_,i)=>c.t0+.3+i*Math.min(.55,(tT-c.t0-.4)/Math.max(1,its.length)));
  return t=>{const th=t-c.t0;let s=bg(p,c,t,{bri:.28,blur:18,g:true});
   s+=`<div class="v-h v-shadow" style="left:60px;top:200px;font-size:84px;opacity:${f3(oc(th/.3))}">${rich(p.title??'一张图记住')}</div>`;
   its.forEach((x,i)=>{if(t<ts[i]-.1)return;const k=oc((t-ts[i]+.1)/.3),kt=oe((t-ts[i]-.15)/.25);
    s+=`<div class="fx-chk" style="top:${340+i*140}px;opacity:${f3(k)};transform:translateX(${f1(80*(1-k))}px)"><i style="transform:scale(${f3(kt)})">${i+1}</i><span>${rich(x)}</span></div>`;});
   if(p.takeaway&&t>=tT){const k=(t-tT)/.2;s+=`<div class="fx-take" style="font-size:${f1(fitH(plain(p.takeaway),110,980))}px;top:${Math.min(1060,380+its.length*140+40)}px;transform:rotate(-3deg) scale(${f3(1+.4*(1-oe(k)))});opacity:${f3(c01(k*3))}">${rich(p.takeaway)}</div>`;}
   return s+hud(p,c,t);};}
});
})();
