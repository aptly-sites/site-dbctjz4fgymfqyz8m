# Working in this repository

This is a website managed and hosted by Aptly (a property management
platform) on behalf of one of its customers. It deploys to Cloudflare Pages
via the GitHub Actions workflow already checked in at
`.github/workflows/deploy.yml` — do not remove or replace that workflow.

## Rules for AI coding agents

- Build and keep this as a fully static site: plain HTML, CSS, and (if
  needed) vanilla or minimally-bundled JavaScript. Every page's real content
  must already be present in the HTML itself — do not introduce a framework
  that needs client-side JavaScript to render the initial page content
  (React, Vue, Next.js, a client-side router, etc.). Aptly's in-app preview
  loads pages in a sandboxed frame with no real page location; a page whose
  content only appears after JavaScript "hydrates" and reads the current URL
  renders correctly on the real live site but blank in that preview —
  observed directly on a site built with React + a client-side router,
  where the header and footer rendered fine but the entire main content
  stayed invisible.
- Do not introduce a new framework, bundler, or build toolchain (React,
  Vite, Next.js, a Node/Express server, etc.) unless a human has explicitly
  asked for that change. A sparse or simple file structure here is
  intentional, not a starting point to scaffold a "real app" onto.
- Edit the existing files in place. Preserve the current directory layout —
  Aptly's own tooling (the customer's Cloudflare Pages project, and Aptly's
  in-app site editor, where available) expects it to stay put.
- If a request genuinely seems to need a different architecture (e.g. real
  interactivity, a backend, a build step that doesn't exist yet), say so
  and ask before restructuring the repo — don't decide that silently.
