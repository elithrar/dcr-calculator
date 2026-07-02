## Dynamic Compression Ratio (DCR) Calculator

A toy project for approximating engine DCR. Built using Vite + React + Tailwind + shadcn and deploys to Cloudflare Workers.

Live and online: https://dcr.questionable.services/

The calculator takes four paper data points to get close:
- **Stroke** and **Static CR** — engine basics
- **Intake Duration @ 0.050"** and **LSA** — cam timing from the card

Optional fields improve accuracy:
- **Duration @ 1 mm** — seat-to-seat closing (Dougherty cards list this)
- **Cam advance** and **overlap lift + nominal** — installed timing (both lift fields required)
- **Rod length** — slider-crank geometry (SC/3.2 rods: 127.8 mm)
- **Direct IVC ABDC** — best if your cam card lists intake closing
- **Bore, deck, chamber, gasket** — computes static CR from geometry (overrides manual CR on calculate)

If your cam card lists intake valve closing ABDC, use that directly. Otherwise we estimate IVC from duration, LSA, advance, and overlap lift. Rod length defaults to ~1.815× stroke if blank. This is a quick approximation — we're not modeling combustion chamber shape in detail, piston dome quirks, or head gasket crush.

### Deploy it

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/elithrar/dcr-calculator/)

### License

Apache-2.0, of course.
