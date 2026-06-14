## Dynamic Compression Ratio (DCR) Calculator

A toy project for approximating engine DCR. Built using Vite + React + Tailwind + shadcn and deploys to Cloudflare Workers.

Live and online: https://dcr.questionable.services/

The calculator takes a few key inputs:
- **Stroke** and **Static CR** — your engine's basics
- **Intake Duration @ 0.050"** and **LSA** — defines when the intake valve closes
- **Direct IVC ABDC**, **Rod length**, **Advertised Duration**, and **Cam Advance** are optional but improve accuracy

If your cam card lists intake valve closing ABDC, use that directly. Otherwise, we estimate IVC from duration, LSA, advertised duration, and cam advance. We estimate rod length from stroke if you don't have it. This is a quick approximation — we're not modeling combustion chamber shape, piston dome volume, or head gasket thickness.

### Deploy it

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/elithrar/dcr-calculator/)

### License

Apache-2.0, of course.
