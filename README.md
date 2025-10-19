# Golden Armor Studios

> Forging vibrant worlds for curious players.

Welcome to the official web experience for Golden Armor Studios, an indie collective building mindful games designed for mobile and beyond. This repository powers the marketing site, donor portal, and studio tooling that keep our community connected.

## Explore Our Worlds
- **Color IQ Pro** — sharpen your perception in a realm of shifting gradients.
- **BattleDawn Pro** — track live milestones, issues, and release status.
- **Community Hub** — join Discord, follow GitHub projects, and contribute feedback.

## Studio Pillars
| Crafted Experiences | Player First | Built for iOS |
| --- | --- | --- |
| Tactile controls, rich soundscapes, and polished visuals tuned for quick delight. | We iterate with our community, weaving feedback into every release. | Native performance for iPhone, iPad, and Apple Silicon with seamless updates. |

## Support the Journey
Fans can donate directly through the site. Payments are processed with Stripe and recorded through Firebase Functions—look for your supporter perks on the dashboard once you sign in with GitHub.

## Tech Stack Highlights
- [Vue 3](https://vuejs.org/) + [Vue Router](https://router.vuejs.org/) + [Vuex](https://vuex.vuejs.org/)
- [Firebase Hosting](https://firebase.google.com/docs/hosting) with callable Functions served via `https://api.goldenarmorstudio.art`
- [Stripe](https://stripe.com/docs/js) for secure donation processing
- Responsive layout crafted with modern CSS, custom video hero assets, and toast notifications

## Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server with hot reload:
   ```bash
   npm run serve
   ```
3. Lint and format fixes:
   ```bash
   npm run lint
   ```
4. Build production assets:
   ```bash
   npm run build
   ```

### Firebase & Functions
- Deploy static hosting:
  ```bash
  firebase deploy --only hosting
  ```
- Deploy the custom API target:
  ```bash
  firebase deploy --only hosting:api
  ```
- Deploy Cloud Functions:
  ```bash
  firebase deploy --only functions
  ```

## Assets & Git LFS
- Large media lives in `creative/` and is tracked via Git LFS.
- Images inside `src/assets/` (`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, `svg`, `bmp`) are also stored with LFS.
- Run `git lfs install` once per environment before committing.

## Stay Connected
- Website: [goldenarmorstudio.art](https://goldenarmorstudio.art)
- GitHub: [Golden Armor Studios](https://github.com/Golden-Armor-Studios)
- Discord: [Join the guild conversation](https://discord.gg)
- Email: [hello@goldenarmorstudio.com](mailto:hello@goldenarmorstudio.com)

Thanks for exploring Golden Armor Studios. Suit up, bring your imagination, and help us build the next adventure.
