import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotifications, createReminderScheduler } from '../native/reminders.mjs';
const now = new Date('2026-10-16T10:00:00').getTime();
const item = { id: 'meeting', type: 'event', title: 'اجتماع التصميم', date: '2026-10-17', time: '20:00', reminders: [60, 0] };
test('schedules the pre-alert and appointment in device time with meaningful text', () => {
 const n = buildNotifications([item], now);
 assert.equal(n.length, 2); assert.equal(n[0].schedule.at.getHours(), 19);
 assert.match(n[0].body, /اجتماع التصميم.*بعد ساعة/); assert.match(n[1].body, /الآن/);
 assert.notEqual(n[0].id, n[1].id); assert.deepEqual(n.map(x => x.id), buildNotifications([item], now).map(x => x.id));
});
test('ignores completed, undated, ideas, duplicate offsets, past and invalid reminders', () => {
 assert.equal(buildNotifications([{...item, done:true},{...item,type:'idea'},{...item,date:''},{...item,date:'2020-01-01'}],now).length,0);
 assert.equal(buildNotifications([{...item,reminders:[60,60,-1,'0',null]}],now).length,1);
 assert.equal(buildNotifications([{...item, reminders:[]}],now).length,0);
});
test('respects iOS pending limit and schedules nearest first', () => {
 const a = Array.from({length:90},(_,i)=>({...item,id:String(i),time:`${String(10+Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}`,reminders:[0]}));
 const n=buildNotifications(a,now);assert.equal(n.length,60);assert.equal(new Set(n.map(x=>x.id)).size,60);
 for(let i=1;i<n.length;i++)assert.ok(n[i].schedule.at>=n[i-1].schedule.at);
});
test('save, complete, delete and rapid saves reconcile without stale or duplicate alerts', async () => {
 let pending=[];let schedules=0;const future={...item,date:'2099-10-17'};
 const plugin={checkPermissions:async()=>({display:'granted'}),getPending:async()=>({notifications:pending}),cancel:async({notifications})=>{pending=pending.filter(n=>!notifications.some(x=>x.id===n.id))},schedule:async({notifications})=>{schedules++;pending.push(...notifications)}};
 const sync=createReminderScheduler(plugin);
 await sync([future]);await sync([future]);assert.equal(schedules,1);assert.equal(pending.length,2);
 await Promise.all([sync([{...future,title:'اجتماع محدث'}]),sync([{...future,done:true}]),sync([])]);assert.equal(pending.length,0);
 await sync([future]);await sync([]);assert.equal(pending.length,0);
});
test('a plugin failure does not poison subsequent scheduling',async()=>{
 let fail=true;const sync=createReminderScheduler({checkPermissions:async()=>{if(fail){fail=false;throw new Error('temporarily unavailable')}return {display:'granted'}},getPending:async()=>({notifications:[]})});
 await assert.rejects(sync([]));assert.equal((await sync([])).count,0);
});
