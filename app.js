"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const SYM={JPY:"¥",CNY:"CN¥",USD:"$",EUR:"€",HKD:"HK$",GBP:"£"};
const fmt=(v,c="JPY")=>{const d=c==="JPY"?0:2;return (v<0?"-":"")+(SYM[c]||c+" ")+Math.abs(Number(v)).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d})};
const CATC={"餐饮":"var(--orange)","交通":"var(--blue)","购物":"var(--pink)","娱乐":"var(--purple)","居住":"var(--indigo)","医疗":"var(--red)","通讯":"var(--teal)","订阅":"var(--mint)","健身":"var(--green)","工资":"var(--green)","收入":"var(--green)"};
const PAL=["var(--orange)","var(--blue)","var(--pink)","var(--purple)","var(--indigo)","var(--teal)","var(--green)","var(--brown)","var(--yellow)"];
let colorMap={};const colorOf=c=>CATC[c]||colorMap[c]||"var(--gray)";
const TYPE={expense:"支出",income:"收入",transfer:"转账"},WD="日一二三四五六";
let E=[],BUD=null,BASE="JPY";const pad=n=>String(n).padStart(2,"0");
const TZF=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
function tokyo(dt){dt=String(dt||"");const t=/(Z|[+-]\d\d:?\d\d)$/.test(dt)?Date.parse(dt):NaN;
 if(isNaN(t)){const m=dt.replace(" ","T");return {d:m.slice(0,10),hm:m.slice(11,16)}}
 const o={};TZF.formatToParts(new Date(t)).forEach(p=>o[p.type]=p.value);return {d:`${o.year}-${o.month}-${o.day}`,hm:`${o.hour}:${o.minute}`}}
const today=()=>tokyo(new Date().toISOString()).d,nowYM=()=>today().slice(0,7);
const conf=r=>r.confidence==null||r.confidence===""||isNaN(+r.confidence)?1:+r.confidence;
const isPend=r=>conf(r)<0.8;
function norm(r){const t=tokyo(r.datetime);const {attachment,...rest}=r;const rc=rest.receipt,ok=rc&&/^[0-9a-f]{32}$/.test(rc.id)&&/^[0-9a-f]{32}$/.test(rc.thumb);delete rest.receipt;return {...rest,hasAtt:!!attachment||!!ok,rc:ok?{id:rc.id,thumb:rc.thumb,w:+rc.w||0,h:+rc.h||0}:null,amount:Math.abs(+r.amount||0),currency:r.currency||"JPY",d:t.d,ym:t.d.slice(0,7),y:t.d.slice(0,4),hm:t.hm,key:t.d+"T"+t.hm+"|"+r.datetime}}
const base=a=>a.filter(r=>r.currency===BASE),sum=a=>a.reduce((s,r)=>s+r.amount,0);
const exOf=a=>sum(base(a).filter(r=>r.type==="expense")),incOf=a=>sum(base(a).filter(r=>r.type==="income"));
const groupBy=(a,k)=>a.reduce((o,r)=>((o[r[k]]=o[r[k]]||[]).push(r),o),{});
const sorted=a=>[...a].sort((x,y)=>y.key<x.key?-1:y.key>x.key?1:0);
const mlabel=ym=>+ym.slice(5)+"月",dlabel=d=>`${+d.slice(5,7)}月${+d.slice(8)}日 周${WD[new Date(d+"T12:00:00Z").getUTCDay()]}`;
function curNote(a){const o={};a.filter(r=>r.currency!==BASE&&r.type!=="transfer").forEach(r=>{const c=o[r.currency]=o[r.currency]||{ex:0,inc:0};c[r.type==="income"?"inc":"ex"]+=r.amount});
 const k=Object.keys(o);return k.length?`<div class="cur" id="other-cur">其他币种（单独汇总，不换算，未计入 ${BASE} 合计）：${k.map(c=>`${c} 支出 ${fmt(o[c].ex,c)} · 收入 ${fmt(o[c].inc,c)}`).join("；")}</div>`:""}
function txRow(r){const s=r.type==="income"?"+":r.type==="transfer"?"":"-";
 return `<div class="row tall" role="button" tabindex="0" data-id="${esc(r.id)}"><span class="badge" style="background:${r.type==="transfer"?"var(--gray)":colorOf(r.category)}">${esc((r.type==="transfer"?"转":r.category||"·").slice(0,1))}</span>
 <div class="m"><div class="p">${esc(r.payee||r.category||"—")}${isPend(r)?'<span class="tag">待确认</span>':""}</div><div class="n">${esc([r.hm,r.type==="transfer"?"转账":r.category,r.account].filter(Boolean).join(" · "))}</div></div>
 <span class="amt num ${r.type==="income"?"in":""}">${s}${fmt(r.amount,r.currency)}</span></div>`}
// List pagination: PER entries per page, page number mirrored in the hash (#/list?p=3) so back/forward/reload restore it.
const PER=20;let pg=1;
const hashP=()=>{const m=/[?&]p=(\d+)/.exec(location.hash);return m?Math.max(1,+m[1]):1};
const pager=(p,n)=>n<=1?"":`<nav class="pager" id="pager" aria-label="分页"><button class="pg-b" data-pg="-1"${p<=1?" disabled":""} aria-label="上一页">‹ 上一页</button><span class="pg-i num" id="pg-i" aria-live="polite">第 ${p}/${n} 页</span><button class="pg-b" data-pg="1"${p>=n?" disabled":""} aria-label="下一页">下一页 ›</button></nav>`;
function days(a,right,n=Infinity,from=0){const full=groupBy(a,"d"),g=groupBy(sorted(a).slice(from,n),"d");return Object.keys(g).sort().reverse().map(d=>`<div class="sh" style="display:flex;justify-content:space-between;text-transform:none"><span>${dlabel(d)}</span><span class="num">${right(full[d])}</span></div><div class="group ic-rows">${sorted(g[d]).map(txRow).join("")}</div>`).join("")}
const RICON='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>';
let lastUpd=null;const updText=()=>lastUpd?"更新于 "+tokyo(new Date(lastUpd).toISOString()).hm:"";
const navbar=(t,l="",inner="")=>`<div class="top">${l?`<div class="navbar">${l}</div>`:""}<div class="lt"><h1>${t}</h1><span class="upd">${updText()}</span><button class="nb rbtn${busy?" spin":""}" data-refresh="1" aria-label="刷新">${RICON}</button>${route()==="home"?'<button class="nb lockbtn" data-lock="1" aria-label="锁定">锁定</button>':""}</div>${inner}</div>`;
const empty=(art,h,p,btn="")=>`<div class="empty"><div class="art">${art}</div><h3>${h}</h3><p>${p}</p>${btn}</div>`;
const mxYM=()=>E.reduce((m,r)=>r.ym>m?r.ym:m,nowYM());
function period(){const isM=rmode==="m"||!location.hash.includes("report"),cur=isM?rym:ryr,now=isM?nowYM():nowYM().slice(0,4),lim=isM?rym<mxYM():ryr<mxYM().slice(0,4);
 return `<div class="period" style="display:flex;align-items:center;justify-content:space-between;margin:4px -8px 0"><button class="nb" data-p="-1" aria-label="上一期" style="font-size:24px">‹</button><b style="font-size:17px" id="rp">${isM?rym.replace("-","年").replace(/年0?/,"年")+"月":ryr+"年"}</b><span style="display:flex">${cur!==now?`<button class="nb" data-now="1">${isM?"本月":"今年"}</button>`:""}<button class="nb" data-p="1" aria-label="下一期" style="font-size:24px;${lim?"":"color:var(--dis)"}" ${lim?"":"disabled"}>›</button></span></div>`}
// ---- home
function home(){const ym=rym,m=E.filter(r=>r.ym===ym),ex=exOf(m),inc=incOf(m),dd=ym===nowYM()?+today().slice(8):ym<nowYM()?new Date(+ym.slice(0,4),+ym.slice(5),0).getDate():1;
 return navbar(`${ym===nowYM()?"本月":mlabel(ym)}概览`)+`<div class="wrap">${period()}
 <div class="summary"><div class="lbl">${mlabel(ym)}支出</div><div class="big num" id="t-ex">${fmt(ex)}</div><div class="three"><div><small>收入</small><b class="num" id="t-inc" style="color:var(--green)">${fmt(inc)}</b></div><div><small>结余</small><b class="num" id="t-bal">${fmt(inc-ex)}</b></div><div><small>日均</small><b class="num">${fmt(Math.round(ex/dd))}</b></div></div></div>${curNote(m)}
 ${mtd(ym)}
 ${homeSubs()}
 ${heatmap(ym)}
 ${storesCard(ym)}
 ${homeBudget(ym,ex)}
 <div class="sh" style="display:flex;justify-content:space-between"><span>最近 10 笔</span><a class="link" href="#/list" style="text-transform:none;text-decoration:none">全部</a></div>
 ${E.length?`<div class="group ic-rows" id="recent">${sorted(E).slice(0,10).map(txRow).join("")}</div>`:empty('<span class="ti-list" style="width:30px;height:30px;color:var(--sub);position:relative;display:block"></span>',"还没有记录","记账管家入账并发布后，记录会显示在这里。")}</div>`}
const total=()=>BUD&&BUD.monthly?+(BUD.monthly[BASE]||0):0;
function homeBudget(ym,ex){const T=total();if(!T)return "";const left=ym===nowYM()?new Date(+ym.slice(0,4),+ym.slice(5),0).getDate()-+today().slice(8):0;
 return `<div class="sh">预算</div><div class="group" id="budget"><div class="row" style="flex-direction:column;align-items:stretch;padding:12px 16px;gap:8px"><div style="display:flex;justify-content:space-between"><span>本月预算</span><span class="sub num">${fmt(ex)} / ${fmt(T)}</span></div>${track(ex/T)}<div class="n sub" style="font-size:13px">${ex>T?`超支 ${fmt(ex-T)}`:`剩余 ${fmt(T-ex)}`} · 还有 ${left} 天 · 已用 ${(ex/T*100).toFixed(1)}%</div></div><a class="row" href="#/budget"><span class="m p">查看分类预算</span><span class="chev"></span></a></div>`}
