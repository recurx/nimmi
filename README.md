# Happy birthday, Nimmi

A static birthday site. No build step, no server, no photo. The hero is a starry night
on a hilly farm: Nimmi and her cat, seen from behind, watching a sky where the stars
spell out the greeting when the firecracker by the barn is lit. A projector beside her raises a
cinema screen from behind the far hill, and the cat loads video messages from a gift box. Flowers sway, fireflies drift, and
clicking the sky makes a wish.

## Files

- `index.html` – the page. The hills, barn, windmill, Nimmi and the cat are inline SVG.
- `css/style.css` – the night palette (see `:root`) and the sway animations.
- `js/scene.js` – the sky (stars, moon, shooting stars), the firecracker show that spells
  the greeting, the piano truck, the generated flowers, grass and fences, and the fireflies.
  After the fireworks a truck drives in from the right and pulls up by the launcher, a sign
  lit with bulbs pops up from behind the bed ("Happy b'day Pinjej"), the man at the piano
  plays the birthday song, and when it ends the sign folds and the truck drives off to the left.
- `js/sound.js` – sound. The night ambience is `assets/night-ambience.mp3` (looped, faded in);
  the firecracker show is `assets/fireworks.mp3` and the truck's pianist plays
  `assets/happy-birthday.mp3`; the projector's motor is `assets/projector.mp3`,
  looped quietly while the lights are down; the cat's meow is `assets/meow.mp3`; the cloth screen,
  the gift lid, the countdown beeps and the footsteps are synthesised with the Web Audio API. The "sound on/off" toggle in the corner is remembered in the browser.
- `js/cinema.js` – the projector, the gift box, the reel stacks and the cat. **Add the video
  messages to the `VIDEOS` list at the top of this file**: one entry per Gumlet video with its id
  and its aspect ratio ("16/9" or "9/16"). The projector raises a blank screen.
  The gift box holds the films as a stack of numbered reels; the first click unfolds the box.
  Click a stack and the cat first carries the reel in the projector to the *other* stack, then
  threads the top reel of the stack you clicked; the film starts by itself after the countdown
  (browsers allow that after a click; if one refuses, press play). So the left stack is "next" and the right stack,
  where watched reels pile up, is "previous", forever in both directions. When a film ends
  (Gumlet's player bridge, loaded from a CDN in `index.html`, reports it) or sits unplayed for a
  minute, the screen shows an END card and the cat walks over and nudges the stack with the next reel.

## Preview locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Publish on GitHub Pages

1. Create a repository and push these files to the `main` branch.
2. In the repository, open Settings → Pages.
3. Under "Build and deployment" choose "Deploy from a branch", pick `main` and `/ (root)`.
4. The site appears at `https://<your-username>.github.io/<repository-name>/` after a minute.

`IMG_0138.tiff` (the reference photo) is ignored by git and is not used by the site.
