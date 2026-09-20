import webpush from 'web-push';

const JSON_HEADERS = {'content-type':'application/json; charset=utf-8'};

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
}
function cors(res){
  const h=new Headers(res.headers);
  h.set('access-control-allow-origin','*');
  h.set('access-control-allow-headers','content-type');
  h.set('access-control-allow-methods','GET,POST,OPTIONS');
  return new Response(res.body,{status:res.status,headers:h});
}
function randomId(prefix='m'){
  return prefix+'_'+Date.now().toString(36)+'_'+crypto.randomUUID().replaceAll('-','').slice(0,12);
}
function omanDateParts(d=new Date()){
  const p=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'
  }).formatToParts(d).reduce((o,x)=>(o[x.type]=x.value,o),{});
  return {y:+p.year,m:+p.month,d:+p.day};
}
function isoDate(y,m,d){
  return [y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
}
function addDays(base,n){
  const [y,m,d]=base.split('-').map(Number);
  const z=new Date(Date.UTC(y,m-1,d+n,12));
  return isoDate(z.getUTCFullYear(),z.getUTCMonth()+1,z.getUTCDate());
}
function nextWeekday(base,target){
  const [y,m,d]=base.split('-').map(Number);
  const z=new Date(Date.UTC(y,m-1,d,12));
  const diff=(target-z.getUTCDay()+7)%7||7;
  z.setUTCDate(z.getUTCDate()+diff);
  return isoDate(z.getUTCFullYear(),z.getUTCMonth()+1,z.getUTCDate());
}
function toOmanEpoch(date,time){
  if(!date||!time)return null;
  const ms=Date.parse(date+'T'+time+':00+04:00');
  return Number.isFinite(ms)?ms:null;
}
function parseOffsets(t){
  const a=[];
  const rows=[
    [/قبل(?:ها)?\s*(?:بيومين|يومين)/,2880],
    [/قبل(?:ها)?\s*(?:بيوم|يوم)(?!ين)/,1440],
    [/قبل(?:ها)?\s*(?:بساعتين|ساعتين)/,120],
    [/قبل(?:ها)?\s*(?:بساعة|ساعة)(?!تين)/,60],
    [/قبل(?:ها)?\s*(?:بنصف\s*ساعة|نصف\s*ساعة)/,30],
    [/قبل(?:ها)?\s*(?:بربع\s*ساعة|ربع\s*ساعة)/,15]
  ];
  rows.forEach(([re,v])=>{if(re.test(t))a.push(v)});
  const min=t.match(/قبل(?:ها)?\s*(\d+)\s*دقائق?/);
  if(min)a.push(+min[1]);
  return [...new Set(a)].sort((x,y)=>y-x);
}
function parseCommand(text){
  const p=omanDateParts(),base=isoDate(p.y,p.m,p.d);
  let type='task';
  if(/فكر|دوّن|دون|ملاحظة|ملاحظه/.test(text))type='idea';
  else if(/موعد|اجتماع|مناسبة|زيارة|عندي/.test(text))type='event';
  else if(/ذكرني|تذكير|نبّه|نبه/.test(text))type='reminder';

  let date='';
  let m=text.match(/بعد\s*(\d+)\s*أيام?/);
  if(m)date=addDays(base,+m[1]);
  else if((m=text.match(/بعد\s*(\d+)\s*أسابيع?/)))date=addDays(base,+m[1]*7);
  else if(/بعد بكرة|بعد غد/.test(text))date=addDays(base,2);
  else if(/بكرة|غد/.test(text))date=addDays(base,1);
  else if(/اليوم/.test(text))date=base;

  const dm=text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if(dm){
    let y=dm[3]?+dm[3]:p.y;if(y<100)y+=2000;
    date=isoDate(y,+dm[2],+dm[1]);
  }

  const days={'الأحد':0,'الاحد':0,'الإثنين':1,'الاثنين':1,'الثلاثاء':2,'الأربعاء':3,'الاربعاء':3,'الخميس':4,'الجمعة':5,'السبت':6};
  if(!date){
    for(const [name,num] of Object.entries(days)){
      if(text.includes(name)){date=nextWeekday(base,num);break}
    }
  }

  let time='';
  m=text.match(/(?:الساعة|الساعه)\s*(\d{1,2})(?::(\d{2}))?\s*(ص|صباح(?:اً)?|م|مساء(?:ً)?|الليل|ليلاً)?/);
  if(m){
    let h=+m[1],mi=m[2]||'00',ap=m[3]||'';
    if(/م|مساء|الليل|ليلاً/.test(ap)&&h<12)h+=12;
    if(/ص|صباح/.test(ap)&&h===12)h=0;
    time=String(h).padStart(2,'0')+':'+mi;
  }
  if(/الظهر/.test(text))time='12:00';
  if(/العصر/.test(text)&&!time)time='16:00';
  if(/المغرب/.test(text)&&!time)time='18:00';

  let reminders=parseOffsets(text);
  if((type==='reminder'||type==='event')&&date&&time&&!reminders.length)reminders=[0];

  const title=text
    .replace(/^(يا\s+مُ?عين[،,]?\s*)/,'')
    .replace(/^(ذكرني|سجل لي|سجل|دوّن|دون|أضف|اضف)\s*/,'')
    .replace(/\s*و?\s*قبل(?:ها)?\s*(?:بيومين|بيوم|يومين|يوم|بساعتين|ساعتين|بساعة|ساعة|بنصف\s*ساعة|نصف\s*ساعة|بربع\s*ساعة|ربع\s*ساعة|\d+\s*دقائق?)/g,'')
    .trim();

  return {type,title:title||text,date,time,reminders,eventAt:toOmanEpoch(date,time)};
}
function reminderBody(item,offset){
  if(offset===0)return item.title;
  if(offset===15)return item.title+' — متبقي 15 دقيقة';
  if(offset===30)return item.title+' — متبقي نصف ساعة';
  if(offset===60)return item.title+' — متبقي ساعة';
  if(offset===120)return item.title+' — متبقي ساعتان';
  if(offset===1440)return item.title+' — متبقي يوم';
  if(offset===2880)return item.title+' — متبقي يومان';
  return item.title+' — متبقي '+offset+' دقيقة';
}
function configureVapid(env){
  webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
}
async function ingestCommand(req,env){
  const body=await req.json().catch(()=>null);
  const url=new URL(req.url);
  const key=url.searchParams.get('key')||req.headers.get('x-mueen-key')||'';
  const valid=(env.MUEEN_LINK_KEY&&key===env.MUEEN_LINK_KEY)||(body&&env.MUEEN_TOKEN&&body.token===env.MUEEN_TOKEN);
  if(!body||!valid)return json({ok:false,error:'unauthorized'},401);
  const text=String(body.text||'').trim();
  if(!text)return json({ok:false,error:'missing_text'},400);

  const parsed=parseCommand(text),id=randomId('item'),now=Date.now();
  await env.DB.prepare(
    'INSERT INTO items (id,text,type,title,event_at,created_at,source) VALUES (?,?,?,?,?,?,?)'
  ).bind(id,text,parsed.type,parsed.title,parsed.eventAt,now,'siri').run();

  if(parsed.eventAt&&parsed.reminders.length){
    for(const offset of parsed.reminders){
      const notifyAt=parsed.eventAt-offset*60000;
      if(notifyAt>now-5*60000){
        await env.DB.prepare(
          'INSERT INTO reminders (id,item_id,notify_at,offset_minutes,sent) VALUES (?,?,?,?,0)'
        ).bind(randomId('rem'),id,notifyAt,offset).run();
      }
    }
  }
  return json({ok:true,item:{id,...parsed}});
}

function omanPartsFromMs(ms){
  if(!ms)return {date:'',time:''};
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(ms)).reduce((o,x)=>(o[x.type]=x.value,o),{});
  return {
    date:parts.year+'-'+parts.month+'-'+parts.day,
    time:parts.hour+':'+parts.minute
  };
}
async function listItems(req,env){
  const body=await req.json().catch(()=>null);
  const url=new URL(req.url);
  const key=url.searchParams.get('key')||req.headers.get('x-mueen-key')||'';
  const valid=(env.MUEEN_LINK_KEY&&key===env.MUEEN_LINK_KEY)||(body&&env.MUEEN_TOKEN&&body.token===env.MUEEN_TOKEN);
  if(!valid)return json({ok:false,error:'unauthorized'},401);

  const rows=await env.DB.prepare(
    `SELECT i.id,i.text,i.type,i.title,i.event_at,i.created_at,
      GROUP_CONCAT(r.offset_minutes) AS offsets
     FROM items i
     LEFT JOIN reminders r ON r.item_id=i.id
     GROUP BY i.id
     ORDER BY i.created_at ASC`
  ).all();

  const items=(rows.results||[]).map(r=>{
    const dt=omanPartsFromMs(Number(r.event_at)||0);
    const reminders=r.offsets?String(r.offsets).split(',').map(Number).filter(Number.isFinite):[];
    return {
      id:r.id,
      type:r.type||'task',
      title:r.title||r.text||'',
      notes:'',
      date:dt.date,
      time:dt.time,
      priority:'normal',
      reminders:[...new Set(reminders)],
      done:false,
      created:new Date(Number(r.created_at)||Date.now()).toISOString(),
      source:'siri-cloudflare'
    };
  });
  return json({ok:true,items});
}

