#!/usr/bin/env python3
"""Renders the App Store marketing frames with headless Chrome.

    python3 marketing/studio/render.py [name-filter]

Each frame is frame.html at the exact pixel size App Store Connect asks
for, described by a small JSON object (see FRAMES below). Output goes to
marketing/app-store/.
"""
import json, os, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "app-store")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

SIZES = {"iphone": (1320, 2868), "ipad": (2064, 2752)}
# Other sizes App Store Connect asks for, drawn from the same frames: the
# medium iPhone slot (6.1"/6.3") takes 1206×2622.
EXTRA_SIZES = {"iphone": [(1206, 2622)]}

TAGLINE = "A 30-day invitation to walk in the<br>wisdom of Jesus' most famous sermon"

# The story the screenshots tell, in order. The first three carry the most
# weight in search results.
STORY = [
    dict(name="01-journey", screen="01-journey", lockup=True, deviceTop=33,
         sub=TAGLINE),
    dict(name="02-story", screen="02-hook", eyebrow="Each morning",
         title="A passage, opened like a story", sub="The words of Jesus, what they meant on that hillside, and one honest question to carry."),
    dict(name="03-scripture", screen="03-scripture", eyebrow="Ten quiet minutes",
         title="Read His words slowly", sub="The Sermon on the Mount, one passage a day, with music for stillness."),
    dict(name="04-deeper", screen="04-teaching", eyebrow="Midday",
         title="Go deeper", sub="The world it was spoken into, and what it asks of you today."),
    dict(name="05-study", screen="06-study", eyebrow="Any verse in the Bible",
         title="Study the words behind the words", sub="The original Greek and Hebrew, the setting, and the kingdom of heaven."),
    dict(name="06-companion", screen="07-companion", eyebrow="Whenever you need",
         title="A companion for your questions", sub="Talk anything through, in writing or out loud."),
    dict(name="07-together", screen="08-group", eyebrow="Together",
         title="No one climbs alone", sub="Walk the thirty days with friends, or a small group who began when you did."),
    dict(name="08-reflect", screen="05-reflection", eyebrow="Evening",
         title="Notice what changed", sub="Write or speak a reflection. Only you and your companion see it."),
]

WATCH = dict(name="09-watch", layout="watch", eyebrow="Apple Watch",
             title="On your wrist, too", sub="Today's words and practice at a glance, and three slow breaths whenever you need them.",
             watch=True)

CLOSING = dict(name="10-begin", layout="closing", lockup=True, sub=TAGLINE,
               pills=["Thirty days", "Ten minutes a day", "Free"])


def frames():
    for kind in ("iphone", "ipad"):
        for frame in STORY:
            if kind == "ipad" and frame["screen"] == "05-reflection":
                continue  # not captured on iPad
            yield kind, dict(frame, kind=kind, layout="device",
                             screen=os.path.join(ROOT, "raw", kind, frame["screen"] + ".png"))
        yield kind, dict(WATCH, kind=kind, screens=[os.path.join(ROOT, "raw", "watch", "01-today.png"),
                                                    os.path.join(ROOT, "raw", "watch", "03-breathing.png")],
                         watchWidth=46 if kind == "iphone" else 30, deviceTop=38 if kind == "iphone" else 44,
                         spread=24 if kind == "iphone" else 18, stagger=14 if kind == "iphone" else 6)
        yield kind, dict(CLOSING, kind=kind, lockupWidth=92 if kind == "iphone" else 74,
                         subSize=2.7 if kind == "iphone" else 2.0)


def render(kind, frame, size=None):
    w, h = size or SIZES[kind]
    folder = os.path.join(OUT, f"{kind}-{w}x{h}")
    os.makedirs(folder, exist_ok=True)
    out = os.path.join(folder, frame["name"] + ".png")
    url = "file://" + os.path.join(HERE, "frame.html") + "#" + urllib.parse.quote(json.dumps(frame))
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=1", f"--window-size={w},{h}",
                    "--virtual-time-budget=10000", "--allow-file-access-from-files",
                    f"--screenshot={out}", url],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(out)




