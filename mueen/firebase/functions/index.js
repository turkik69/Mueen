const {onValueCreated} = require('firebase-functions/v2/database');
const {initializeApp} = require('firebase-admin/app');
const {getDatabase} = require('firebase-admin/database');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();

const APP_URL = 'https://turkik69.github.io/mueen/';
const APP_ICON = APP_URL + 'icon.svg';

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
