# IslandHost branding

The shared theme uses the requested colors:

| Color | Use |
| --- | --- |
| `#29A5D2` | Blue highlights, icons, card accents and coastal artwork |
| `#0E7A86` | Primary buttons, links, navigation and selected controls |
| `#F1C232` | Gold calls to action, markers and decorative accents |

Dark teal text and pale companion backgrounds keep the interface readable. Gold buttons use dark text. Error states retain a distinct red. The primary button has a 5.06:1 text contrast ratio; the gold action has 6.79:1.

`public/images/islandhost-logo.jpeg` is an unchanged copy of the supplied IslandHostTempLogo.jpeg. The shared component is `src/components/brand.tsx`; its image is used on sign-in/recovery pages, loading screens and navigation. Compact navigation displays the palm and sun through CSS clipping. Browser branding uses the same asset and a teal theme color.

## Deploy the web update

The prepared archive is `.runtime/releases/islandhost-branding-web-20261004.zip`. It contains the complete rebuilt `.next/standalone` folder, including the logo, coastal artwork and static assets. Its API rewrite remains `http://127.0.0.1:4000/api/*`, matching the working hosted API.

1. Extract the archive on the trusted workstation.
2. Stop/recycle the hosted site for the file replacement and retain a backup of its current `.next/standalone` folder.
3. Replace the hosted `.next/standalone` folder with the complete folder from the archive, preserving that path under the website root. `.next` is a folder name beginning with a dot.
4. Restart the site. Check `/login`, `/api/health`, and the navigation at desktop and mobile sizes. Refresh the browser after deployment.

The patch does not require database changes or a dependency install on the host. Keep the existing working root launcher, web.config, dist/server and private hosted environment in place.

## View locally

Open `http://localhost:3000/login` while the local app is running. Use Ctrl+F5 if the browser has cached the previous logo or colors.

From the project root (the folder containing `package.json`), `npm start` runs the compiled app. To see future source edits as you save them, stop the existing local app and run `npm run dev` instead. Both commands start the web app and API together; do not run them on the same ports at the same time. To refresh the compiled preview after later edits, run `npm run build` before `npm start`.

The branding build was prepared in `.runtime/branding-build-20261004` while Windows locked the original dependency directory's native SQL module. The edited source and logo are in the main project. The root dependencies have now been restored and the updated compiled web folder installed locally; the previous generated folders are retained in `.runtime/local-before-branding-20261004`.

## Verification

- Production Next.js build and its TypeScript checks passed using the pinned dependencies in the isolated build folder.
- Application-source lint passed.
- The restarted local app passed checks for the login page, unchanged logo asset, all three theme colors, API health (direct and through the web app), and login input validation. Results are in `.runtime/local-branding-verification.json`.
- Six browser scenes passed: desktop/mobile sign-in, mobile recovery, desktop/tablet administrator dashboard, and mobile member dashboard. Collapsed desktop navigation and the mobile drawer were also captured and checked.
- Each scene loaded the supplied logo, used the three requested colors, and had no horizontal overflow or browser page errors. Visual checks used local sample data.
- Desktop/mobile screenshots and the check results are in `.runtime/branding-preview`.

The branding update has been prepared locally; the hosted website changes after the rebuilt web folder is uploaded and the site is restarted.
