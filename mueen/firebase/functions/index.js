const {onValueCreated} = require('firebase-functions/v2/database');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {initializeApp} = require('firebase-admin/app');
const {getDatabase} = require('firebase-admin/database');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();

const APP_URL = 'https://turkik69.github.io/Mueen/';
const APP_ICON = APP_URL + 'icon.svg';


function omanDate(offsetDays=0){
  const d=new Date(Date.now()+offsetDays*86400000);
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((o,x)=>(o[x.type]=x.value,o),{});
  return p.year+'-'+p.month+'-'+p.day;
}
function parseSiri(text){
  let date='',time='',type=/فكر|ملاحظة|ملاحظه/.test(text)?'idea':(/موعد|اجتماع|مناسبة|زيارة|عندي/.test(text)?'event':'reminder');
  if(/بعد بكرة|بعد غد/.test(text))date=omanDate(2);else if(/بكرة|غد/.test(text))date=omanDate(1);else if(/اليوم/.test(text))date=omanDate(0);
  const tm=text.match(/(?:الساعة|الساعه)\s*(\d{1,2})(?::(\d{2}))?\s*(ص|صباح|م|مساء)?/);
  if(tm){let h=+tm[1],mi=tm[2]||'00';if((tm[3]==='م'||tm[3]==='مساء')&&h<12)h+=12;if((tm[3]==='ص'||tm[3]==='صباح')&&h===12)h=0;time=String(h).padStart(2,'0')+':'+mi}
  let reminders=[];if(/قبل(?:ها)?\s*(?:بيومين|يومين)/.test(text))reminders.push(2880);if(/قبل(?:ها)?\s*(?:بيوم|يوم)(?!ين)/.test(text))reminders.push(1440);if(/قبل(?:ها)?\s*(?:بساعتين|ساعتين)/.test(text))reminders.push(120);if(/قبل(?:ها)?\s*(?:بساعة|ساعة)(?!تين)/.test(text))reminders.push(60);if((type==='reminder'||type==='event')&&date&&time&&!reminders.length)reminders=[0];
  return {id:Date.now()+Math.random().toString(16).slice(2),type,title:text.replace(/^(يا\s+مُ?عين[،,]?\s*)/,'').replace(/^(ذكرني|سجل|دوّن|دون)\s*/,'').trim(),notes:'',date,time,priority:'normal',reminders,done:false,created:new Date().toISOString(),source:'siri'};
}
exports.mueenShortcutIngest = onValueCreated({ref:'/mueen/users/{uid}/shortcutInbox/{commandId}',region:'europe-west1'},async event=>{
  const uid=String(event.params.uid||''), commandId=String(event.params.commandId||''), row=event.data.val()||{}, text=String(row.text||'').trim();
  if(!uid||!commandId||!text)return;
  const db=getDatabase(), item=parseSiri(text); item.sourceCommandId=commandId;
  await db.ref('/mueen/users/'+uid+'/items').transaction(v=>{const a=Array.isArray(v)?v:[];if(!a.some(x=>x&&x.sourceCommandId===commandId))a.push(item);return a});
  await event.data.ref.remove();
});

exports.mueenPushDispatch = onValueCreated({
  ref: '/mueen/users/{uid}/pushQueue/{messageId}',
  region: 'europe-west1'
}, async (event) => {
  const uid = String(event.params.uid || '');
  const messageId = String(event.params.messageId || '');
  const msg = event.data.val();

  if (!uid || !messageId || !msg || !msg.body) return;

  const db = getDatabase();
  const snap = await db.ref('/mueen/users/' + uid + '/pushTokens').once('value');
  const rows = snap.val() || {};
  const entries = Object.entries(rows).filter(([,v]) => v && v.token);

  if (!entries.length) {
    await event.data.ref.update({status:'no-devices',processedAt:Date.now()});
    return;
  }

  const title = String(msg.title || 'مُعين').slice(0,120);
  const body = String(msg.body || '').slice(0,500);
  const messaging = getMessaging();
  let successCount = 0;
  let failureCount = 0;
  const invalidKeys = [];

  for (let i=0;i<entries.length;i+=500) {
    const batch = entries.slice(i,i+500);
    const response = await messaging.sendEachForMulticast({
      tokens: batch.map(([,v]) => v.token),
      notification: {title, body},
      data: {
        title, body, messageId,
        type: String(msg.type || 'reminder'),
        itemId: String(msg.itemId || ''),
        url: APP_URL
      },
      webpush: {
        notification: {icon:APP_ICON,badge:APP_ICON,tag:'mueen-'+messageId,renotify:true},
        fcmOptions: {link: APP_URL}
      }
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
    response.responses.forEach((r,idx)=>{
      const code=r.error && r.error.code;
      if(!r.success && (code==='messaging/registration-token-not-registered'||code==='messaging/invalid-registration-token')) invalidKeys.push(batch[idx][0]);
    });
  }

  const updates = {};
  invalidKeys.forEach(k => updates['/mueen/users/'+uid+'/pushTokens/'+k] = null);
  updates['/mueen/users/'+uid+'/pushQueue/'+messageId+'/status'] = successCount ? 'sent' : 'failed';
  updates['/mueen/users/'+uid+'/pushQueue/'+messageId+'/processedAt'] = Date.now();
  updates['/mueen/users/'+uid+'/pushQueue/'+messageId+'/successCount'] = successCount;
  updates['/mueen/users/'+uid+'/pushQueue/'+messageId+'/failureCount'] = failureCount;
  await db.ref().update(updates);
});
