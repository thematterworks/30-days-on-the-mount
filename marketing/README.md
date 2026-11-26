# Marketing assets

Everything for the App Store product page and launch, in the app's own look.
Rendered from real app screens, so it stays true to what people download.

## App Store Connect: where each file goes

**iOS App → 1.0 Prepare for Submission → Product Page Information**

| Field | File |
|---|---|
| Header (Header and Search Results tab) | `app-store/header-3840x1646.png` |
| iPhone 6.9" screenshots, in order | `app-store/iphone-1320x2868/01…09` |
| iPad 13" screenshots, in order | `app-store/ipad-2064x2752/01…09` |
| iPhone app preview video | `app-store/app-preview-iphone-886x1920.mp4` (28 s, H.264, stereo AAC) |
| Preview poster frame | choose the 1-second mark, or `app-store/app-preview-poster.png` |
| Apple Watch screenshots | `raw/watch/01-today.png`, `02-breathe.png`, `03-breathing.png` (416×496) |

The first three iPhone screenshots show in search results, so they carry the
most weight: the brand and the day's first card, a story opened, and
scripture read slowly.

## Social and web (`social/`)

- `story-0*-1080x1920.png`: Instagram/Facebook stories and Reels covers
- `post-0*-1080x1080.png`: square scripture cards for feeds
- `banner-1500x500.png`: X/LinkedIn header
- `wide-1920x1080.png`: YouTube, presentations, press

## Re-rendering

The studio is plain HTML rendered by headless Chrome at exact pixel sizes.

```
python3 marketing/studio/render.py           # all screenshots
python3 marketing/studio/render.py iphone/01 # one frame
python3 marketing/studio/render.py social    # social set and banners
```

Edit the captions in `studio/render.py` (`STORY`, `CLOSING`, `SOCIAL`), the
look in `studio/frame.html` and `studio/header.html`.

Raw screens come from the simulator with sample data. Launch the app with
`-previewShowcase` (plus `-previewDay`, `-previewStory`, `-previewStoryCard`,
`-previewTab`, `-previewStudy`, `-previewGroup`), set the status bar to 9:41
with `xcrun simctl status_bar … override --time 9:41`, and capture with
`xcrun simctl io … screenshot`. The raw video takes and soundtrack source
(`raw/video/*.mov`, `*.mp3`) are left out of git.
