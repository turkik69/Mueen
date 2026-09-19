(function(){
  const firebaseConfig={
    apiKey:"AIzaSyBsnryD1ZtvjzumatCCVN-QpRAMR4_IG7M",
    authDomain:"world-cup-2026-d3091.firebaseapp.com",
    databaseURL:"https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:"world-cup-2026-d3091",
    storageBucket:"world-cup-2026-d3091.firebasestorage.app",
    messagingSenderId:"830204361101",
    appId:"1:830204361101:web:f3a23c0fa41bb809d365c4",
    measurementId:"G-4Y1R6PW3SL"
  };
  const VAPID="BJ0U0e4v5iNhSHtKFRgqRF5MX9-9hWgV-cS2Drc75c9MCb0--JvP5LmqU4_JJn6RoIRwalaHnT-T46PE19XUaZM";
  let app,auth,db,messaging,currentUser=null,onRemote=null,started=false;
  const qs=s=>document.querySelector(s);
  function state(text,ok=false){const e=qs('#cloudState');if(e){e.textContent=text;e.dataset.ok=ok?'1':'0'}}
  function safe(v){return JSON.parse(JSON.stringify(v||[]))}
  async function init(localItems,remoteCb){
    onRemote=remoteCb;
    try{
      if(!window.firebase){state('وضع محلي');return;}
      app=firebase.apps.length?firebase.app():firebase.initializeApp(firebaseConfig);
      auth=firebase.auth(); db=firebase.database();
      try{messaging=firebase.messaging()}catch(e){}
      auth.onAuthStateChanged(async user=>{
        currentUser=user||null; updateAccountUI();
        if(user){state('متصل بالسحابة',true); await mergeInitial(localItems||[]); subscribeRemote();}
        else state('غير مسجل');
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
  async function syncItems(items){
    if(!started||!currentUser)return false;
    try{await db.ref('mueen/users/'+currentUser.uid+'/items').set(safe(items));return true}catch(e){console.error(e);return false}
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
  async function enablePush(){
    if(!currentUser)throw new Error('LOGIN_REQUIRED');
    if(!messaging)throw new Error('NO_MESSAGING');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('DENIED');
    const reg=await navigator.serviceWorker.register('./firebase-messaging-sw.js');
    const token=await messaging.getToken({vapidKey:VAPID,serviceWorkerRegistration:reg});
    await db.ref('mueen/users/'+currentUser.uid+'/pushTokens/'+encodeURIComponent(token)).set({token,updatedAt:Date.now(),platform:navigator.platform||'web'});
    return token;
  }
  window.MueenFirebase={init,syncItems,login,register,logout,reset,enablePush,get user(){return currentUser}};
})();