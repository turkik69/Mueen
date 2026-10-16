const {test,expect}=require('@playwright/test');
for(const path of ['/', '/www/']){
 test(`core flow survives repeat dialogs, saves, deletes and reload: ${path}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // No real account or production data is used in UI tests.
  await page.route(/googleapis\.com|firebaseio\.com|firebasedatabase\.app|workers\.dev/,r=>r.abort());
  if(path==='/')await page.route('https://www.gstatic.com/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await page.goto('http://127.0.0.1:4173'+path);
  await expect(page.locator('#hello')).toHaveText('أهلًا بك في مُعين');
  await expect(page.locator('#msgs')).not.toContainText('تركي');
  for(let i=0;i<3;i++){
   await page.locator('[data-add="idea"]').first().click();await expect(page.locator('#dlg')).toBeVisible();
   await page.locator('#dlg [aria-label="إغلاق"]').click();await expect(page.locator('#dlg')).not.toBeVisible();
  }
  await page.locator('[data-add="task"]').first().click();await page.locator('#title').fill('مهمة اختبار الهاتف');await page.locator('#form .primary').click();
  await expect(page.locator('#homeList')).toContainText('مهمة اختبار الهاتف');
  await page.reload();await expect(page.locator('#homeList')).toContainText('مهمة اختبار الهاتف');
  await page.locator('#homeList [data-done]').click();await expect(page.locator('#homeList .item')).toHaveClass(/done/);
  await page.locator('#homeList [data-del]').click();await expect(page.locator('#homeList')).not.toContainText('مهمة اختبار الهاتف');
  await page.locator('#accountBtn').click();await expect(page.locator('#accountDlg')).toBeVisible();await page.locator('#closeAccount').click();await expect(page.locator('#accountDlg')).not.toBeVisible();
  for(const view of ['today','ideas','calendar','assistant','home']){const b=page.locator(`.nav [data-view="${view}"]`);if(await b.count())await b.click();}
  expect(errors).toEqual([]);
 });
}
test('new account name appears only after registration and disappears on logout',async({page})=>{
 await page.route('https://www.gstatic.com/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 await page.route('**/firebase-adapter.js?v=45',r=>r.fulfill({contentType:'text/javascript',body:`window.MueenFirebase={
   init:async(_items,_remote,_shortcut,onAccount)=>{window.accountChanged=onAccount;onAccount(null)},
   register:async name=>{document.querySelector('#loginBox').hidden=true;document.querySelector('#userBox').hidden=false;window.accountChanged({displayName:name});return {}},
   logout:async()=>{document.querySelector('#loginBox').hidden=false;document.querySelector('#userBox').hidden=true;window.accountChanged(null)},
   get user(){return null}
 };`}));
 await page.goto('http://127.0.0.1:4173/');
 await expect(page.locator('#hello')).toHaveText('أهلًا بك في مُعين');
 await expect(page.locator('#msgs')).toContainText('مرحبًا. أنا مُعين');
 await page.locator('#accountBtn').click();
 await page.locator('[data-auth-tab="register"]').click();
 await page.locator('#regEmail').fill('example@example.com');
 await page.locator('#regPassword').fill('example123');
 await page.locator('#registerSubmit').click();
 await expect(page.locator('#hello')).toHaveText('أهلًا بك في مُعين');
 await page.locator('#regName').fill('فاطمة');
 await page.locator('#registerSubmit').click();
 await expect(page.locator('#hello')).toContainText('فاطمة');
 await expect(page.locator('#msgs')).toContainText('مرحبًا فاطمة');
 await page.locator('#accountBtn').click();
 await page.locator('#logoutBtn').click();
 await expect(page.locator('#hello')).toHaveText('أهلًا بك في مُعين');
 await expect(page.locator('#msgs')).toContainText('مرحبًا. أنا مُعين');
 await page.reload();
 await expect(page.locator('#hello')).toHaveText('أهلًا بك في مُعين');
});
test('native integration uses device notifications and speech, cancels on deletion',async({page})=>{
 await page.route('https://www.gstatic.com/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 await page.addInitScript(()=>{
  window.nativeCalls=[];
  window.MueenNative={isNative:true,syncReminders:items=>{window.nativeCalls.push({type:'sync',items:JSON.parse(JSON.stringify(items))});return Promise.resolve()},enableNotifications:async()=>{window.nativeCalls.push({type:'enable'})},recognize:async()=>'ذكرني غدا الساعة 8 مساء عندي اجتماع التصميم'};
 });
 await page.goto('http://127.0.0.1:4173/');
 await page.locator('#notify').click();await page.locator('#mic').click();
 await expect(page.locator('#speech')).toHaveText('جاهز');
 let calls=await page.evaluate(()=>window.nativeCalls);
 expect(calls.some(c=>c.type==='enable')).toBe(true);
 const saved=calls.filter(c=>c.type==='sync').at(-1).items;
 expect(saved).toHaveLength(1);expect(saved[0].title).toContain('اجتماع التصميم');expect(saved[0].time).toBe('20:00');
 await page.locator('.nav [data-view="calendar"]').click();
 await page.locator('#calList [data-del]').click();
 calls=await page.evaluate(()=>window.nativeCalls);expect(calls.filter(c=>c.type==='sync').at(-1).items).toHaveLength(0);
 expect(await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});
