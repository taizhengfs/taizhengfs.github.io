/* 认字簿冒烟测试：jsdom 加载 + 模拟云端 + 走一遍两阶段交互 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const APP = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const charsRaw = fs.readFileSync(path.join(APP, 'data/chars.json'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const cloud = { store: null, puts: 0, gets: 0 };

function mockFetch(url, opt = {}) {
  const u = String(url);
  if (u.indexOf('chars.json') >= 0)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(charsRaw)) });
  if (u.indexOf('time.taizhendong.com') >= 0) {
    if (opt.method === 'PUT') {
      cloud.puts++; cloud.store = JSON.parse(opt.body);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cloud.store) });
    }
    cloud.gets++;
    if (!cloud.store) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cloud.store) });
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://taizhendong.com/yining-literacy/',
  virtualConsole: vc,
  beforeParse(w) {
    w.fetch = mockFetch;
    w.speechSynthesis = { cancel() {}, speak() {} };
    w.SpeechSynthesisUtterance = function () {};
    w.prompt = () => null;
    w.confirm = () => true;
    w.alert = () => {};
    w.scrollTo = () => {};
  }
});
const { window } = dom;
const doc = window.document;
const $ = s => doc.querySelector(s);
const $$ = s => Array.from(doc.querySelectorAll(s));

const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  OK   ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); }
}
const btn = (act, i) => $$('#tiles [data-act="' + act + '"]')[i || 0];

(async () => {
  await wait(1000);
  const L = window.__lit;
  const k = Object.keys(L.db.days)[0];

  console.log('--- 渲染 ---');
  ok('今日渲染 5 张卡', $$('#tiles .tile').length === 5, '实际 ' + $$('#tiles .tile').length);
  ok('卡片显示汉字', $$('#tiles .hz').every(e => e.textContent.length === 1));
  ok('拼音已填充', $$('#tiles .py').filter(p => p.textContent.trim()).length === 5);
  ok('组词已填充', $$('#tiles .w span').length >= 10, $$('#tiles .w span').length + ' 个词');
  ok('大人可选', $$('#teachers .chip').length >= 5);
  ok('日期已渲染', /月.*日/.test($('#d-date').textContent));
  ok('处于筛选阶段', $('#t-phase').className.includes('sift'));
  ok('筛选阶段显示双按钮', !!btn('know') && !!btn('pick'));
  ok('阶段按钮是「换一批」', $('#t-reopen').textContent === '换一批', $('#t-reopen').textContent);
  ok('进度显示 0/5', $('#d-prog').textContent.includes('0 / 5'), $('#d-prog').textContent);

  console.log('--- 阶段一：筛选 ---');
  // 第 1 个字：本来就认识 → 换成新字，且不计入「今天学的」
  const c1 = $$('#tiles .hz')[0].textContent;
  btn('know').click();
  await wait(600);
  ok('认识的字被换走', $$('#tiles .hz')[0].textContent !== c1, c1 + ' → ' + $$('#tiles .hz')[0].textContent);
  ok('认识的字记为 known', L.db.learned[c1] && L.db.learned[c1].status === 'known');
  ok('来源是「本来就认识」', L.db.learned[c1].via === 'sift', L.db.learned[c1].via);
  ok('不算进今天要学的', L.db.days[k].sifted.length === 0);
  ok('卡片仍是 5 张', $$('#tiles .tile').length === 5);

  // 新的第 1 个字：不认识 → 留下
  const c2 = $$('#tiles .hz')[0].textContent;
  btn('pick').click();
  await wait(600);
  ok('不认识的字被选中', L.db.days[k].sifted.includes(c2), c2);
  ok('卡片盖了「学」章', !!$('#tiles .tile.picked .stamp'));
  ok('进度显示 1/5', $('#d-prog').textContent.includes('1 / 5'), $('#d-prog').textContent);

  btn('undo').click();
  await wait(400);
  ok('可以取消选择', !L.db.days[k].sifted.includes(c2));
  btn('pick').click();
  await wait(500);

  console.log('--- 集齐 5 个 → 自动锁定 ---');
  let guard = 0;
  while (L.db.days[k].sifted.length < 5 && guard++ < 12) {
    const b = $$('#tiles [data-act="pick"]')[0];
    if (!b) break;
    b.click();
    await wait(450);
  }
  await wait(300);
  ok('已集齐 5 个', L.db.days[k].sifted.length === 5, L.db.days[k].sifted.join(''));
  ok('自动进入学习阶段', L.db.days[k].phase === 'learn', L.db.days[k].phase);
  ok('picked 锁定 5 个字', L.db.days[k].picked.length === 5, L.db.days[k].picked.join(''));
  ok('筛选池已清空', L.db.days[k].pool.length === 0);
  ok('提示条显示「今天学这 5 个字」',
    $('#t-phase').className.includes('learn') && /今天学这 5 个字/.test($('#t-phase').textContent),
    $('#t-phase').textContent.slice(0, 16));
  ok('阶段按钮变成「重新挑」', $('#t-reopen').textContent === '重新挑');
  ok('Tab 计数 0/5', $('#n-today').textContent === '0/5', $('#n-today').textContent);

  console.log('--- 阶段二：学习（卡片不再更换）---');
  const locked = L.db.days[k].picked.slice();
  const lc = locked[0];
  btn('got').click();
  await wait(600);
  ok('学会的字记为 known', L.db.learned[lc].status === 'known');
  ok('来源是「当天学会」', L.db.learned[lc].via === 'learn', L.db.learned[lc].via);
  ok('卡片没被换走（锁定生效）', L.db.days[k].picked.join('') === locked.join(''),
    L.db.days[k].picked.join(''));
  ok('页面仍显示这 5 个字', $$('#tiles .hz').map(e => e.textContent).join('') === locked.join(''),
    $$('#tiles .hz').map(e => e.textContent).join(''));
  ok('进度显示 学会 1/5', $('#d-prog').textContent.includes('学会 1 / 5'), $('#d-prog').textContent);
  ok('Tab 计数 1/5', $('#n-today').textContent === '1/5', $('#n-today').textContent);

  const missC = $$('#tiles .hz')[1].textContent;
  btn('miss', 0).click();
  await wait(600);
  ok('没记住的字记为 fuzzy', L.db.learned[missC] && L.db.learned[missC].status === 'fuzzy', missC);
  ok('卡片依然没被换走', L.db.days[k].picked.join('') === locked.join(''));

  let g2 = 0;
  while ($$('#tiles [data-act="got"]').length && g2++ < 8) {
    $$('#tiles [data-act="got"]')[0].click();
    await wait(450);
  }
  ok('可以全部学完', L.db.days[k].picked.every(c => L.db.learned[c].status === 'known'),
    L.db.days[k].picked.join(''));
  ok('学完卡片依然在（不换字）', L.db.days[k].picked.length === 5);
  ok('进度显示 5/5', $('#d-prog').textContent.includes('5 / 5'), $('#d-prog').textContent);

  console.log('--- 筛选的字不算今天学的 ---');
  ok('本来就认识的字不在 picked 里', !L.db.days[k].picked.includes(c1), c1);
  ok('它仍留在 history 记录里', L.db.days[k].history.includes(c1));
  ok('已掌握 = 5 学会 + 1 本来会',
    Object.values(L.db.learned).filter(e => e.status === 'known').length === 6,
    Object.values(L.db.learned).filter(e => e.status === 'known').length + ' 个');

  console.log('--- 抽查 ---');
  $$('.tab')[1].click();
  await wait(250);
  ok('抽查卡片渲染', !!$('#q-body .tz .hz'));
  $$('#q-body [data-qa="right"]')[0].click();
  await wait(300);
  ok('抽查计数 +1', L.quizTotal() === 1, JSON.stringify(L.db.quiz));

  console.log('--- 字库 ---');
  $$('.tab')[2].click();
  await wait(250);
  ok('字库渲染出格子', $$('#lib-grid .cell').length > 100, $$('#lib-grid .cell').length + ' 个');
  ok('已学的字标为已掌握', $$('#lib-grid .cell.k').length >= 5, $$('#lib-grid .cell.k').length + ' 个');
  $('#lib-status .chip[data-ls="k"]').click();
  await wait(200);
  ok('筛选「已掌握」生效', $$('#lib-grid .cell').length === $$('#lib-grid .cell.k').length);

  console.log('--- 记录 ---');
  $$('.tab')[3].click();
  await wait(250);
  ok('记录列表有条目', $$('#log-list .e').length === 1);
  ok('记录显示「学了 5 个字」', /学了 5 个字/.test($('#log-list .et').textContent),
    $('#log-list .et').textContent);
  ok('记录显示「本来就会」', /本来就会/.test($('#log-list .et').textContent));
  ok('记录含 6 个字（5 学的 + 1 本来会）', $$('#log-list .ec b').length === 6,
    $$('#log-list .ec b').length + ' 个');

  console.log('--- 统计 ---');
  $$('.tab')[4].click();
  await wait(250);
  ok('已掌握 ≥ 6', +$('#k-known').textContent >= 6, $('#k-known').textContent);
  ok('连续天数 = 1', $('#k-day').textContent === '1');
  ok('进度条渲染', $$('#bars .bar').length >= 4, $$('#bars .bar').length + ' 条');

  console.log('--- 导出 ---');
  let dl = null;
  window.URL.createObjectURL = b => { dl = b; return 'blob:mock'; };
  window.URL.revokeObjectURL = () => {};
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = tag => {
    const el = origCreate(tag);
    if (String(tag).toLowerCase() === 'a') el.click = () => {};
    return el;
  };
  $('#s-report').click();
  await wait(100);
  const rpt = dl ? await dl.text() : '';
  ok('报告已生成', !!dl && dl.size > 2000, dl ? dl.size + ' 字节' : '未生成');
  ok('报告含 KPI', /已掌握[\s\S]*需巩固[\s\S]*剩余/.test(rpt));
  ok('报告含曲线 SVG', rpt.includes('<svg') && rpt.includes('polyline'));
  ok('报告含热力图', rpt.includes('class="heat"'));
  ok('报告含「本来就认识」列', rpt.includes('本来就认识'));
  ok('报告自包含', !/src="https?:|href="https?:/.test(rpt));
  ok('报告无 JS 依赖', !/<script/i.test(rpt));

  dl = null;
  $('#s-csv').click();
  await wait(100);
  const csv = dl ? await dl.text() : '';
  ok('CSV 表头正确', (csv.split('\n')[0] || '').replace(/^\ufeff/, '') === '字,拼音,册次,状态,日期,教的人,来源',
    JSON.stringify((csv.split('\n')[0] || '').replace(/^\ufeff/, '')));
  ok('CSV 含「本来就认识」来源', csv.includes('本来就认识'));
  ok('CSV 含每日记录段', csv.includes('当天学的字'));

  console.log('--- 多端合并 ---');
  const mine = Object.keys(L.db.learned).length;
  const other = JSON.parse(JSON.stringify(cloud.store));
  const poolChars = JSON.parse(charsRaw).grades.flatMap(g => g.chars.map(a => a[0]));
  const oc = poolChars.find(c => !other.learned[c] && !(other.days[k].history || []).includes(c));
  other.learned[oc] = { status: 'known', date: k, teacher: '奶奶', via: 'learn' };
  other.days[k].picked.push(oc);
  other.days[k].history.push(oc);
  other.quiz[k] = { devOther: [7, 9] };
  cloud.store = other;

  await L.syncPull();
  await wait(400);
  ok('本机记录还在', !!L.db.learned[lc], lc);
  ok('拿到另一台设备的字', !!L.db.learned[oc], oc);
  ok('两边都在', Object.keys(L.db.learned).length >= mine + 1,
    mine + ' → ' + Object.keys(L.db.learned).length);
  ok('抽查计数累加', L.quizTotal() >= 10, L.quizTotal() + ' 题');
  ok('合并后仍是学习阶段', L.db.days[k].phase === 'learn');

  console.log('--- 跨设备：选中的字不能被顶掉 ---');
  {
    const D = L.db.days[k];
    // 构造线上真实坏数据：sifted 里的字被挤出 pool（旧合并规则的产物）
    // 必须用字库里真实存在的字，否则会被 normalize 的缺字清理掉
    const PICK = JSON.parse(charsRaw).grades.flatMap(g => g.chars.map(a => a[0]));
    const pick = i => PICK[200 + i];
    const fakePool = [0, 1, 2, 3, 4].map(pick);
    const fakeSift = [5, 6].map(pick);
    D.pool = fakePool.slice();
    D.sifted = fakeSift.slice();
    D.history = D.history.concat(fakePool, fakeSift);
    D.phase = 'sift';
    // base 是「另一台设备」的数据（卡片完全不同），incoming 是本机坏数据
    const mk = (pool, sifted, at) => ({
      teacher: '妈妈', phase: 'sift', pool: pool, sifted: sifted, picked: [],
      history: pool.concat(sifted), at: at
    });
    const base = { version: 3, days: {}, learned: {}, quiz: {} };
    base.days[k] = mk([5, 6, 7, 8, 9].map(pick), [], '2026-10-16T01:00:00.000Z');
    const incoming = { version: 3, days: {}, learned: {}, quiz: {} };
    incoming.days[k] = mk(fakePool, fakeSift, '2026-10-16T02:00:00.000Z');
    const m = window.__lit.mergeDB(base, incoming);
    const md = m.db.days[k];
    ok('合并后 sifted ⊆ pool（不同源会被自愈）',
      md.sifted.every(c => md.pool.includes(c)),
      'sifted=' + md.sifted.join('') + ' pool=' + md.pool.join(''));
    ok('选中的字被保留下来', md.sifted.length === 2, md.sifted.join(''));
    ok('卡片仍是 5 张', md.pool.length === 5, md.pool.join(''));
    // 还原
    D.pool = fakePool.slice();
    D.sifted = [];
  }

  console.log('--- 重新挑一遍 ---');
  L.reopenSift();
  await wait(400);
  ok('回到筛选阶段', L.db.days[k].phase === 'sift');
  ok('已学的字仍在记录里', L.db.days[k].history.length >= 6, L.db.days[k].history.length + ' 个');
  ok('筛选池补满 5 个', L.db.days[k].pool.length === 5, L.db.days[k].pool.join(''));
  ok('选中的字清空', L.db.days[k].sifted.length === 0);
  ok('回到筛选阶段按钮变回「换一批」', $('#t-reopen').textContent === '换一批');

  console.log('\n--- 运行时错误 ---');
  if (errors.length) { errors.slice(0, 8).forEach(e => console.log('  ' + e)); fail += errors.length; }
  else console.log('  无');

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