const track=(p,h)=>`<div class="track"${h?` style="height:${h}px"`:""}><i class="${p>1?"over":p>=.7?"warn":""}" style="width:${Math.min(100,p*100).toFixed(1)}%"></i></div>`;
// ---- budget
function budget(){const ym=rym,m=base(E.filter(r=>r.ym===ym&&r.type==="expense")),ex=sum(m),T=total(),cats=Object.entries((BUD&&BUD.categories)||{});
 const back=`<a class="nb" href="#/"><span class="chev" style="transform:rotate(-135deg) scale(.8);border-color:var(--blue)"></span>首页</a>`;
 if(!T&&!cats.length)return navbar(`${mlabel(ym)}预算`,back)+empty('<span class="ti-chart" style="width:30px;height:30px;color:var(--sub);position:relative;display:block"></span>',"未设置预算","预算由记账管家在数据中设置。");
 const left=ym===nowYM()?new Date(+ym.slice(0,4),+ym.slice(5),0).getDate()-+today().slice(8)+1:1;
 return navbar(`${mlabel(ym)}预算`,back)+`<div class="wrap">${period()}${T?`<div class="summary" id="budget"><div class="lbl">总预算${ex>T?"超支":"剩余"}</div><div class="big num">${fmt(Math.abs(T-ex))}</div>${track(ex/T,8)}<div class="three" style="margin-top:12px"><div><small>已用 ${(ex/T*100).toFixed(1)}%</small><b class="num">${fmt(ex)}</b></div><div><small>预算</small><b class="num">${fmt(T)}</b></div><div><small>可日均</small><b class="num">${fmt(Math.max(0,Math.round((T-ex)/left)))}</b></div></div></div>`:""}
 ${cats.length?`<div class="sh">分类预算</div><div class="group ic-rows">${cats.map(([c,v])=>{v=+v;const u=sum(m.filter(r=>r.category===c)),p=v?u/v:0;
 return `<div class="row bud" data-bcat="${esc(c)}" data-used="${u}" style="padding:12px 16px;gap:12px"><span class="badge" style="background:${colorOf(c)}">${esc(c.slice(0,1))}</span><div class="m" style="padding:0"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>${esc(c)}</span><span class="sub num" style="font-size:15px">${fmt(u)} / ${fmt(v)} · ${(p*100).toFixed(1)}%${u>v?` 超支 ${fmt(u-v)}`:""}</span></div>${track(p)}</div></div>`}).join("")}</div>`:""}
 <div class="sf">超出预算显示红色，达到 70% 显示橙色。预算由记账管家设置，只统计 ${BASE} 支出。</div></div>`}
// ---- list + filter sheet
const st={q:"",payee:"",scope:"",month:"",day:"",type:"",category:"",account:"",currency:"",pend:false};let sheet=false;
const uniq=k=>[...new Set(E.map(r=>r[k]).filter(Boolean))].sort();
function filtered(){const q=st.q.trim().toLowerCase();return sorted(E.filter(r=>(!st.payee||r.payee===st.payee)&&(st.scope!=="store"||!STORE_SKIP.has(r.category))&&(!st.month||r.ym===st.month)&&(!st.day||r.d===st.day)&&(!st.type||r.type===st.type)&&(!st.category||r.category===st.category)&&(!st.account||r.account===st.account)&&(!st.currency||r.currency===st.currency)&&(!st.pend||isPend(r))
 &&qMatch(r,q)))}
// search: space-separated tokens, all must match. A token matches the payee / note / category / account text, or the amount:
// "2900" "¥2,900" "2,900円" = amount equals (text containing the digits also matches); ">5000" "<=1000" "1000-3000" = amount range.
const NUMQ=/^[¥￥]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:円|元)?$/,CMPQ=/^(>=|<=|>|<|＞|＜)\s*[¥￥]?\s*(\d[\d,]*(?:\.\d+)?)$/,RNGQ=/^[¥￥]?(\d[\d,]*(?:\.\d+)?)\s*[-~～]\s*[¥￥]?(\d[\d,]*(?:\.\d+)?)$/;
const qNum=x=>+x.replace(/,/g,"");
function qTok(r,t){let m;const txt=[r.payee,r.note,r.category,r.account].join(" ").toLowerCase();
 if(m=t.match(CMPQ)){const n=qNum(m[2]),o=m[1].replace("＞",">").replace("＜","<");return o===">"?r.amount>n:o==="<"?r.amount<n:o===">="?r.amount>=n:r.amount<=n}
 if(m=t.match(RNGQ)){const a=qNum(m[1]),b=qNum(m[2]);return r.amount>=Math.min(a,b)&&r.amount<=Math.max(a,b)}
 if(m=t.match(NUMQ)){const n=qNum(m[1]);return Math.abs(r.amount-n)<0.005||txt.includes(m[1])||txt.includes(m[1].replace(/,/g,""))}
 return txt.includes(t)}
const qMatch=(r,q)=>!q||q.split(/\s+/).filter(Boolean).every(t=>qTok(r,t));
const anyF=()=>st.q||st.payee||st.day||st.month||st.type||st.category||st.account||st.currency||st.pend;
function chip(k,label,val){return val?`<button class="chip on" data-clr="${k}">${esc(val)} <span class="x">✕</span></button>`:`<button class="chip dd" data-open="1">${label}</button>`}
function list(){return navbar("明细","",`<div class="search-hit"><label class="search"><span class="mag"></span><input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="搜索商户、备注、金额或分类" value="${esc(st.q)}"><button class="qclr" data-qclr="1" aria-label="清除搜索"${st.q?"":" hidden"}>✕</button></label></div>
 <div class="chips" id="chips"></div>`)+`<div id="res"></div>`}
function chipsHTML(){return (st.payee?`<button class="chip on" data-clr="payee" id="chip-payee">${esc(st.payee)}${st.scope==="store"?" · 不含家政/买菜/订阅":""} <span class="x">✕</span></button>`:"")+(st.day?`<button class="chip on" data-clr="day" id="chip-day">${esc(dlabel(st.day))} <span class="x">✕</span></button>`:chip("month","月份",st.month&&mlabel(st.month)))+chip("type","类型",TYPE[st.type])+chip("category","分类",st.category)+chip("account","账户",st.account)+chip("currency","币种",st.currency)+`<button class="chip ${st.pend?"on":""}" data-pend="1">待确认</button>`}
function listRes(keep){if(keep==="h")pg=hashP();else if(!keep)pg=1;$("#chips").innerHTML=chipsHTML();const qc=$(".qclr");if(qc)qc.hidden=!st.q;const a=filtered(),np=Math.max(1,Math.ceil(a.length/PER));pg=Math.min(Math.max(1,pg),np);
 {const want=pg>1?"#/list?p="+pg:"#/list";if(route()==="list"&&location.hash!==want)history.replaceState(history.state,"",want)}
 $("#res").innerHTML=`<div class="wrap"><div class="sf" style="padding-top:4px"><span id="cnt">${a.length}</span> 笔 · 支出 ${fmt(exOf(a))} · 收入 ${fmt(incOf(a))}</div>${curNote(a)}${a.length?days(a,g=>"支出 "+fmt(exOf(g)),pg*PER,(pg-1)*PER)+pager(pg,np):E.length?
 empty('<span class="mag" style="transform:scale(2)"></span>',"没有找到结果",`没有符合${st.q?`“${esc(st.q)}”和`:""}当前筛选的记录。`,'<button class="btn sec" data-reset="1">清除筛选</button>'):
 empty('<span class="ti-list" style="width:30px;height:30px;color:var(--sub);position:relative;display:block"></span>',"还没有记录","记账管家入账并发布后，记录会显示在这里。")}</div>`;
 const sh=$("#sheet"),was=!!sh.innerHTML;if(was&&!sheet)ghostOut(sh);sh.innerHTML=sheet?sheetHTML():"";if(!was&&sheet)sheetIn(sh)}
