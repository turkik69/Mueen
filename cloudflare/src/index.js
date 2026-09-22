// verify-secret-trigger
// deploy-trigger: 2026-09-22 v3.10
import webpush from 'web-push';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
function cors(res){
  const h=new Headers(res.headers);
  h.set('access-control-allow-origin','*');
  h.set('access-control-allow-headers','content-type, authorization');
  h.set('access-control-allow-methods','GET,POST,OPTIONS');
  return new Response(res.body,{status:res.status,headers:h});
}
function randomId(prefix='m'){return prefix+'_'+Date.now().toString(36)+'_'+crypto.randomUUID().replaceAll('-','').slice(0,12)}
function arabicDigits(s=''){return String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))}
function omanDateParts(d=new Date()){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(d).reduce((o,x)=>(o[x.type]=x.value,o),{});
  return {y:+p.year,m:+p.month,d:+p.day};
}
function isoDate(y,m,d){return [y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-')}
function addDays(base,n){
  const [y,m,d]=base.split('-').map(Number),z=new Date(Date.UTC(y,m-1,d+n,12));
  return isoDate(z.getUTCFullYear(),z.getUTCMonth()+1,z.getUTCDate());
}
function nextWeekday(base,target){
  const [y,m,d]=base.split('-').map(Number),z=new Date(Date.UTC(y,m-1,d,12));
  const diff=(target-z.getUTCDay()+7)%7||7;z.setUTCDate(z.getUTCDate()+diff);
  return isoDate(z.getUTCFullYear(),z.getUTCMonth()+1,z.getUTCDate());
}
function toOmanEpoch(date,time){
  if(!date||!time)return null;
  const ms=Date.parse(date+'T'+time+':00+04:00');
  return Number.isFinite(ms)?ms:null;
}
function omanPartsFromMs(ms){
  if(!ms)return {date:'',time:''};
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
    .formatToParts(new Date(ms)).reduce((o,x)=>(o[x.type]=x.value,o),{});
  return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};
}
function parseOffsets(t){
  const a=[],rows=[
    [/قبل(?:ها)?\s*(?:بيومين|يومين)/,2880],
    [/قبل(?:ها)?\s*(?:بيوم|يوم)(?!ين)/,1440],
    [/قبل(?:ها)?\s*(?:بساعتين|ساعتين)/,120],
    [/قبل(?:ها)?\s*(?:بساعة|ساعة)(?!تين)/,60],
    [/قبل(?:ها)?\s*(?:بنصف\s*ساعة|نصف\s*ساعة)/,30],
    [/قبل(?:ها)?\s*(?:بربع\s*ساعة|ربع\s*ساعة)/,15]
  ];
  rows.forEach(([re,v])=>{if(re.test(t))a.push(v)});
  const m=t.match(/قبل(?:ها)?\s*(\d+)\s*دقائق?/);if(m)a.push(+m[1]);
  return [...new Set(a)].sort((x,y)=>y-x);
}
function spokenHour(text){
  const m=text.match(/(?:الساعة|الساعه)\s*(الواحدة|الواحده|واحد|وحدة|الثانية|الثانيه|اثنين|إثنين|الثالثة|الثالثه|ثلاثة|ثلاثه|الرابعة|الرابعه|أربعة|اربعة|الخامسة|الخامسه|خمسة|خمسه|السادسة|السادسه|ستة|سته|السابعة|السابعه|سبعة|سبعه|الثامنة|الثامنه|ثمانية|ثمانيه|التاسعة|التاسعه|تسعة|تسعه|العاشرة|العاشره|عشرة|عشره|الحادية عشرة|الحاديه عشره|أحد عشر|احد عشر|الثانية عشرة|الثانيه عشره|اثنا عشر|إثنا عشر)/);
  if(!m)return null;
  const k=m[1].replace(/ة/g,'ه').replace(/أ|إ/g,'ا');
  const map={'الواحده':1,'واحد':1,'وحده':1,'الثانيه':2,'اثنين':2,'الثالثه':3,'ثلاثه':3,'الرابعه':4,'اربعه':4,'الخامسه':5,'خمسه':5,'السادسه':6,'سته':6,'السابعه':7,'سبعه':7,'الثامنه':8,'ثمانيه':8,'التاسعه':9,'تسعه':9,'العاشره':10,'عشره':10,'الحاديه عشره':11,'احد عشر':11,'الثانيه عشره':12,'اثنا عشر':12};
  return map[k]||null;
}
function parseCommand(raw){
  const text=arabicDigits(raw),p=omanDateParts(),base=isoDate(p.y,p.m,p.d);
  let type='task';
  if(/ذكرني|تذكير|نبّه|نبه/.test(text))type='reminder';
  else if(/موعد|اجتماع|مناسبة|زيارة|عندي/.test(text))type='event';
  else if(/فكر|دوّن|دون|ملاحظة|ملاحظه/.test(text))type='idea';

  let relativeMs=null,m;
  if((m=text.match(/بعد\s*(\d+)\s*(?:دقيقة|دقيقه|دقائق)/)))relativeMs=+m[1]*60000;
  else if(/بعد\s*(?:دقيقة|دقيقه)(?!\s*\d)/.test(text))relativeMs=60000;
  else if(/بعد\s*(?:دقيقتين|دقيقتان)/.test(text))relativeMs=120000;
  else if(/بعد\s*(?:نصف\s*ساعة|نص\s*ساعة)/.test(text))relativeMs=30*60000;
  else if(/بعد\s*ساعتين/.test(text))relativeMs=7200000;
  else if((m=text.match(/بعد\s*(\d+)\s*ساعات?/)))relativeMs=+m[1]*3600000;
  else if(/بعد\s*ساعة/.test(text))relativeMs=3600000;

  let date='',time='',eventAt=null;
  if(relativeMs){
    eventAt=Date.now()+relativeMs;
    const dt=omanPartsFromMs(eventAt);date=dt.date;time=dt.time;
  }else{
    m=text.match(/بعد\s*(\d+)\s*أيام?/);
    if(m)date=addDays(base,+m[1]);
    else if((m=text.match(/بعد\s*(\d+)\s*أسابيع?/)))date=addDays(base,+m[1]*7);
    else if(/بعد بكرة|بعد غد/.test(text))date=addDays(base,2);
    else if(/بكرة|غد/.test(text))date=addDays(base,1);
    else if(/اليوم/.test(text))date=base;

    const dm=text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if(dm){let y=dm[3]?+dm[3]:p.y;if(y<100)y+=2000;date=isoDate(y,+dm[2],+dm[1])}
    const days={'الأحد':0,'الاحد':0,'الإثنين':1,'الاثنين':1,'الثلاثاء':2,'الأربعاء':3,'الاربعاء':3,'الخميس':4,'الجمعة':5,'السبت':6};
    if(!date)for(const [name,num] of Object.entries(days)){if(text.includes(name)){date=nextWeekday(base,num);break}}

    m=text.match(/(?:الساعة|الساعه)?\s*(\d{1,2})(?::(\d{2}))?\s*(ص|صباح(?:اً)?|م|مساء(?:ً)?|الليل|ليلاً)?/);
    if(m&&(/(?:الساعة|الساعه)/.test(text)||m[3])){
      let h=+m[1],mi=m[2]||'00',ap=m[3]||'';
      if(/م|مساء|الليل|ليلاً/.test(ap)&&h<12)h+=12;
      if(/ص|صباح/.test(ap)&&h===12)h=0;
      time=String(h).padStart(2,'0')+':'+mi;
    }else{
      const sh=spokenHour(text);
      if(sh){
        let h=sh;
        if(/م|مساء|الليل|ليلاً/.test(text)&&h<12)h+=12;
        if(/ص|صباح/.test(text)&&h===12)h=0;
        time=String(h).padStart(2,'0')+':00';
      }
    }
    if(/الظهر/.test(text))time='12:00';
    if(/العصر/.test(text)&&!time)time='16:00';
    if(/المغرب/.test(text)&&!time)time='18:00';
    eventAt=toOmanEpoch(date,time);
  }
  let reminders=parseOffsets(text);
  if(eventAt&&!reminders.length)reminders=[0];
  const title=text
    .replace(/^(يا\s+مُ?عين[،,]?\s*)/,'')
    .replace(/^(ذكرني|سجل لي|سجل|دوّن|دون|أضف|اضف)\s*/,'')
    .replace(/\s*و?\s*قبل(?:ها)?\s*(?:بيومين|بيوم|يومين|يوم|بساعتين|ساعتين|بساعة|ساعة|بنصف\s*ساعة|نصف\s*ساعة|بربع\s*ساعة|ربع\s*ساعة|\d+\s*دقائق?)/g,'')
    .trim();
  return {type,title:title||text,date,time,reminders,eventAt};
}
function reminderBody(title,offset){
  if(offset===0)return title;
  if(offset===15)return title+' — متبقي 15 دقيقة';
  if(offset===30)return title+' — متبقي نصف ساعة';
  if(offset===60)return title+' — متبقي ساعة';
  if(offset===120)return title+' — متبقي ساعتان';
  if(offset===1440)return title+' — متبقي يوم';
  if(offset===2880)return title+' — متبقي يومان';
  return title+' — متبقي '+offset+' دقيقة';
}

const FIREBASE_API_KEY='AIzaSyDZ5MYN5z1FiSVe9LoYXmER4NUUkW6C0us';
let schemaReady=false;
async function columns(env,table){
  const r=await env.DB.prepare('PRAGMA table_info('+table+')').all();
  return new Set((r.results||[]).map(x=>x.name));
}
async function ensureSchema(env){
  if(schemaReady)return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS shortcut_links (uid TEXT PRIMARY KEY,link_key TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS subscriptions (endpoint TEXT PRIMARY KEY,p256dh TEXT NOT NULL,auth TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)').run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY,text TEXT NOT NULL,type TEXT NOT NULL,title TEXT NOT NULL,event_at INTEGER,created_at INTEGER NOT NULL,source TEXT NOT NULL DEFAULT 'siri')").run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY,item_id TEXT NOT NULL,notify_at INTEGER NOT NULL,offset_minutes INTEGER NOT NULL DEFAULT 0,sent INTEGER NOT NULL DEFAULT 0,sent_at INTEGER,attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT)').run();

  const sc=await columns(env,'subscriptions');if(!sc.has('uid'))await env.DB.prepare('ALTER TABLE subscriptions ADD COLUMN uid TEXT').run();
  const ic=await columns(env,'items');if(!ic.has('uid'))await env.DB.prepare('ALTER TABLE items ADD COLUMN uid TEXT').run();
  const rc=await columns(env,'reminders');if(!rc.has('uid'))await env.DB.prepare('ALTER TABLE reminders ADD COLUMN uid TEXT').run();

  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_subscriptions_uid ON subscriptions(uid)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_items_uid_created ON items(uid,created_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(sent,notify_at)').run();
  schemaReady=true;
}
async function verifyFirebaseUser(req){
  const auth=req.headers.get('authorization')||'',m=auth.match(/^Bearer\s+(.+)$/i);
  if(!m)return null;
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+FIREBASE_API_KEY,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:m[1]})});
  if(!r.ok)return null;
  const data=await r.json().catch(()=>null),u=data&&data.users&&data.users[0];
  return u&&u.localId?{uid:u.localId,email:u.email||''}:null;
}
function newLinkKey(){const b=new Uint8Array(24);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('')}
async function getOrCreateLink(req,env){
  const user=await verifyFirebaseUser(req);if(!user)return json({ok:false,error:'unauthorized'},401);
  await ensureSchema(env);
  let row=await env.DB.prepare('SELECT link_key FROM shortcut_links WHERE uid=?').bind(user.uid).first(),key=row&&row.link_key;
  if(!key){key=newLinkKey();const now=Date.now();await env.DB.prepare('INSERT INTO shortcut_links(uid,link_key,created_at,updated_at) VALUES(?,?,?,?)').bind(user.uid,key,now,now).run()}
  return json({ok:true,endpoint:new URL(req.url).origin+'/api/command?key='+encodeURIComponent(key)});
}
async function uidForKey(env,key){
  await ensureSchema(env);if(!key)return null;
  const row=await env.DB.prepare('SELECT uid FROM shortcut_links WHERE link_key=?').bind(key).first();
  return row&&row.uid?row.uid:null;
}
function configureVapid(env){webpush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY)}
async function readCommandText(req){
  const url=new URL(req.url),q=url.searchParams.get('text');if(q)return String(q).trim();
  const ct=req.headers.get('content-type')||'';
  if(ct.includes('application/json')){const b=await req.json().catch(()=>null);return String((b&&b.text)||'').trim()}
  if(ct.includes('application/x-www-form-urlencoded')){const f=await req.formData();return String(f.get('text')||'').trim()}
  return String(await req.text().catch(()=>'' )).trim();
}
async function ingestCommand(req,env){
  const uid=await uidForKey(env,new URL(req.url).searchParams.get('key')||'');if(!uid)return json({ok:false,error:'unauthorized'},401);
  const text=await readCommandText(req);if(!text)return json({ok:false,error:'missing_text'},400);
  const parsed=parseCommand(text),id=randomId('item'),now=Date.now();
  await env.DB.prepare('INSERT INTO items (id,uid,text,type,title,event_at,created_at,source) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id,uid,text,parsed.type,parsed.title,parsed.eventAt,now,'siri').run();
  if(parsed.eventAt&&parsed.reminders.length)for(const offset of parsed.reminders){
    const notifyAt=parsed.eventAt-offset*60000;
    if(notifyAt>now-5*60000)await env.DB.prepare('INSERT INTO reminders (id,item_id,uid,notify_at,offset_minutes,sent) VALUES (?,?,?,?,?,0)')
      .bind(randomId('rem'),id,uid,notifyAt,offset).run();
  }
  await sendPushForUid(env,uid,{title:'مُعين',body:'تم الحفظ: '+parsed.title,itemId:id,tag:'mueen-save-'+id,url:'https://turkik69.github.io/Mueen/'});
  const spoken=parsed.eventAt
    ? 'تم حفظ '+(parsed.type==='reminder'?'التذكير':parsed.type==='event'?'الموعد':parsed.type==='idea'?'الفكرة':'المهمة')+' وجدولته بنجاح'
    : 'تم الحفظ في مُعين';
  const wantsText=new URL(req.url).searchParams.get('format')==='text'||(req.headers.get('accept')||'').includes('text/plain');
  if(wantsText)return new Response(spoken,{status:200,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  return json({ok:true,spoken,item:{id,...parsed}});
}
async function syncReminders(req,env){
  const user=await verifyFirebaseUser(req);if(!user)return json({ok:false,error:'unauthorized'},401);
  await ensureSchema(env);
  const body=await req.json().catch(()=>null),items=Array.isArray(body&&body.items)?body.items:[],now=Date.now();
  await env.DB.prepare("DELETE FROM reminders WHERE uid=? AND sent=0 AND item_id IN (SELECT id FROM items WHERE uid=? AND source='app')").bind(user.uid,user.uid).run();
  await env.DB.prepare("DELETE FROM items WHERE uid=? AND source='app'").bind(user.uid).run();
  for(const it of items){
    if(!it||!it.id||it.done||!it.date||!it.time||!Array.isArray(it.reminders)||!it.reminders.length)continue;
    const eventAt=toOmanEpoch(it.date,it.time);if(!eventAt)continue;
    const iid='app_'+String(it.id);
    await env.DB.prepare('INSERT INTO items (id,uid,text,type,title,event_at,created_at,source) VALUES (?,?,?,?,?,?,?,?)')
      .bind(iid,user.uid,String(it.title||''),String(it.type||'task'),String(it.title||''),eventAt,Date.parse(it.created||'')||now,'app').run();
    for(const off0 of it.reminders){
      const off=Number(off0);if(!Number.isFinite(off))continue;
      const notifyAt=eventAt-off*60000;
      if(notifyAt>now-5*60000)await env.DB.prepare('INSERT INTO reminders (id,item_id,uid,notify_at,offset_minutes,sent) VALUES (?,?,?,?,?,0)')
        .bind(randomId('rem'),iid,user.uid,notifyAt,off).run();
    }
  }
  return json({ok:true,synced:items.length});
}
async function listItems(req,env){
  const user=await verifyFirebaseUser(req);if(!user)return json({ok:false,error:'unauthorized'},401);
  await ensureSchema(env);
  const rows=await env.DB.prepare("SELECT i.id,i.text,i.type,i.title,i.event_at,i.created_at,GROUP_CONCAT(r.offset_minutes) AS offsets FROM items i LEFT JOIN reminders r ON r.item_id=i.id WHERE i.uid=? AND i.source='siri' GROUP BY i.id ORDER BY i.created_at ASC").bind(user.uid).all();
  const items=(rows.results||[]).map(r=>{
    const dt=omanPartsFromMs(Number(r.event_at)||0),reminders=r.offsets?String(r.offsets).split(',').map(Number).filter(Number.isFinite):[];
    return {id:r.id,type:r.type||'task',title:r.title||r.text||'',notes:'',date:dt.date,time:dt.time,priority:'normal',reminders:[...new Set(reminders)],done:false,created:new Date(Number(r.created_at)||Date.now()).toISOString(),source:'siri-cloudflare'};
  });
  return json({ok:true,items});
}
async function subscribe(req,env){
  const user=await verifyFirebaseUser(req);if(!user)return json({ok:false,error:'unauthorized'},401);
  await ensureSchema(env);
  const body=await req.json().catch(()=>null),s=body&&body.subscription;
  if(!s||!s.endpoint||!s.keys?.p256dh||!s.keys?.auth)return json({ok:false,error:'bad_subscription'},400);
  const now=Date.now();
  await env.DB.prepare('INSERT INTO subscriptions(endpoint,uid,p256dh,auth,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET uid=excluded.uid,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at')
    .bind(s.endpoint,user.uid,s.keys.p256dh,s.keys.auth,now,now).run();
  return json({ok:true});
}
async function sendPushForUid(env,uid,payload){
  await ensureSchema(env);
  let vapidError='';
  try{
    if(!env.VAPID_SUBJECT)throw new Error('VAPID_SUBJECT_MISSING');
    if(!env.VAPID_PUBLIC_KEY)throw new Error('VAPID_PUBLIC_KEY_MISSING');
    if(!env.VAPID_PRIVATE_KEY)throw new Error('VAPID_PRIVATE_KEY_MISSING');
    configureVapid(env);
  }catch(e){
    vapidError=String(e?.message||e||'VAPID_CONFIG_FAILED').replace(/\s+/g,' ').slice(0,180);
    return {ok:0,fail:0,count:0,lastStatus:0,lastError:'VAPID_CONFIG: '+vapidError};
  }

  const subs=await env.DB.prepare('SELECT endpoint,p256dh,auth FROM subscriptions WHERE uid=?').bind(uid).all();
  let ok=0,fail=0,lastError='',lastStatus=0;
  for(const sub of subs.results||[]){
    try{
      await webpush.sendNotification(
        {endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},
        JSON.stringify(payload),
        {TTL:3600,urgency:'high'}
      );
      ok++;
    }catch(e){
      fail++;
      lastStatus=e?.statusCode||0;
      lastError=String(e?.body||e?.message||e||'push_failed').replace(/\s+/g,' ').slice(0,180);
      if(lastStatus===404||lastStatus===410)await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(sub.endpoint).run();
    }
  }
  return {ok,fail,count:(subs.results||[]).length,lastStatus,lastError};
}
async function testMe(req,env){
  const user=await verifyFirebaseUser(req);if(!user)return json({ok:false,error:'unauthorized'},401);
  const result=await sendPushForUid(env,user.uid,{title:'مُعين',body:'اختبار خادم مُعين: الإشعارات الخارجية تعمل.',tag:'mueen-server-test',url:'https://turkik69.github.io/Mueen/'});
  if(result.ok<1)return json({ok:false,error:'NO_ACTIVE_PUSH',result},409);
  return json({ok:true,result});
}
async function processDue(env){
  await ensureSchema(env);const now=Date.now();
  const due=await env.DB.prepare('SELECT r.id,r.item_id,r.offset_minutes,i.title,i.uid FROM reminders r JOIN items i ON i.id=r.item_id WHERE r.sent=0 AND r.notify_at<=? AND i.uid IS NOT NULL ORDER BY r.notify_at ASC LIMIT 50').bind(now).all();
  for(const r of due.results||[]){
    try{
      const result=await sendPushForUid(env,r.uid,{title:'مُعين',body:reminderBody(r.title,Number(r.offset_minutes)||0),itemId:r.item_id,tag:'mueen-'+r.id,url:'https://turkik69.github.io/Mueen/?item='+encodeURIComponent(r.item_id)});
      if(result.ok>0)await env.DB.prepare('UPDATE reminders SET sent=1,sent_at=?,attempts=attempts+1,last_error=NULL WHERE id=?').bind(Date.now(),r.id).run();
      else await env.DB.prepare('UPDATE reminders SET attempts=attempts+1,last_error=? WHERE id=?').bind('no_active_subscription',r.id).run();
    }catch(e){await env.DB.prepare('UPDATE reminders SET attempts=attempts+1,last_error=? WHERE id=?').bind(String(e?.message||e).slice(0,500),r.id).run()}
  }
}
export default {
  async fetch(req,env){
    if(req.method==='OPTIONS')return cors(new Response(null,{status:204}));
    try{
      await ensureSchema(env);
      const url=new URL(req.url);let res;
      if(url.pathname==='/api/config'&&req.method==='GET')res=json({ok:true,vapidPublicKey:env.VAPID_PUBLIC_KEY});
      else if(url.pathname==='/api/link'&&req.method==='POST')res=await getOrCreateLink(req,env);
      else if(url.pathname==='/api/command'&&(req.method==='POST'||req.method==='GET'))res=await ingestCommand(req,env);
      else if(url.pathname==='/api/subscribe'&&req.method==='POST')res=await subscribe(req,env);
      else if(url.pathname==='/api/items'&&req.method==='POST')res=await listItems(req,env);
      else if(url.pathname==='/api/reminders/sync'&&req.method==='POST')res=await syncReminders(req,env);
      else if(url.pathname==='/api/test-me'&&req.method==='POST')res=await testMe(req,env);
      else if(url.pathname==='/health')res=json({ok:true,service:'mueen-reminders',version:'3.15'});
      else res=json({ok:false,error:'not_found'},404);
      return cors(res);
    }catch(e){
      return cors(json({ok:false,error:'WORKER_RUNTIME',detail:String(e?.message||e||'unknown').slice(0,180)},500));
    }
  },
  async scheduled(_event,env,ctx){ctx.waitUntil(processDue(env))}
};
