# Swiss Tech Center kiosk

Offline web app for the Dahua 65" portrait totem (Android 11). Designed for 1080×1920 and scaled to fit any portrait screen.

## Files
- `index.html`: the whole app (content, animations, kiosk behaviour)
- `fonts/`: Source Sans Pro (local, no internet needed)
- `media/hero.mp4`: banner video (from betterask.erni, cropped to portrait)
- `media/erni-logo.png`, `media/better-ask-erni.png`: official RGB files from the ERNI Frontify logo library
- `media/sifu-robot-piano.jpg`: ABB/ERNI press photo (SuperArte Gala)
- `media/sifu.mp4`: ABB × Fundación SIFU video (2:54, 1280×720, English subtitles burned in, with sound). Plays from the "Technology with purpose" tile (Our talent). Demo 4 itself shows only Animation / Photo.
- `media/talent-arena.mp4`: ERNI Talent Arena video (0:46, 1280×720, with sound), plays from the "Talent arena" tile. (Tile texts and files: `TALENT` array.)
- `vendor/three.min.js`: three.js r160 (local copy) for the 3D model in demo 5

## Install on the totem
1. Copy the whole `kiosk/` folder to the totem (USB stick → `/sdcard/kiosk/`).
2. Install **Fully Kiosk Browser** from Google Play (the PLUS licence is needed for full kiosk lock).
3. Start URL: `file:///sdcard/kiosk/index.html`
4. In Fully: enable Kiosk Mode, Autostart on boot, Keep screen on, and "Autoplay videos". Disable pinch zoom.
5. If the totem has to stay in landscape at hardware level, rotate the screen in Fully (Device Management → Screen orientation: Portrait).

You can also host the folder on any web server and point Fully at the URL. Every path is relative.

## Behaviour
- No scrolling. Touching a tile opens a full-screen sheet with an animation, a short explanation, steps and industries.
- Previous/Next, swipe left/right on the animation, or "Back to all demos" to go back.
- After 90 s without touches it returns to the home screen, except while a video is playing.
- Attract mode (as in the first versions): while the home screen is shown, the five demo tiles light up one after another every 2.2 s, and the dot next to "Live in this room" pulses.
- Test on a laptop: open `index.html#demo=1` … `#demo=5` to jump to a demo (Esc and arrow keys work).

## Editing texts
Demo texts: `DEMOS` array. AI vision pillars: `PILLARS` array. Talent videos (titles, lines, file names): `TALENT` array. All in the `<script>` of `index.html`.
