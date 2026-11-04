"""Call the deployed quote reader like the app does: submit, then poll (task 047).

    set -a; . ~/.config/low-key/env; set +a
    python cloud/quote_reader/client.py path/to/photo.jpg
Prints the read and the wall-clock time. Never prints the token.
"""

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

URL = os.environ.get("LOWKEY_QUOTE_URL", "https://ngoldbla--lowkey-quote-reader-web.us-east.modal.run")


def call(method, path, body=None):
    req = urllib.request.Request(
        URL + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {os.environ['LOWKEY_QUOTE_TOKEN']}",
            "content-type": "application/json",
        },
    )
    for attempt in range(4):  # this box is on WiFi: retry transient network errors
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def main(path):
    mime = "image/png" if path.endswith(".png") else "image/jpeg"
    t = time.time()
    _, started = call(
        "POST", "/read", {"image_b64": base64.b64encode(open(path, "rb").read()).decode(), "mime": mime}
    )
    while True:
        status, body = call("GET", f"/result/{started['id']}")
        if status == 200:
            break
        time.sleep(2)
    print(json.dumps(body, indent=1)[:1500])
    print(f"wall clock {time.time() - t:.1f}s")


if __name__ == "__main__":
    main(sys.argv[1])
