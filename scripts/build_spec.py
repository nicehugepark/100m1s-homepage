#!/usr/bin/env python3
"""
홈페이지 /spec/ 정적 빌더.

입력: 100m1s 메인 레포의 REQ-001 + DSN-001 마크다운
출력: 100m1s-homepage 레포의 /spec/{index,feature,design}.html

사용:
    python3 scripts/build_spec.py

빌드 시점:
    - 명세 본문(100m1s 메인 레포) 수정 시 수동 또는 cron
    - 본 스크립트는 100m1s-homepage 레포 내부에 위치, 메인 레포는 read-only로 참조
"""

from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import markdown

REPO_ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = REPO_ROOT / "spec"
MAIN_REPO = REPO_ROOT.parent / "100m1s"
SOURCES = {
    "feature": MAIN_REPO / "records/2026-05/DOC-20260513-REQ-001-public.md",
    "design": MAIN_REPO / "records/2026-05/DOC-20260513-DSN-001-public.md",
}
TITLES = {
    "feature": "기능 요구사항 정의서",
    "design": "디자인 요구사항 정의서",
}
ICONS = {"feature": "REQ", "design": "DSN"}

SANITIZE_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
SANITIZE_LOCAL_PATH_RE = re.compile(r"(/Users/|~/company/)")
SANITIZE_KEYWORDS = [
    "nicehugepark",
    "키움 API 키",
    "Gemini API",
    "Google AI API",
    "Option C",
    "카페 법적 리스크",
    "카페 데이터 법적 리스크",
    "Trade Cockpit",
    "lab/",
    "P005 Trade",
    "휴지",
    "타치코마",
    "이시카와",
    "토구사",
    "HUGEPARK",
    "TACHIKOMA",
    "박성진",
    "MIN-001",
    "DEC-001",
]


