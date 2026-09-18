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
  looped quietly while a film is actually running (it stops on pause and at the end); the cat's meow is `assets/meow.mp3`; the cloth screen,
  the gift lid, the countdown beeps and the footsteps are synthesised with the Web Audio API. The "sound on/off" toggle in the corner is remembered in the browser.
- `js/cinema.js` – the projector, the gift box, the stack of reels and the cat. **Add the
  messages to the `VIDEOS` list at the top of this file**, in the order they should sit in the
  stack (top first): one entry per Gumlet video with its id, its aspect ratio ("16/9" or
  "9/16") and a `label`, the name written on the reel's paper label (a `\n` in the label
  starts a second line). A photo message is an entry with `photo` (a file in `assets/`)
  instead of `id`; it stays on the screen for fifteen seconds.
  The projector raises a blank screen. Clicking the gift unfolds the box and zooms the
  camera in on the stack of labelled reels; click a reel and the camera zooms back out, the
  cat fetches that reel, loads it in the projector, and after a 3-2-1 countdown the message
  plays. Click the gift again and the cat first brings the reel back to the stack, then the
  camera zooms in on the full stack again. When a message ends the cat walks over and nudges
  the stack, asking for the next one.
- `js/letter.js` – a sealed letter. The small card on the grass left of the projector opens a
  closed envelope; tapping it asks for a seed word. The letter is stored only as ciphertext
  (a keystream from SHA-256 of the typed seed, each character shifted within printable
  ASCII), so the right seed reveals it and any other seed shows gibberish. The seed is not in
  the code anywhere. To seal a new letter, encrypt it with the same scheme and replace `CIPHER`.

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
