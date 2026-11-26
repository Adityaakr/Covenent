# /contact spec

Framer source: page `q0GecTnYS` (Desktop `m39OTbL2S`, Tablet `PbV9aRfxu`, Phone `tZtV264Rg`). No Page CTA on this page.
Code: `web/src/landing/pages/ContactPage.tsx`, `web/src/landing/sections/contact/**`. References: `reference/contact/full-*.jpg`.

## Contact Main (`EX2bP05WH`), no top border

| | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| Outer padding | 0 32 | 0 24 | 0 16 |
| Content | gap 0, padding 96 64 112 64 | 80 48 96 48 | 56 20 64 20 |
| Contact Columns | horizontal, align start, gap 72 | vertical, gap 48 | vertical, gap 40 |
| Contact Intro | width 1fr | 100% | 100% |
| Form Card | width 520, padding 32 | 100%, 32 | 100%, padding 20 |
| Form rows | horizontal, gap 14 | horizontal | vertical |

Contact Intro: vertical, gap 24.
- Eyebrow: Label, Accent. Title `h1`: **H2 preset**, two runs (Text Primary / Text Secondary). Body: Lead.
- Contact Channels: 1px top Border; each row is a link, horizontal, centred, gap 14, padding 18 0, 1px bottom Border.
  Icon 18px Text Primary; title Label width 1fr; right text Label Text Secondary.
  **Hover: x 4px, scale 1.1, spring duration 0.3s bounce 0.**
  Template rows were mailto links (Sales, Support, Press). Covenant uses App `/app`, Rules `/features`,
  Milestones `/changelog` with Phosphor Rocket Launch, Shield Check and Flag (icons that exist in the project).

Contact Form Card (`D7UHLL426`): radius 20, Surface fill, 1px Border.
**Appear effect: onInView, viewport end, from y 32px scale 0.98, spring stiffness 500 damping 60 mass 1** (`ScrollLift`).

Contact Form (`edrBpjcZA`, `form`): vertical, gap 18, align start.
- Each field is a `label`: vertical, gap 8, width 1fr; label text Label preset (Text Primary).
- Inputs (FormPlainTextInputNode): height 46, padding 12 14, radius 10, 1px **Border** token, Background fill,
  Inter 500 15px, line height 1.2em, letter spacing 0, Text Primary, placeholder Text Secondary,
  focused border 1px **Accent**. Required.
- Select (FormSelectNode): same box; icon colour Text Secondary; first option selected. Chevron: Phosphor Caret Down 12px at right 14px.
- Textarea: same box, height 140.
- Contact Submit: Submit Button instance, width 100%, height 48, label "Send message" (variants in `changelog.md`).
- Form Note: Small, Text Secondary.
Fields for Covenant: Name, Email / Project, You are (Team, Buyer, Launchpad, Agent builder) / What are you raising for?
No backend: submit shows Pending, then Success.

## Contact Promises (`AAAHVbPKY`)

1px top Border. Content: no padding, gap 0. Promises Row horizontal, gap 0 (Phone vertical).
Promise: width 1fr, vertical gap 10, padding 40 (Tablet 32 24, Phone 24 20). Promise 2 and 3: 1px left Border
(Phone: no left border, 1px top Border). Icon 20px Accent; title `h4` H4; body Body.

## Contact FAQ (`vBRO6vLHq`)

1px top Border. Content padding 120 64 / 96 48 / 64 20, gap 32 / 32 / 36.
Heading Group: vertical gap 20; eyebrow Label Accent; heading `h2` H2 Text Primary, max width 820.
FAQ List: collection list (FAQ CMS) limited to 4, sorted ascending, 1px top Border; each row a FAQ Item component
(`VrMDv2AIP`, Closed variant). Rendered with the foundation `FAQList` over `content/faqs.ts` (first 4 items).
