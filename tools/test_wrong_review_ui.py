"""Mounted React regression tests. Requires Python Playwright and installed Chrome.
Run from the app root: python tools/test_wrong_review_ui.py
The RN host/gesture adapter tests app logic, not the native OS gesture dispatcher.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "wrong-question-review"
OUT.mkdir(parents=True, exist_ok=True)
subprocess.run(["node", "tools/prepare_wrong_review_ui.cjs"], cwd=ROOT, check=True)
URL = (ROOT / "tmp/wrong-review/index.html").as_uri()


def swipe(page, dx, dy=0, touches=1, cancel=False, multi_after=False):
    return page.locator('[data-pan="true"]').evaluate("""(el, g) => {
      const p = el.__pan;
      const gesture = {dx:g.dx,dy:g.dy,numberActiveTouches:g.touches};
      const claimed = p.onMoveShouldSetPanResponderCapture({},gesture);
      if (claimed) {
        p.onPanResponderGrant?.({},gesture);
        p.onPanResponderMove?.({}, {...gesture,numberActiveTouches:g.multi_after ? 2 : g.touches});
        if (g.cancel) p.onPanResponderTerminate?.({},gesture);
        else p.onPanResponderRelease({}, {...gesture,numberActiveTouches:0});
      }
      return claimed;
    }""", dict(dx=dx, dy=dy, touches=touches, cancel=cancel, multi_after=multi_after))


def position(page, current, total=5):
    expect(page.get_by_role("heading", name=f"復習 {current} / {total}", exact=True)).to_be_visible()


def current_number(page, n):
    expect(page.get_by_text(f"間違えた問題 · 模試の問{n}", exact=True)).to_be_visible()


def detail_scroll(page):
    return page.locator('[data-scroll="true"]').nth(1)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "C:/Program Files/Google/Chrome/Application/chrome.exe"), headless=True)
    page = browser.new_page(viewport={"width": 393, "height": 680}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL)
    cards = page.get_by_role("button").filter(has_text="要復習")
    expect(cards).to_have_count(5)
    cards.nth(2).scroll_into_view_if_needed()
    saved_y = page.locator('[data-scroll="true"]').first.evaluate("el=>{window.resultsList=el;window.resultY=el.scrollTop;return el.scrollTop}")
    assert saved_y > 0
    cards.nth(2).click()
    position(page, 3)
    current_number(page, 18)
    assert page.evaluate("window.resultsList.isConnected && window.resultsList.scrollTop === window.resultY")
    assert page.evaluate("window.resultsList.closest('[aria-hidden=true]') !== null")
    assert not swipe(page, -100, 150)  # vertical reading
    assert not swipe(page, -100, 0, touches=2)
    swipe(page, -40)  # insufficient distance
    swipe(page, -100, cancel=True)
    swipe(page, -100, multi_after=True)
    position(page, 3)
    detail_scroll(page).evaluate("el=>el.scrollTop=el.scrollHeight")
    page.get_by_role("button", name="次の間違えた問題へ", exact=True).click()
    position(page, 4)
    current_number(page, 31)
    assert detail_scroll(page).evaluate("el=>el.scrollTop") == 0
    page.screenshot(path=str(OUT / "practical-393-light.png"))
    page.get_by_role("button", name="問題図を拡大", exact=True).click()
    expect(page.get_by_role("dialog")).to_be_visible()
    assert not swipe(page, -160)  # enlarged image horizontal panning must not change questions
    position(page, 4)
    page.get_by_role("button", name="‹ 図を閉じる", exact=True).click()
    swipe(page, -100)
    position(page, 5)
    current_number(page, 35)
    expect(page.get_by_role("button", name="次の間違えた問題へ", exact=True)).to_be_disabled()
    assert not swipe(page, -100)
    swipe(page, 100)
    position(page, 4)
    page.get_by_role("button", name="前の間違えた問題へ", exact=True).click()
    position(page, 3)
    page.get_by_text("ブックマーク", exact=True).click()
    expect(page.get_by_text("ブックマーク解除", exact=True)).to_be_visible()
    position(page, 3)
    for _ in range(2):
        page.get_by_role("button", name="前の間違えた問題へ", exact=True).click()
    position(page, 1)
    current_number(page, 2)
    expect(page.get_by_role("button", name="前の間違えた問題へ", exact=True)).to_be_disabled()
    assert not swipe(page, 100)
    page.get_by_role("button", name="‹ 一覧へ", exact=True).click()
    assert page.evaluate("window.resultsList === document.querySelector('[data-scroll]') && window.resultsList.scrollTop === window.resultY")
    expect(cards).to_have_count(5)
    # Second round, including the parent re-render caused by bookmarking, keeps the same list.
    cards.nth(2).click()
    position(page, 3)
    page.get_by_role("button", name="‹ 一覧へ", exact=True).click()
    assert page.evaluate("window.resultsList.scrollTop === window.resultY")

    for theme, width, height, scale in [('light',320,568,1),('dark',393,720,1.3),('light',768,900,1)]:
        page.set_viewport_size({"width":width,"height":height})
        page.goto(URL + f"?theme={theme}&scale={scale}")
        page.get_by_role("button").filter(has_text="要復習").nth(2).click()
        position(page,3)
        detail_scroll(page).evaluate("el=>el.scrollTop=el.scrollHeight")
        for name in ['前の間違えた問題へ','次の間違えた問題へ']:
            box = page.get_by_role('button',name=name,exact=True).bounding_box()
            assert box and box['height'] >= 48 and box['x'] >= 0 and box['x']+box['width'] <= width+1 and box['y']+box['height'] <= height
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        detail_scroll(page).evaluate("el=>el.scrollTop=0")
        page.screenshot(path=str(OUT / f"written-{width}-{theme}.png"))

    page.goto(URL + '?case=single')
    page.get_by_role("button").filter(has_text="要復習").click()
    position(page,1,1)
    expect(page.get_by_role("button", name="前の間違えた問題へ", exact=True)).to_be_disabled()
    expect(page.get_by_role("button", name="次の間違えた問題へ", exact=True)).to_be_disabled()
    assert not swipe(page,-100) and not swipe(page,100)
    page.goto(URL + '?case=none')
    expect(page.get_by_role("button").filter(has_text="要復習")).to_have_count(0)
    page.goto(URL + '?case=bookmark')
    expect(page.get_by_role("heading", name="問題", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name="次の間違えた問題へ", exact=True)).to_have_count(0)
    assert page.locator('[data-pan="true"]').count() == 0
    assert not errors, errors
    browser.close()

report = {
    "result": "passed", "listScrollPreservedAt": saved_y,
    "incorrectQuestionNumbersOnly": [2,9,18,31,35],
    "checks": ["same list DOM and scroll offset after two visits and bookmarking", "previous/next and swipe", "question begins at top", "first/last/single/empty boundaries", "vertical/short/multitouch/cancelled gestures", "zoom prevents navigation", "bookmark detail unaffected", "fixed buttons at 320/393/768 widths and 1.3 font scale"],
    "sourceSha256": hashlib.sha256((ROOT / 'App.tsx').read_bytes()).hexdigest(),
    "browserHostSimulation": True, "physicalDeviceTested": False,
}
(OUT / 'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS: wrong-only navigation, gestures, retained scroll, zoom, bookmarks, boundaries and responsive layout')