def _check_sanitize(content: str, label: str) -> list[str]:
    """sanitize 게이트 — 보안 민감 정보 9 카테고리 grep. 위반 list 반환 (빈 list = PASS)."""
    violations: list[str] = []
    for m in SANITIZE_EMAIL_RE.finditer(content):
        violations.append(f"[{label}] EMAIL: {m.group(0)!r}")
    for m in SANITIZE_LOCAL_PATH_RE.finditer(content):
        violations.append(f"[{label}] LOCAL_PATH: {m.group(0)!r}")
    for kw in SANITIZE_KEYWORDS:
        if kw in content:
            violations.append(f"[{label}] KEYWORD: {kw!r}")
    return violations


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
H_RE = re.compile(r"^(#{2,3})\s+(.+?)\s*$", re.MULTILINE)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """YAML frontmatter 추출 (간단 line-by-line 파싱)."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    raw = m.group(1)
    body = text[m.end() :]
    meta: dict = {}
    current_key = None
    current_list: list[str] | None = None
    multiline_buf: list[str] | None = None
    for line in raw.split("\n"):
        if multiline_buf is not None:
            if line.startswith("  ") or line.strip() == "":
                multiline_buf.append(line[2:] if line.startswith("  ") else "")
                continue
            meta[current_key] = "\n".join(multiline_buf).rstrip()
            multiline_buf = None
            current_key = None
        if current_list is not None:
            if line.startswith("  - "):
                current_list.append(line[4:].strip().strip('"'))
                continue
            current_list = None
            current_key = None
        if not line.strip() or line.startswith("#"):
            continue
        if line.startswith("  "):
            continue
        if ":" in line:
            k, _, v = line.partition(":")
            k = k.strip()
            v = v.strip()
            if v == "|":
                current_key = k
                multiline_buf = []
            elif v == "":
                current_key = k
                current_list = []
                meta[k] = current_list
            else:
                meta[k] = v.strip().strip('"')
    if multiline_buf is not None and current_key:
        meta[current_key] = "\n".join(multiline_buf).rstrip()
    return meta, body


def slugify(text: str) -> str:
    text = re.sub(r"[\s/]+", "-", text.strip())
    text = re.sub(r"[^\w\-가-힣]", "", text)
    return text.lower()[:80]


def extract_toc(body: str) -> list[dict]:
    """h2/h3 추출 (h1은 페이지 타이틀로 대체)."""
    toc: list[dict] = []
    seen: dict[str, int] = {}
    for m in H_RE.finditer(body):
        level = len(m.group(1))
        text = m.group(2).strip()
        # 인용 블록(>) 내부 헤더는 제외
        line_start = body.rfind("\n", 0, m.start()) + 1
        if body[line_start : m.start()].lstrip().startswith(">"):
            continue
        slug = slugify(text) or f"h-{len(toc)}"
        if slug in seen:
            seen[slug] += 1
            slug = f"{slug}-{seen[slug]}"
        else:
            seen[slug] = 0
        toc.append({"level": level, "text": text, "slug": slug})
    return toc


def assign_slugs(html_body: str, toc: list[dict]) -> str:
    """렌더링된 HTML h2/h3에 toc 슬러그 id 주입 (등장 순서대로)."""
    idx = [0]

    def repl(m: re.Match) -> str:
        tag = m.group(1)
        attrs = m.group(2) or ""
        inner = m.group(3)
        # 이미 id가 있으면 그대로
        if "id=" in attrs:
            return m.group(0)
        if idx[0] >= len(toc):
            return m.group(0)
        item = toc[idx[0]]
        idx[0] += 1
        return f'<{tag}{attrs} id="{item["slug"]}">{inner}</{tag}>'

    return re.sub(r"<(h[23])([^>]*)>(.*?)</\1>", repl, html_body, flags=re.DOTALL)


def render_md(body: str) -> str:
    md = markdown.Markdown(
        extensions=["extra", "tables", "fenced_code", "sane_lists", "nl2br"],
        output_format="html5",
    )
    return md.convert(body)


def fmt_meta_value(v) -> str:
    if isinstance(v, list):
        if not v:
            return "<em>없음</em>"
        return (
            "<ul class='meta-list'>"
            + "".join(f"<li>{html.escape(x)}</li>" for x in v)
            + "</ul>"
        )
    return html.escape(str(v))


PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — 100M1S</title>
<meta name="description" content="{desc}">
<meta name="robots" content="noindex, nofollow">
<meta property="og:title" content="{title} — 100M1S">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://100m1s.com/spec/{slug}.html">
<meta property="og:image" content="https://100m1s.com/og-image.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/spec/spec.css?v={ver}">
</head>
<body>

<header class="spec-header">
  <div class="spec-header-inner">
    <a href="/" class="brand">
      <div class="brand-mark">
        <svg viewBox="0 0 124 124" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#FBE9B5"/>
              <stop offset="0.5" stop-color="#E8C063"/>
              <stop offset="1" stop-color="#C49930"/>
            </linearGradient>
          </defs>
          <g transform="translate(5, 3.5)">
            <path d="M73 24 Q73 12 59 12 Q32 12 32 33 Q32 53 58 57 Q88 61 67 86 Q46 105 26 95" stroke="url(#hg)" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="74" cy="18" r="3.8" fill="#A01528"/>
            <circle cx="72.5" cy="16.5" r="1.1" fill="#FFE4D8" opacity="0.85"/>
          </g>
        </svg>
      </div>
      <div class="brand-name">100M1S</div>
    </a>
    <nav class="nav-links">
      <a href="/#about">About</a>
      <a href="/#products">Products</a>
      <a href="/news.html">News</a>
      <a href="/spec/" class="active">Spec</a>
      <a href="/#contact">Contact</a>
    </nav>
    <button class="menu-toggle" id="menu-toggle" aria-label="메뉴 열기" aria-expanded="false"><span></span></button>
  </div>
</header>
<div class="drawer-backdrop" id="drawer-backdrop"></div>
<nav class="mobile-drawer" id="mobile-drawer" aria-label="모바일 메뉴">
  <a href="/#about">About</a>
  <a href="/#products">Products</a>
  <a href="/news.html">News</a>
  <a href="/spec/" class="active">Spec</a>
  <a href="/#contact">Contact</a>
</nav>
<script src="/menu.js"></script>

<main class="spec-layout">
  {nav_section}
  <article class="spec-doc">
    <div class="spec-eyebrow"><span class="kind-badge">{icon}</span> {doc_id}</div>
    <h1 class="spec-title">{title}</h1>
    <div class="spec-summary">{summary}</div>
    <details class="spec-meta">
      <summary>문서 메타정보</summary>
      <dl>{meta_dl}</dl>
    </details>
    <div class="spec-body">{body}</div>
    <div class="spec-footer">
      <div>본 문서는 자동 빌드되었습니다 (build: {build_ts})</div>
      <div><a href="/spec/">/spec/ 목차로 돌아가기</a></div>
    </div>
  </article>
</main>

</body>
</html>
"""


