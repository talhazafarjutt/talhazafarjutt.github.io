"""Render the 1200x630 share cards (img/og/*.jpg) and favicon PNGs with headless Chrome.
   Usage: python3 tools/seo/cards.py"""
import base64, html, json, re, subprocess
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
R = os.path.abspath(os.path.join(HERE, "..", ".."))
from seo_pages import PAGES
photo = base64.b64encode(open(f"{R}/img/talha-zafar.jpg", "rb").read()).decode()
cards = [dict(p["card"], file=p["og"]) for p in PAGES]
page = open(os.path.join(HERE, "og.html")).read().replace("photo.src = 'photo.jpg';", f"photo.src = 'data:image/jpeg;base64,{photo}';")
page = re.sub(r"/\*CARDS\*/.*?/\*END\*/", lambda _: "/*CARDS*/" + json.dumps(cards) + "/*END*/", page, flags=re.S)
open(os.path.join(HERE, "og_build.html"), "w").write(page)
for attempt in range(4):
    dom = subprocess.run(["google-chrome", "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=25000",
                          "--dump-dom", "file://" + os.path.join(HERE, "og_build.html")], capture_output=True, text=True, timeout=180).stdout
    m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    if m: break
for name, url in json.loads(html.unescape(m.group(1))).items():
    open(f"{R}/{name}", "wb").write(base64.b64decode(url.split(",", 1)[1]))
print("cards ok")
os.remove(os.path.join(HERE, "og_build.html"))