const sel=(k,label,vals,lab=v=>v)=>`<div class="row sel"><span class="m">${label}</span><span class="v">${esc(st[k]?lab(st[k]):"全部")}</span><span class="chev"></span><select data-f="${k}" aria-label="${label}"><option value="">全部</option>${vals.map(v=>`<option value="${esc(v)}"${st[k]===v?" selected":""}>${esc(lab(v))}</option>`).join("")}</select></div>`;
function sheetHTML(){return `<div class="dim" data-close="1"></div><div class="sheet"><div class="grab"></div><div class="navbar"><button class="nb" data-reset="1">重置</button><span class="t">筛选</span><button class="nb b" data-close="1">完成</button></div><div class="body" style="padding:0 16px 24px">
 <div class="sh">月份</div><div class="group">${sel("month","月份",uniq("ym").reverse(),v=>v.replace("-","年")+"月")}</div>
 <div class="sh">类型</div><div class="seg-hit"><div class="seg">${[["","全部"],["expense","支出"],["income","收入"],["transfer","转账"]].map(([v,l])=>`<button data-type="${v}" class="${st.type===v?"on":""}">${l}</button>`).join("")}</div></div>
 <div class="sh">分类</div><div style="display:flex;flex-wrap:wrap;gap:0 8px">${uniq("category").map(c=>`<button class="chip ${st.category===c?"on":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
 <div class="sh">账户 · 币种</div><div class="group">${sel("account","账户",uniq("account"))}${sel("currency","币种",uniq("currency"))}<div class="row" data-pend="1" style="cursor:pointer"><span class="m">仅看待确认</span><span class="sw ${st.pend?"on":""}"></span></div></div>
 <div style="padding-top:20px"><button class="btn" data-close="1">显示 ${filtered().length} 笔结果</button></div></div></div>`}
// ---- report
let rmode="m",rym=nowYM(),ryr=rym.slice(0,4);
const shiftYM=(ym,d)=>{let [y,m]=ym.split("-").map(Number);m+=d;while(m<1){m+=12;y--}while(m>12){m-=12;y++}return y+"-"+pad(m)};
function donut(parts,T){let off=0;return `<svg viewBox="0 0 36 36" width="120" height="120" style="flex:0 0 120px;transform:rotate(-90deg)">${parts.map(p=>{const L=p.v/T*100,s=`<circle cx="18" cy="18" r="15.9155" fill="none" stroke="${p.c}" stroke-width="4.2" stroke-dasharray="${L.toFixed(3)} ${(100-L).toFixed(3)}" stroke-dashoffset="${(-off).toFixed(3)}"/>`;off+=L;return s}).join("")}</svg>`}
function deltaBox(label,cur,prev){return `<div><small>${label}</small><b class="num ${prev&&cur>prev?"up":prev?"down":""}">${prev?(cur>=prev?"+":"")+((cur-prev)/prev*100).toFixed(1)+"%":"—"}</b></div>`}
function bars(vals,labels,hi){const mx=Math.max(0,...vals);return `<div class="chart"><div class="bars">${vals.map((v,i)=>`<div class="${v?(i===hi?"hi":""):"z"}" data-v="${v}" style="height:${mx?(v/mx*100).toFixed(1):0}%"></div>`).join("")}</div></div><div class="axis">${labels.map(l=>`<span>${l}</span>`).join("")}</div>`}
function report(){const isM=rmode==="m",sel=isM?E.filter(r=>r.ym===rym):E.filter(r=>r.y===ryr),ex=exOf(sel),inc=incOf(sel),exr=base(sel.filter(r=>r.type==="expense"));

 let h=navbar("报表","",`<div style="padding:0 16px"><div class="seg-hit"><div class="seg"><button data-m="m" class="${isM?"on":""}">月</button><button data-m="y" class="${isM?"":"on"}">年</button></div></div></div>`)+
 `<div class="wrap">${period()}`;
 if(!sel.length)return h+`</div>`+empty('<span class="ti-chart" style="width:30px;height:30px;color:var(--sub);position:relative;display:block"></span>',isM?"本月暂无数据":"本年暂无数据","有记录后会在这里显示分类占比和趋势。")+`<div class="wrap">${trendCard()}</div>`;
 const prevA=isM?E.filter(r=>r.ym===shiftYM(rym,-1)):E.filter(r=>r.y===String(+ryr-1));const yoyA=isM?E.filter(r=>r.ym===(+rym.slice(0,4)-1)+rym.slice(4)):null;
 const g=groupBy(exr,"category"),parts=Object.entries(g).map(([k,a])=>({k,v:sum(a),c:colorOf(k)})).sort((a,b)=>b.v-a.v);
 let vals,labels,hi;if(isM){const n=new Date(+rym.slice(0,4),+rym.slice(5),0).getDate();vals=[...Array(n)].map((_,i)=>sum(exr.filter(r=>+r.d.slice(8)===i+1)));labels=[1,8,15,22,n]}
 else{vals=[...Array(12)].map((_,i)=>sum(exr.filter(r=>+r.ym.slice(5)===i+1)));labels=[...Array(12)].map((_,i)=>i+1)}
 hi=vals.indexOf(Math.max(...vals));const rank=(t,k,id)=>{const a=Object.entries(groupBy(exr,k)).map(([n,x])=>[n,sum(x)]).sort((x,y)=>y[1]-x[1]).slice(0,10),mx=a[0]?a[0][1]:1;
 return a.length?`<div class="card" id="${id}"><h2>${t}<small>${BASE} 支出</small></h2>${a.map(([n,v])=>`<div class="rk" data-k="${esc(n)}" data-v="${v}" style="padding:8px 0"><div style="display:flex;justify-content:space-between;font-size:15px;margin-bottom:6px"><span>${esc(n||"—")}</span><span class="sub num">${fmt(v)}</span></div><div class="track"><i style="width:${(v/mx*100).toFixed(1)}%"></i></div></div>`).join("")}</div>`:""};
 return h+`<div class="summary"><div class="lbl">${isM?mlabel(rym):ryr+"年"}支出</div><div class="big num" id="r-ex">${fmt(ex)}</div>
 <div class="three" style="margin-bottom:12px;border-top:0;padding-top:0"><div><small>收入</small><b class="num" id="r-inc" style="color:var(--green)">${fmt(inc)}</b></div><div><small>结余</small><b class="num" id="r-bal">${fmt(inc-ex)}</b></div><div><small>笔数</small><b class="num">${sel.length}</b></div></div>
 <div class="delta">${isM?deltaBox("环比 上月",ex,exOf(prevA))+deltaBox(`同比 去年${mlabel(rym)}`,ex,exOf(yoyA)):deltaBox(`同比 ${+ryr-1}年`,ex,exOf(prevA))+`<div><small>月均</small><b class="num">${fmt(Math.round(ex/(ryr===nowYM().slice(0,4)?+nowYM().slice(5):12)))}</b></div>`}</div></div>${curNote(sel)}
 ${parts.length?`<div class="card"><h2>分类占比<small>点分类查看明细</small></h2><div class="ring">${donut(parts,ex)}<div style="flex:1;font-size:15px">${parts.map(p=>`<a class="row" href="#/list" data-drill="${esc(p.k)}" data-v="${p.v}" style="padding:0;gap:10px"><span class="badge" style="background:${p.c}">${esc(p.k.slice(0,1))}</span><span class="m">${esc(p.k)}</span><span class="sub num">${(p.v/ex*100).toFixed(1)}%</span><span class="chev"></span></a>`).join("")}</div></div></div>`:""}
 <div class="card"><h2>${isM?"每日支出":"每月支出"}<small>最高 ${fmt(Math.max(0,...vals))}</small></h2>${bars(vals,labels,hi)}</div>
 ${trendCard()}
 ${rank("账户分布","account","acct")}${rank("商户排行","payee","payee")}</div>`}
// ---- 分类趋势图: stacked bars per month (expense, JPY only, JST months, 0-months kept)
const TR={range:"6",off:new Set(),sel:null};
const sumA=a=>a.reduce((s,v)=>s+v,0),pctTxt=(c,p)=>p?((c>=p?"+":"")+((c-p)/p*100).toFixed(1)+"%"):"—";
function trendMonths(range){const end=rmode==="m"?rym:(ryr===nowYM().slice(0,4)?nowYM():ryr+"-12");
 if(range==="ytd"){const y=end.slice(0,4);return [...Array(+end.slice(5))].map((_,i)=>y+"-"+pad(i+1))}
 const n=+range;return [...Array(n)].map((_,i)=>shiftYM(end,i-n+1))}
function trendData(range=TR.range){const ms=trendMonths(range),idx={};ms.forEach((m,i)=>idx[m]=i);idx[shiftYM(ms[0],-1)]=-1;
 const by={},prev={},other={};
 for(const r of E){if(r.type!=="expense"||r.deleted)continue;const i=idx[r.ym];if(i===undefined)continue;
  if(r.currency!=="JPY"){if(i>=0)other[r.currency]=(other[r.currency]||0)+r.amount;continue}
  const c=r.category||"未分类";if(i<0){prev[c]=(prev[c]||0)+r.amount;continue}(by[c]=by[c]||ms.map(()=>0))[i]+=r.amount}
 const cats=Object.keys(by).sort((a,b)=>sumA(by[b])-sumA(by[a])||a.localeCompare(b));
 const val=(c,i)=>i<0?(prev[c]||0):(by[c]?by[c][i]:0);return {ms,cats,by,prev,other,val}}
const niceMax=v=>{if(v<=0)return 1;const p=10**Math.floor(Math.log10(v)),f=v/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p};
const yen=v=>v>=10000?(v/10000).toFixed(v%10000?1:0)+"万":String(v);
function trendSVG(T,vis,si){const n=T.ms.length,W=Math.max(330,n*46+30),H=170,top=8,bot=22,ch=H-top-bot,slot=(W-30)/n,bw=Math.min(26,slot*.6);
 const tot=T.ms.map((_,i)=>sumA(vis.map(c=>T.val(c,i)))),mx=niceMax(Math.max(0,...tot)),MINH=2.5;
 // drawn height per segment: true scale, but any nonzero value gets ≥2.5px so it stays visible (values/labels unchanged)
 const hOf=v=>v?Math.max(MINH,v/mx*ch):0,bh=T.ms.map((_,i)=>sumA(vis.map(c=>hOf(T.val(c,i)))));
 let s=`<div class="tr-scroll" id="tr-scroll"><svg id="tr-svg" viewBox="0 0 ${W} ${H}" width="100%" style="min-width:${n*46+30}px" role="img" aria-label="分类趋势图"><defs>`;
 T.ms.forEach((m,i)=>{const x=i*slot+(slot-bw)/2,h=bh[i];s+=`<clipPath id="tc${i}"><rect x="${x.toFixed(1)}" y="${(top+ch-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(5,bw/4).toFixed(1)}"/></clipPath>`});
 s+=`</defs>`;[0,.5,1].forEach(f=>{const y=(top+ch-f*ch).toFixed(1);s+=`<line x1="0" x2="${W-30}" y1="${y}" y2="${y}" style="stroke:var(--sep);stroke-width:${f?.5:1}"${f?' stroke-dasharray="2 3"':""}/>`+(f?`<text x="${W}" y="${(+y+3).toFixed(1)}" text-anchor="end" class="tr-ax">${yen(mx*f)}</text>`:"")});
 T.ms.forEach((m,i)=>{s+=`<rect data-tm="${i}" class="tr-hit" x="${(i*slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}" fill="transparent"/>`});   // month hit areas UNDER the segments
 T.ms.forEach((m,i)=>{const x=i*slot+(slot-bw)/2,dim=si!=null&&si!==i;let y=top+ch;
  s+=`<g class="tr-bar" data-m="${m}" data-v="${tot[i]}" opacity="${dim?.35:1}">`;
  if(!tot[i])s+=`<rect class="z" data-tm="${i}" x="${x.toFixed(1)}" y="${(top+ch-3).toFixed(1)}" width="${bw.toFixed(1)}" height="3" rx="1.5" style="fill:var(--fill)"/>`;
  else{s+=`<g clip-path="url(#tc${i})">`;vis.forEach(c=>{const v=T.val(c,i);if(!v)return;const h=hOf(v);y-=h;s+=`<rect data-c="${esc(c)}" data-tm="${i}" data-m="${m}" data-v="${v}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(h+.4).toFixed(1)}" style="fill:${colorOf(c)}"/>`});s+=`</g>`}
  s+=`<text x="${(i*slot+slot/2).toFixed(1)}" y="${H-6}" text-anchor="middle" class="tr-ax${si===i?" on":""}">${n>6&&i%2&&i!==n-1&&si!==i?"":+m.slice(5)+"月"}</text>`;
  s+=`</g>`});
 return s+`</svg></div>`}
function trendCard(){const T=trendData(),vis=T.cats.filter(c=>!TR.off.has(c)),n=T.ms.length;
 if(TR.sel!=null&&TR.sel>=n)TR.sel=null;const si=TR.sel,mi=si==null?n-1:si,m=T.ms[mi];
 const segs=[["6","6个月"],["ytd","今年"],["12","12个月"]].map(([k,l])=>`<button data-tr="${k}" class="${TR.range===k?"on":""}">${l}</button>`).join("");
 const chips=T.cats.map(c=>`<button class="tchip${TR.off.has(c)?"":" on"}" data-tc="${esc(c)}" aria-pressed="${!TR.off.has(c)}"><i style="background:${colorOf(c)}"></i>${esc(c)}</button>`).join("");
 const rows=vis.map(c=>({c,v:T.val(c,mi),p:T.val(c,mi-1)}));const tv=sumA(rows.map(r=>r.v)),tp=sumA(rows.map(r=>r.p));
 const det=`<div class="tr-det" id="tr-det" data-m="${m}"><div class="tr-dh"><b>${+m.slice(0,4)}年${mlabel(m)}${si==null?"":" · 已选"}</b><span class="num" id="tr-tot">${fmt(tv)} <small class="${tp&&tv>tp?"up":tp&&tv<tp?"down":""}">${pctTxt(tv,tp)}</small></span></div>`+
  rows.filter(r=>r.v||r.p).sort((a,b)=>b.v-a.v).map(r=>`<button class="tr-r" data-c="${esc(r.c)}" data-v="${r.v}" data-jc="${esc(r.c)}" data-jm="${m}" aria-label="查看 ${mlabel(m)} ${esc(r.c)} 明细"><i style="background:${colorOf(r.c)}"></i><span>${esc(r.c)}</span><span class="num">${fmt(r.v)}</span><small class="num ${r.p&&r.v>r.p?"up":r.p&&r.v<r.p?"down":""}">${pctTxt(r.v,r.p)}</small><b class="chev" aria-hidden="true">›</b></button>`).join("")+(tv?`<button class="tr-all" id="tr-all" data-jc="" data-jm="${m}">查看 ${mlabel(m)} 全部支出明细 ›</button>`:"")+`</div>`;
 const mv=rows.map(r=>({...r,d:r.v-r.p})),up=mv.filter(r=>r.d>0).sort((a,b)=>b.d-a.d)[0],dn=mv.filter(r=>r.d<0).sort((a,b)=>a.d-b.d)[0];
 const mover=(t,r,id)=>`<div class="tr-mv" id="${id}"><small>${t}</small>${r?`<b><i style="background:${colorOf(r.c)}"></i>${esc(r.c)}</b><span class="num">${r.d>0?"+":"-"}${fmt(Math.abs(r.d))} · ${pctTxt(r.v,r.p)}</span>`:`<b>—</b><span class="num">—</span>`}</div>`;
 const ok=Object.keys(T.other);
 return `<div class="card" id="trend"><h2>分类趋势图<small>${mlabel(T.ms[0])}–${mlabel(T.ms[n-1])} · JPY 支出</small></h2>
 <div class="seg tr-seg">${segs}</div>${trendSVG(T,vis,si)}
 <div class="tr-chips">${chips||'<span class="sub" style="font-size:13px">这段时间没有 JPY 支出</span>'}</div>${det}
 <div class="tr-mvs">${mover("涨得最多",up,"tr-up")}${mover("降得最多",dn,"tr-dn")}</div>
 ${ok.length?`<div class="cur" id="tr-other">其他币种支出（不换算，未计入图表）：${ok.map(c=>fmt(T.other[c],c)).join(" · ")}</div>`:""}</div>`}
const trendRedraw=()=>{const el=$("#trend");if(!el)return;const sx=$("#tr-scroll");const keep=sx?sx.scrollLeft:null;el.outerHTML=trendCard();trendScroll(TR.rs?null:keep);TR.rs=0};
function trendScroll(keep){const sx=$("#tr-scroll");if(sx)sx.scrollLeft=keep==null?sx.scrollWidth:keep}
document.addEventListener("click",e=>{const b=e.target.closest("#trend [data-tr],#trend [data-tc],#trend [data-tm]");if(!b)return;const d=b.dataset;
 if(d.tr){TR.range=d.tr;TR.sel=null;TR.rs=1}else if(d.tc!=null){TR.off.has(d.tc)?TR.off.delete(d.tc):TR.off.add(d.tc)}else{const i=+d.tm;TR.sel=TR.sel===i?null:i}trendRedraw()});
// ---- entry detail sheet
const SRC={screenshot:"截图",text:"文字",voice:"录音",audio:"录音",manual:"手动"};
function entrySheet(r){const s=r.type==="income"?"+":r.type==="transfer"?"":"-";const f=(k,v,id)=>`<div class="row"><span class="m">${k}</span><span class="v" data-f="${id}" style="white-space:normal;text-align:right;max-width:65%">${v}</span></div>`;
 return `<div class="dim" data-eclose="1"></div><div class="sheet" id="entry" role="dialog" aria-label="账目详情"><div class="grab"></div><div class="navbar"><span></span><span class="t">账目详情</span><button class="nb b" data-eclose="1">完成</button></div><div class="body" style="padding:0 16px 24px">
 <div style="text-align:center;padding:16px 0 4px"><div class="big num ${r.type==="income"?"in":""}" style="font-size:40px;font-weight:700" data-f="amount">${s}${fmt(r.amount,r.currency)}</div><div class="sub" style="font-size:15px;margin-top:4px">${esc(r.payee||"—")}${isPend(r)?'<span class="tag">待确认</span>':""}</div></div>
 ${r.rc?`<div class="rc" id="rc" data-th="${r.rc.thumb}" data-full="${r.rc.id}"><button class="rc-th" data-rview="1" aria-label="查看收据大图"><span class="rc-ph">正在解密收据…</span></button></div>`:r.hasAtt?`<div class="rc" id="rc"><div class="rc-th"><span class="rc-ph err">收据暂不可用</span></div></div>`:""}
 <div class="group" style="margin-top:16px">${f("时间",esc(r.d+" "+r.hm),"time")}${f("类型",TYPE[r.type],"type")}${f("分类",esc(r.category||"—"),"category")}${f("账户",esc(r.account||"—"),"account")}${f("商户",esc(r.payee||"—"),"payee")}${f("备注",esc(r.note||"—"),"note")}${f("来源",esc(SRC[r.source]||r.source||"—"),"source")}${f("币种",esc(r.currency),"currency")}${f("状态",isPend(r)?'<span class="tag" style="margin:0">待确认</span>':"已确认","pending")}${r.confidence!=null?f("识别置信度",Math.round(+r.confidence*100)+"%","confidence"):""}${f("收据",r.rc?"有（见下方）":r.hasAtt?"有（尚未上传）":"无","attachment")}${(()=>{try{const t=r.updated_at&&!isNaN(Date.parse(r.updated_at))?tokyo(r.updated_at):null;return t?f("更新于",esc(t.d+" "+t.hm),"updated"):""}catch{return ""}})()}${f("编号",'<span class="num" style="font-size:13px;color:var(--sub)">'+esc(r.id)+'</span>',"id")}</div>
  ${isPend(r)?'<div class="readonly">这笔还没确认。需要改的话，告诉记账管家。</div>':""}</div></div>`}
const openEntry=(id,force,vt)=>{const r=E.find(x=>x.id===id);if(!r)return;if(route()==="list")selId=id;if(!force&&isWide()&&route()==="list"){layout();document.querySelectorAll("#res .row.sel").forEach(x=>x.classList.remove("sel"));const rw=document.querySelector(`#res .row[data-id="${CSS.escape(id)}"]`);if(rw)rw.classList.add("sel");return}const was=!!$("#overlay").innerHTML;rcRevoke();$("#overlay").innerHTML=entrySheet(r);document.body.style.overflow="hidden";if(!vt&&!was)sheetIn($("#overlay"));rcLoad()};
const closeEntry=()=>{const inPane=!!$("#pane #entry");rcRevoke();ghostOut($("#overlay"));$("#overlay").innerHTML="";document.body.style.overflow="";if(inPane||!isWide()){selId=null;document.querySelectorAll("#res .row.sel").forEach(x=>x.classList.remove("sel"))}if(inPane)layout()};
// ---- encrypted receipts: data/r/<id>.bin = iv(12) || AES-GCM(ct||tag), AAD = id, same key as the ledger. Decrypted bytes live only in blob: URLs, all revoked on close/lock.
const BLOBS=new Set();let rcGen=0;
function rcRevoke(){rcGen++;BLOBS.forEach(u=>URL.revokeObjectURL(u));BLOBS.clear();const v=$("#rviewer");if(v)v.remove();document.querySelectorAll("#entry .rc img").forEach(i=>i.removeAttribute("src"))}
async function rcGet(id){const g=rcGen;if(!KEY||!KEY.key)throw new Error("locked");const r=await fetch("data/r/"+id+".bin");if(!r.ok)throw new Error("HTTP "+r.status);const b=new Uint8Array(await r.arrayBuffer());if(b.length<29)throw new Error("short");
 const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b.slice(0,12),additionalData:new TextEncoder().encode(id)},KEY.key,b.slice(12));if(g!==rcGen)throw new Error("stale");const u=URL.createObjectURL(new Blob([pt],{type:"image/webp"}));BLOBS.add(u);return u}
