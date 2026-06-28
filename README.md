# iOS App Website Template

A minimal static website template for iOS apps. Provide an App Store ID and the site builds itself: app name, icon, screenshots, and developer name are all fetched from Apple's iTunes API at build time.

Built with [Astro](https://astro.build). Ships zero JavaScript. Output is pure HTML + CSS.

## Quick Start

```sh
pnpm install
```

Edit `settings.yaml` with your app's ID:

```yaml
appID: "1234567890"
```

<!-- Adjust `contact.md` and `privacy.md` in `src/content/pages/` to fit your app. -->

Build and preview:

```sh
pnpm run build
pnpm run preview
```

## Configuration

All configuration lives in `settings.yaml`. Only `appID` is required. Everything else is optional and falls back to App Store data.

| Key                 | Required   | Default               | Description                                                                                 |
| ------------------- | ---------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `appID`             | Yes        | -                     | Your app's App Store ID                                                                     |
| `email`             | No / Maybe | hello@example.com     | Email shown on contact and privacy pages. Needed if both are left as is.                    |
| `site-url`          | No / Maybe | -                     | Full production URL, mainly used for OG image. If left empty, no og-image will be available |
| `title`             | No         | App Name              | Page title and meta tags                                                                    |
| `headline`          | No         | App Name              | Large heading in the hero section                                                           |
| `subheadline`       | No         | Hidden                | Paragraph below the headline                                                                |
| `accent-color`      | No         | Blue                  | Accent color (hex), used for buttons                                                        |
| `accent-color-dark` | No         | `accent-color`        | Accent color (hex) used in dark mode                                                        |
| `developer`         | No         | App Store seller name | Name shown in the footer                                                                    |
| `developer-link`    | No         | No Link               | Link when clicking developer name                                                           |

## Local Image Overrides

Place files in the `public/` directory to override images fetched from the App Store:

| File                    | Overrides                            |
| ----------------------- | ------------------------------------ |
| `public/appicon.png`    | App icon (hero + favicon + OG image) |
| `public/screenshot.png` | App screenshot in the hero section   |

Local files always take priority. If neither a local screenshot nor App Store screenshots are available, the hero section displays as a single centered column without an image.

## Adding Markdown Pages

Drop any `.md` file into `src/content/pages/` and it becomes a page automatically.

_Contact_ and _Privacy Policy_ pages are already created and can be adjusted to your app. Section for RevenueCat and TelemetryDeck exist, but are commented out.

| Frontmatter Key | Required | Default  | Description                                          |
| --------------- | -------- | -------- | ---------------------------------------------------- |
| `title`         | No       | Filename | Used for the page `<title>` tag and footer link text |
| `description`   | No       | Hidden   | Used for page meta description tags                  |
| `showInFooter`  | No       | True     | Decides if link to page is shown in footer           |

## Getting your App ID

To find your app ID from [App Store Marketing Tools](https://tools.applemediaservices.com/app-store), type the name of your app in the Search field, and select the appropriate country or region and media type. In the results, select your app. In the detail view for your app, find the Content Link. Your app ID is the number between id and ?.

Alternatively, select your app in App Store Connect. Under General, select App Information, then find your app ID in the General Information section that opens in the middle of the screen; your app ID is listed as Apple ID.

## Deployment

Since this template uses Astro, a static site will be generated in the `/dist` directory.

### Coolify

Enable the checkmark for _'Is this a static site'_ and set `/dist` as the _Publish Directory_. Then double check that the port has been changed to `80` (This should have happened automatically).

## Examples

Here are a few example sites using this template:

- [Count Up](https://countup.shemilt.de)
