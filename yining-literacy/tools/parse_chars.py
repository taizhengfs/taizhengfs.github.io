#!/usr/bin/env python3
"""构建一二年级识字表（会认字）字库。
- 字表 / 组词：从网页抽取
- 拼音：用 pypinyin 生成（避免网页注音错误）
"""
import re
import json
import ssl
import urllib.request
from pypinyin import pinyin, Style

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

SOURCES = {
    'g1a': ('一年级上册', ['https://www.ixuehai.cn/html/1908.html']),
    'g1b': ('一年级下册', ['https://www.ixuehai.cn/html/4547.html']),
    'g2a': ('二年级上册', ['https://www.ixuehai.cn/html/2005.html']),
    'g2b': ('二年级下册', ['http://www.bodocs.net/doc/448710951.html',
                       'https://sn.qinxue100.com/news/201908/141928.html']),
}
EXPECT = {'g1a': 300, 'g1b': 400, 'g2a': 450, 'g2b': 450}

INIT = r'(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])'
VOWEL = r'[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜăĕĭŏŭ]'
TAIL = r'(?:n\u0261|ng|n|r)'
PY = INIT + r'?' + VOWEL + r'{1,3}' + TAIL + r'?' + r'[1-5]?'
HAN = r'([\u4e00-\u9fa5])'

P_CHAR_FIRST = re.compile(HAN + r'\s*(' + PY + r')((?:[\s　]*[(（][^)）]{1,14}[)）]){0,8})')
P_CHAR_PAREN = re.compile(HAN + r'\s*[\(（]\s*(' + PY + r')\s*[\)）]((?:[\s　]*[(（][^)）]{1,14}[)）]){0,8})')
P_PY_FIRST = re.compile(r'(' + PY + r')\s*' + HAN + r'((?:[\s　]*[(（][^)）]{1,14}[)）]){0,8})')


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        raw = urllib.request.urlopen(req, timeout=40, context=CTX).read()
    except Exception as e:
        print('   × %s' % e)
        return ''
    try:
        return raw.decode('utf-8')
    except UnicodeDecodeError:
        return raw.decode('gb18030', errors='ignore')


def strip_html(html):
    html = re.sub(r'(?is)<(script|style).*?</\1>', ' ', html)
    m = re.search(r'(?is)<body[^>]*>(.*?)</body>', html)
    text = re.sub(r'(?s)<[^>]+>', '\n', m.group(1) if m else html)
    return re.sub(r'&nbsp;|&#160;|&[a-z]+;', ' ', text)


def collect(text, bag, py_first=True):
    def add(ch, py, groups):
        raw = re.findall(r'[(（]([^)）]{1,40})[)）]', groups or '')
        words = []
        for g in raw:
            for w in re.split(r'[\s\u3000、,，/]+', g):
                w = w.strip()
                if re.search(r'[\u4e00-\u9fa5]', w) and 2 <= len(w) <= 6:
                    words.append(w)
        e = bag.setdefault(ch, {'p': '', 'w': []})
        if not e['p'] and py:
            e['p'] = py
        for w in words:
            if w not in e['w']:
                e['w'].append(w)

    pats = [(P_CHAR_FIRST, True), (P_CHAR_PAREN, True)]
    if py_first:
        pats.append((P_PY_FIRST, False))
    for pat, cfirst in pats:
        for m in pat.finditer(text):
            if cfirst:
                add(m.group(1), m.group(2), m.group(3))
            else:
                add(m.group(2), m.group(1), m.group(3))


def main():
    out = {}
    for key, (name, urls) in SOURCES.items():
        bag = {}
        for u in urls:
            html = fetch(u)
            if html:
                collect(strip_html(html), bag)
                print('   ↳ %s 累积 %d 字' % (u[:46], len(bag)))
        rows = []
        for ch, e in bag.items():
            try:
                py = pinyin(ch, style=Style.TONE)[0][0]
            except Exception:
                py = e['p']
            rows.append({'c': ch, 'p': py, 'w': e['w'][:3]})
        rows.sort(key=lambda r: r['c'])
        out[key] = {'name': name, 'expect': EXPECT[key], 'count': len(rows), 'chars': rows}
        print('== %s %s: %d 字（教材约 %d）｜有组词 %d'
              % (key, name, len(rows), EXPECT[key], sum(1 for r in rows if r['w'])))

    with open('/tmp/chars_final.json', 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    total = sum(v['count'] for v in out.values())
    print('\n合计 %d 字 → /tmp/chars_final.json' % total)


if __name__ == '__main__':
    main()
