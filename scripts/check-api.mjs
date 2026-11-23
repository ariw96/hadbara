// בדיקה שבועית: האם המאגר הממשלתי עדיין זמין ובמבנה שהאתר מצפה לו
const API = 'https://data.gov.il/api/3/action/';
const RES_ID = 'cffe0c50-6856-4187-9315-51bc113cb718';
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
  const meta = await api('resource_show', { id: RES_ID });
  const mod = meta.last_modified || meta.metadata_modified;
  console.log('המאגר עודכן לאחרונה:', mod);
  const ageDays = (Date.now() - new Date(mod).getTime()) / 864e5;
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
if (problems.length) {
  console.error('\n❌ נמצאו בעיות:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\n✅ המאגר תקין');