INDEX_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spec — 100M1S</title>
<meta name="description" content="100M1S 요구사항 정의서 모음.">
<meta name="robots" content="noindex, nofollow">
<meta property="og:title" content="Spec — 100M1S">
<meta property="og:description" content="100M1S 요구사항 정의서 모음.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://100m1s.com/spec/">
<meta property="og:image" content="https://100m1s.com/og-image.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/spec/spec.css?v={ver}">
</head>
<body>

<header class="spec-header">
  <div class="spec-header-inner">
    <a href="/" class="brand">
      <div class="brand-mark">
        <svg viewBox="0 0 124 124" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#FBE9B5"/>
              <stop offset="0.5" stop-color="#E8C063"/>
              <stop offset="1" stop-color="#C49930"/>
            </linearGradient>
          </defs>
          <g transform="translate(5, 3.5)">
            <path d="M73 24 Q73 12 59 12 Q32 12 32 33 Q32 53 58 57 Q88 61 67 86 Q46 105 26 95" stroke="url(#hg)" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="74" cy="18" r="3.8" fill="#A01528"/>
            <circle cx="72.5" cy="16.5" r="1.1" fill="#FFE4D8" opacity="0.85"/>
          </g>
        </svg>
      </div>
      <div class="brand-name">100M1S</div>
    </a>
    <nav class="nav-links">
      <a href="/#about">About</a>
      <a href="/#products">Products</a>
      <a href="/news.html">News</a>
      <a href="/spec/" class="active">Spec</a>
      <a href="/#contact">Contact</a>
    </nav>
    <button class="menu-toggle" id="menu-toggle" aria-label="메뉴 열기" aria-expanded="false"><span></span></button>
  </div>
</header>
<div class="drawer-backdrop" id="drawer-backdrop"></div>
<nav class="mobile-drawer" id="mobile-drawer" aria-label="모바일 메뉴">
  <a href="/#about">About</a>
  <a href="/#products">Products</a>
  <a href="/news.html">News</a>
  <a href="/spec/" class="active">Spec</a>
  <a href="/#contact">Contact</a>
</nav>
<script src="/menu.js"></script>

<main class="spec-index">
  <div class="spec-eyebrow">100M1S Spec</div>
  <h1 class="spec-title">요구사항 정의서</h1>
  <p class="spec-lead">2026-04-05 이후 누적된 기능·디자인 결정·결함을 종합한 1차 정의서. <br>분기 1회 갱신, 신규 REQ는 records/에 별도 등록.</p>
  <div class="spec-cards">
    {cards}
  </div>
  <div class="spec-footer">
    <div>build: {build_ts}</div>
    <div><a href="/">홈으로</a></div>
  </div>
</main>

