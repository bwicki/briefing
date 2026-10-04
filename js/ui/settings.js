/* Fahrtbriefing — Einstellungen (Stammdaten, Regeln, Zugänge, Experte). */
import { h, clear, toast, deepCopy, num, dialog, uid } from '../util.js';
import { t, tt, getLang, setLang } from '../i18n.js';
import { setHeader } from '../app.js';
import { field, input, select, textarea, check, listHead, fieldAdd, docsEditor } from './widgets.js';
import { PANELS, SECTIONS } from '../panels.js';
import { parseRacText, racValidity, linesFromPdfItems } from '../calc/rac.js';
import { CYLINDER_CATALOG } from '../calc/aero.js';
import { placeRow, mapsUrl } from './place.js';
import { exportAll } from './extras.js';
import { usersSection, statsSection } from './users.js';

const SECTS = ['general', 'balloons', 'persons', 'operators', 'sites', 'intent', 'schedule', 'rac', 'transition', 'gonogo', 'meteo', 'panels', 'links', 'users', 'stats', 'access', 'expert'];

export async function renderSettings(view, ctx) {
  let S = deepCopy(ctx.settings);
  let cur = location.hash.split('?')[1] || 'general';
  const saveBtn = h('button.btn.primary', { type: 'button', onclick: async () => { await ctx.saveSettings(S); S = deepCopy(ctx.settings); toast(t('set_saved')); draw(); } }, t('set_save'));
  const expBtn = h('button.btn', { type: 'button', onclick: () => { const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(S, null, 2)); a.download = 'briefing-settings.json'; a.click(); } }, t('set_export'));
  const impIn = h('input', { type: 'file', accept: 'application/json', style: { display: 'none' }, onchange: async (e) => { try { const txt = await e.target.files[0].text(); S = { ...S, ...JSON.parse(txt) }; draw(); toast(t('ok')); } catch (err) { toast(err.message); } } });
  const impBtn = h('button.btn', { type: 'button', onclick: () => impIn.click() }, t('set_import'));
  setHeader({ title: t('set_title'), tools: [expBtn, impBtn, saveBtn] });
  const nav = h('div.snav');
  const body = h('div');
  view.appendChild(h('div.settings', [nav, body, impIn]));

  function draw() {
    clear(nav);
    const sects = SECTS.filter((x) => x !== 'stats' || (ctx.isSuper && ctx.store.mode === 'remote'));
    if (!sects.includes(cur)) cur = 'general';
    for (const s of sects) nav.appendChild(h('button', { type: 'button', class: cur === s ? 'on' : '', onclick: () => { cur = s; draw(); } }, t('set_' + s)));
    setTimeout(() => nav.querySelector('button.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 0);
    clear(body);
    body.appendChild(({ general, balloons, persons, operators, sites, intent, schedule, rac, transition, gonogo, meteo, panels, links, users, stats, access, expert })[cur]());
  }
  const numField = (obj, key, label, step = 1, cls) => field(label, input('number', obj[key] ?? '', { step, oninput: (e) => { obj[key] = num(e.target.value, null); } }), cls);
  const txtField = (obj, key, label, cls) => field(label, input('text', obj[key] ?? '', { oninput: (e) => { obj[key] = e.target.value; } }), cls);

  function general() {
    return h('div.card', h('div.card-body', [
      h('div.frow.c3', [
        field(t('set_lang'), select([{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }], S.lang, { onchange: (e) => { S.lang = e.target.value; } })),
        field(t('set_theme'), select([{ value: 'light', label: t('theme_light') }, { value: 'dark', label: t('theme_dark') }], S.theme, { onchange: (e) => { S.theme = e.target.value; } })),
        txtField(S, 'ownerName', t('set_ownerName')),
      ]),
      check(t('set_expertMode'), S.expert, (v) => { S.expert = v; }),
      h('div.note', `${t('localMode')}/${t('remoteMode')}: ${ctx.store.mode === 'remote' ? ctx.store.apiBase : t('localMode')}`),
    ]));
  }

  function balloons() {
    const B = S.balloons;
    const wrap = h('div');
    const habBox = h('div');
    const drawHab = () => {
      clear(habBox);
      B.hab.forEach((x, i) => {
        const cylRows = CYLINDER_CATALOG.map((c) => { const cur = x.cylinders.find((y) => y.id === c.id); return h('tr', [h('td', c.name), h('td', input('number', cur?.count ?? 0, { min: 0, step: 1, oninput: (e) => { const n = num(e.target.value); const idx = x.cylinders.findIndex((y) => y.id === c.id); if (idx >= 0) x.cylinders[idx].count = n; else x.cylinders.push({ ...c, count: n }); } })), h('td', c.litres), h('td', c.gasKg), h('td', c.totalKg)]); });
        habBox.appendChild(h('div.item-box', [
          h('div.head', [h('b', `${x.id} · ${x.model}`), h('label.check', [h('input', { type: 'radio', name: 'defHab', checked: B.defaultHab === x.id, onchange: () => { B.defaultHab = x.id; } }), h('span', t('default'))]), h('button.btn.icon', { type: 'button', onclick: () => { B.hab.splice(i, 1); drawHab(); } }, '🗑')]),
          h('div.frow.c4', [txtField(x, 'id', t('registration')), txtField(x, 'model', t('b_model')), txtField(x, 'hex', t('b_hex')), numField(x, 'volume', t('b_volume'))]),
          h('div.frow.c4', [numField(x, 'mtom', t('b_mtom'))]),
          h('div.frow.c4', [numField(x.masses, 'envelope', `${t('b_envelope')} kg`), numField(x.masses, 'burner', `${t('b_burner')} kg`), numField(x.masses, 'basket', `${t('b_basket')} kg`), numField(x.masses, 'equipment', `${t('b_equipment')} kg`)]),
          h('div.frow.c4', [numField(x, 'personWeight', `${t('b_personWeight')} kg`), numField(x, 'maxPersons', t('b_maxPersons')), numField(x, 'burnRate', t('b_burn')), numField(x, 'rigMin', t('b_rig'))]),
          S.expert ? h('div.frow.c3', [numField(x, 'envTempC', t('b_envTemp')), numField(x, 'envMaxC', t('b_envMax')), field(`${t('b_usable')} (0–1)`, input('number', x.usableFraction, { step: 0.05, min: 0, max: 1, oninput: (e) => { x.usableFraction = num(e.target.value, 1); } }))]) : null,
          h('details', [h('summary.small', t('b_cyl')), h('table.cyl', [h('thead', h('tr', [h('th', t('b_cyl')), h('th', t('mp_count')), h('th', 'l'), h('th', 'kg Gas'), h('th', 'kg')])), h('tbody', cylRows)])]),
          (() => { const de = docsEditor(x, S.docTypes?.balloon, ctx); return fieldAdd(t('docs'), de, () => de.addFn(), t('doc_add')); })(),
        ]));
      });
      habBox.addFn = () => { B.hab.push({ id: 'HB-XXX', name: 'HB-XXX', model: 'Heissluft', volume: 3000, masses: { envelope: 120, burner: 20, basket: 60, equipment: 20 }, mtom: 800, personWeight: 85, envTempC: 100, envMaxC: null, usableFraction: 0.9, burnRate: 25, cylinders: [], rigMin: 45, maxPersons: 4 }); drawHab(); };
    };
    drawHab();
    const envBox = h('div');
    const drawEnv = () => {
      clear(envBox);
      B.envelopes.forEach((x, i) => envBox.appendChild(h('div.item-box', [
        h('div.head', [h('b', x.id), x.placeholder ? h('span.tag.half', t('placeholderMark')) : null, h('label.check', [h('input', { type: 'radio', name: 'defEnv', checked: B.defaultEnvelope === x.id, onchange: () => { B.defaultEnvelope = x.id; } }), h('span', t('default'))]), h('button.btn.icon', { type: 'button', onclick: () => { B.envelopes.splice(i, 1); drawEnv(); } }, '🗑')]),
        h('div.frow.c4', [txtField(x, 'id', t('registration')), txtField(x, 'model', t('b_model')), txtField(x, 'hex', t('b_hex')), numField(x, 'volume', t('b_volume'))]),
        h('div.frow.c4', [numField(x, 'mass', `${t('b_envelope')} kg`)]),
        (() => { const de = docsEditor(x, S.docTypes?.balloon, ctx); return fieldAdd(t('docs'), de, () => de.addFn(), t('doc_add')); })(),
        S.expert ? h('div.frow.c3', [field(t('b_gas'), select([{ value: 'H2', label: 'H₂' }, { value: 'He', label: 'He' }], x.gas, { onchange: (e) => { x.gas = e.target.value; } })), field(`${t('b_purity')} (0–1)`, input('number', x.purity, { step: 0.001, oninput: (e) => { x.purity = num(e.target.value, 1); } })), field('Füllgrad (0–1)', input('number', x.fillFraction ?? 1, { step: 0.05, oninput: (e) => { x.fillFraction = num(e.target.value, 1); } }))]) : null,
        check(t('placeholderMark'), x.placeholder, (v) => { x.placeholder = v; }),
      ])));
      envBox.addFn = () => { B.envelopes.push({ id: 'HB-XXX', name: 'HB-XXX', model: 'NL/STU-1000', volume: 1050, mass: 116, gas: 'H2', purity: 0.995, fillFraction: 1, placeholder: true }); drawEnv(); };
    };
    drawEnv();
    const basBox = h('div');
    const drawBas = () => {
      clear(basBox);
      B.baskets.forEach((x, i) => basBox.appendChild(h('div.item-box', [
        h('div.head', [h('b', x.name), x.placeholder ? h('span.tag.half', t('placeholderMark')) : null, h('label.check', [h('input', { type: 'radio', name: 'defBas', checked: B.defaultBasket === x.id, onchange: () => { B.defaultBasket = x.id; } }), h('span', t('default'))]), h('button.btn.icon', { type: 'button', onclick: () => { B.baskets.splice(i, 1); drawBas(); } }, '🗑')]),
        h('div.frow.c4', [txtField(x, 'name', t('name')), numField(x, 'mass', `${t('b_basket')} kg`), numField(x, 'equipment', `${t('b_equipment')} kg`), numField(x, 'instruments', `${t('b_instruments')} kg`)]),
        h('div.frow.c3', [numField(x, 'maxPersons', t('b_maxPersons')), numField(x, 'ballastUnitKg', t('b_ballastUnit')), numField(x, 'reserveUnits', t('b_reserveUnits'))]),
        check(t('placeholderMark'), x.placeholder, (v) => { x.placeholder = v; }),
      ])));
      basBox.addFn = () => { B.baskets.push({ id: uid(6), name: 'Korb', mass: 50, equipment: 40, instruments: 0, maxPersons: 2, ballastUnitKg: 15, reserveUnits: 3, placeholder: true }); drawBas(); };
    };
    drawBas();
    wrap.append(
      h('div.card', [listHead(t('hab'), habBox, `${t('add')} ${t('hab')}`), h('div.card-body', habBox)]),
      h('div.card', [listHead(`${t('gas')} · ${t('envelope')}`, envBox, `${t('add')} ${t('envelope')}`), h('div.card-body', envBox)]),
      h('div.card', [listHead(`${t('gas')} · ${t('basket')}`, basBox, `${t('add')} ${t('basket')}`), h('div.card-body', [basBox, h('div.frow.c3', [numField(B.gasDefaults, 'personWeight', `${t('b_personWeight')} kg (${t('gas')})`), numField(B.gasDefaults, 'rigMin', t('b_rig')), numField(B.gasDefaults, 'fillMin', t('b_fill'))])])]),
      h('div.card', h('div.card-body', field(t('balloonType') + ' ' + t('default'), select([{ value: 'hab', label: t('hab') }, { value: 'gas', label: t('gas') }], B.defaultType, { onchange: (e) => { B.defaultType = e.target.value; } })))),
    );
    return wrap;
  }

  function persons() {
    const box = h('div');
    const ROLES = ['pic', 'crew', 'retrieve', 'pax'];
    const drawP = () => {
      clear(box);
      S.persons.forEach((p, i) => box.appendChild(h('div.item-box', [
        h('div.head', [h('b', p.name), h('button.btn.icon', { type: 'button', onclick: () => { S.persons.splice(i, 1); drawP(); } }, '🗑')]),
        h('div.frow.c4', [txtField(p, 'name', t('name')), txtField(p, 'phone', t('phone')), txtField(p, 'email', t('email')), numField(p, 'weight', `${t('weight')} kg`)]),
        field(t('p_trackers'), textarea((p.trackers || []).join('\n'), { rows: 2, placeholder: 'https://live.garmin.com/… · https://aprs.fi/… · https://www.flightradar24.com/…', oninput: (e) => { p.trackers = e.target.value.split(/[\n,;\s]+/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x)); } })),
        h('div.chips', ROLES.map((r) => h('button.chip', { type: 'button', 'aria-pressed': (p.roles || []).includes(r), onclick: (e) => { p.roles = p.roles || []; const i2 = p.roles.indexOf(r); if (i2 >= 0) p.roles.splice(i2, 1); else p.roles.push(r); e.currentTarget.setAttribute('aria-pressed', p.roles.includes(r)); } }, r.toUpperCase()))),
        (() => { const de = docsEditor(p, S.docTypes?.person, ctx); return fieldAdd(t('docs'), de, () => de.addFn(), t('doc_add')); })(),
      ])));
      box.addFn = () => { S.persons.push({ id: uid(6), name: '', roles: ['crew'], phone: '', email: '', weight: null }); drawP(); };
    };
    drawP();
    return h('div.card', [listHead(t('set_persons'), box), h('div.card-body', box)]);
  }

  function operators() {
    const box = h('div');
    const drawO = () => {
      clear(box);
      S.operators.forEach((o, i) => box.appendChild(h('div.item-box', h('div.frow.c3', [txtField(o, 'name', t('name')), field(t('default'), h('label.check', [h('input', { type: 'radio', name: 'defOp', checked: !!o.default, onchange: () => { S.operators.forEach((x) => { x.default = false; }); o.default = true; } }), h('span', t('default'))])), h('div.f', [h('label', ' '), h('button.btn', { type: 'button', onclick: () => { S.operators.splice(i, 1); drawO(); } }, t('remove'))])]))));
      box.addFn = () => { S.operators.push({ id: uid(6), name: '' }); drawO(); };
    };
    drawO();
    return h('div.card', [listHead(t('set_operators'), box), h('div.card-body', box)]);
  }

  function sites() {
    const sBox = h('div'), mBox = h('div');
    const drawS = () => {
      clear(sBox);
      S.sites.forEach((s, i) => sBox.appendChild(h('div.item-box', [
        h('div.head', [h('b', s.name), h('button.btn.icon', { type: 'button', onclick: () => { S.sites.splice(i, 1); drawS(); } }, '🗑')]),
        h('div.frow', [txtField(s, 'name', t('name')), placeRow(s, { label: t('coords'), title: t('site'), noName: true, onPick: (p) => { Object.assign(s, { lat: p.lat, lon: p.lon, elev: p.elev ?? s.elev, tz: p.tz || s.tz, country: p.country || s.country }); if (!s.name) s.name = p.name; drawS(); } })]),
        h('div.frow.c4', [numField(s, 'elev', t('s_elev')), txtField(s, 'country', t('s_country')), txtField(s, 'tz', t('s_tz')), field(t('s_meeting'), select([{ value: '', label: '–' }].concat(S.meetings.map((m) => ({ value: m.id, label: m.name }))), s.meetingId, { onchange: (e) => { s.meetingId = e.target.value; } }))]),
        h('div.frow', [field(t('s_fav'), check('', s.favorite, (v) => { s.favorite = v; })), field(t('s_types'), h('div.chips', ['hab', 'gas'].map((ty) => h('button.chip', { type: 'button', 'aria-pressed': !s.types?.length || s.types.includes(ty), title: t('s_typesHint'), onclick: (e) => {
          // leer = beide; Klick schaltet um; nie beide aus
          let cur = s.types?.length ? [...s.types] : ['hab', 'gas'];
          cur = cur.includes(ty) ? cur.filter((x) => x !== ty) : cur.concat(ty);
          if (!cur.length) cur = [ty === 'hab' ? 'gas' : 'hab'];
          s.types = cur.length === 2 ? [] : cur;
          e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c, k) => c.setAttribute('aria-pressed', !s.types.length || s.types.includes(['hab', 'gas'][k])));
        } }, t(ty)))))]),
        field(t('s_notes'), textarea(s.notes, { rows: 2, oninput: (e) => { s.notes = e.target.value; } })),
      ])));
      sBox.addFn = () => { S.sites.push({ id: uid(6), name: '', lat: null, lon: null, elev: null, country: 'CH', tz: 'Europe/Zurich', notes: '', meetingId: '', favorite: true }); drawS(); };
    };
    const drawM = () => {
      clear(mBox);
      S.meetings.forEach((m, i) => mBox.appendChild(h('div.item-box', [
        h('div.head', [h('b', m.name), h('label.check', [h('input', { type: 'radio', name: 'defM', checked: !!m.default, onchange: () => { S.meetings.forEach((x) => { x.default = false; }); m.default = true; } }), h('span', t('default'))]), h('button.btn.icon', { type: 'button', onclick: () => { S.meetings.splice(i, 1); drawM(); } }, '🗑')]),
        h('div.frow', [txtField(m, 'name', t('name')), txtField(m, 'address', t('m_address'))]),
        placeRow(m, { label: t('coords'), title: t('meeting'), noName: true, onPick: (p) => { Object.assign(m, { lat: p.lat, lon: p.lon, mapsUrl: mapsUrl(p.lat, p.lon) }); if (!m.address && p.address) m.address = p.address; if (!m.name) m.name = p.name; drawM(); } }),
      ])));
      mBox.addFn = () => { S.meetings.push({ id: uid(6), name: '', address: '', lat: null, lon: null, mapsUrl: '' }); drawM(); };
    };
    drawS(); drawM();
    return h('div', [h('div.card', [listHead(t('site'), sBox), h('div.card-body', sBox)]), h('div.card', [listHead(t('meeting'), mBox), h('div.card-body', mBox)])]);
  }

  function intent() {
    const box = h('div');
    for (const ty of ['hab', 'gas']) {
      const d = S.intentDefaults[ty];
      box.appendChild(h('div.item-box', [h('div.head', h('b', t(ty))), h('div.frow.c3', [numField(d, 'durationMin', `${t('duration')} (min)`), numField(d, 'altMinFt', `${t('altMin')} ft`), numField(d, 'altMaxFt', `${t('altMax')} ft`)]), S.expert ? field(t('levels'), input('text', d.levels.join(', '), { oninput: (e) => { d.levels = e.target.value.split(/[,;]+/).map((x) => x.trim()).filter(Boolean); } })) : h('div.note', `${t('levels')}: ${d.levels.join(', ')} (${t('set_expert')})`)]));
    }
    return h('div.card', h('div.card-body', box));
  }

  function schedule() {
    const d = S.scheduleDefaults;
    return h('div.card', h('div.card-body', h('div.frow.c4', [numField(d, 'trailerFactor', t('set_trailer'), 0.05), numField(d, 'surchargeMin', t('set_surcharge')), numField(d, 'bufferMin', t('set_buffer')), numField(d, 'recoveryMin', t('set_recovery'))])));
  }

  function rac() {
    const status = h('div.note');
    const fileIn = h('input', { type: 'file', accept: 'application/pdf', style: { display: 'none' } });
    const refresh = () => { status.textContent = `${t('set_racDefault')}: ${ctx.racDefault ? racValidity(ctx.racDefault) : '–'} · ${t('set_racCustom')}: ${S.rac.custom ? racValidity(S.rac.custom) + ' (' + Object.keys(S.rac.custom.days).length + ' d)' : '–'}`; };
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0]; if (!f) return;
      status.textContent = t('set_racParse');
      try {
        const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
        const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
        let lines = [];
        for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const tc = await pg.getTextContent(); lines = lines.concat(linesFromPdfItems(tc.items)); }
        const table = parseRacText(lines.join('\n'), f.name);
        S.rac.custom = table;
        status.textContent = t('set_racOk', { n: Object.keys(table.days).length, v: racValidity(table) }) + (table.problems.length ? ` · ${table.problems.length} ?` : '');
      } catch (e) { status.textContent = t('set_racErr', { e: e.message }); }
    });
    refresh();
    return h('div.card', h('div.card-body', [
      h('div.row-actions', [h('button.btn', { type: 'button', onclick: () => fileIn.click() }, t('set_racUpload')), S.rac.custom ? h('button.btn', { type: 'button', onclick: () => { S.rac.custom = null; refresh(); } }, t('set_racRemove')) : null, fileIn]),
      status,
      h('div.note', { style: { marginTop: '8px' } }, 'VFR Manual Switzerland, RAC 4-4 «Tag- und Nachtgrenzen» (skyguide). Lokalzeit, Referenz Sternwarte Bern, gültig für die FIR Schweiz.'),
    ]));
  }

  function transition() {
    const box = h('div');
    const drawT = () => {
      clear(box);
      S.transitionAltitudes.forEach((ta, i) => box.appendChild(h('div.frow.c3', [txtField(ta, 'label', t('name')), field(t('s_country'), input('text', (ta.countries || []).join(','), { oninput: (e) => { ta.countries = e.target.value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean); } })), h('div.f', [h('label', ' '), h('button.btn', { type: 'button', onclick: () => { S.transitionAltitudes.splice(i, 1); drawT(); } }, t('remove'))])])));
      box.addFn = () => { S.transitionAltitudes.push({ id: uid(5), label: '', countries: [] }); drawT(); };
    };
    drawT();
    const defs = h('div.frow.c3', ['CH', 'DE', 'FR', 'AT', 'IT'].map((cc) => field(`${t('default')} ${cc}`, input('text', (S.transitionDefaults[cc] || []).join(','), { placeholder: 'ids', oninput: (e) => { S.transitionDefaults[cc] = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); } }))));
    return h('div.card', [listHead(t('set_transition'), box), h('div.card-body', [box, h('div.note', t('tr_hint')), defs])]);
  }

  function gonogo() {
    const g = S.goNoGo;
    return h('div.card', h('div.card-body', [h('div.frow.c4', [numField(g, 'dryWindowH', 'Trockenfenster ≥ h'), numField(g, 'noTsH', 'kein Gewitter innert h'), numField(g, 'meanWindKt', 'Mittelwind < kt'), numField(g, 'gustKt', 'Böen < kt')]), h('div.note', 'Ampel ab Phase 3.')]));
  }

  function meteo() {
    const F = S.flyLimits, T = S.trajDefaults;
    const pair = (key, label) => field(label, h('div.inline', [input('number', F[key][0], { step: 0.5, oninput: (e) => { F[key][0] = num(e.target.value); } }), input('number', F[key][1], { step: 0.5, oninput: (e) => { F[key][1] = num(e.target.value); } })]));
    const chartsBox = h('div');
    const drawCharts = () => {
      clear(chartsBox);
      (S.synopticCharts || []).forEach((c, i) => chartsBox.appendChild(h('div.frow', [txtField(c, 'name', t('name')), h('div.inline', [input('text', c.url, { oninput: (e) => { c.url = e.target.value; } }), h('button.btn.icon', { type: 'button', onclick: () => { S.synopticCharts.splice(i, 1); drawCharts(); } }, '🗑')])])));
      chartsBox.addFn = () => { (S.synopticCharts = S.synopticCharts || []).push({ name: '', url: 'https://' }); drawCharts(); };
    };
    drawCharts();
    const camBox = h('div');
    const drawCams = () => {
      clear(camBox);
      (S.webcams || []).forEach((w, i) => camBox.appendChild(h('div.item-box', [
        h('div.frow', [txtField(w, 'name', t('name')), h('div.inline', [input('text', w.url, { placeholder: 'https://', oninput: (e) => { w.url = e.target.value; } }), h('button.btn.icon', { type: 'button', title: t('remove'), onclick: () => { S.webcams.splice(i, 1); drawCams(); } }, '🗑')])]),
        placeRow(w, { label: t('coords'), title: t('set_webcams'), noName: true, onPick: (p) => { w.lat = p.lat; w.lon = p.lon; if (!w.name) w.name = p.name; drawCams(); } }),
      ])));
      camBox.addFn = () => { (S.webcams = S.webcams || []).push({ id: uid(5), name: '', lat: null, lon: null, url: 'https://' }); drawCams(); };
    };
    drawCams();
    const txtBox = h('div');
    const drawTxt = () => {
      clear(txtBox);
      (S.wxTexts || []).forEach((x, i) => txtBox.appendChild(h('div.frow.c4', [field(t('s_country'), h('div.inline', [input('text', x.cc, { maxlength: 2, style: { width: '64px' }, oninput: (e) => { x.cc = e.target.value.toUpperCase(); } }), check(t('set_wxFetch'), !x.disabled, (v) => { x.disabled = !v; })])), txtField(x, 'name', t('name')), field('URL', input('text', x.url, { oninput: (e) => { x.url = e.target.value; } })), h('div.f', [h('label', t('set_wxSel')), h('div.inline', [input('text', x.sel || '', { placeholder: 'main', oninput: (e) => { x.sel = e.target.value; } }), h('button.btn.icon', { type: 'button', title: t('remove'), onclick: () => { S.wxTexts.splice(i, 1); drawTxt(); } }, '🗑')])])])));
      txtBox.addFn = () => { (S.wxTexts = S.wxTexts || []).push({ cc: 'CH', name: '', url: 'https://', sel: 'main' }); drawTxt(); };
    };
    drawTxt();
    return h('div', [
      h('div.card', [h('div.card-head', h('div.section-title', t('set_flyLimits'))), h('div.card-body', [h('div.frow.c4', [pair('wind', `${t('auto_wind')} m/s (grenzwertig / nein)`), pair('gust', `${t('auto_gust')} m/s`), pair('gustSpread', 'Böe − Wind m/s'), pair('cape', 'CAPE J/kg')]), h('div.frow.c3', [numField(F, 'precip', 'Niederschlag ≥ mm/h → nein', 0.1), numField(F, 'visKm', 'Sicht < km → nein', 0.5), numField(F, 'baseFt', 'Wolkenbasis < ft → grenzwertig', 100)])])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('set_trajDefaults'))), h('div.card-body', h('div.frow.c3', [numField(T, 'hab', `${t('hab')} (min)`, 30), numField(T, 'gas', `${t('gas')} (min)`, 60), numField(T, 'stepMin', 'Zeitschritt (min)', 5)]))]),
      h('div.card', [h('div.card-head', h('div.section-title', t('set_meteo'))), h('div.card-body', [h('div.frow.c4', [numField(S.meteoDefaults, 'topHpa', 'Profil bis hPa', 50), numField(S, 'metarRadiusKm', t('set_metar'), 10), numField(S, 'metarCount', t('set_metarN')), numField(S, 'notamRadiusNm', t('set_notamNm'), 5)]), h('div.frow.c4', [numField(S, 'airspaceCorridorKm', t('set_airspaceCorridor'), 1), txtField(S, 'aiModel', t('set_aiModel'))])])]),
      h('div.card', [listHead(t('set_wxTexts'), txtBox), h('div.card-body', [txtBox, h('div.note', t('set_wxTextsHint'))])]),
      h('div.card', [listHead(t('set_webcams'), camBox), h('div.card-body', [h('div.note', t('set_webcamsAuto')), h('div.frow.c4', [numField(S, 'webcamKm', t('set_webcamKm'), 5)]), camBox, h('div.note', t('set_webcamsHint'))])]),
      h('div.card', [listHead(t('set_synoptic'), chartsBox), h('div.card-body', [chartsBox, h('div.note', 'Nur Bild-URLs von dwd.de, ecmwf.int, meteoschweiz.admin.ch, rainviewer, meteoblue, skybriefing, eumetsat (Allowlist im Worker).')])]),
    ]);
  }

  function panels() {
    const box = h('div');
    const hidden = new Set(S.panels.hidden || []), mand = new Set(S.panels.mandatory || []);
    for (const s of SECTIONS) {
      box.appendChild(h('div.sect-title', `${s.id} · ${s[getLang()] || s.de}`));
      for (const p of PANELS.filter((x) => x.section === s.id)) {
        box.appendChild(h('div.frow.c3', { style: { marginBottom: '2px' } }, [h('div', [tt(p), ' ', p.always ? h('span.tag.calc', 'fix') : null, p.chOnly ? h('span.tag', 'CH') : null]), p.always ? h('span') : check(t('set_hidden'), hidden.has(p.key), (v) => { if (v) hidden.add(p.key); else hidden.delete(p.key); S.panels.hidden = [...hidden]; }), p.always ? h('span') : check(t('set_mandatory'), mand.has(p.key), (v) => { if (v) mand.add(p.key); else mand.delete(p.key); S.panels.mandatory = [...mand]; })]));
      }
    }
    return h('div.card', h('div.card-body', [h('div.note', t('set_mandatoryHint')), box]));
  }

  function links() {
    return h('div.card', h('div.card-body', h('div.frow.c3', [numField(S.links, 'defaultExpiryDays', t('set_linkDays'))])));
  }

  const users = () => usersSection(ctx);
  const stats = () => statsSection(ctx);

  function access() {
    const box = h('div');
    const ro = ctx.store.mode === 'remote' && !ctx.isSuper;
    const names = [['openmeteo', 'Open-Meteo API key'], ['meteoblue', 'meteoblue API key'], ['anthropic', 'Anthropic API key'], ['pcmet_user', 'pc_met Benutzer'], ['pcmet_pass', 'pc_met Kennwort'], ['skybriefing_user', 'skybriefing Benutzer'], ['skybriefing_pass', 'skybriefing Kennwort'], ['ors', 'OpenRouteService key'], ['openaip', 'openAIP API key (Luftraum)'], ['windy_webcams', 'Windy Webcams key'], ['faa_client_id', 'FAA NOTAM client_id'], ['faa_client_secret', 'FAA NOTAM client_secret'], ['cf_account_id', 'Cloudflare Account-ID (Final-PDF)'], ['cf_api_token', 'Cloudflare API-Token mit «Browser Rendering» (Final-PDF)']];
    const drawA = async () => {
      clear(box);
      if (ctx.store.mode !== 'remote') { box.appendChild(h('div.note', t('ac_localOnly'))); return; }
      let have = {};
      try { have = await ctx.store.listSecrets(); } catch (e) { box.appendChild(h('div.err', e.message)); return; }
      if (ro) { box.appendChild(h('div.note', t('set_secretsReadOnly'))); box.appendChild(h('ul.plain', names.map(([k, label]) => h('li', `${label}: ${have[k] ? t('set_secretSet') : t('set_secretUnset')}`)))); return; }
      for (const [k, label] of names) {
        const inp = input('password', '', { placeholder: have[k] ? '••••••••' : '', autocomplete: 'off', spellcheck: 'false' });
        // Auge: Eingabe im Klartext zeigen; bei leerem Feld den gespeicherten Wert nachladen (Supermaster, protokolliert)
        let shown = false, loaded = '';
        const eye = h('button.btn.icon.eye', { type: 'button', title: t('set_secretShow'), 'aria-label': t('set_secretShow') }, '👁');
        eye.onclick = async () => {
          if (!shown) {
            if (!inp.value && have[k]) { try { loaded = (await ctx.store.getSecret(k)).value || ''; inp.value = loaded; } catch (e) { toast(e.status === 403 ? t('set_secretsReadOnly') : `${t('error')}: ${e.message}`); return; } }
            inp.type = 'text'; shown = true; eye.textContent = '🙈'; eye.title = t('set_secretHide');
          } else {
            inp.type = 'password'; shown = false; eye.textContent = '👁'; eye.title = t('set_secretShow');
            if (loaded && inp.value === loaded) { inp.value = ''; loaded = ''; }   // unverändert nachgeladen → wieder leeren (kein versehentliches Neu-Speichern)
          }
        };
        box.appendChild(h('div.frow.c3', [field(label, h('div.pwwrap', [inp, eye])), h('div.f', [h('label', have[k] ? t('set_secretSet') : t('set_secretUnset')), h('div.row-actions', [h('button.btn', { type: 'button', onclick: async () => { if (!inp.value || inp.value === loaded) { toast(t('set_secretUnchanged')); return; } await ctx.store.setSecret(k, inp.value); inp.value = ''; loaded = ''; toast(t('set_saved')); drawA(); } }, t('set_secretSave')), have[k] ? h('button.btn', { type: 'button', onclick: async () => { if (!(await dialog(t('set_secretDelete'), h('p', `${label}: ${t('set_secretConfirm')}`), [{ label: t('cancel'), value: false }, { label: t('delete'), value: true, primary: true }]))) return; await ctx.store.deleteSecret(k); drawA(); } }, t('set_secretDelete')) : null])])]));
      }
    };
    drawA();
    return h('div.card', h('div.card-body', [h('details.exp', { open: ro }, [h('summary', t('set_access')), h('div.note', t('set_secretsHint')), box])]));
  }

  function expert() {
    const pwOld = input('password', '', { autocomplete: 'current-password' }), pwNew = input('password', '', { autocomplete: 'new-password' }), pwNew2 = input('password', '', { autocomplete: 'new-password' });
    const pwBtn = h('button.btn', { type: 'button', onclick: async () => {
      if (pwNew.value !== pwNew2.value) { toast(t('set_pwMismatch')); return; }
      if (pwNew.value.length < 4) { toast('≥ 4'); return; }
      try { await ctx.store.changePassword(pwOld.value, pwNew.value); toast(t('set_pwChanged')); pwOld.value = pwNew.value = pwNew2.value = ''; }
      catch (e) { toast(e.message === 'wrong' || e.status === 403 ? t('set_pwWrong') : `${t('error')}: ${e.message}`); }
    } }, t('set_password'));
    const r = S.reserve;
    return h('div', [
      h('div.card', [h('div.card-head', h('div.section-title', t('set_password'))), h('div.card-body', [h('div.frow.c3', [field(t('set_pwOld'), pwOld), field(t('set_pwNew'), pwNew), field(t('set_pwNew2'), pwNew2)]), pwBtn])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('set_reserve'))), h('div.card-body', h('div.frow.c3', [numField(r, 'pct', `${t('set_reservePct')} %`), numField(r, 'capMin', t('set_reserveCap')), numField(r, 'minMin', t('set_reserveMin'))]))]),
      h('div.card', [h('div.card-head', h('div.section-title', t('set_expertMode'))), h('div.card-body', check(t('set_expertMode'), S.expert, (v) => { S.expert = v; }))]),
      h('div.card', [h('div.card-head', h('div.section-title', t('set_export'))), h('div.card-body', [h('div.row-actions', [h('button.btn', { type: 'button', onclick: () => exportAll(ctx).catch((e) => toast(e.message)) }, t('export_all')), ctx.isSuper && ctx.store.mode === 'remote' ? h('button.btn', { type: 'button', onclick: () => exportAll(ctx, true).catch((e) => toast(e.message)) }, t('export_allUsers')) : null]), h('div.note', t('export_hint'))])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('pax_title'))), h('div.card-body', [field(t('pax_bring') + ' (DE, eine Zeile je Punkt)', textarea((S.paxCardItems?.de || []).join('\n'), { rows: 5, oninput: (e) => { S.paxCardItems = S.paxCardItems || {}; S.paxCardItems.de = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); } })), field(t('pax_bring') + ' (EN)', textarea((S.paxCardItems?.en || []).join('\n'), { rows: 5, oninput: (e) => { S.paxCardItems = S.paxCardItems || {}; S.paxCardItems.en = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); } }))])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('set_airspace'))), h('div.card-body', [txtField(S, 'airspaceTileUrl', t('set_airspaceUrl')), h('div.note', t('set_airspaceHint'))])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('set_thermal'))), h('div.card-body', [h('div.frow.c4', [numField(S.thermalLimits, 'none', `${t('th_weak')} ab w* m/s`, 0.1), numField(S.thermalLimits, 'weak', `${t('th_moderate')} ab m/s`, 0.1), numField(S.thermalLimits, 'moderate', `${t('th_strong')} ab m/s`, 0.1), numField(S.thermalLimits, 'strong', `${t('th_severe')} ab m/s`, 0.1)]), h('div.frow.c4', [numField(S.thermalLimits, 'onset', `${t('th_onset')} ab w* m/s`, 0.1)]), h('div.note', t('set_thermalHint'))])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('set_docTypes'))), h('div.card-body', h('div.frow', [field(t('set_docTypesBalloon'), textarea((S.docTypes?.balloon || []).join('\n'), { rows: 6, oninput: (e) => { (S.docTypes = S.docTypes || {}).balloon = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); } })), field(t('set_docTypesPerson'), textarea((S.docTypes?.person || []).join('\n'), { rows: 6, oninput: (e) => { (S.docTypes = S.docTypes || {}).person = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); } }))]))]),
    ]);
  }
  draw();
}
