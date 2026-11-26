# Built-on logo sources

The "Built on" ticker on the home page shows each project's own mark. Every file here was downloaded from the
project's own site or from Simple Icons on 26 Nov 2026, then made monochrome: every ink area is filled with Text
Primary (`#15171C`), any knock-out detail is white, and gradients, colour discs and clip paths are removed. The
ticker draws them at a 20px optical height with the template's 0.72 opacity, which gives the ticker grey. The
geometry is the projects' own. Nothing was redrawn, except the ERC-8004 mark, which is traced (see below).
The script that does this is kept with the task notes, not in the repo. To redo it: download the source files
below, swap the fills and crop the viewBox to the mark.

| File | Mark | Source | What changed |
| --- | --- | --- | --- |
| `flap.svg` | Flap's two-wing mark | https://flap.sh/icon.svg (Flap's site icon) | Lime `#D0FF00` fill to ink; viewBox cropped to the wings |
| `atlas.svg` | Atlas's folded "A" ribbon | https://atlasoracle.io/favicon.svg (Atlas, the oracle backed by CoinMarketCap) | Five gradient fills to ink; defs and clip path dropped |
| `coinmarketcap.svg` | CoinMarketCap "M" in a ring | Simple Icons `coinmarketcap` (https://simpleicons.org/?q=coinmarketcap, CC0) | Fill set to ink |
| `pancakeswap.svg` | PancakeSwap bunny | CAKE symbol from PancakeSwap's token asset host, https://tokens.pancakeswap.finance/images/symbol/cake.svg | Gradient disc dropped; bunny silhouette to ink, eyes knocked out in white |
| `four-meme.svg` | Four.meme waving hand | https://four.meme/_next/static/media/logo-square.05d-1ttqbfnze.svg (Four.meme's site logo; OpenFour is Four.meme's template system) | Gradient hand to ink; black outline and finger lines knocked out in white; white sticker border dropped |
| `erc-8004.svg` | ERC-8004 network diamond | 8004.org logo, https://www.8004.org/8004_logo_purple%20copy.png (PNG only; no SVG is published) | Traced by hand: the same nine nodes and thirteen edges as strokes and dots, line weight raised to stay visible at 20px. The "8004" numerals are left out, since the ticker sets the name in text |
| `cournot.svg` | Cournot dot grid | https://cournot.ai/icon.svg (Cournot's site icon) | Dark disc dropped; the nine white dots to ink |
| `bnb-chain.svg` | BNB Chain cube | Simple Icons `bnbchain` (https://simpleicons.org/?q=bnbchain, CC0) | Fill set to ink |
| `tether.svg` | Tether (USDT) mark | Simple Icons `tether` (https://simpleicons.org/?q=tether, CC0) | Unchanged. Not in the ticker: the app uses it as a CSS mask, white on Tether green `#26A17B`, for the test USDT token glyph |

The marks are trademarks of their owners. They are used here only to name the integrations Covenant is built on,
not to suggest an endorsement.