async function rcLoad(){document.querySelectorAll("#entry .rc[data-th]:not([data-st])").forEach(async el=>{el.dataset.st="loading";const btn=el.querySelector(".rc-th");
 try{const u=await rcGet(el.dataset.th);if(!el.isConnected){URL.revokeObjectURL(u);BLOBS.delete(u);return}btn.innerHTML=`<img src="${u}" alt="收据缩略图" decoding="async">`;el.dataset.st="ok"}
 catch(e){if(e.message==="stale")return;el.dataset.st="err";btn.innerHTML='<span class="rc-ph err">收据无法读取</span>';btn.disabled=true}})}
function rcView(id){const old=$("#rviewer");if(old)old.remove();const v=document.createElement("div");v.id="rviewer";v.setAttribute("role","dialog");v.setAttribute("aria-label","收据");
 v.innerHTML=`<div class="rv-stage" id="rv-stage"><span class="rc-ph" id="rv-msg">正在解密…</span></div><button class="rv-x" data-rvclose="1" aria-label="关闭">✕</button>`;document.body.appendChild(v);
 rcGet(id).then(u=>{if(!v.isConnected){URL.revokeObjectURL(u);BLOBS.delete(u);return}v.dataset.u=u;$("#rv-stage").innerHTML=`<img id="rv-img" src="${u}" alt="收据" draggable="false">`;rvZoom(v)}).catch(e=>{if(e.message==="stale")return;const m=$("#rv-msg");if(m){m.textContent="收据无法读取";m.classList.add("err")}})}
function rvClose(){const v=$("#rviewer");if(!v)return;const u=v.dataset.u;if(u){URL.revokeObjectURL(u);BLOBS.delete(u)}v.remove()}
function rvZoom(v){const st=$("#rv-stage"),img=$("#rv-img");let s=1,x=0,y=0;const P=new Map();let d0=0,s0=1,last=null,tap=0;
 const ap=()=>{s=Math.min(5,Math.max(1,s));if(s===1){x=0;y=0}img.style.transform=`translate(${x}px,${y}px) scale(${s})`;v.dataset.scale=s.toFixed(2)};
 const dist=()=>{const [a,b]=[...P.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
 st.addEventListener("pointerdown",e=>{P.set(e.pointerId,{x:e.clientX,y:e.clientY});if(P.size===2){d0=dist();s0=s}last={x:e.clientX,y:e.clientY};
  const t=Date.now();if(P.size===1&&t-tap<300){s=s>1?1:2.5;ap();tap=0}else tap=t});
 st.addEventListener("pointermove",e=>{if(!P.has(e.pointerId))return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});if(P.size===2&&d0){s=s0*dist()/d0;ap()}else if(P.size===1&&s>1&&last){x+=e.clientX-last.x;y+=e.clientY-last.y;ap()}last={x:e.clientX,y:e.clientY}});
 const up=e=>{P.delete(e.pointerId);if(P.size<2)d0=0;last=null};["pointerup","pointercancel","pointerleave"].forEach(t=>st.addEventListener(t,up));
 st.addEventListener("wheel",e=>{e.preventDefault();s*=e.deltaY<0?1.15:1/1.15;ap()},{passive:false});ap()}
