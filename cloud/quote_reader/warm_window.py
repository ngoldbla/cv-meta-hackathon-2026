"""Keep the quote reader warm for a demo or judging window (task 050).

    python cloud/quote_reader/warm_window.py on --hours 4   # one H100 kept warm, auto-off after 4 h
    python cloud/quote_reader/warm_window.py off            # back to scale-to-zero
    python cloud/quote_reader/warm_window.py status

While "on", one GPU container stays loaded, so a first read takes seconds,
not a cold start; it bills for every hour it is on. "on" schedules its own
"off" with a user systemd timer on this machine, so a forgotten window
can't keep billing. A redeploy also resets to scale-to-zero.
"""

import shutil
import subprocess
import sys
from pathlib import Path

import modal

APP, CLS = "lowkey-quote-reader", "Reader"
UNIT = "lowkey-quote-warm-off"


def reader():
    return modal.Cls.from_name(APP, CLS)()


def set_min(n: int) -> None:
    reader().update_autoscaler(min_containers=n)


def schedule_off(hours: float) -> str:
    if not shutil.which("systemd-run"):
        return "no systemd-run here: run `warm_window.py off` yourself"
    subprocess.run(["systemctl", "--user", "stop", f"{UNIT}.timer"], capture_output=True)
    cmd = [
        "systemd-run",
        "--user",
        f"--unit={UNIT}",
        f"--on-active={int(hours * 3600)}s",
        sys.executable,
        str(Path(__file__).resolve()),
        "off",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return f"auto-off in {hours:g} h" if r.returncode == 0 else f"auto-off NOT scheduled: {r.stderr.strip()}"


def main(argv: list[str]) -> None:
    cmd = argv[0] if argv else "status"
    if cmd == "on":
        hours = float(argv[argv.index("--hours") + 1]) if "--hours" in argv else 3.0
        set_min(1)
        reader().warm.spawn()  # start loading now
        print(f"warm window ON (min_containers=1); {schedule_off(hours)}")
    elif cmd == "off":
        set_min(0)
        subprocess.run(["systemctl", "--user", "stop", f"{UNIT}.timer"], capture_output=True)
        print("warm window OFF (scale to zero)")
    else:
        r = subprocess.run(
            ["systemctl", "--user", "list-timers", f"{UNIT}.timer", "--no-pager"],
            capture_output=True,
            text=True,
        )
        print(r.stdout.strip() or "no auto-off timer scheduled")
        print(
            "containers:",
            subprocess.run(["modal", "container", "list"], capture_output=True, text=True).stdout.count(APP),
        )


if __name__ == "__main__":
    main(sys.argv[1:])
