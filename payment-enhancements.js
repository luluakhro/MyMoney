/* MyMoney payment enhancements v2 */
(function(){
  if(window.__MYMONEY_PAYMENTS_V2__) return;
  window.__MYMONEY_PAYMENTS_V2__=true;

  const style=document.createElement('style');
  style.textContent=`
    .pay-split{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-top:14px}
    .pay-col{min-width:0}
    .pay-title{font-size:11px;color:#71818b;letter-spacing:.8px;text-transform:uppercase;margin:0 0 10px}
    .pay-list{display:grid;gap:9px}
    .pay-card{background:#0a1217;border:1px solid #1a2930;border-radius:13px;padding:13px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 14px;align-items:center}
    .pay-card.due{border-color:#315239;background:linear-gradient(180deg,#0d1714,#0a1210)}
    .pay-card.overdue{border-color:#604231;background:linear-gradient(180deg,#18110d,#0d0d0c)}
    .pay-card.paid{opacity:.75}
    .pay-date{font-size:10px;color:#788991;text-transform:uppercase;letter-spacing:.45px}
    .pay-name{font-size:13px;font-weight:700;margin-top:3px}
    .pay-amount{font-size:16px;font-weight:850;text-align:right}
    .pay-status{font-size:10px;color:#7f909a;margin-top:4px}
    .pay-status.good{color:#63e783}.pay-status.warn{color:#ffad69}
    .pay-action{grid-column:1/-1;display:flex;justify-content:flex-end;margin-top:2px}
    .pay-now{border:1px solid #294036;background:#102018;color:#bdf5c8;border-radius:9px;padding:7px 10px;font-size:10px;cursor:pointer}
    .pay-summary{display:flex;gap:16px;align-items:flex-end;justify-content:space-between;margin-bottom:12px}
    .pay-reserve{font-size:24px;font-weight:850;color:#8ef23d;letter-spacing:-.7px}
    @media(max-width:900px){.pay-split{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const today=()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate())};
  const monthDate=(day)=>{const t=today();return new Date(t.getFullYear(),t.getMonth(),Number(day))};
  const eventDate=(e)=>e.recurring&&e.recurrenceDay?monthDate(e.recurrenceDay):new Date(e.date+'T12:00:00');
  const sameMonth=(d)=>{const t=today();return d.getFullYear()===t.getFullYear()&&d.getMonth()===t.getMonth()};
  const norm=(s)=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim();
  const rub=(n)=>Math.round(Number(n)||0).toLocaleString('ru-RU')+' ₽';

  function matchesPayment(e,due){
    const key=norm(e.title), amount=Number(e.amount)||0;
    const from=new Date(due); from.setDate(from.getDate()-14);
    const to=new Date(due); to.setDate(to.getDate()+3);
    const candidates=(data.tx||[]).filter(tx=>{
      if(Number(tx.amount)>=0)return false;
      const td=new Date(tx.date+'T12:00:00');
      if(td<from||td>to)return false;
      const name=norm(tx.name), cat=norm(tx.cat);
      let nameOK=false;
      if(key.includes('яндекс')) nameOK=name.includes('яндекс');
      else if(key.includes('проезд')) nameOK=cat.includes('проезд')||name.includes('проезд')||name.includes('lesnaya');
      else if(key.includes('интернет')) nameOK=name.includes('интернет');
      else if(key.includes('спорт')) nameOK=name.includes('спорт')||name.includes('gym')||name.includes('фитнес');
      else if(key.includes('долями')) nameOK=name.includes('долями');
      else nameOK=name.includes(key);
      const amountOK=key.includes('проезд')||Math.abs(Math.abs(Number(tx.amount))-amount)<1;
      return nameOK&&amountOK;
    });
    candidates.sort((a,b)=>Math.abs(new Date(a.date+'T12:00:00')-due)-Math.abs(new Date(b.date+'T12:00:00')-due));
    return candidates[0]||null;
  }
  function paidEvent(e){if(e.type!=='expense')return null;return matchesPayment(e,eventDate(e))}

  const oldCalc=calc;
  calc=function(){
    const foodLeft=Math.max(0,(data.budgets['Еда']?.limit||0)-(data.budgets['Еда']?.spent||0));
    const transitLeft=Math.max(0,(data.budgets['Проезд']?.limit||0)-(data.budgets['Проезд']?.spent||0));
    const now=today();
    const expenses=(data.events||[]).filter(e=>e.type==='expense'&&!paidEvent(e)).filter(e=>{const d=eventDate(e);return d>=now&&sameMonth(d)});
    const incomes=(data.events||[]).filter(e=>e.type==='income').filter(e=>{const d=eventDate(e);return d>=now&&sameMonth(d)});
    const fixedFuture=expenses.reduce((s,e)=>s+Number(e.amount||0),0);
    const futureIncome=incomes.reduce((s,e)=>s+Number(e.amount||0),0);
    const free=Math.max(0,futureIncome-fixedFuture-foodLeft-transitLeft);
    return {foodLeft,transitLeft,fixedFuture,futureIncome,free,forecast:Math.max(0,data.debt-free),variableLeft:foodLeft+transitLeft};
  };

  function ensureCalendar(){
    const overview=document.querySelector('#overview'); if(!overview)return null;
    let box=document.querySelector('#paymentCalendarV2');
    if(box)return box;
    box=document.createElement('div'); box.id='paymentCalendarV2'; box.className='card pad';
    box.innerHTML=`<div class="pay-summary"><div><div class="panel-head" style="margin:0"><div><h2>Платёжный календарь</h2><p>Автоматически разделяет закрытые и будущие платежи</p></div></div></div><div><div class="label">Нужно отложить</div><div class="pay-reserve" id="payReserveV2">—</div></div></div><div class="pay-split"><div class="pay-col"><div class="pay-title">Впереди</div><div class="pay-list" id="payUpcomingV2"></div></div><div class="pay-col"><div class="pay-title">Погашено</div><div class="pay-list" id="payPaidV2"></div></div></div>`;
    overview.appendChild(box);return box;
  }
  function prefillPayment(e){
    if(typeof openAdd==='function')openAdd();
    setTimeout(()=>{
      const expTab=document.querySelector('.tab[data-type="expense"]'); if(expTab)expTab.click();
      const a=document.querySelector('#amountInput'), n=document.querySelector('#noteInput'), d=document.querySelector('#dateInput'), c=document.querySelector('#catInput'), acc=document.querySelector('#accountInput');
      if(a)a.value=e.amount;if(n)n.value=e.title;if(d)d.value=new Date().toISOString().slice(0,10);
      if(c){const preferred=e.title==='Проезд'?'Проезд':e.title==='Яндекс'?'Другое':'Обязательное';if([...c.options].some(o=>o.value===preferred))c.value=preferred}
      if(acc)acc.value='Дебетовая';
    },0);
  }
  window.__prefillPlanPayment=(id)=>{const e=(data.events||[]).find(x=>x.id===id);if(e)prefillPayment(e)};

  function renderCalendar(){
    if(!ensureCalendar())return;
    const now=today();
    const all=(data.events||[]).filter(e=>e.type==='expense').map(e=>{const due=eventDate(e);return {...e,_due:due,_paid:matchesPayment(e,due)}}).filter(e=>sameMonth(e._due));
    const ahead=all.filter(e=>!e._paid).sort((a,b)=>a._due-b._due);
    const done=all.filter(e=>e._paid).sort((a,b)=>new Date(b._paid.date)-new Date(a._paid.date));
    const reserve=ahead.reduce((s,e)=>s+Number(e.amount||0),0);
    document.querySelector('#payReserveV2').textContent=rub(reserve);
    const card=(e,doneFlag)=>{
      const dueText=e.recurring?`${e.recurrenceDay} числа · каждый месяц`:new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(e._due);
      if(doneFlag){const pd=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(e._paid.date+'T12:00:00')).replace('.','');return `<div class="pay-card paid"><div><div class="pay-date">${dueText}</div><div class="pay-name">${e.title}</div><div class="pay-status good">✓ оплачено ${pd}</div></div><div class="pay-amount">${rub(e.amount)}</div></div>`}
      const overdue=e._due<now;return `<div class="pay-card ${overdue?'overdue':'due'}"><div><div class="pay-date">${dueText}</div><div class="pay-name">${e.title}</div><div class="pay-status ${overdue?'warn':''}">${overdue?'срок прошёл':'предстоит списание'}</div></div><div class="pay-amount">${rub(e.amount)}</div><div class="pay-action"><button class="pay-now" onclick="__prefillPlanPayment('${e.id}')">${overdue?'Оплатить':'Оплатить сейчас'}</button></div></div>`;
    };
    document.querySelector('#payUpcomingV2').innerHTML=ahead.map(e=>card(e,false)).join('')||'<div class="muted">Все обязательные платежи месяца закрыты</div>';
    document.querySelector('#payPaidV2').innerHTML=done.map(e=>card(e,true)).join('')||'<div class="muted">Пока ничего не закрыто</div>';
  }

  renderUpcoming=function(){
    const now=today();const items=(data.events||[]).map(e=>({...e,_d:eventDate(e)})).filter(e=>e.type==='income'||!paidEvent(e)).filter(e=>e._d>=now&&sameMonth(e._d)).sort((a,b)=>a._d-b._d);
    document.querySelector('#upcomingList').innerHTML=items.map(e=>`<div class="next-item"><div class="next-date">${new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(e._d).replace('.','')}</div><b class="${e.type==='income'?'green':''}">${e.type==='income'?'+':'−'}${rub(e.amount)}</b><span>${e.title}</span></div>`).join('')||'<div class="muted">Ближайших событий нет</div>';
  };
  const oldRenderPlan=renderPlan;
  renderPlan=function(){oldRenderPlan();const c=calc();const pc=document.querySelector('#planCalc');if(pc)pc.innerHTML=`<div class="calc-row"><span>Текущий долг</span><strong>${rub(data.debt)}</strong></div><div class="calc-row"><span>Будущие поступления</span><strong class="green">+${rub(c.futureIncome)}</strong></div><div class="calc-row"><span>Ещё нужно оплатить</span><strong>−${rub(c.fixedFuture)}</strong></div><div class="calc-row"><span>Остаток бюджета на еду</span><strong>−${rub(c.foodLeft)}</strong></div><div class="calc-row"><span>Остаток на транспорт</span><strong>−${rub(c.transitLeft)}</strong></div><div class="calc-row"><span>Можно направить на кредитку</span><strong class="green">${rub(c.free)}</strong></div>`;};

  const oldRender=render;
  render=function(){oldRender();renderCalendar();};
  render();
})();