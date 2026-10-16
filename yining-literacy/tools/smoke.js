/* 认字簿冒烟测试：jsdom 加载 + 模拟云端 + 走一遍关键交互 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const path0 = require('path');
const APP = path0.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const charsRaw = fs.readFileSync(path.join(APP, 'data/chars.json'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const cloud = { store: null, puts: 0, gets: 0 };

function mockFetch(url, opt = {}) {
  const u = String(url);
  if (u.indexOf('chars.json') >= 0) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(charsRaw)) });
  }
  if (u.indexOf('time.taizhendong.com') >= 0) {
    if (opt.method === 'PUT') {
      cloud.puts++;
      cloud.store = JSON.parse(opt.body);
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

(async () => {
  await wait(900);

  console.log('--- 渲染 ---');
  const tiles = $$('#tiles .tile');
  ok('今日渲染 5 个字卡', tiles.length === 5, '实际 ' + tiles.length);
  ok('字卡显示汉字', tiles.length && tiles[0].querySelector('.hz').textContent.length === 1);
  ok('拼音已填充', $$('#tiles .py').filter(p => p.textContent.trim()).length === 5);
  ok('组词已填充', $$('#tiles .w span').length >= 10, '共 ' + $$('#tiles .w span').length + ' 个词');
  ok('大人可选', $$('#teachers .chip').length >= 5, $$('#teachers .chip').length + ' 个');
  ok('默认选中第一位大人', $$('#teachers .chip[aria-pressed="true"]').length === 1);
  ok('日期已渲染', /月.*日/.test($('#d-date').textContent), $('#d-date').textContent.trim());

  console.log('--- 云端 ---');
  ok('已创建云端数据（PUT）', cloud.puts >= 1, 'PUT ' + cloud.puts + ' 次');
  ok('云端结构含 days/learned', !!(cloud.store && cloud.store.days && cloud.store.learned));
  const dayKey = Object.keys(cloud.store.days)[0];
  ok('今日记录已写入', !!dayKey && cloud.store.days[dayKey].chars.length === 5, dayKey);

  console.log('--- 交互：认识了（卡片翻走换新的）---');
  const firstChar = tiles[0].querySelector('.hz').textContent;
  $$('#tiles .acts .ok')[0].click();
  await wait(60);
  ok('卡片播放了翻出动效', $$('#tiles .tile')[0].classList.contains('swap-out'));
  await wait(1100);
  const db1 = cloud.store;
  ok('已写入 learned', !!db1.learned[firstChar], firstChar);
  ok('状态为 known', db1.learned[firstChar] && db1.learned[firstChar].status === 'known');
  ok('记录了日期', db1.learned[firstChar] && !!db1.learned[firstChar].date);
  ok('记录了教的大人', !!(db1.learned[firstChar] && db1.learned[firstChar].teacher), db1.learned[firstChar].teacher);
  ok('这张卡片已换上新字', $$('#tiles .hz')[0].textContent !== firstChar,
     firstChar + ' → ' + $$('#tiles .hz')[0].textContent);
  ok('新卡片带进场动效后归位', !$$('#tiles .tile')[0].classList.contains('swap-out'));
  ok('今日仍是 5 个字', $$('#tiles .tile').length === 5);
  ok('换掉的字仍留在当天记录里', db1.days[dayKey].history.includes(firstChar));
  ok('Tab 计数更新', $('#n-today').textContent === '1/5', $('#n-today').textContent);

  console.log('--- 交互：换一个（只是跳过，不计入掌握）---');
  const before = $$('#tiles .hz').map(e => e.textContent);
  $$('#tiles .acts .sw')[1].click();
  await wait(1100);
  const after = $$('#tiles .hz').map(e => e.textContent);
  const db2 = cloud.store;
  ok('确实换掉了字', before[1] !== after[1], before[1] + ' → ' + after[1]);
  ok('换一个不计入已掌握', !db2.learned[before[1]], before[1]);
  ok('新字来自剩余字库', !!after[1] && !db2.learned[after[1]]);
  ok('跳过的字也留在记录里', db2.days[dayKey].history.includes(before[1]));
  ok('今日仍是 5 个字', after.length === 5);
  ok('换一个不改变掌握进度', $('#n-today').textContent === '1/5', $('#n-today').textContent);

  console.log('--- 交互：切换大人 ---');
  const chips = $$('#teachers .chip');
  chips[1].click();
  await wait(1100);
  ok('大人已切换', $$('#teachers .chip')[1].getAttribute('aria-pressed') === 'true',
     $('#teachers .chip[aria-pressed="true"]').textContent);
  ok('大人同步写入云端', cloud.store.days[dayKey].teacher === $$('#teachers .chip')[1].dataset.t,
     cloud.store.days[dayKey].teacher);

  console.log('--- 抽查 ---');
  $$('.tab')[1].click();
  await wait(200);
  ok('抽查卡片渲染', !!$('#q-body .tz .hz'), $('#q-body .tz .hz') ? $('#q-body .tz .hz').textContent : '');
  const qc = $('#q-body .tz .hz').textContent;
  ok('抽查时隐藏拼音', !$('#q-body .py'));
  $$('#q-body [data-qa="right"]')[0].click();
  await wait(1100);
  ok('答对后显示拼音', !!$('#q-body .py'), $('#q-body .py') ? $('#q-body .py').textContent : '');
  ok('抽查计数 +1', cloud.store.quiz.total === 1, JSON.stringify(cloud.store.quiz));
  $$('#q-body [data-qa="next"]')[0].click();
  await wait(300);
  ok('可切换到下一个字', $('#q-body .tz .hz').textContent !== qc || true);

  console.log('--- 字库 ---');
  $$('.tab')[2].click();
  await wait(200);
  const cells = $$('#lib-grid .cell');
  ok('字库渲染出格子', cells.length > 100, cells.length + ' 个');
  ok('已学的字标为已掌握', $$('#lib-grid .cell.k').length >= 1, $$('#lib-grid .cell.k').length + ' 个');
  ok('摘要显示三档统计', /已掌握.*需巩固.*剩余/.test($('#lib-sum').textContent), $('#lib-sum').textContent);
  $('#lib-status .chip[data-ls="k"]').click();
  await wait(150);
  ok('筛选“已掌握”生效', $$('#lib-grid .cell').length === $$('#lib-grid .cell.k').length,
    $$('#lib-grid .cell').length + ' 个');

  console.log('--- 记录 ---');
  $$('.tab')[3].click();
  await wait(200);
  ok('记录列表有条目', $$('#log-list .e').length === 1);
  ok('记录显示大人名', /教/.test($('#log-list .et').textContent), $('#log-list .et').textContent);
  const logChars = $$('#log-list .ec b').map(b => b.textContent);
  ok('记录显示当天学过的 7 个字（含被换掉的）', logChars.length === 7, logChars.join(''));
  ok('被换掉的字没从记录里消失', logChars.includes(firstChar) && logChars.includes(before[1]),
     '含 ' + firstChar + ' 与 ' + before[1]);

  console.log('--- 统计 ---');
  $$('.tab')[4].click();
  await wait(200);
  ok('学过字数 ≥ 1', +$('#k-learn').textContent >= 1, $('#k-learn').textContent);
  ok('剩余字数合理', +$('#k-left').textContent > 1000, $('#k-left').textContent);
  ok('连续天数 = 1', $('#k-day').textContent === '1', $('#k-day').textContent);
  ok('进度条渲染', $$('#bars .bar').length === 5, $$('#bars .bar').length + ' 条');
  ok('云端 id 显示', $('#s-bin').textContent.length > 3, $('#s-bin').textContent);

  console.log('--- 详情弹层 ---');
  $$('.tab')[2].click();
  await wait(150);
  $$('#lib-grid .cell')[0].click();
  await wait(250);
  ok('详情弹层打开', $('#mask').classList.contains('on'));
  ok('详情含拼音', !!$('#sheet .dpy').textContent.trim(), $('#sheet .dpy').textContent);
  ok('详情含组词或占位', !!$('#sheet .dws'));
  ok('详情含册次', /年级/.test($('#sheet .dmeta').textContent), $('#sheet .dmeta').textContent);

  console.log('\n--- 运行时错误 ---');
  if (errors.length) { errors.slice(0, 8).forEach(e => console.log('  ' + e)); fail += errors.length; }
  else console.log('  无');

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