# MARK: - Social and web

SOCIAL = [
    ("story-01-journey", (1080, 1920), dict(STORY[0], kind="iphone", layout="device", deviceTop=34)),
    ("story-02-together", (1080, 1920), dict(STORY[6], kind="iphone", layout="device", deviceTop=34)),
    ("story-03-begin", (1080, 1920), dict(CLOSING, kind="iphone", lockupWidth=92, subSize=2.9)),
    ("story-04-watch", (1080, 1920), dict(WATCH, kind="iphone", watchWidth=46, deviceTop=38, spread=24, stagger=14,
                                          screens=["raw/watch/01-today.png", "raw/watch/03-breathing.png"])),
    ("post-04-watch", (1080, 1080), dict(WATCH, kind="ipad", watchWidth=26, deviceTop=52, titleSize=6.6, subSize=2.6, copyTop=7,
                                         screens=["raw/watch/01-today.png", "raw/watch/03-breathing.png"])),
    ("post-01-poor-in-spirit", (1080, 1080), dict(layout="quote", eyebrow="Day 1 · Matthew 5:3", title="Blessed are the poor in spirit, for theirs is the kingdom of heaven.", sub="Thirty days in the words of Jesus", titleSize=6.6, subSize=2.2)),
    ("post-02-love-your-enemies", (1080, 1080), dict(layout="quote", eyebrow="Day 13 · Matthew 5:44", title="Love your enemies and pray for those who persecute you.", sub="Thirty days in the words of Jesus", titleSize=7, subSize=2.2)),
    ("post-03-tomorrow", (1080, 1080), dict(layout="quote", eyebrow="Day 20 · Matthew 6:34", title="Do not worry about tomorrow, for tomorrow will worry about itself.", sub="Thirty days in the words of Jesus", titleSize=6.6, subSize=2.2)),
]


def render_social():
    folder = os.path.join(ROOT, "social")
    os.makedirs(folder, exist_ok=True)
    for name, (w, h), frame in SOCIAL:
        if frame.get("screen"):
            frame = dict(frame, screen=os.path.join(ROOT, "raw", "iphone", frame["screen"] + ".png"))
        if frame.get("screens"):
            frame = dict(frame, screens=[os.path.join(ROOT, path) for path in frame["screens"]])
        out = os.path.join(folder, f"{name}-{w}x{h}.png")
        url = "file://" + os.path.join(HERE, "frame.html") + "#" + urllib.parse.quote(json.dumps(frame))
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--force-device-scale-factor=1", f"--window-size={w},{h}",
                        "--virtual-time-budget=10000", "--allow-file-access-from-files",
                        f"--screenshot={out}", url],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(out)
    # Wide banners from header.html: the App Store header, an X/LinkedIn
    # banner, a YouTube/presentation frame.
    raw = os.path.join(ROOT, "raw", "iphone")
    screens = [os.path.join(raw, n + ".png") for n in ("03-scripture", "01-journey", "08-group", "06-study")]
    for name, (w, h), target in [("header", (3840, 1646), OUT), ("banner", (1500, 500), folder), ("wide", (1920, 1080), folder)]:
        out = os.path.join(target, f"{name}-{w}x{h}.png")
        url = "file://" + os.path.join(HERE, "header.html") + "#" + urllib.parse.quote(json.dumps({"screens": screens}))
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--force-device-scale-factor=1", f"--window-size={w},{h}",
                        "--virtual-time-budget=10000", "--allow-file-access-from-files",
                        f"--screenshot={out}", url],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(out)


if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    if only == "social":
        render_social()
    else:
        for kind, frame in frames():
            if only in f"{kind}/{frame['name']}":
                render(kind, frame)
                for size in EXTRA_SIZES.get(kind, []):
                    render(kind, frame, size)