document.addEventListener("click",e=>{const b=e.target.closest("[data-rview],[data-rvclose]");if(!b)return;e.stopPropagation();if(b.dataset.rvclose)return rvClose();const el=b.closest(".rc");if(el&&el.dataset.st==="ok")rcView(el.dataset.full)},true);
// ---- 订阅 (read-only, data/subscriptions.json maintained by 记账管家)
let SUBS;   // undefined = not loaded yet, null = missing/unreadable
const subsToday=()=>window.__subsToday||today();
const dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
function nextCharge(it,t=subsToday()){const [y,m,d]=t.split("-").map(Number),day=Math.max(1,+it.day||1),mk=(Y,M)=>`${Y}-${pad(M)}-${pad(Math.min(day,dim(Y,M)))}`;
 if(it.cycle==="yearly"){const M=+it.month||1;let c=mk(y,M);return c<t?mk(y+1,M):c}
 let c=mk(y,m);if(c<t){const n=m===12?[y+1,1]:[y,m+1];c=mk(...n)}return c}
const daysTo=(a,t=subsToday())=>Math.round((Date.parse(a+"T00:00:00Z")-Date.parse(t+"T00:00:00Z"))/864e5);
function dueLabel(dt,t=subsToday()){const n=daysTo(dt,t);return n===0?"今天":n===1?"明天":n<=7?`${n} 天后`:(dt.slice(0,4)!==t.slice(0,4)?`${dt.slice(0,4)}年`:"")+`${+dt.slice(5,7)}月${+dt.slice(8)}日`}
const subItems=()=>((SUBS&&Array.isArray(SUBS.items))?SUBS.items:[]).filter(it=>it&&(it.cycle==="monthly"||it.cycle==="yearly")&&+it.amount>0)
 .map((it,i)=>({...it,i,amount:+it.amount,next:nextCharge(it)})).sort((a,b)=>a.next.localeCompare(b.next)||b.amount-a.amount);
function subTotals(a=subItems()){const mo=sum(a.filter(x=>x.cycle==="monthly")),yr=sum(a.filter(x=>x.cycle==="yearly"));return {mo,yr,eff:Math.round(mo+yr/12),annual:mo*12+yr}}
const subsDue=()=>subItems().filter(x=>daysTo(x.next)<=7).length;
// ---- 常去的店 (merchants.enc.json: {payee:{address,lat,lng,online}}; undefined = not loaded, null = missing/unreadable → no addresses)
let MER;const MER_ON="ledger.merch.online";   // localStorage holds only "1"/"0" (include online merchants)
async function loadMerch(){try{const r=await fetch((TESTPLAIN?"data/merchants.json":ENC.merch)+"?t="+Date.now(),{cache:"no-store"});MER=r.ok?(TESTPLAIN?await r.json():await decryptWith(KEY,await r.json())):null;if(MER&&typeof MER!=="object")MER=null}catch{MER=null}
 if(route()==="home"){const el=$("#stores");if(el){const busy=el.hasAttribute("aria-busy");el.outerHTML=storesCard(rym);if(busy)mv($("#stores"),[{opacity:.3},{opacity:1}],{d:220})}}}
const merOnline=()=>{try{return localStorage.getItem(MER_ON)==="1"}catch{return false}};
const STORE_SKIP=new Set(["家政","买菜","订阅"]);
function storeStats(ym,withOnline){const m=E.filter(r=>r.ym===ym&&r.type==="expense"&&!r.deleted&&r.currency===BASE&&r.payee&&!STORE_SKIP.has(r.category));const by={};
 m.forEach(r=>{const k=r.payee,o=by[k]||(by[k]={payee:k,days:new Set(),amt:0,last:""});o.days.add(r.d);o.amt+=r.amount;if(r.d>o.last)o.last=r.d});
 const info=k=>MER&&MER[k]&&typeof MER[k]==="object"?MER[k]:null,isOnline=k=>{if(!MER)return false;const i=info(k);return !i||!!i.online||!i.address};   // MER missing → can't tell, keep all
 const all=Object.values(by).map(o=>({...o,visits:o.days.size,info:info(o.payee),online:isOnline(o.payee)})),a=withOnline?all:all.filter(o=>!o.online);
 const tie=(x,y)=>y.amt-x.amt||y.last.localeCompare(x.last)||x.payee.localeCompare(y.payee);
 return {visits:[...a].sort((x,y)=>y.visits-x.visits||tie(x,y)).slice(0,3),spend:[...a].sort((x,y)=>tie(x,y)).slice(0,3),hidden:all.length-a.length}}
const mapURL=(n,i)=>"https://maps.apple.com/?"+(i.lat!=null&&i.lng!=null&&isFinite(+i.lat)&&isFinite(+i.lng)?`q=${encodeURIComponent(n)}&ll=${+i.lat},${+i.lng}`:`address=${encodeURIComponent(i.address)}&q=${encodeURIComponent(n)}`);
function storeRow(o,rank,kind,ym){const i=o.info,addr=i&&i.address&&!i.online?`<a class="st-addr" href="${esc(mapURL(o.payee,i))}" target="_blank" rel="noopener" aria-label="在地图中打开 ${esc(o.payee)}"><span>${esc(i.address)}</span></a>`:o.online?`<span class="st-addr sub">线上商户</span>`:"";
 return `<div class="st-row" data-payee="${esc(o.payee)}" data-visits="${o.visits}" data-amt="${o.amt}"><span class="st-rk num">${rank}</span><div class="st-m"><button class="st-name" data-jp="${esc(o.payee)}" data-jm="${ym}">${esc(o.payee)}</button>${addr}</div>
 <div class="st-v num"><b>${kind==="v"?o.visits+" 次":fmt(o.amt)}</b><small>${kind==="v"?fmt(o.amt):o.visits+" 次"}</small></div></div>`}
function storesCard(ym){if(MER===undefined)return `<div class="card" id="stores" aria-busy="true"><h2>常去的店</h2><div class="st-sk" aria-hidden="true">${"<i></i>".repeat(3)}</div><span class="vh">正在加载商户信息</span></div>`;const on=merOnline(),S=storeStats(ym,on),sw=`<label class="st-tg"><span>包含线上商户</span><input type="checkbox" role="switch" id="st-online"${on?" checked":""}><i aria-hidden="true"></i></label>`;
 const part=(t,a,k,id)=>`<div class="st-part" id="${id}"><div class="st-h">${t}</div>${a.map((o,j)=>storeRow(o,j+1,k,ym)).join("")}</div>`;
 const body=S.visits.length?part("去得最多",S.visits,"v","st-visits")+part("花得最多",S.spend,"s","st-spend"):`<div class="st-empty" id="st-empty">${mlabel(ym)}还没有${on?"":"线下"}常去的店${S.hidden&&!on?`<br><small>${S.hidden} 家线上商户未计入</small>`:""}</div>`;
 return `<div class="card" id="stores"><h2>常去的店<small>${MER===null?"地址暂不可用":"按天计次 · JPY"}</small></h2>${body}${sw}</div>`}
document.addEventListener("change",e=>{if(e.target.id!=="st-online")return;try{localStorage.setItem(MER_ON,e.target.checked?"1":"0")}catch{}const el=$("#stores");if(el)el.outerHTML=storesCard(rym)});
async function loadSubs(){try{const r=await fetch((TESTPLAIN?"data/subscriptions.json":ENC.subs)+"?t="+Date.now(),{cache:"no-store"});SUBS=r.ok?(TESTPLAIN?await r.json():await decryptWith(KEY,await r.json())):null}catch{SUBS=null}
 if(["home","subs"].includes(route())){const y=scrollY;render();scrollTo(0,y)}else subBadge()}
function subBadge(){const n=SUBS?subsDue():0,c=$("#pcnt");if(c){c.hidden=!n;c.textContent=n||""}}
const subIcon=it=>`<span class="badge sub-ic" style="background:${colorOf("订阅")}">${esc((it.payee||"·").slice(0,1).toUpperCase())}</span>`;
function homeSubs(){if(SUBS===undefined)return "";const a=subItems();if(!a.length)return "";const t=subTotals(a),n=a[0],soon=daysTo(n.next)<=7;
 return `<a class="subcard" id="home-subs" href="#/subs">${subIcon({payee:"订"})}<div class="m"><div class="p">订阅 · 每月固定 <b class="num" id="hs-mo">${fmt(t.mo)}</b></div><div class="n${soon?" soon":""}" id="hs-next">${dueLabel(n.next)} ${esc(n.payee)} ${fmt(n.amount)}</div></div><span class="chev"></span></a>`}
function subs(){const h=navbar("订阅");if(SUBS===undefined)return h+`<div class="wrap"><div class="sk" style="height:120px;border-radius:12px;margin-top:8px"></div></div>`;
 const a=subItems();if(!a.length)return h+empty(`<span style="font-size:30px;font-weight:600;color:var(--sub)">订</span>`,"还没有订阅数据","记账管家整理好订阅后，会显示在这里。");
 const t=subTotals(a);
 return h+`<div class="wrap"><div class="summary subs-sum"><div class="lbl">每月固定支出</div><div class="big num" id="s-mo">${fmt(t.mo)}</div>
 <div class="sub" id="s-eff" style="font-size:15px">含年付折算 ${fmt(t.eff)}/月</div><div class="sub" id="s-yr" style="font-size:15px;margin-top:2px">全年合计 ${fmt(t.annual)}</div></div>
 <div class="sh">按下次扣费排序</div><div class="group ic-rows" id="subs-list">${a.map(it=>{const n=daysTo(it.next),soon=n<=7;
  return `<div class="row tall subrow${soon?" soon":""}" role="button" tabindex="0" data-sub="${it.i}" data-next="${it.next}">${subIcon(it)}<div class="m"><div class="p">${esc(it.payee||"—")}</div><div class="n">${esc(it.note||"")}${it.note?" · ":""}<span class="due">${dueLabel(it.next)}</span></div></div>
  <div class="v"><div class="num">${fmt(it.amount)}</div><span class="ctag">${it.cycle==="yearly"?"年付":"月付"}</span></div><span class="chev"></span></div>`}).join("")}</div>
 <div class="readonly">订阅由记账管家维护，这里只读。</div></div>`}
function openSub(i){const it=(SUBS.items||[])[i];if(!it)return;const rows=sorted(E.filter(r=>r.category==="订阅"&&r.payee===it.payee));
 $("#overlay").innerHTML=`<div class="dim" data-eclose="1"></div><div class="sheet" id="subsheet" role="dialog" aria-label="${esc(it.payee)} 扣费记录"><div class="grab"></div><div class="navbar"><span></span><span class="t">${esc(it.payee)}</span><button class="nb b" data-eclose="1">完成</button></div><div class="body" style="padding:0 16px 24px">
 <div class="sub" style="text-align:center;font-size:15px;padding:8px 0 4px">${it.cycle==="yearly"?"年付":"月付"} ${fmt(+it.amount)} · 下次 ${dueLabel(nextCharge(it))}</div>
 <div class="sh" style="padding-left:0">扣费记录（${rows.length}）</div>${rows.length?`<div class="group" id="sub-charges">${rows.map(r=>`<div class="row" data-cid="${esc(r.id)}"><span class="m">${esc(r.d)}</span><span class="sub" style="flex:1">${esc(r.note||"")}</span><span class="num">${fmt(r.amount,r.currency)}</span></div>`).join("")}</div>`:`<div class="readonly" id="sub-none">账本里还没有这项订阅的扣费记录。</div>`}</div></div>`;document.body.style.overflow="hidden"}