async function subscribe(req,env){
  const body=await req.json().catch(()=>null);
  const s=body&&body.subscription;
  if(!s||!s.endpoint||!s.keys?.p256dh||!s.keys?.auth)return json({ok:false,error:'bad_subscription'},400);
  const now=Date.now();
  await env.DB.prepare(
    `INSERT INTO subscriptions(endpoint,p256dh,auth,created_at,updated_at)
     VALUES(?,?,?,?,?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at`
  ).bind(s.endpoint,s.keys.p256dh,s.keys.auth,now,now).run();
  return json({ok:true});
}
async function sendPushToAll(env,payload){
  configureVapid(env);
  const subs=await env.DB.prepare('SELECT endpoint,p256dh,auth FROM subscriptions').all();
  let ok=0,fail=0;
  for(const s of subs.results||[]){
    try{
      await webpush.sendNotification(
        {endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
        JSON.stringify(payload),
        {TTL:3600}
      );
      ok++;
    }catch(e){
      fail++;
      const status=e?.statusCode||0;
      if(status===404||status===410){
        await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(s.endpoint).run();
      }
    }
  }
  return {ok,fail};
}
async function testPush(req,env){
  const body=await req.json().catch(()=>null);
  if(!body||body.token!==env.MUEEN_TOKEN)return json({ok:false,error:'unauthorized'},401);
  return json({ok:true,result:await sendPushToAll(env,{title:'مُعين',body:'الإشعارات المجانية تعمل بنجاح.',url:'https://turkik69.github.io/Mueen/'})});
}
async function processDue(env){
  const now=Date.now();
  const due=await env.DB.prepare(
    `SELECT r.id,r.item_id,r.offset_minutes,i.title
     FROM reminders r JOIN items i ON i.id=r.item_id
     WHERE r.sent=0 AND r.notify_at<=?
     ORDER BY r.notify_at ASC LIMIT 25`
  ).bind(now).all();

  for(const r of due.results||[]){
    try{
      const result=await sendPushToAll(env,{
        title:'مُعين',
        body:reminderBody({title:r.title},Number(r.offset_minutes)||0),
        itemId:r.item_id,
        url:'https://turkik69.github.io/Mueen/'
      });
      if(result.ok>0){
        await env.DB.prepare('UPDATE reminders SET sent=1,sent_at=?,attempts=attempts+1,last_error=NULL WHERE id=?').bind(Date.now(),r.id).run();
      }else{
        await env.DB.prepare('UPDATE reminders SET attempts=attempts+1,last_error=? WHERE id=?').bind('no_active_subscription',r.id).run();
      }
    }catch(e){
      await env.DB.prepare('UPDATE reminders SET attempts=attempts+1,last_error=? WHERE id=?').bind(String(e?.message||e).slice(0,500),r.id).run();
    }
  }
}
export default {
  async fetch(req,env){
    if(req.method==='OPTIONS')return cors(new Response(null,{status:204}));
    const url=new URL(req.url);
    let res;
    if(url.pathname==='/api/config'&&req.method==='GET')res=json({ok:true,vapidPublicKey:env.VAPID_PUBLIC_KEY});
    else if(url.pathname==='/api/command'&&req.method==='POST')res=await ingestCommand(req,env);
    else if(url.pathname==='/api/subscribe'&&req.method==='POST')res=await subscribe(req,env);
    else if(url.pathname==='/api/items'&&req.method==='POST')res=await listItems(req,env);
    else if(url.pathname==='/api/test'&&req.method==='POST')res=await testPush(req,env);
    else if(url.pathname==='/health')res=json({ok:true,service:'mueen-reminders'});
    else res=json({ok:false,error:'not_found'},404);
    return cors(res);
  },
  async scheduled(_event,env,ctx){
    ctx.waitUntil(processDue(env));
  }
};
