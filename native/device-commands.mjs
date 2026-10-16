const digits = text => String(text).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

export function parseDeviceCommand(input) {
  const text = digits(input).replace(/[ًٌٍَُِّْـ]/g, '').trim().replace(/^(?:يا\s+)?معين[،,]?\s*/, '');
  if (!/^ذكرني/.test(text) && /منبه|المنبه/.test(text)) {
    const time = text.match(/(?:الساعة|الساعه)\s*(\d{1,2})(?::(\d{1,2}))?\s*(صباحا?|الصباح|ص|مساء?|المساء|م|الليل|ليلا)?/);
    if (!time) return { type: 'alarm', error: 'حدد وقت المنبّه، مثل: الساعة 5 مساءً' };
    let hour = Number(time[1]), minute = Number(time[2] || 0);
    const period = time[3] || '';
    if (minute > 59 || hour > 23 || (period && (hour < 1 || hour > 12))) return { type: 'alarm', error: 'وقت المنبّه غير صحيح' };
    if (hour <= 12 && !period) return { type: 'alarm', error: 'حدد صباحًا أو مساءً للمنبّه' };
    if (/مساء|الليل|^م$/.test(period) && hour < 12) hour += 12;
    if (/صباح|^ص$/.test(period) && hour === 12) hour = 0;
    return { type: 'alarm', hour, minute };
  }
  const call = text.match(/^(?:اتصل|دق)(?:\s+لي)?\s+(?:ب|على|في)\s+(.+?)(?:\s+(?:الحين|الان|الآن|اللحين|دحين))?$/);
  if (call) {
    const name = call[1].replace(/[،.؟!?]+$/g, '').trim();
    return { type: 'call', name, ...(name ? {} : { error: 'اذكر اسم جهة الاتصال' }) };
  }
  return null;
}
