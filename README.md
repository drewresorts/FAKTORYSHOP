# FAKTORY — Shopify theme for The Faktory

A bold, minimal, aggressive Online Store 2.0 theme for **The Faktory** — record label, recording studio, merch line and media channel in one storefront.

- **Liquid chrome UI.** Every chrome surface (headings, buttons, badges, selected options, borders) is a metallic gradient driven by two live variables, `--tx` / `--ty`. On phones they follow the **gyroscope**, so the UI shimmers like a chrome object turning under light. On desktop they follow the pointer. When nothing is moving they drift slowly.
- **Interactive 3D.** The `<faktory-scene>` web component (Three.js, bundled locally) renders a chrome object — liquid blob, F monogram, torus knot, gyroscope rings, or **your own `.glb` model**. Drag or swipe to spin it with inertia, and tap to make it pulse. Tilting the device rotates the studio-light reflections across the metal.
- **Native 3D products.** If a product has 3D media, it shows in an interactive `model-viewer` with drag, zoom and AR.
- **Moving site areas.** Scroll-velocity marquees, a scroll-pinned horizontal artist rail, a manifesto that lights up word by word as you scroll, parallax, glitch and text-scramble hovers, 3D tilt cards with glare, magnetic buttons, and a custom cursor.
- **Integrated label, studio, merch and media.** Artist roster (from blocks or metaobjects), studio booking (inquiry form, paid deposit, or an embedded scheduler), merch drops with an AJAX cart drawer, and a content hub for video, podcasts, livestreams, digital products and the blog.

All motion respects `prefers-reduced-motion`.

---

## Install

1. Zip the repo contents (or connect the repo with the Shopify GitHub integration: **Online Store → Themes → Add theme → Connect from GitHub**).
2. Or use the CLI: `shopify theme push --unpublished` / `shopify theme dev`.

## Store setup checklist

### 1. Navigation
**Content → Menus**
- `main-menu`: Artists → `/pages/artists`, Studio → `/pages/studio`, Merch → `/collections/all`, Media → `/pages/media`
- `footer`: whatever you like (Shipping, Returns, Contact…)

### 2. Pages
Create these pages and assign the matching template in the page editor:

| Page | Template | Contents |
|---|---|---|
| Artists | `page.artists` | Giant name list with hover-reveal portraits, plus a profile grid |
| Studio | `page.studio` | Rooms, specs, live cost estimate, booking form |
| Media | `page.media` | Content hub (video / audio / live / editorial / digital) |

### 3. Artist roster (metaobjects, recommended)
**Settings → Custom data → Metaobjects → Add definition**
- Name: `Artist` · Type: `artist`
- Turn on **Web pages** (Online Store) so each artist gets a URL using `templates/metaobject/artist.json`.
- Fields (use these exact keys):

| Key | Type |
|---|---|
| `name` | Single line text |
| `genre` | Single line text |
| `portrait` | File (image) |
| `bio` | Rich text or Multi-line text |
| `spotify_url` | URL |
| `apple_music_url` | URL |
| `instagram_url` | URL |
| `youtube_url` | URL |
| `spotify_embed` | URL (e.g. `https://open.spotify.com/embed/artist/...`) |
| `merch_collection` | Collection reference |

If an **Artist roster** section has no blocks, it automatically lists every artist entry. To link products to an artist, add a product metafield `custom.artist` (Metaobject reference → Artist). The product page will then show an "Artist" card that links to their profile.

### 4. Studio booking
Each **Room** block has a display rate (`$85/HR`), a numeric hourly rate (used for the live estimate), and an optional **booking product**.

Booking methods (section setting):
- **Inquiry form** — sends a Shopify contact email (tagged `studio-booking`) with room, date, start time, hours, project type and notes.
- **Pay deposit** — adds the room's booking product to the cart with quantity = hours. The session details are attached as line-item properties, so they appear on the order. Create a product such as "Studio A — 1 hour" priced at your hourly rate (untick "physical product").
- **Both** (default), **Embed** (paste a Calendly / Square / Acuity URL), or **None**.

### 5. Merch & digital content
- Point the **Merch drop** section at any collection.
- Tag digital goods (sample packs, stems, presets, digital albums) with `digital` to get a DIGITAL badge. Deliver them with Shopify's free **Digital Downloads** app.
- Products with 3D media get a **3D** badge on their cards.

### 6. Content hub blocks
Video (YouTube/Vimeo with click-to-load embeds), Audio/podcast (Spotify, SoundCloud, Apple Music or Bandcamp embed URL), Livestream (with a "Live now" toggle), Digital product, and Blog feed. Visitors can filter by type.

### 7. Custom 3D hero model
Upload a `.glb` file to **Content → Files**, copy its URL, and in the **3D chrome hero** section choose Shape → *Custom GLB model* and paste the URL. By default the model is rendered in chrome. Tick **Keep the model's own materials** to keep its textures. Keep models small (under 5 MB, Draco not required).

## Theme settings
- **Colors:** background, surface, text, signal accent, and the three chrome stops (highlight / mid / shadow). *Chrome finish* switches between polished silver and holographic.
- **Typography:** display face (Anton, Archivo Black, Unbounded) and size scale.
- **Motion & effects:** tilt on/off and intensity, custom cursor, film grain, scroll reveals.
- **Presets:** *Default* (silver / signal red) and *Holo* (holographic / acid green / Unbounded).

## iOS motion permission
iOS needs permission before a site can read the gyroscope. The first time a visitor arrives on an iPhone, a small chrome button appears ("Tilt your phone — enable chrome motion"). Once they allow it, the theme remembers and re-enables tilt silently on their next tap. Android needs no prompt.

## Files
```
assets/
  faktory.css          design system, chrome, layout
  faktory.js           tilt engine, motion, cart drawer, variants, booking
  faktory-3d.js        <faktory-scene> Three.js component
  three.*.min.js       Three.js r180 (MIT), loaded via import map
  three-gltf-loader.js, three-buffer-geometry-utils.js  (for custom .glb models)
sections/  hero-3d, marquee, portals, artist-roster, featured-collection,
           statement, studio-booking, content-hub, split-feature, newsletter,
           main-* (product, collection, cart, artist, blog, …), header, footer
templates/ index, product, collection, page.{artists,studio,media},
           metaobject/artist, customers/*, …
```
