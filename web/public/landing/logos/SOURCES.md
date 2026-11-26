# Logo sources

Marks for the "Built on" ticker in the home hero (`src/landing/sections/home/HomeHero.tsx`,
`src/landing/sections/home/hero/LogoTicker.tsx`). All are SVG, fetched on 2026-11-26 from each project's
own site or package. None is redrawn.

How they were processed: only the path data (`d`) and circle coordinates were copied out of each source
file into a new SVG. Everything else was dropped: scripts, event handlers, filters, gradients, clip paths,
ids and external references. Fill is `currentColor`, and each viewBox is cropped to the mark's own
bounding box. On the page the files are used as CSS masks filled with the ticker's text colour, so every
mark is one grey colour like the template's logo row. The template's ticker has no colour-on-hover effect
(hover only slows the ticker down), so none was added.

| File | Project | Source URL | What was taken | Licence / brand note |
| --- | --- | --- | --- | --- |
| `flap.svg` | Flap | https://flap.sh/icon.svg (the site favicon; the same two shapes start the nav logo https://flap.sh/ui20/nav-logo.svg) | Both shapes of the mark, which were green (`#D0FF00`), now one colour | No licence or brand guidelines found on flap.sh. Trademark of Flap. |
| `atlas.svg` | Atlas (Atlas Oracle) | https://atlasoracle.io/_next/static/media/logo.41op5tx66i3ek.svg (logo image on atlasoracle.io; same as https://atlasoracle.io/favicon.svg) | The five shapes of the mark. Their purple gradients are now one flat colour. | No licence or brand guidelines found on atlasoracle.io. Trademark of Atlas Oracle. |
| `coinmarketcap.svg` | CoinMarketCap | https://cdn.jsdelivr.net/npm/simple-icons@16.38.1/icons/coinmarketcap.svg | The Simple Icons path, unchanged | Simple Icons data is CC0-1.0. Simple Icons gives https://www.coinmarketcap.com as the source. The mark is CoinMarketCap's trademark. |
| `bnb-chain.svg` | BNB Chain | https://cdn.jsdelivr.net/npm/simple-icons@16.38.1/icons/bnbchain.svg | The Simple Icons path, unchanged | Simple Icons data is CC0-1.0. Simple Icons gives https://www.bnbchain.org as the source. The mark is BNB Chain's trademark. |
| `four-meme.svg` | OpenFour / Four.meme | https://four.meme/_next/static/media/logo-square.05d-1ttqbfnze.svg (the square logo on four.meme) | The black outline layer of the hand mark. The white fill and green gradient fill layers are dropped, so the hand reads as line art in one colour. | No licence or brand guidelines found on four.meme. Trademark of Four.meme. |
| `pancakeswap.svg` | PancakeSwap | `LogoIcon` in the official PancakeSwap UI kit, https://cdn.jsdelivr.net/npm/@pancakeswap/uikit@0.64.0/dist/index.cjs.js (`Icon$1j`, viewBox 0 0 198 199) | The bunny's outer outline path and its eyes path, merged with the even-odd rule. The result is a one-colour bunny with the eyes as holes. The two inner fill layers are dropped. | The pancakeswap.finance site (now pancake.xyz) offers only a raster `logo.png`, so the SVG comes from PancakeSwap's own npm package. That package's `package.json` gives its licence as MIT. The mark is PancakeSwap's trademark. |
| `cournot.svg` | Cournot | https://cournot.ai/assets/logos/logo.svg (the logo lockup on cournot.ai) | The nine dots of the mark. The "COURNOT" wordmark and drop-shadow filter are dropped. | No licence or brand guidelines found on cournot.ai. Trademark of Cournot. |

## Name only

| Project | Why |
| --- | --- |
| ERC-8004 | The standard has no published mark. The EIP text (https://github.com/ethereum/ERCs/blob/master/ERCS/erc-8004.md) has no logo and ethereum/ERCs has no `assets/erc-8004` folder. The community site https://8004.org lists `/logo_8004.png` as its favicon, but that URL serves the site's HTML page rather than an image, and its JS bundle has no SVG logo. The ticker shows the name "ERC-8004" alone. |
