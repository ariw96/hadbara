// בדיקה שבועית: האם המאגר הממשלתי עדיין זמין ובמבנה שהאתר מצפה לו
const API = 'https://data.gov.il/api/3/action/';
const DATASET_ID = '673';
const RES_ID = 'cffe0c50-6856-4187-9315-51bc113cb718';          // הקובץ שהאתר קורא ממנו (כותרות בעברית)
const KNOWN = [RES_ID, '75722dd3-9da7-431b-9af5-401570fbc34c']; // קבצים מוכרים במאגר (כולל כותרות באנגלית)
import fs from 'fs';
const notes = [];   // עדכונים לידיעה (לא תקלה)
const REQUIRED = ['שם תכשיר','סוג פעילות','סוג תכשיר','חומר פעיל','קבוצת עמידות','טרגט קוד','ריכוז חומר פעיל','פורמולציה','דרגת רעילות','תווית','קבוצת גידולים','גידול','נגע','מינון ליישום','נפח ליישום','כניסה מחדש','תקופת המתנה','שלב גידול','גיל גידול','אופי הפעלה','הערה גידול'];
const problems = [];
async function api(action, body) {
  const r = await fetch(API + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(action + ': HTTP ' + r.status);
  const j = await r.json();
  if (!j.success) throw new Error(action + ': success=false');
  return j.result;
}
try {
  // 1. האם הועלה קובץ חדש למאגר, או שהקובץ שלנו הוסר
  const pkg = await api('package_show', { id: DATASET_ID });
  const res = pkg.resources || [];
  if (!res.some(r => r.id === RES_ID)) problems.push('הקובץ שהאתר קורא ממנו כבר לא מופיע במאגר – צריך לעדכן את RES_ID ב-index.html');
  for (const r of res.filter(r => !KNOWN.includes(r.id))) {
    problems.push(`הועלה קובץ חדש למאגר: "${r.name}" (מזהה ${r.id}, נוצר ${r.created}). צריך לבדוק אם הוא מחליף את הקובץ הנוכחי ולעדכן את RES_ID ב-index.html`);
  }
  console.log('קבצים במאגר:', res.map(r => r.name + ' [' + r.id + ']').join(' | '));

  // 2. מתי עודכנו הנתונים
  const meta = await api('resource_show', { id: RES_ID });
  const mod = meta.last_modified || meta.metadata_modified;
  console.log('המאגר עודכן לאחרונה:', mod);
  const modDate = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(mod) ? mod : mod + 'Z');
  if ((Date.now() - modDate.getTime()) / 864e5 <= 7) {
    notes.push(`המאגר עודכן ב-${modDate.toLocaleDateString('he-IL')}. האתר כבר מציג את הנתונים החדשים – כדאי לעבור על הגידולים העיקריים ולוודא שהכול נראה תקין.`);
  }
  const ageDays = (Date.now() - modDate.getTime()) / 864e5;
  if (ageDays > 120) problems.push(`המאגר לא עודכן ${Math.round(ageDays)} ימים`);

  const s = await api('datastore_search', { resource_id: RES_ID, limit: 1 });
  const fields = s.fields.map(f => f.id);
  const missing = REQUIRED.filter(f => !fields.includes(f));
  if (missing.length) problems.push('עמודות חסרות במאגר: ' + missing.join(', '));
  console.log('סה"כ שורות:', s.total);
  if (s.total < 10000) problems.push('מספר השורות נמוך באופן חשוד: ' + s.total);

  const t = await api('datastore_search', { resource_id: RES_ID, filters: { 'גידול': 'תפוח עץ' }, limit: 1 });
  console.log('שורות לתפוח עץ:', t.total);
  if (!t.total) problems.push('אין שורות לגידול "תפוח עץ" – ייתכן ששמות הגידולים השתנו');
} catch (e) {
  problems.push('שגיאה בגישה למאגר: ' + e.message);
}
// כתיבת סיכום לשלב פתיחת ה-Issue ב-GitHub
const out = process.env.GITHUB_OUTPUT;
if (out) {
  const today = new Date().toLocaleDateString('he-IL');
  if (problems.length) {
    fs.writeFileSync('issue.md', '### נמצאו בעיות בבדיקה השבועית\n\n- ' + problems.join('\n- ') + (notes.length ? '\n\n### לידיעה\n- ' + notes.join('\n- ') : ''));
    fs.appendFileSync(out, `issue_title=⚠️ בעיה במאגר תכשירי ההדברה (${today})\n`);
  } else if (notes.length) {
    fs.writeFileSync('issue.md', '- ' + notes.join('\n- '));
    fs.appendFileSync(out, `issue_title=🔄 המאגר הממשלתי עודכן (${today})\n`);
  }
}
if (notes.length) console.log('\nℹ️ ' + notes.join('\nℹ️ '));
if (problems.length) {
  console.error('\n❌ נמצאו בעיות:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\n✅ המאגר תקין');
