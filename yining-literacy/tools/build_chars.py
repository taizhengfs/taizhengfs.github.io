#!/usr/bin/env python3
"""最终字库：多源交叉验证 + pypinyin 生成拼音 + 组词合并。"""
import re
import json
import importlib.util
from pypinyin import pinyin, Style

spec = importlib.util.spec_from_file_location('bc', '/tmp/build_chars3.py')
bc = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(bc)
except SystemExit:
    pass

# 教材口径：统编版一二年级识字表（会认字）
SOURCES = {
    'g1a': ('一年级上册', 300, ['https://www.ixuehai.cn/html/1908.html',
                             'https://www.yidocs.com/doc/5122672921.html']),
    'g1b': ('一年级下册', 400, ['https://www.ixuehai.cn/html/4547.html']),
    'g2a': ('二年级上册', 450, ['https://www.ixuehai.cn/html/2005.html',
                             'https://www.yidocs.com/doc/1f10406668.html']),
    'g2b': ('二年级下册', 450, ['http://www.bodocs.net/doc/448710951.html']),
}


EXTRA_WORDS = {
    'g2b': ['https://www.ixuehai.cn/html/2027.html'],
    'g2a': ['https://www.ixuehai.cn/html/2004.html'],
}


def scrape(urls):
    bags = []
    for u in urls:
        html = bc.fetch(u)
        if not html:
            continue
        bag = {}
        # bodocs 是「字+拼音」排版，关掉拼音优先匹配可显著降噪
        bc.collect(bc.strip_html(html), bag, py_first=('bodocs' not in u))
        print('   %-56s %d 字' % (u[:56], len(bag)))
        bags.append(bag)
    return bags


W_PAT = __import__('re').compile(r'([\u4e00-\u9fa5])\s*[(（]([^)）]{2,40})[)）]')


def collect_words(text, bag):
    import re
    n = 0
    for m in W_PAT.finditer(text):
        ch = m.group(1)
        if ch not in bag:
            continue
        ws = [w.strip() for w in re.split(r'[\s\u3000、,，/]+', m.group(2))
              if re.search(r'[\u4e00-\u9fa5]', w) and 2 <= len(w.strip()) <= 6]
        for w in ws:
            if w not in bag[ch]['w']:
                bag[ch]['w'].append(w)
                n += 1
    return n


def main():
    out, report = {}, []
    for key, (name, expect, urls) in SOURCES.items():
        print('== %s %s（教材约 %d 字）' % (key, name, expect))
        bags = scrape(urls)
        if not bags:
            continue
        # 单源：直接用；多源：取交集过滤噪声
        if len(bags) == 1:
            merged = dict(bags[0])
            inter = set(merged)
        else:
            inter = set(bags[0])
            for b in bags[1:]:
                inter &= set(b)
            merged = {}
            for b in bags:
                for ch, e in b.items():
                    if ch not in inter:
                        continue
                    t = merged.setdefault(ch, {'p': '', 'w': []})
                    t['p'] = t['p'] or e['p']
                    for w in e['w']:
                        if w not in t['w']:
                            t['w'].append(w)
        # 组词补充源（词语表格式），只给已有字补词
        for extra in EXTRA_WORDS.get(key, []):
            html = bc.fetch(extra)
            if not html:
                continue
            n = collect_words(bc.strip_html(html), merged)
            print('   组词补充 %-40s +%d 条' % (extra[:40], n))
        rows = []
        for ch in sorted(inter):
            e = merged.get(ch, {'w': []})
            try:
                py = pinyin(ch, style=Style.TONE)[0][0]
            except Exception:
                py = e.get('p', '')
            rows.append({'c': ch, 'p': py, 'w': e.get('w', [])[:3]})
        out[key] = {'name': name, 'expect': expect, 'count': len(rows), 'chars': rows}
        report.append((name, expect, len(rows), sum(1 for r in rows if r['w'])))
        print('   → 交集 %d 字｜有组词 %d 字' % (len(rows), sum(1 for r in rows if r['w'])))

    with open('/tmp/chars_final.json', 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print('\n%-12s %8s %8s %10s' % ('册', '教材', '实得', '有组词'))
    for name, exp, got, wc in report:
        flag = 'OK' if abs(got - exp) <= exp * 0.12 else '偏差'
        print('%-12s %8d %8d %10d   %s' % (name, exp, got, wc, flag))
    print('\n合计 %d 字' % sum(v['count'] for v in out.values()))


if __name__ == '__main__':
    main()
