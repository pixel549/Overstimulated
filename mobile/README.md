# Overstimulated: mobile rebuild

Tap-to-move rebuild of Overstimulated for phones (landscape), wrapped as an Android APK.
The original desktop game in the repo root is untouched.

## Play in a browser
`npm run serve` then open http://127.0.0.1:8765/ (add `?autostart=1` to skip the intro).

## Build the APK
No Gradle needed. A plain Java WebView shell in `android/` is built with aapt, javac, dx, zipalign and apksigner:

```
sudo apt install aapt dalvik-exchange zipalign apksigner default-jdk
# android.jar for API 34, e.g. from github.com/Sable/android-platforms
ANDROID_JAR=/path/to/android-34.jar android/build.sh     # -> android/build/Overstimulated.apk
```
The signing key (`android/overstimulated.jks`) is created on the first build and is git-ignored. Keep it: updates must be signed
with the same key. Bump `versionCode` in `android/AndroidManifest.xml` for each update. The game is served to the WebView from
a fake https origin so `fetch()` works.

## How it plays
- Tap anywhere to walk; tap furniture, toys or mess to interact; the chore list top-right also walks you there.
- Chores use mini-games: scrub dishes, pour dog food in the green band, drag toys into the box, scoop patio mess, settle the baby by timing a ring.
- Couches and beds calm you down; the ensuite toilet is the emergency hide (25s cooldown).
- Stress hits 100% and Dad storms off. Survive the 5 minute day.

## Art
Sprites are the Liberated Pixel Cup / **LPC Revised** set by Eliza Wyatt (the same set used in Grindstone), composited by
`tools/bake.py` from a local clone of https://github.com/ElizaWy/LPC (`LPCR=/path/to/ElizaWy_LPC npm run bake`).
Dogs and chickens are drawn procedurally. Portraits are the project's own pixel-art cards.
Credits for the LPC art are in `CREDITS-LPC.txt` (CC-BY-SA 3.0 / CC-BY 3.0 / OGA-BY 3.0 / GPL, see the upstream repo).

## Status
Vertical slice: Day 1 and a harder Day 2 with five chores. Not yet ported from the desktop game: Munty, aggressive chickens,
mower, beer/coffee, doors that open and close, bark.
