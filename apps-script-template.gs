const SPREADSHEET_ID = '1zB4qoZzF76SvNqrnkJJ_AOsFf_g_-EmAvOUtOLjPdCw';
// Замени на длинный личный ключ. Не публикуй реальный ключ в GitHub.
const SYNC_SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET';

function doGet(e) {
  const callback = (e && e.parameter && e.parameter.callback) || '';
  const key = (e && e.parameter && e.parameter.key) || '';
  const result = key === SYNC_SECRET ? {ok:true, data:getAll_()} : {ok:false, error:'unauthorized'};
  const body = callback ? `${callback}(${JSON.stringify(result)})` : JSON.stringify(result);
  return ContentService.createTextOutput(body).setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function doPost(e) {
  let p={};
  try { p=JSON.parse((e.postData&&e.postData.contents)||'{}'); }
  catch(err) { return json_({ok:false,error:'bad_json'}); }
  if (p.key !== SYNC_SECRET) return json_({ok:false,error:'unauthorized'});
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (p.action==='addTransaction') addTransaction_(p.transaction||{});
    else if (p.action==='deleteTransaction') deleteTransaction_(String(p.id||''));
    else if (p.action==='updateBudget') updateBudget_(String(p.category||''), Number(p.limit));
    else if (p.action==='setSetting') setSetting_(String(p.keyName||''), p.value);
    else return json_({ok:false,error:'unknown_action'});
    return json_({ok:true});
  } catch(err) { return json_({ok:false,error:String(err)}); }
  finally { lock.releaseLock(); }
}

function getAll_(){return {settings:getSettings_(),budgets:readObjects_('Бюджеты'),plans:readObjects_('Планы'),transactions:readObjects_('Операции').sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created_at).localeCompare(String(a.created_at)))}};
function ss_(){return SpreadsheetApp.openById(SPREADSHEET_ID);}
function sheet_(name){const s=ss_().getSheetByName(name);if(!s)throw new Error('Нет листа '+name);return s;}
function readObjects_(name){const s=sheet_(name),v=s.getDataRange().getValues();if(v.length<2)return[];const h=v[0].map(String);return v.slice(1).filter(r=>r.some(x=>x!==''&&x!==null)).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])));}
function getSettings_(){const out={};readObjects_('Настройки').forEach(r=>out[String(r.key)]=r.value);return out;}
function setSetting_(key,value){const s=sheet_('Настройки'),v=s.getDataRange().getValues();for(let i=1;i<v.length;i++)if(String(v[i][0])===key){s.getRange(i+1,2).setValue(value);return;}s.appendRow([key,value]);}
function budgetRow_(cat){const s=sheet_('Бюджеты'),v=s.getDataRange().getValues();for(let i=1;i<v.length;i++)if(String(v[i][0])===cat)return {sheet:s,row:i+1,limit:Number(v[i][1])||0,spent:Number(v[i][2])||0};return null;}
function updateBudget_(cat,limit){const b=budgetRow_(cat);if(!b)throw new Error('Категория не найдена');b.sheet.getRange(b.row,2).setValue(limit);}
function changeBudgetSpent_(cat,delta){const b=budgetRow_(cat);if(!b)return;b.sheet.getRange(b.row,3).setValue(Math.max(0,b.spent+delta));}
function changeDebt_(delta){const s=getSettings_(),cur=Number(s.current_debt)||0;setSetting_('current_debt',Math.max(0,cur+delta));}
function changeDebtPayments_(delta){const s=getSettings_(),cur=Number(s.debt_payments_month)||0;setSetting_('debt_payments_month',Math.max(0,cur+delta));}
function addTransaction_(t){const type=String(t.type||'expense'),amount=Math.abs(Number(t.amount)||0);if(!amount)throw new Error('Некорректная сумма');const id=Utilities.getUuid(),date=String(t.date||Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd')),cat=String(t.category||'Другое'),account=String(t.account||'Дебетовая'),note=String(t.note||cat),created=new Date().toISOString();sheet_('Операции').appendRow([id,date,type,cat,amount,account,note,created]);if(type==='expense'){changeBudgetSpent_(cat,amount);if(account==='Кредитка')changeDebt_(amount);}else if(type==='debt'){changeDebt_(-amount);changeDebtPayments_(amount);}}
function deleteTransaction_(id){const s=sheet_('Операции'),v=s.getDataRange().getValues();for(let i=1;i<v.length;i++){if(String(v[i][0])!==id)continue;const type=String(v[i][2]),cat=String(v[i][3]),amount=Math.abs(Number(v[i][4])||0),account=String(v[i][5]);if(type==='expense'){changeBudgetSpent_(cat,-amount);if(account==='Кредитка')changeDebt_(-amount);}else if(type==='debt'){changeDebt_(amount);changeDebtPayments_(-amount);}s.deleteRow(i+1);return;}throw new Error('Операция не найдена');}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