document.addEventListener("click",e=>{const r=e.target.closest("[data-sub]");if(r)openSub(+r.dataset.sub)});
// ---- batch 2: calendar heatmap, month-to-date, chart → list jumps
const dimYM=ym=>new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5),0)).getUTCDate();
const dayEx=ym=>{const o={};for(const r of E)if(r.ym===ym&&r.type==="expense"&&r.currency==="JPY")o[r.d]=(o[r.d]||0)+r.amount;return o};
function heatLevel(v,mx){if(!v)return 0;const f=v/mx;return f>.75?4:f>.5?3:f>.25?2:1}
function heatmap(ym){const o=dayEx(ym),n=dimYM(ym),first=new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5)-1,1)).getUTCDay(),td=today(),vals=Object.values(o),mx=Math.max(1,...vals);
 let cells="";for(let i=0;i<first;i++)cells+=`<span class="hm-pad"></span>`;
 for(let d=1;d<=n;d++){const ds=`${ym}-${pad(d)}`,v=o[ds]||0,fut=ds>td,lv=fut?0:heatLevel(v,mx);
  cells+=fut?`<span class="hm-c fut" data-d="${ds}" data-v="0"><i>${d}</i></span>`:`<button class="hm-c l${lv}${ds===td?" td":""}" data-d="${ds}" data-v="${v}" data-jd="${ds}" aria-label="${dlabel(ds)} 支出 ${fmt(v)}"><i>${d}</i></button>`}
 const top=vals.length?Object.entries(o).sort((a,b)=>b[1]-a[1])[0]:null;
 return `<div class="card" id="heat"><h2>每日支出<small>${top?`最高 ${+top[0].slice(8)}日 ${fmt(top[1])}`:"本月暂无 JPY 支出"}</small></h2>
 <div class="hm-wd">${[...WD].map(w=>`<span>${w}</span>`).join("")}</div><div class="hm">${cells}</div>
 <div class="hm-lg"><span>少</span>${[0,1,2,3,4].map(l=>`<i class="l${l}"></i>`).join("")}<span>多</span><span style="flex:1"></span><span>点日期查看当天明细</span></div></div>`}
function mtd(ym){const isNow=ym===nowYM(),n=isNow?+today().slice(8):dimYM(ym),pm=shiftYM(ym,-1),pn=Math.min(n,dimYM(pm));
 const s=(m,k)=>sum(E.filter(r=>r.ym===m&&r.type==="expense"&&r.currency==="JPY"&&+r.d.slice(8)<=k)),cur=s(ym,n),prev=s(pm,pn),d=cur-prev;
 const note=n>pn?`（上月只有 ${pn} 天）`:"";
 return `<div class="mtd" id="mtd" data-cur="${cur}" data-prev="${prev}" data-n="${n}" data-pn="${pn}"><div><small>${isNow?`本月至今 1–${n}日`:`${mlabel(ym)} 1–${n}日`}</small><b class="num">${fmt(cur)}</b></div>
 <div><small>上月同期 ${mlabel(pm)} 1–${pn}日${note}</small><b class="num">${fmt(prev)}</b></div>
 <div><small>差额</small><b class="num ${prev&&d>0?"up":prev&&d<0?"down":""}" id="mtd-d">${prev?(d>=0?"+":"-")+fmt(Math.abs(d))+" · "+(d>=0?"+":"")+(d/prev*100).toFixed(1)+"%":"—"}</b></div></div>`}
function jump(o){Object.assign(st,{q:"",payee:"",scope:"",type:"",category:"",account:"",currency:"",pend:false,month:"",day:""},o);const q=$("#q");if(q)q.value="";
 if(route()==="list"){listRes();scrollTo(0,0)}else location.hash="#/list"}
document.addEventListener("click",e=>{const p=e.target.closest("[data-jp]");if(p&&!p.closest("#overlay")){e.stopPropagation();return jump({payee:p.dataset.jp,month:p.dataset.jm||"",type:"expense",currency:BASE,scope:"store"})}const b=e.target.closest("[data-jd],[data-jc]");if(!b||b.closest("#overlay"))return;e.stopPropagation();const d=b.dataset;
 if(d.jd)jump({day:d.jd,month:d.jd.slice(0,7)});else jump({category:d.jc||"",month:d.jm||"",type:"expense"})},true);
// ---- foldable / wide: two-pane list + detail. State lives in JS (selId, st, scroll), so resizing/folding never reloads.
const WIDEQ=matchMedia("(min-width: 600px), (horizontal-viewport-segments: 2)");
const segs2=()=>{try{const s=window.viewport&&window.viewport.segments;return !!(s&&s.length===2&&Math.abs(s[0].top-s[1].top)<1)}catch{return false}};
const isWide=()=>WIDEQ.matches||segs2();let selId=null;
function paneHTML(){const r=selId&&E.find(x=>x.id===selId);return r?entrySheet(r).replace('<div class="dim" data-eclose="1"></div>','').replace('class="sheet" id="entry"','class="pane-in" id="entry"'):`<div class="pane-empty" id="pane-empty">选择一笔账目查看详情</div>`}
function layout(){const w=isWide()&&route()==="list"&&!document.body.classList.contains("locked");document.body.classList.toggle("two-pane",w);document.body.classList.toggle("segmented",w&&segs2());
 const p=$("#pane");if(!p)return;if(w){if($("#overlay #entry")){closeEntry()}const k=selId+"|"+sig;if(p.dataset.k!==k||!p.innerHTML){rcRevoke();p.innerHTML=paneHTML();p.dataset.k=k;if(selId)mv(p.querySelector("#entry"),[{opacity:0,transform:"translateX(12px)"},{opacity:1,transform:"none"}],{d:280});rcLoad()}}else{if(p.innerHTML){rcRevoke();p.innerHTML=""}delete p.dataset.k;if(selId&&route()==="list"&&!$("#overlay").innerHTML&&isWide()===false&&layout.was)openEntry(selId,true)}layout.was=w}
WIDEQ.addEventListener?WIDEQ.addEventListener("change",layout):WIDEQ.addListener(layout);window.addEventListener("resize",layout);
try{window.viewport&&window.viewport.addEventListener&&window.viewport.addEventListener("segmentschange",layout)}catch{}
// ---- motion (B5): Apple-style springs, transform/opacity only, 200–400 ms. will-change only while running; nothing transformed at rest.
// Reduced motion → opacity-only (or nothing). Sheets/cards animate in #overlay/#sheet/#pane (outside #app, NF-33); exits use an inert, id-less ghost.
const SPR=CSS.supports("animation-timing-function","linear(0, 1)")?"linear(0, 0.096 2.4%, 0.33 6.2%, 0.62 11%, 0.84 16.5%, 0.96 22%, 1.02 28.5%, 1.03 35%, 1.015 45%, 1.004 58%, 1)":"cubic-bezier(.2,.9,.25,1)";
const MV={list:false,unlock:false,period:false};
function mv(el,kf,o={}){if(!el||!el.animate)return null;let k=kf,e=o.e||SPR;if(RM.matches){k=o.rm===undefined?kf.map(f=>"opacity" in f?{opacity:f.opacity}:{}):o.rm;if(!k||!k.some(f=>"opacity" in f))return null;e="linear"}
 const d=Math.max(200,Math.min(400,o.d||300));el.style.willChange=RM.matches?"opacity":"transform, opacity";el.__mv=(el.__mv||0)+1;
 const a=el.animate(k,{duration:d,delay:o.delay||0,easing:e,fill:"backwards"});const done=()=>{if(--el.__mv<=0){el.__mv=0;el.style.willChange="";if(!el.getAttribute("style"))el.removeAttribute("style")}};a.finished.then(done,done);return a}
const pageIn=()=>mv($("#app"),[{opacity:0,transform:"translateY(8px)"},{opacity:1,transform:"none"}],{d:280});
function sheetIn(host){if(!host)return;mv(host.querySelector(".dim"),[{opacity:0},{opacity:1}],{d:240,e:"linear"});mv(host.querySelector(".sheet"),[{transform:"translateY(100%)"},{transform:"none"}],{d:380,rm:[{opacity:0},{opacity:1}]})}
function ghostOut(host){if(!host||!host.innerHTML)return;const g=document.createElement("div");g.className="mv-ghost";g.setAttribute("aria-hidden","true");g.inert=true;g.innerHTML=host.innerHTML;
 g.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));g.querySelectorAll("img").forEach(x=>x.removeAttribute("src"));document.body.appendChild(g);
 const as=[mv(g.querySelector(".dim"),[{opacity:1},{opacity:0}],{d:220,e:"linear"}),mv(g.querySelector(".sheet"),[{transform:"none"},{transform:"translateY(100%)"}],{d:260,e:"cubic-bezier(.4,0,.9,.6)",rm:[{opacity:1},{opacity:0}]})].filter(Boolean);
 if(!as.length)return g.remove();Promise.all(as.map(a=>a.finished.catch(()=>{}))).then(()=>g.remove())}
const ghostsClear=()=>document.querySelectorAll(".mv-ghost").forEach(g=>g.remove());
function chartsIn(again){const st0=again?4:12;
 document.querySelectorAll("#heat .hm-c").forEach((c,j)=>mv(c,[{opacity:0,transform:"scale(.86)"},{opacity:1,transform:"none"}],{d:260,delay:Math.min(j*st0,240)}));
 document.querySelectorAll("#tr-svg .tr-bar").forEach((g,j)=>{g.style.transformBox="fill-box";g.style.transformOrigin="50% 100%";mv(g,[{transform:"scaleY(0)"},{transform:"none"}],{d:380,delay:j*(again?15:35),rm:null})});
 document.querySelectorAll(".ring svg circle").forEach((c,j)=>{c.style.transformBox="fill-box";c.style.transformOrigin="center";mv(c,[{opacity:0,transform:"scale(.92)"},{opacity:1,transform:"none"}],{d:320,delay:j*(again?15:40)})})}
function listIn(){const rows=[...document.querySelectorAll("#res .row[data-id]")].slice(0,14);rows.forEach((r,j)=>mv(r,[{opacity:0,transform:"translateY(6px)"},{opacity:1,transform:"none"}],{d:280,delay:j*18}))}
function afterRender(k,changed){if(changed&&(lastRouteWas||MV.unlock))pageIn();MV.unlock=false;
 if(changed||MV.period)chartsIn(MV.period&&!changed);MV.period=false;if(k==="list"&&!MV.list&&document.querySelector("#res .row[data-id]")){MV.list=true;listIn()}}
