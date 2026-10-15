"""Tell Bing (and other IndexNow engines) that pages changed — no account needed.
   Usage: python3 tools/seo/indexnow.py            (submits every page in sitemap.xml)
   The key file /c32bbcbaf4d636a80c72007e798ebf97.txt must stay published at the site root."""
import json, os, re, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.abspath(os.path.join(HERE, "..", ".."))
KEY = "c32bbcbaf4d636a80c72007e798ebf97"
urls = re.findall(r"<loc>([^<]+)</loc>", open(os.path.join(R, "sitemap.xml")).read())
body = json.dumps({"host": "talhazafarjutt.github.io", "key": KEY,
                   "keyLocation": f"https://talhazafarjutt.github.io/{KEY}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, method="POST",
                             headers={"Content-Type": "application/json; charset=utf-8"})
try:
    r = urllib.request.urlopen(req, timeout=30); print("IndexNow:", r.status, f"({len(urls)} URLs)")
except urllib.error.HTTPError as e:
    print("IndexNow:", e.code, e.read()[:200])
