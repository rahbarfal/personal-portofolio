# Portfolio — Naufal Akbar Rahardjo

Static site (HTML + CSS + JS), no build step. Deploys to Vercel's free plan as-is.

## Structure

```
website/
├── index.html              # all sections (Home, About, Experience, Projects, Skills, Education, Contact)
│                           # theme: street / rolling-shutter / vinyl (shutter intro, turntable,
│                           # paste-wall posters, draggable stickers, cassette rack + document lightbox, spray tag wall)
├── vercel.json             # clean URLs + asset caching
└── assets/
    ├── css/style.css       # theme colors live in :root at the top
    ├── js/main.js          # shutter intro, nav/now-playing, LED stats, turntable, stickers,
    │                       # credentials carousel + lightbox, drawer menu, copy email, spray canvas
    ├── img/naufal.jpg      # profile photo
    ├── img/favicon.svg
    ├── img/credentials/    # certificate images (personal ID numbers blacked out)
    └── docs/CV_...pdf      # file served by the "Resume / Download CV" buttons
```

## Filling in placeholders

Search `index.html` for `TODO` — each marks a spot meant to be filled later
(personal note in About, project screenshots/links, next project card, certifications).
Placeholder links use `aria-disabled="true"`; replace `href="#"` with a real URL and
remove that attribute plus the `is-soon` class once a link is ready.

## Notes

- The entry shutter shows once per browser session (sessionStorage). It is skipped when the URL
  has a hash (e.g. `/#projects`) or when the visitor prefers reduced motion.
- Previous design is backed up in `../backup-website-v1/`.

## Preview locally

```bash
cd website
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to Vercel (free)

1. Push this repo to GitHub.
2. On vercel.com → **Add New… → Project** → import the repo.
3. Set **Root Directory** to `website`, Framework Preset **Other**, leave build command empty.
4. Deploy.

Or with the CLI: `npx vercel` from inside `website/`.