let lastRouteWas="";
// detail card: expands from the tapped row via View Transitions when available (transform/opacity keyframes on the snapshot), else a spring sheet.
function openFromRow(id,row){const vtOK=typeof document.startViewTransition==="function"&&!RM.matches&&row&&!(isWide()&&route()==="list");
 if(!vtOK)return openEntry(id);const r=row.getBoundingClientRect();row.style.viewTransitionName="ecard";
 let vt;try{vt=document.startViewTransition(()=>{row.style.viewTransitionName="";openEntry(id,false,true);const sh=$("#overlay .sheet");if(sh)sh.style.viewTransitionName="ecard"})}catch{row.style.viewTransitionName="";return openEntry(id)}
 vt.ready.then(()=>{const sh=$("#overlay .sheet");if(!sh)return;const R2=sh.getBoundingClientRect();
  document.documentElement.animate([{transform:`translate(${r.left-R2.left}px,${r.top-R2.top}px) scale(${r.width/R2.width},${r.height/R2.height})`,opacity:.6},{transform:"none",opacity:1}],{duration:340,easing:SPR,pseudoElement:"::view-transition-new(ecard)"})}).catch(()=>{});
 vt.finished.finally(()=>{const sh=$("#overlay .sheet");if(sh)sh.style.viewTransitionName="";if(row.isConnected)row.style.viewTransitionName=""})}
function unlockOut(){const u=$("#unlock");if(!u)return;const g=document.createElement("div");g.className="mv-ghost mv-unlock";g.setAttribute("aria-hidden","true");g.inert=true;g.appendChild(u.cloneNode(true));
 g.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));g.querySelectorAll("input").forEach(x=>x.value="");document.body.appendChild(g);MV.unlock=true;
 const a=mv(g,[{opacity:1,transform:"none"},{opacity:0,transform:"scale(1.04)"}],{d:300,e:"cubic-bezier(.3,0,.2,1)"});if(!a)return g.remove();a.finished.then(()=>g.remove(),()=>g.remove())}
// ---- router
const ROUTES={home,list,subs,budget,report};const route=()=>location.hash.replace(/^#\/?/,"").split("?")[0]||"home";
let lastRoute="";
function render(){if(route()==="pending"){history.replaceState(null,"","#/subs")}const k=route(),fn=ROUTES[k]||home,changed=k!==lastRoute;lastRouteWas=lastRoute;if(k!==lastRoute&&$("#overlay").innerHTML){closeEntry()}lastRoute=k;if(k!=="list")$("#sheet").innerHTML="";
 $("#app").innerHTML=fn();const tk=k==="budget"?"home":k;document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("on",t.dataset.r===tk));
 subBadge();if(k==="list")listRes("h");trendScroll();layout();afterRender(k,changed)}
const go=()=>{if(route()==="list"&&lastRoute==="list"&&$("#res")){const n=hashP();if(n!==pg){pg=n;listRes(true);pageTop();return}}render();window.scrollTo(0,0)};
function pageTop(){const r=$("#res");if(!r)return;const y=Math.max(0,r.getBoundingClientRect().top+scrollY-($(".top")?$(".top").getBoundingClientRect().height:0)-8);if(scrollY>y)scrollTo({top:y,behavior:RM.matches?"auto":"smooth"});
 const w=$("#res .wrap");if(w)mv(w,[{opacity:.4,transform:"translateY(8px)"},{opacity:1,transform:"none"}],{d:240})}
document.addEventListener("input",e=>{if(e.target.id==="q"){st.q=e.target.value;listRes()}});
document.addEventListener("change",e=>{const f=e.target.dataset.f;if(f&&e.target.tagName==="SELECT"){st[f]=e.target.value;listRes()}});
function shiftPeriod(d){if(rmode==="m"||route()!=="report"){const n=shiftYM(rym,d);if(d>0&&n>mxYM())return false;rym=n}else{const n=String(+ryr+d);if(d>0&&n>mxYM().slice(0,4))return false;ryr=n}const b=numsBefore();MV.period=true;render();animateNums(b);return true}
document.addEventListener("click",e=>{const pb=e.target.closest("[data-pg]");if(pb){if(pb.disabled)return;const n=pg+ +pb.dataset.pg;location.hash="#/list"+(n>1?"?p="+n:"");return}
 const b=e.target.closest("[data-m],[data-p],[data-now],[data-open],[data-close],[data-clr],[data-pend],[data-reset],[data-type],[data-cat],[data-drill],[data-refresh],[data-retry],[data-qclr],[data-eclose],[data-id],#newbar");if(!b)return;const d=b.dataset;
 if(b.id==="newbar")return applyPending();
 if(d.refresh!=null)return refresh();if(d.retry!=null)return boot();if(d.eclose!=null)return closeEntry();if(d.id!=null)return openFromRow(d.id,b.closest("#res .row,.row"));
 if(d.m){rmode=d.m;render()}else if(d.p){shiftPeriod(+d.p)}else if(d.now){rym=nowYM();ryr=rym.slice(0,4);render()}
 else if(d.drill!=null){Object.assign(st,{q:"",payee:"",scope:"",day:"",type:"expense",category:d.drill,account:"",currency:"",pend:false,month:rmode==="m"?rym:""})}
 else if(d.qclr!=null){e.preventDefault();st.q="";const q=$("#q");q.value="";listRes();q.focus()}
 else{if(d.open)sheet=true;if(d.close)sheet=false;if(d.clr){st[d.clr]="";if(d.clr==="payee")st.scope="";if(d.clr==="day")st.month=""}if(d.pend)st.pend=!st.pend;if(d.type!=null)st.type=d.type;if(d.cat!=null)st.category=st.category===d.cat?"":d.cat;
  if(d.reset){Object.assign(st,{q:"",payee:"",scope:"",month:"",day:"",type:"",category:"",account:"",currency:"",pend:false});const q=$("#q");if(q)q.value=""}listRes()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("#rviewer"))return rvClose();closeEntry()}if(e.key==="Enter"&&e.target.dataset&&e.target.dataset.id)openEntry(e.target.dataset.id)});
window.addEventListener("hashchange",go);
// ---- encrypted data (AES-256-GCM, PBKDF2-SHA256). Only *.enc.json is published; the derived key is kept in memory,
// or (「在这台设备上记住」) in IndexedDB as a NON-extractable CryptoKey. The password itself is never stored.
// Decrypted JSON is never written to the SW cache / localStorage (the SW only ever sees the ciphertext files).
const TESTPLAIN=!!window.__LEDGER_TEST_PLAINTEXT;   // set only by the local test harness (fixture servers); never in the deployed page
const ENC={ledger:"data/ledger.enc.json",subs:"data/subscriptions.enc.json",merch:"data/merchants.enc.json"};
let KEY=null;const b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const idb=(mode,fn)=>new Promise((res,rej)=>{const o=indexedDB.open("ledger-keys",1);o.onupgradeneeded=()=>o.result.createObjectStore("k");o.onerror=()=>rej(o.error);
 o.onsuccess=()=>{const t=o.result.transaction("k",mode),s=t.objectStore("k"),r=fn(s);t.oncomplete=()=>{o.result.close();res(r&&r.result)};t.onerror=()=>rej(t.error)}});
const keyLoad=()=>idb("readonly",s=>s.get("main")).catch(()=>null),keySave=k=>idb("readwrite",s=>s.put(k,"main")).catch(()=>{}),keyClear=()=>idb("readwrite",s=>s.delete("main")).catch(()=>{});
async function deriveKey(pw,enc){const m=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]);
 const key=await crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:b64d(enc.salt),iterations:+enc.iter},m,{name:"AES-GCM",length:256},false,["decrypt"]);return {key,salt:enc.salt,iter:+enc.iter}}
async function decryptWith(K,enc){if(!enc||enc.v!==1||enc.kdf!=="PBKDF2-SHA256")throw new Error("bad format");if(K.salt!==enc.salt||K.iter!==+enc.iter)throw new Error("key mismatch");
 const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64d(enc.iv)},K.key,b64d(enc.ct));return JSON.parse(new TextDecoder().decode(pt))}
class Locked extends Error{}
async function currentKey(){if(KEY)return KEY;const k=await keyLoad();if(k&&k.key)KEY=k;return KEY}
async function openEnc(enc){const K=await currentKey();if(!K)throw new Locked("locked");
 try{return await decryptWith(K,enc)}catch(e){KEY=null;await keyClear();throw new Locked("key no longer works")}}   // e.g. password changed
function wipe(){rcRevoke();ghostsClear();MV.list=false;selId=null;{const p=$("#pane");if(p){p.innerHTML="";delete p.dataset.k}}document.body.classList.remove("two-pane","segmented");E=[];BUD=null;SUBS=null;MER=undefined;pendingL=null;sig="";colorMap={};lastUpd=null;TR.off.clear();TR.sel=null;pg=1;Object.assign(st,{q:"",payee:"",scope:"",month:"",type:"",category:"",account:"",currency:"",pend:false});
 ["#app","#overlay","#sheet"].forEach(q=>{const el=$(q);if(el)el.innerHTML=""});const t=$("#toast");if(t){t.textContent="";t.classList.remove("show")}
 const nb=$("#newbar");if(nb)nb.hidden=true;const c=$("#pcnt");if(c){c.hidden=true;c.textContent=""}document.body.style.overflow=""}
async function lock(){KEY=null;wipe();await keyClear();showUnlock()}
function unlockHTML(){return `<div class="unlock" id="unlock"><div class="ul-in"><div class="ul-ic" aria-hidden="true"><span></span></div><h1>账本已加密</h1><p>输入密码以查看账目</p>
 <form id="ul-form" autocomplete="off"><input id="ul-pw" type="password" autocomplete="current-password" placeholder="密码" aria-label="密码" enterkeyhint="go">
 <label class="ul-rem"><input type="checkbox" id="ul-rem"><span>在这台设备上记住</span></label><button class="btn" id="ul-go" type="submit">解锁</button><div class="ul-err" id="ul-err" role="alert"></div></form>
 <div class="ul-note">密码只用于在本机解密，不会上传或保存。</div></div></div>`}
function showUnlock(msg=""){$("#overlay").innerHTML="";$("#sheet").innerHTML="";document.body.classList.add("locked");$("#app").innerHTML=unlockHTML();if(msg)$("#ul-err").textContent=msg;setTimeout(()=>{const i=$("#ul-pw");i&&i.focus()},50)}
document.addEventListener("submit",async e=>{if(e.target.id!=="ul-form")return;e.preventDefault();const pw=$("#ul-pw").value,btn=$("#ul-go"),box=$(".ul-in");if(!pw)return;
 btn.disabled=true;btn.textContent="正在解锁…";$("#ul-err").textContent="";
 let enc;try{const r=await fetch(ENC.ledger+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);enc=await r.json()}
 catch(err){btn.disabled=false;btn.textContent="解锁";$("#ul-err").textContent="连不上网络，暂时无法解锁";return}   // fetch/offline/HTTP/unreadable file: never "wrong password"
 try{
  const K=await deriveKey(pw,enc);await decryptWith(K,enc);KEY=K;if($("#ul-rem").checked)await keySave(K);else await keyClear();unlockOut();document.body.classList.remove("locked");boot()}
 catch(err){btn.disabled=false;btn.textContent="解锁";const i=$("#ul-pw");
  if(!(err&&err.name==="OperationError")){$("#ul-err").textContent="数据文件无法读取，请稍后再试";return}   // only an AES-GCM auth failure means a wrong password
  i.value="";$("#ul-err").textContent="密码不正确";box.classList.remove("shake");void box.offsetWidth;box.classList.add("shake");try{navigator.vibrate&&navigator.vibrate([20,40,20])}catch{}i.focus()}});
