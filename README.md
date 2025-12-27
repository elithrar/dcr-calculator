## Dynamic Compression Ratio (DCR) Calculator

A toy project for approximating engine DCR. Built using Vite + React + Tailwind + shadcn and deploys to Cloudflare Workers.

Live and online: https://dcr.questionable.services/

The calculator takes a few key inputs:
- **Stroke** and **Static CR** — your engine's basics
- **Intake Duration @ 0.050"** and **LSA** — defines when the intake valve closes
- **Rod length**, **Advertised Duration**, and **Cam Advance** are optional but improve accuracy

We estimate rod length from stroke if you don't have it, and assume a typical ramp rate when advertised duration isn't provided. This is a quick approximation — we're not modeling combustion chamber shape, piston dome volume, or head gasket thickness.

### Deploy it

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/elithrar/dcr-calculator/)

### License

Apache-2.0, of course.
