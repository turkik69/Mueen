(function(){
  const firebaseConfig={
    apiKey:"AIzaSyDZ5MYN5z1FiSVe9LoYXmER4NUUkW6C0us",
    authDomain:"fitness-coach-21b40.firebaseapp.com",
    databaseURL:"https://fitness-coach-21b40-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:"fitness-coach-21b40",
    storageBucket:"fitness-coach-21b40.firebasestorage.app",
    messagingSenderId:"162393884721",
    appId:"1:162393884721:web:d0d5768c827b997c322d10"
  };
  const CLOUDFLARE_WORKER="https://mueen-reminders.turki-k69.workers.dev";
  let app,auth,db,currentUser=null,onRemote=null,onShortcut=null,started=false;
  const qs=s=>document.querySelector(s);
  function state(text,ok=false){const e=qs('#cloudState');if(e){e.textContent=text;e.dataset.ok=ok?'1':'0'}}
  function safe(v){return JSON.parse(JSON.stringify(v||[]))}

  async function init(localItems,remoteCb,shortcutCb){
    onRemote=remoteCb;onShortcut=shortcutCb;
    try{
      if(!window.firebase){state('وضع محلي');return;}
      app=firebase.apps.length?firebase.app():firebase.initializeApp(firebaseConfig);
      auth=firebase.auth(); db=firebase.database();
      try{await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)}catch(e){console.warn('auth persistence',e)}
      auth.onAuthStateChanged(async user=>{
        currentUser=user||null; updateAccountUI();
        if(user){
          state('متصل بالسحابة',true); localStorage.setItem('mueen_logged_in','1');
          await mergeInitial(localItems||[]); subscribeRemote();
          try{await syncCloudItems()}catch(e){console.warn('cloud items sync',e)}
          await restorePushIfGranted();
        }else{
          localStorage.removeItem('mueen_logged_in'); state('غير مسجل');
        }
      });
      started=true; updateAccountUI();
    }catch(e){console.error(e);state('وضع محلي')}
  }

  async function mergeInitial(localItems){
    if(!currentUser)return;
    const ref=db.ref('mueen/users/'+currentUser.uid+'/items');
    const snap=await ref.once('value');
    const remote=snap.val();
    if(remote && Array.isArray(remote)){ if(onRemote)onRemote(remote); }
    else if(localItems.length){ await ref.set(safe(localItems)); }
  }
  function subscribeRemote(){
    if(!currentUser)return;
    db.ref('mueen/users/'+currentUser.uid+'/items').off();
    db.ref('mueen/users/'+currentUser.uid+'/items').on('value',s=>{
      const v=s.val(); if(Array.isArray(v)&&onRemote)onRemote(v);
    });
  }

  async function getShortcutSetup(){
    if(!currentUser)throw new Error('LOGIN_REQUIRED');
    const idToken=await currentUser.getIdToken();
    const res=await fetch(CLOUDFLARE_WORKER+'/api/link',{
      method:'POST',
      headers:{'authorization':'Bearer '+idToken}
    });
    if(!res.ok)throw new Error('SHORTCUT_LINK_FAILED');
    const data=await res.json();
    return {uid:currentUser.uid,endpoint:data.endpoint,token:''};
  }

  async function getAccountState(){
    if(!currentUser)return {loggedIn:false,pushEnabled:false};
    return {loggedIn:true,pushEnabled:localStorage.getItem('mueen_push_enabled')==='1',user:currentUser};
  }

  async function syncCloudItems(){
    if(!currentUser)return {ok:false,error:'LOGIN_REQUIRED'};
    const idToken=await currentUser.getIdToken();
    const res=await fetch(CLOUDFLARE_WORKER+'/api/items',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+idToken},
      body:'{}'
    });
    if(!res.ok){
      if(res.status===401)throw new Error('CLOUD_AUTH_FAILED');
      throw new Error('CLOUD_SYNC_FAILED');
    }
    const data=await res.json();
    const incoming=Array.isArray(data.items)?data.items:[];
    const ref=db.ref('mueen/users/'+currentUser.uid+'/items');
    const snap=await ref.once('value');
    const current=Array.isArray(snap.val())?snap.val():[];
    const byId=new Map(current.filter(Boolean).map(x=>[String(x.id),x]));
    let changed=false;
    for(const x of incoming){
      if(!x||!x.id)continue;
      const key=String(x.id);
      if(!byId.has(key)){byId.set(key,x);changed=true}
    }
    const merged=[...byId.values()];
    if(changed)await ref.set(safe(merged));
    if(onRemote)onRemote(merged);
    return {ok:true,count:incoming.length,added:changed};
  }

  // يزامن تذكيرات التطبيق العادية مع جدولة الإرسال بالـ Worker — بدون هذا
  // أي تذكير تسوّينه من داخل مُعين نفسه ما يوصله Push وقت إغلاق التطبيق.
  // لا ننتظر نتيجتها من save() عشان ما نوقف الحفظ المحلي لو تأخر الـ Worker.
  async function syncReminderSchedule(items){
    if(!currentUser)return;
    try{
      const idToken=await currentUser.getIdToken();
      await fetch(CLOUDFLARE_WORKER+'/api/reminders/sync',{
        method:'POST',
        headers:{'content-type':'application/json','authorization':'Bearer '+idToken},
        body:JSON.stringify({items:safe(items)})
      });
    }catch(e){console.warn('reminder schedule sync',e)}
  }

  async function syncItems(items){
    if(!started||!currentUser)return false;
    try{
      await db.ref('mueen/users/'+currentUser.uid+'/items').set(safe(items));
      syncReminderSchedule(items);
      return true;
    }catch(e){console.error(e);return false}
  }

  async function login(email,password){return auth.signInWithEmailAndPassword(email,password)}
  async function register(name,email,password){
    const c=await auth.createUserWithEmailAndPassword(email,password);
    if(name)await c.user.updateProfile({displayName:name});
    await db.ref('mueen/users/'+c.user.uid+'/profile').update({name:name||'',email,createdAt:Date.now()});
    return c;
  }
  async function logout(){if(auth)await auth.signOut()}
  async function reset(email){return auth.sendPasswordResetEmail(email)}

  function updateAccountUI(){
    const b=qs('#accountBtn'),name=qs('#accountName'),email=qs('#accountEmail'),loginBox=qs('#loginBox'),userBox=qs('#userBox');
    if(currentUser){
      if(b)b.textContent='👤';
      if(name)name.textContent=currentUser.displayName||'مستخدم مُعين';
      if(email)email.textContent=currentUser.email||'';
      if(loginBox)loginBox.hidden=true;if(userBox)userBox.hidden=false;
    }else{
      if(b)b.textContent='◎'; if(loginBox)loginBox.hidden=false;if(userBox)userBox.hidden=true;
    }
  }

  function b64ToUint8Array(base64String){
    const padding='='.repeat((4-base64String.length%4)%4);
    const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);const out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
    return out;
  }

  async function savePushToken(showTest=false){
    if(!currentUser)throw new Error('LOGIN_REQUIRED');
    if(!('Notification' in window))throw new Error('NO_NOTIFICATION');
    if(!('serviceWorker' in navigator))throw new Error('NO_SW');

    const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
    await reg.update().catch(()=>{});
    const ready=await navigator.serviceWorker.ready;

    const cfgRes=await fetch(CLOUDFLARE_WORKER+'/api/config',{cache:'no-store'});
    if(!cfgRes.ok)throw new Error('PUSH_CONFIG_FAILED');
    const cfg=await cfgRes.json();
    if(!cfg.vapidPublicKey)throw new Error('VAPID_REQUIRED');

    let sub=await ready.pushManager.getSubscription();
    if(sub){
      const currentKey=sub.options&&sub.options.applicationServerKey;
      const desired=b64ToUint8Array(cfg.vapidPublicKey);
      let same=!!currentKey&&currentKey.byteLength===desired.byteLength;
      if(same){
        const a=new Uint8Array(currentKey);
        for(let i=0;i<a.length;i++){if(a[i]!==desired[i]){same=false;break}}
      }
      if(!same){await sub.unsubscribe().catch(()=>{});sub=null}
    }
    if(!sub){
      sub=await ready.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:b64ToUint8Array(cfg.vapidPublicKey)
      });
    }

    const idToken=await currentUser.getIdToken();
    const response=await fetch(CLOUDFLARE_WORKER+'/api/subscribe',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+idToken},
      body:JSON.stringify({subscription:sub.toJSON()})
    });
    if(!response.ok)throw new Error('PUSH_SUBSCRIBE_FAILED');

    localStorage.setItem('mueen_push_enabled','1');
    updatePushUI(true);
    if(showTest){
      try{await ready.showNotification('مُعين',{body:'تم تفعيل إشعارات مُعين على هذا الجهاز.',icon:'./icon.svg',badge:'./icon.svg',tag:'mueen-push-test'})}catch(e){}
    }
    return sub;
  }

  function updatePushUI(on){
    const b=qs('#enablePush');
    if(!b)return;
    b.textContent=on?'الإشعارات مفعلة':'تفعيل الإشعارات';
    b.disabled=!!on;
  }

  async function restorePushIfGranted(){
    try{
      const granted=('Notification' in window)&&Notification.permission==='granted';
      if(granted){updatePushUI(false);await savePushToken(false);}
      else{localStorage.removeItem('mueen_push_enabled');updatePushUI(false);}
    }catch(e){
      console.warn('restore push',e);
      localStorage.removeItem('mueen_push_enabled');
      updatePushUI(false);
    }
  }

  async function enablePush(){
    if(!currentUser)throw new Error('LOGIN_REQUIRED');
    if(!('Notification' in window))throw new Error('NO_NOTIFICATION');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('DENIED');
    return savePushToken(true);
  }

  window.MueenFirebase={init,syncItems,login,register,logout,reset,enablePush,getShortcutSetup,getAccountState,syncCloudItems,get user(){return currentUser}};
})();