document.addEventListener("click",e=>{if(e.target.closest("[data-lock]"))lock()});
// ---- data loading / refresh
const SRCURL=TESTPLAIN?(({sample:"data/sample-ledger.json",trend:"data/sample-trend.json"})[new URLSearchParams(location.search).get("data")]||"data/ledger.json"):ENC.ledger;
let sig="",lastCheck=0,busy=false,pendingL=null;
const RM=matchMedia("(prefers-reduced-motion: reduce)");
function sigOf(L){const a=(L.entries||[]);let h=a.length;for(const r of a)h=(h*31+String(r.id).length+(+r.amount||0)+String(r.updated_at||"").length+(r.deleted?7:0))%1e9;return h+"|"+(L.generated_at||"")+"|"+JSON.stringify(L.budgets||null)}
async function fetchLedger(){const r=await fetch(SRCURL+"?t="+Date.now(),{cache:"no-store"});if(!r.ok){const e=new Error("HTTP "+r.status);e.server=r.status>=500;throw e}const L=TESTPLAIN?await r.json():await openEnc(await r.json());const fc=r.headers.get("X-From-Cache");return {L,cached:!!fc,server:fc==="5xx"}}
function apply(L){BASE=L.base_currency||"JPY";const unk=(L.entries||[]).filter(r=>!r.deleted&&!TYPE[r.type]);if(unk.length)console.warn(`ledger: skipped ${unk.length} entr${unk.length>1?"ies":"y"} with unknown type`,unk.map(r=>r.id+":"+r.type));E=(L.entries||[]).filter(r=>!r.deleted&&TYPE[r.type]).map(norm);BUD=L.budgets||null;sig=sigOf(L);
 colorMap={};uniq("category").filter(c=>!CATC[c]).forEach((c,i)=>colorMap[c]=PAL[i%PAL.length])}
let toastT;function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("show"),2600)}
const NUMS=["t-ex","t-inc","t-bal","r-ex","r-inc","r-bal"];
function animateNums(before){if(RM.matches)return;const els=NUMS.map(id=>document.getElementById(id)).filter(el=>el&&before[el.id]!=null);
 const to=els.map(el=>parseFloat(el.textContent.replace(/[^\d.\-]/g,""))||0),from=els.map(el=>before[el.id]);if(!els.length||to.every((v,i)=>v===from[i]))return;
 const t0=performance.now();document.body.dataset.anim="1";const step=t=>{const k=Math.min(1,(t-t0)/360),e=1-Math.pow(1-k,3);els.forEach((el,i)=>el.textContent=fmt(Math.round(from[i]+(to[i]-from[i])*e)));if(k<1)requestAnimationFrame(step);else delete document.body.dataset.anim};requestAnimationFrame(step)}
function numsBefore(){const before={};NUMS.forEach(id=>{const el=document.getElementById(id);if(el)before[id]=parseFloat(el.textContent.replace(/[^\d.\-]/g,""))||0});return before}
function rerender(){const before=numsBefore();const y=scrollY;render();scrollTo(0,y);animateNums(before)}
function setBusy(v){busy=v;document.querySelectorAll(".rbtn").forEach(b=>b.classList.toggle("spin",v));$("#ptr").classList.toggle("spin",v)}

async function refresh(){if(busy)return;setBusy(true);const old=new Set(E.map(r=>r.id));
 try{const {L,cached,server}=await fetchLedger();lastCheck=Date.now();apply(L);pendingL=null;$("#newbar").hidden=true;
  if(cached){rerender();toast(server?"服务器暂时不可用，显示缓存数据":"离线，显示缓存数据")}else{lastUpd=Date.now();rerender();toast(`已更新 · +${E.filter(r=>!old.has(r.id)).length} 条`)}}
 catch(e){if(e instanceof Locked){setBusy(false);ptrReset();return showUnlock("密码已更改或已失效，请重新输入")}toast(e&&e.server?"服务器暂时不可用，显示缓存数据":"离线，显示缓存数据")}finally{setBusy(false);ptrReset();if(KEY||TESTPLAIN){loadSubs();loadMerch()}}}
function applyPending(){if(!pendingL)return;const old=new Set(E.map(r=>r.id));apply(pendingL);pendingL=null;lastUpd=Date.now();$("#newbar").hidden=true;rerender();toast(`已更新 · +${E.filter(r=>!old.has(r.id)).length} 条`)}
async function silentCheck(){lastCheck=Date.now();try{const {L,cached}=await fetchLedger();if(!cached&&sigOf(L)!==sig){pendingL=L;$("#newbar").hidden=false}}catch(e){if(e instanceof Locked)showUnlock("密码已更改或已失效，请重新输入")}}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&E&&sig&&Date.now()-lastCheck>5*60e3)silentCheck()});
// ---- touch: native-feel pull-to-refresh + horizontal month swipe (direction-locked)
const PTR={TH:70,HOLD:56,MAX:130};let tx=null,ptrH=0;
const damp=dy=>dy<=0?0:PTR.MAX*(1-Math.exp(-dy/(PTR.MAX*1.6)));   // rubber-band
const STANDALONE=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;if(STANDALONE)document.documentElement.classList.add("standalone");
function ptrSet(h,anim){ptrH=h;const p=$("#ptr"),a=$("#app"),k=Math.min(1,h/PTR.TH);
 p.classList.toggle("anim",!!anim);a.classList.toggle("anim",!!anim);
 a.style.transform=h&&!RM.matches?`translateY(${h.toFixed(1)}px)`:"";
 p.style.opacity=h>0||busy?1:0;p.style.transform=`translate(-50%,${(RM.matches?PTR.HOLD:h)-44}px)`;
 p.querySelector(".ring").style.strokeDashoffset=(1-k)*69.1;p.dataset.k=k.toFixed(2)}
function ptrReset(){const p=$("#ptr");p.classList.remove("ready","pull","spin");ptrSet(0,true)}
// Normal scrolling never sees a non-passive listener: the blocking touchmove handler is attached only for a
// gesture that starts with the page at the very top (scrollY<=0), and removed again on touchend/cancel.
const atTop=()=>(document.scrollingElement||document.documentElement).scrollTop<=0&&scrollY<=0;
function ptrGuard(e){if(tx&&tx.axis==="ptr"&&e.cancelable)e.preventDefault()}
const ptrArm=on=>on?document.addEventListener("touchmove",ptrGuard,{passive:false}):document.removeEventListener("touchmove",ptrGuard,{passive:false});
document.addEventListener("touchstart",e=>{ptrArm(false);if(e.touches.length!==1||$("#overlay").innerHTML||$("#sheet").innerHTML||e.target.closest(".sheet,.chips,.dim"))return tx=null;const t=e.touches[0];tx={x:t.clientX,y:t.clientY,top:atTop(),axis:null,buzz:false};if(tx.top)ptrArm(true)},{passive:true});
document.addEventListener("touchmove",e=>{if(!tx)return;const t=e.touches[0],dx=t.clientX-tx.x,dy=t.clientY-tx.y;
 if(!tx.axis&&Math.abs(dx)+Math.abs(dy)>10)tx.axis=Math.abs(dx)>Math.abs(dy)*1.2?"x":(dy>0&&tx.top&&atTop()&&!busy?"ptr":"y");
 if(tx.axis==="ptr"){const h=damp(dy),p=$("#ptr");p.classList.add("pull");ptrSet(h,false);
  const ready=h>=PTR.TH;if(ready&&!tx.buzz){tx.buzz=true;try{navigator.vibrate&&navigator.vibrate(10)}catch{}}p.classList.toggle("ready",ready)}},{passive:true});
document.addEventListener("touchend",e=>{ptrArm(false);if(!tx)return;const t=e.changedTouches[0],dx=t.clientX-tx.x,a=tx.axis;tx=null;
 if(a==="ptr"){$("#ptr").classList.remove("pull");if(ptrH>=PTR.TH&&!busy){ptrSet(PTR.HOLD,true);refresh()}else ptrReset();return}
 if(a==="x"&&Math.abs(dx)>60&&["home","report","budget"].includes(route()))shiftPeriod(dx<0?1:-1)},{passive:true});
document.addEventListener("touchcancel",()=>{ptrArm(false);if(tx&&tx.axis==="ptr"&&!busy)ptrReset();tx=null},{passive:true});
// ---- boot
const SKEL=`<div class="top"><div class="lt"><h1>账本</h1></div></div><div class="wrap" id="skeleton" aria-busy="true" aria-label="加载中"><div class="sk" style="width:45%;height:34px;margin:8px 0 16px"></div><div class="sk" style="height:150px;border-radius:12px"></div><div class="sk" style="height:52px;margin-top:12px;border-radius:12px"></div><div class="sk" style="width:30%;height:13px;margin:24px 0 8px"></div>${'<div class="sk" style="height:60px;margin-top:2px;border-radius:12px"></div>'.repeat(5)}</div>`;
async function boot(){if(!TESTPLAIN&&!(await currentKey()))return showUnlock();document.body.classList.remove("locked");$("#app").innerHTML=SKEL;
 try{const {L,cached,server}=await fetchLedger();apply(L);lastCheck=Date.now();if(!cached)lastUpd=Date.now();render();loadSubs();loadMerch();if(cached)toast(server?"服务器暂时不可用，显示缓存数据":"离线，显示缓存数据")}
 catch(e){if(e instanceof Locked)return showUnlock("密码已更改或已失效，请重新输入");$("#app").innerHTML=navbar("账本")+empty('<span style="font-size:30px;font-weight:600;color:var(--sub)">!</span>',...(e&&e.server?["服务器暂时不可用","服务器出错了，本机也还没有缓存数据。稍后再试一次。"]:["连不上网络","没能读取账目数据。检查网络后再试一次。"]),'<button class="btn sec" data-retry="1">重试</button>')}}
boot();
if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").then(r=>r.update()).catch(()=>{});
 let reloaded=false;const had=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(reloaded||!had)return;reloaded=true;location.reload()})}

// ---- test-only hooks: exposed ONLY when the local test harness sets a flag before load (never in the deployed page)
if(window.__LEDGER_TEST_PLAINTEXT||window.__LEDGER_TEST_HOOKS){window.__trend=trendData;window.__subs={nextCharge,dueLabel,daysTo};window.__test={expire:()=>{lastCheck=0}};
 window.__ledgerTest=()=>({E,BUD,BASE})}
