import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Keyboard } from '@capacitor/keyboard';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { createReminderScheduler } from './reminders.mjs';

const isNative = Capacitor.isNativePlatform();
const DeviceActions = registerPlugin('DeviceActions');
const ENABLED = 'mueen_native_notifications_enabled';
const readItems = () => JSON.parse(localStorage.getItem('mueen_v1_items') || '[]');
const sync = createReminderScheduler(LocalNotifications);
const notify = text => { if (typeof window.toast === 'function') window.toast(text); };
let speechBusy = false;
let channelReady;
let remindersSuspended = false;
async function ensureChannel() {
  if (Capacitor.getPlatform() !== 'android') return;
  if (!channelReady) channelReady = LocalNotifications.createChannel({ id: 'mueen-reminders', name: 'تذكيرات مُعين', description: 'المواعيد والتذكيرات المسبقة', importance: 4, visibility: 0, vibration: true }).catch(error => { channelReady = null; throw error; });
  await channelReady;
}
async function syncReminders(items) {
  if (!isNative || remindersSuspended || localStorage.getItem(ENABLED) !== '1') return;
  try { await ensureChannel(); return await sync(items); }
  catch (error) { console.error('Native reminders', error); notify('حُفظت بياناتك، لكن تعذرت جدولة إشعارات الجهاز. أعد تفعيل الإشعارات.'); }
}
async function enableNotifications() {
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') throw new Error('DENIED');
  await ensureChannel();
  remindersSuspended = false;
  localStorage.setItem(ENABLED, '1');
  await sync(readItems());
  await LocalNotifications.schedule({ notifications: [{ id: 90001, title: 'مُعين', body: 'إشعارات الجهاز جاهزة. سأذكّرك بمواعيدك المحفوظة هنا.', schedule: { at: new Date(Date.now() + 5000) }, channelId: 'mueen-reminders' }] });
  return { enabled: true };
}
async function notificationState() {
  return localStorage.getItem(ENABLED) === '1' && (await LocalNotifications.checkPermissions()).display === 'granted';
}
async function clearReminders() {
  remindersSuspended = true;
  // Use the same queue as saves, so a finishing save cannot restore logged-out reminders.
  await sync([]);
  await LocalNotifications.cancel({ notifications: [{ id: 90001 }] });
  localStorage.removeItem(ENABLED);
}
async function recognize() {
  if (speechBusy) return '';
  speechBusy = true;
  let timeout;
  try {
    if (!(await SpeechRecognition.available()).available) throw new Error('SPEECH_UNAVAILABLE');
    const permission = await SpeechRecognition.requestPermissions();
    if (permission.speechRecognition !== 'granted') throw new Error('SPEECH_DENIED');
    if (Capacitor.getPlatform() === 'ios') return await recognizeIOS();
    const result = await Promise.race([
      SpeechRecognition.start({ language: 'ar-SA', maxResults: 1, partialResults: false, popup: true, prompt: 'تحدث إلى مُعين' }),
      new Promise((_, reject) => { timeout = setTimeout(() => { SpeechRecognition.stop().catch(() => {}); reject(new Error('SPEECH_TIMEOUT')); }, 25000); })
    ]);
    return (result.matches?.[0] || '').trim();
  } finally { clearTimeout(timeout); speechBusy = false; }
}
async function recognizeIOS() {
  let partial, state, quietTimer, deadline, finish;
  let text = '', settled = false;
  const result = new Promise((resolve, reject) => {
    finish = (error) => { if (settled) return; settled = true; clearTimeout(quietTimer); clearTimeout(deadline); if (error && !text) reject(error); else resolve(text); };
  });
  try {
    partial = await SpeechRecognition.addListener('partialResults', data => {
      if (settled) return;
      text = (data.matches?.[0] || '').trim();
      clearTimeout(quietTimer);
      if (text) quietTimer = setTimeout(() => finish(), 1600);
    });
    state = await SpeechRecognition.addListener('listeningState', data => { if (data.status === 'stopped') finish(); });
    deadline = setTimeout(() => finish(new Error('SPEECH_TIMEOUT')), 25000);
    await SpeechRecognition.start({ language: 'ar-SA', maxResults: 1, partialResults: true });
    return await result;
  } finally {
    settled = true; clearTimeout(quietTimer); clearTimeout(deadline);
    await partial?.remove(); await state?.remove();
    await SpeechRecognition.stop().catch(() => {});
  }
}
window.MueenNative = {
  isNative, syncReminders, enableNotifications, notificationState, clearReminders, recognize,
  platform: Capacitor.getPlatform(),
  setAlarm: ({ hour, minute }) => DeviceActions.setAlarm({ hour, minute }),
  callContact: ({ name }) => DeviceActions.callContact({ name })
};

if (isNative) document.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.classList.add('native-app');
  const style = document.createElement('style');
  style.textContent = `html{background:#F7F0EA}body{overscroll-behavior-y:none}.app{padding-top:0}.top{height:calc(86px + env(safe-area-inset-top));padding-top:env(safe-area-inset-top)}.nav{bottom:0;width:min(100%,720px);height:calc(72px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:#FFF9F5;backdrop-filter:none;-webkit-backdrop-filter:none;border-radius:20px 20px 0 0}.sheet{max-height:85dvh;overflow-y:auto;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.account-overlay{padding-top:calc(18px + env(safe-area-inset-top));padding-bottom:calc(18px + env(safe-area-inset-bottom))}.account-dialog{max-height:85dvh;overflow-y:auto}input,select,textarea,.composer input,.search{font-size:16px}.chat{height:calc(100dvh - 200px - env(safe-area-inset-top) - env(safe-area-inset-bottom));min-height:280px}`;
  document.head.append(style);
  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', () => { if (typeof window.go === 'function') window.go('today', document.querySelector('[data-view="today"]')); });
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        syncReminders(readItems());
        window.MueenFirebase?.syncCloudItems().catch(console.warn);
      } else if (speechBusy) SpeechRecognition.stop().catch(() => {});
    });
    if (Capacitor.getPlatform() === 'android') {
      await App.addListener('backButton', () => {
        const dialog = document.querySelector('dialog[open]');
        if (dialog) return dialog.close();
        if (!document.querySelector('#accountDlg').hidden) return window.closeAccount();
        if (!document.querySelector('#home').classList.contains('on')) return window.go('home', document.querySelector('[data-view="home"]'));
        App.minimizeApp();
      });
    }
    await Keyboard.addListener('keyboardWillShow', () => { document.querySelector('.nav').style.display = 'none'; });
    await Keyboard.addListener('keyboardWillHide', () => { document.querySelector('.nav').style.display = ''; });
    if (Capacitor.getPlatform() === 'android') {
      const exact = await LocalNotifications.checkExactNotificationSetting();
      if (exact.exact_alarm !== 'granted') {
        const control = document.createElement('button'); control.className = 'ghost';
        control.textContent = 'السماح بدقة توقيت التنبيهات'; control.style.marginTop = '8px';
        control.onclick = () => LocalNotifications.changeExactNotificationSetting().catch(console.warn);
        document.querySelector('#userBox').append(control);
      }
    }
    await syncReminders(readItems());
  } catch (error) { console.warn('Native setup', error); }
});