</body>
</html>
"""


CSS = """
:root {
  --bg: #FAFBFE;
  --bg2: #F2F4F8;
  --sf: #FFFFFF;
  --sf2: #F7F8FB;
  --bd: #E8ECF2;
  --bd2: #D9DFE9;
  --tx: #1A1D26;
  --tx2: #3D4351;
  --dm: #8B95A8;
  --dm2: #B0B8C9;
  --am: #C49930;
  --am2: #E8C063;
  --am3: #FBE9B5;
  --am4: #FFF6E5;
  --ru: #A01528;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--tx); -webkit-font-smoothing: antialiased; scroll-behavior: smooth; }
body { min-height: 100vh; line-height: 1.6; }
a { color: inherit; text-decoration: none; }

.spec-header {
  position: sticky; top: 0; z-index: 100;
  background: rgba(250, 251, 254, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--bd);
}
.spec-header-inner {
  max-width: 1280px; margin: 0 auto;
  padding: 14px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand-mark { width: 32px; height: 32px; }
.brand-mark svg { width: 100%; height: 100%; }
.brand-name { font-size: 17px; font-weight: 900; letter-spacing: -0.5px; }
.nav-links { display: flex; gap: 24px; font-size: 13px; font-weight: 600; color: var(--tx2); }
.nav-links a:hover { color: var(--am); }
.nav-links a.active { color: var(--am); }

.menu-toggle {
  display: none; width: 40px; height: 40px;
  align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer; padding: 0;
}
.menu-toggle span { display: block; width: 22px; height: 2px; background: var(--tx); position: relative; }
.menu-toggle span::before, .menu-toggle span::after {
  content: ''; position: absolute; left: 0; width: 22px; height: 2px; background: var(--tx); transition: transform .2s;
}
.menu-toggle span::before { top: -7px; }
.menu-toggle span::after { top: 7px; }
.menu-toggle.open span { background: transparent; }
.menu-toggle.open span::before { top: 0; transform: rotate(45deg); }
.menu-toggle.open span::after { top: 0; transform: rotate(-45deg); }

.mobile-drawer {
  display: none; position: fixed; top: 0; right: 0;
  width: 75%; max-width: 300px; height: 100vh;
  background: var(--sf); border-left: 1px solid var(--bd);
  padding: 80px 28px 24px; z-index: 200;
  transform: translateX(100%); transition: transform .25s ease-out;
  box-shadow: -8px 0 24px rgba(0,0,0,0.06);
}
.mobile-drawer.open { transform: translateX(0); }
.mobile-drawer a {
  display: block; padding: 14px 0;
  font-size: 17px; font-weight: 700; color: var(--tx);
  border-bottom: 1px solid var(--bd);
}
.mobile-drawer a.active { color: var(--am); }
.mobile-drawer a:hover { color: var(--am); }
.drawer-backdrop {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.32); z-index: 150;
}
.drawer-backdrop.open { display: block; }
@media (max-width: 880px) {
  .nav-links { display: none; }
  .menu-toggle { display: inline-flex; }
  .mobile-drawer { display: block; }
}

.spec-layout {
  max-width: 1280px; margin: 0 auto;
  padding: 32px 20px 80px;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 40px;
}
@media (max-width: 880px) {
  .spec-layout { grid-template-columns: 1fr; padding-top: 20px; gap: 0; }
}

.spec-toc {
  position: sticky; top: 80px;
  align-self: start;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 18px 14px;
  background: var(--sf);
  border: 1px solid var(--bd);
  border-radius: 12px;
  font-size: 13px;
}
@media (max-width: 880px) {
  .spec-toc {
    position: static; max-height: 240px;
    margin-bottom: 20px; font-size: 13px;
  }
}
.spec-toc h2 {
  font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
  color: var(--dm); text-transform: uppercase;
  margin-bottom: 12px; padding-bottom: 8px;
  border-bottom: 1px solid var(--bd);
}
.spec-toc ul { list-style: none; }
.spec-toc li { margin: 0; }
.spec-toc a {
  display: block; padding: 6px 8px;
  color: var(--tx2); font-weight: 500;
  border-radius: 6px;
  line-height: 1.4;
}
.spec-toc a:hover { background: var(--sf2); color: var(--tx); }
.spec-toc li.lvl3 a { padding-left: 22px; font-size: 12px; color: var(--dm); }
.spec-toc .doc-switch {
  display: flex; gap: 6px;
  margin-bottom: 14px;
}
.spec-toc .doc-switch a {
  flex: 1; text-align: center;
  padding: 8px 10px; font-size: 11px; font-weight: 700;
  background: var(--sf2); border: 1px solid var(--bd);
  border-radius: 8px; color: var(--tx2);
}
.spec-toc .doc-switch a.active {
  background: var(--am); color: #fff; border-color: var(--am);
}

.spec-doc {
  min-width: 0;
  background: var(--sf);
  border: 1px solid var(--bd);
  border-radius: 14px;
  padding: 40px 44px;
}
@media (max-width: 720px) { .spec-doc { padding: 28px 20px; border-radius: 10px; } }

.spec-eyebrow {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
  color: var(--dm); text-transform: uppercase;
  margin-bottom: 14px;
}
.kind-badge {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 3px 8px; background: var(--am4); color: var(--am);
  border: 1px solid var(--am3); border-radius: 6px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.6px;
}
.spec-title {
  font-size: clamp(24px, 3.5vw, 32px);
  font-weight: 900; letter-spacing: -0.8px;
  line-height: 1.2; color: var(--tx);
  margin-bottom: 14px;
}
.spec-summary {
  font-size: 14px; color: var(--tx2);
  background: var(--sf2); border-left: 3px solid var(--am);
  padding: 14px 18px; border-radius: 0 8px 8px 0;
  margin-bottom: 20px; white-space: pre-line;
}
.spec-meta {
  background: var(--sf2); border: 1px solid var(--bd);
  border-radius: 10px; padding: 12px 16px;
  margin-bottom: 32px; font-size: 13px;
}
.spec-meta summary {
  cursor: pointer; font-weight: 700; color: var(--tx2);
  list-style: none;
}
.spec-meta summary::before { content: '▶ '; font-size: 10px; color: var(--dm); margin-right: 4px; }
.spec-meta[open] summary::before { content: '▼ '; }
.spec-meta dl {
  display: grid; grid-template-columns: 140px 1fr;
  gap: 8px 16px; margin-top: 12px;
  padding-top: 12px; border-top: 1px solid var(--bd);
}
.spec-meta dt { font-weight: 600; color: var(--dm); font-size: 12px; }
.spec-meta dd { color: var(--tx2); font-size: 12px; word-break: break-all; }
.spec-meta dd .meta-list { list-style: none; }
.spec-meta dd .meta-list li { padding: 2px 0; }
@media (max-width: 720px) {
  .spec-meta dl { grid-template-columns: 1fr; }
}

.spec-body { color: var(--tx2); font-size: 14.5px; line-height: 1.75; }
.spec-body h1 { display: none; }
.spec-body h2 {
  font-size: 22px; font-weight: 800; color: var(--tx);
  margin: 40px 0 14px;
  padding-bottom: 8px; border-bottom: 2px solid var(--bd);
  letter-spacing: -0.4px;
  scroll-margin-top: 80px;
}
.spec-body h3 {
  font-size: 17px; font-weight: 700; color: var(--tx);
  margin: 28px 0 10px;
  letter-spacing: -0.3px;
  scroll-margin-top: 80px;
}
.spec-body h4 {
  font-size: 14px; font-weight: 700; color: var(--tx2);
  margin: 20px 0 8px;
}
.spec-body p { margin: 10px 0; }
.spec-body ul, .spec-body ol { margin: 10px 0 10px 24px; }
.spec-body li { margin: 4px 0; }
.spec-body strong { color: var(--tx); font-weight: 700; }
.spec-body em { font-style: italic; color: var(--tx2); }
.spec-body code {
  background: var(--bg2); padding: 1px 6px;
  border-radius: 4px; font-size: 13px;
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  color: var(--ru);
  word-break: break-all;
}
.spec-body pre {
  background: var(--tx); color: #E8ECF2;
  padding: 14px 18px; border-radius: 8px;
  overflow-x: auto; margin: 14px 0;
  font-size: 13px;
}
.spec-body pre code {
  background: transparent; color: inherit;
  padding: 0; font-size: 13px; word-break: normal;
}
.spec-body blockquote {
  border-left: 3px solid var(--am2);
  background: var(--am4);
  padding: 10px 14px;
  margin: 14px 0;
  color: var(--tx2);
  border-radius: 0 6px 6px 0;
}
.spec-body table {
  border-collapse: collapse;
  margin: 14px 0;
  width: 100%;
  font-size: 13px;
}
.spec-body th, .spec-body td {
  border: 1px solid var(--bd);
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
}
.spec-body th {
  background: var(--sf2); font-weight: 700; color: var(--tx);
}
.spec-body hr {
  border: none; border-top: 1px solid var(--bd);
  margin: 32px 0;
}
.spec-body a {
  color: var(--am);
  border-bottom: 1px solid transparent;
}
.spec-body a:hover { border-bottom-color: var(--am); }

.spec-footer {
  margin-top: 48px; padding-top: 20px;
  border-top: 1px solid var(--bd);
  display: flex; justify-content: space-between;
  font-size: 12px; color: var(--dm);
  flex-wrap: wrap; gap: 8px;
}
.spec-footer a { color: var(--am); }

.spec-index {
  max-width: 880px; margin: 0 auto;
  padding: 60px 20px 80px;
}
.spec-index .spec-eyebrow { margin-bottom: 12px; }
.spec-index .spec-title { font-size: clamp(32px, 5vw, 44px); }
.spec-lead {
  font-size: 16px; color: var(--tx2);
  margin: 14px 0 36px;
  line-height: 1.7;
}
.spec-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}
.spec-card {
  display: block;
  background: var(--sf);
  border: 1px solid var(--bd);
  border-radius: 14px;
  padding: 24px;
  transition: transform .15s, border-color .15s, box-shadow .15s;
}
.spec-card:hover {
  transform: translateY(-2px);
  border-color: var(--am2);
  box-shadow: 0 8px 24px rgba(196, 153, 48, 0.08);
}
.spec-card .card-badge {
  display: inline-block;
  padding: 3px 8px;
  background: var(--am4); color: var(--am);
  border: 1px solid var(--am3); border-radius: 6px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.6px;
  margin-bottom: 10px;
}
.spec-card .card-id {
  font-size: 11px; color: var(--dm);
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 8px;
}
.spec-card .card-title {
  font-size: 17px; font-weight: 800; color: var(--tx);
  letter-spacing: -0.3px; line-height: 1.35;
  margin-bottom: 10px;
}
.spec-card .card-desc {
  font-size: 13px; color: var(--tx2); line-height: 1.6;
}
"""


def build_card(slug: str, meta: dict) -> str:
    return (
        f'<a href="/spec/{slug}.html" class="spec-card">'
        f'<span class="card-badge">{ICONS[slug]}</span>'
        f'<div class="card-id">{html.escape(meta.get("doc_id", ""))}</div>'
        f'<div class="card-title">{html.escape(meta.get("title", TITLES[slug]).strip(chr(34)))}</div>'
        f'<div class="card-desc">{html.escape((meta.get("summary") or "").splitlines()[0] if meta.get("summary") else "")}</div>'
        f"</a>"
    )


def build_toc_section(active: str, toc_by_slug: dict[str, list[dict]]) -> str:
    switches = "".join(
        f'<a href="/spec/{s}.html" class="{"active" if s == active else ""}">{ICONS[s]}</a>'
        for s in ("feature", "design")
    )
    items_html: list[str] = []
    for item in toc_by_slug[active]:
        cls = "lvl3" if item["level"] == 3 else "lvl2"
        items_html.append(
            f'<li class="{cls}"><a href="#{item["slug"]}">{html.escape(item["text"])}</a></li>'
        )
    return (
        '<aside class="spec-toc" aria-label="목차">'
        f'<div class="doc-switch">{switches}</div>'
        "<h2>목차</h2>"
        "<ul>" + "".join(items_html) + "</ul>"
        "</aside>"
    )


META_KEYS_ORDER = [
    "doc_id",
    "type",
    "title",
    "date",
    "status",
    "domain",
    "tags",
    "participants",
    "supersedes",
    "preserves",
    "related_docs",
    "flr_reference",
    "created_by",
    "created_at",
    "authored_by",
    "authored_at",
    "revisions",
]
META_LABELS = {
    "doc_id": "문서코드",
    "type": "유형",
    "title": "제목",
    "date": "날짜",
    "status": "상태",
    "domain": "도메인",
    "tags": "태그",
    "participants": "참여자",
    "supersedes": "흡수",
    "preserves": "보존",
    "related_docs": "관련 문서",
    "flr_reference": "참조 결함",
    "created_by": "작성",
    "created_at": "작성 시각",
    "authored_by": "본문 작성",
    "authored_at": "본문 시각",
    "revisions": "개정",
}


def build_meta_dl(meta: dict) -> str:
    parts: list[str] = []
    for key in META_KEYS_ORDER:
        if key not in meta or meta[key] in (None, "", []):
            continue
        parts.append(
            f"<dt>{META_LABELS.get(key, key)}</dt><dd>{fmt_meta_value(meta[key])}</dd>"
        )
    return "".join(parts)


def main() -> int:
    if not all(p.exists() for p in SOURCES.values()):
        missing = [str(p) for p in SOURCES.values() if not p.exists()]
        print(f"[build_spec] missing source: {missing}", file=sys.stderr)
        return 1

    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    build_ts = datetime.now().strftime("%Y-%m-%d %H:%M KST")
    ver = datetime.now().strftime("%Y%m%d%H%M")

    metas: dict[str, dict] = {}
    bodies: dict[str, str] = {}
    tocs: dict[str, list[dict]] = {}
    sanitize_violations: list[str] = []
    for slug, src in SOURCES.items():
        text = src.read_text(encoding="utf-8")
        sanitize_violations.extend(_check_sanitize(text, src.name))
        meta, body = parse_frontmatter(text)
        metas[slug] = meta
        bodies[slug] = body
        tocs[slug] = extract_toc(body)

    if sanitize_violations:
        print(
            f"[build_spec] sanitize gate FAIL — {len(sanitize_violations)} 위반:",
            file=sys.stderr,
        )
        for v in sanitize_violations:
            print(f"  - {v}", file=sys.stderr)
        return 1
    print("[build_spec] sanitize gate PASS — 위반 0건")

    # 각 문서 페이지
    for slug, src in SOURCES.items():
        meta = metas[slug]
        body_md = bodies[slug]
        html_body = render_md(body_md)
        html_body = assign_slugs(html_body, tocs[slug])
        nav = build_toc_section(slug, tocs)
        title_val = meta.get("title", TITLES[slug]).strip(chr(34))
        summary_val = (meta.get("summary") or "").strip()
        page = PAGE_TEMPLATE.format(
            title=html.escape(title_val),
            doc_id=html.escape(meta.get("doc_id", "")),
            desc=html.escape(summary_val.split("\n")[0] if summary_val else title_val),
            slug=slug,
            icon=ICONS[slug],
            summary=html.escape(summary_val),
            meta_dl=build_meta_dl(meta),
            body=html_body,
            nav_section=nav,
            build_ts=build_ts,
            ver=ver,
        )
        (SPEC_DIR / f"{slug}.html").write_text(page, encoding="utf-8")
        print(f"[build_spec] wrote spec/{slug}.html ({len(page):,} bytes)")

    # 인덱스
    cards = "\n    ".join(
        build_card(slug, metas[slug]) for slug in ("feature", "design")
    )
    idx_html = INDEX_TEMPLATE.format(cards=cards, build_ts=build_ts, ver=ver)
    (SPEC_DIR / "index.html").write_text(idx_html, encoding="utf-8")
    print(f"[build_spec] wrote spec/index.html ({len(idx_html):,} bytes)")

    # CSS
    (SPEC_DIR / "spec.css").write_text(CSS, encoding="utf-8")
    print(f"[build_spec] wrote spec/spec.css ({len(CSS):,} bytes)")

    # 빌드 메타
    (SPEC_DIR / "build.json").write_text(
        json.dumps(
            {
                "build_ts": build_ts,
                "ver": ver,
                "sources": {k: str(v) for k, v in SOURCES.items()},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
