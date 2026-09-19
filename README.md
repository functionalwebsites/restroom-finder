# Relief — public restroom finder

A full-screen results panel opens after Use my location. Switch List/Map, browse Next 3/Previous, or close the panel to change the search. Map view uses Leaflet and OpenStreetMap tiles, with numbered markers for the current page and a blue search-location marker. Only the area currently viewed is requested. The theme color is brand green (#c6f578).

Shows the three closest mapped restrooms with distance, a compass direction (relative to true north), and one button for the selected maps app. Names use mapped restroom names, street addresses, or nearby park/playground/garden context when available; otherwise the option number and direction distinguish unnamed facilities. Nearby labels do not imply a verified association.

A small, mobile-friendly website that uses your current location to find nearby mapped restrooms, including park facilities. Plain HTML, CSS, and JavaScript: no build tools, account system, API keys, or backend to maintain.

## Publish on GitHub Pages

1. Create a GitHub repository, for example `restroom-finder`. A public repository is the simplest option for GitHub Pages on a free account.
2. Unzip this download. Upload the **files inside the `github-pages` folder** to the repository's top level using **Add file → Upload files**, then commit them to `main`. The repository must have `index.html` at its root, not inside another folder. Upload the extracted files, not the ZIP itself.
3. Open **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**.
4. Select **main** and **/(root)**, then **Save**.
5. Wait for GitHub's Pages deployment to finish. Open the HTTPS website address shown in Settings → Pages, usually `https://YOUR-USERNAME.github.io/restroom-finder/`.
6. On your phone, tap **Use my location** and allow location access. A full-screen panel opens with three results, a List/Map switch, and Previous/Next controls. Each result has a walking-directions link.

All site paths are relative, so both repository sites and custom domains work. No GitHub Actions workflow or npm installation is needed. `.nojekyll` is included; if your file picker hides dotfiles, this plain site also works without it.

Official instructions: [Configure a GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Update it later

Open the file in GitHub, click **Edit** (the pencil), make your change, and **Commit changes** to `main`. GitHub Pages republishes automatically. Check the repository's **Actions** tab if an update is still pending, and refresh your site after publication.

| File         | What to edit                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `config.js`  | Search radius choices, default radius, number of results per page, data-service timeout and fallback endpoints |
| `index.html` | Page title, headings, explanatory text, and page structure                                                     |
| `style.css`  | Colors, fonts, spacing, and mobile layout                                                                      |
| `app.js`     | Location requests, result cards, UI messages, and search interactions                                          |
| `data.js`    | Public-access rules, distance sorting, navigation URLs, and KML export                                         |

Example: change `defaultRadiusMeters` to `2000` in `config.js` to start with a 2 km search. Keep that value in `searchRadiiMeters` too.

To undo an edit, restore the previous content from the file's GitHub history and commit it. Keep OpenStreetMap attribution when changing the page or export.

## Navigation links

- **Open in Apple Maps** uses Apple's HTTPS map link with the restroom's coordinates and walking mode.
- **Open in Google Maps** uses Google's universal HTTPS directions link with walking mode and requests navigation.
- These are real clickable links, not copied text. Compatible phones can open the installed navigation app. Browser settings, installed apps, and operating-system behavior determine the handoff; a browser route or route preview may appear instead. You may need to tap **Start** in the maps app.
- The origin is intentionally omitted so the maps app determines your current position. This also means directions from an example or manually entered search still start from your actual location.

References: [Apple Map Links](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html), [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

## Data and privacy

Restroom data is fetched live from public Overpass services using OpenStreetMap. No manual database refresh is needed. Queries include standalone toilets and facilities tagged as having toilets. Restricted access is excluded; standalone toilets with missing access tags are shown with an explicit unknown-access label. Facilities without explicit public or permissive access are excluded.

Location is requested only after you tap the button. Search coordinates are sent to the data service, and the app does not persist them. GitHub hosts the static files. Fonts load from Google Fonts. Navigation apps and external services have their own privacy policies.

Distances are straight-line estimates, not walking-route distances. Hours and availability are not verified. Coverage is incomplete, and public Overpass services can be slow or unavailable. Retry later or widen the radius if needed. The optional KML download contains all matching results and can be imported into Google My Maps; it does not create public listings in Apple Maps or Google Maps.

Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under ODbL. Source links on each result let you inspect or improve the community record.

## Optional local preview

From this folder, run `python3 -m http.server 8000` and open `http://localhost:8000`. Do not double-click `index.html`: browsers restrict JavaScript modules and location access on `file://` URLs. Use the HTTPS GitHub Pages address for testing on your phone.

## Quick check after an edit

1. Tap the Golden Gate Park example and confirm real results load in distance order.
2. Tap **Use my location** on your phone and confirm its permission prompt and results.
3. Tap each maps link and confirm the destination and walking mode.
4. Change the radius, and try the KML download if you use exports.

This package is independent of the earlier hosted version. Updating your GitHub files updates GitHub Pages only.
