# FWDS & BCKS LTD company website

The public website for **www.fwdsandbcks.com**, the company behind PHASE: Rugby Manager.
Apple asks an organisation enrolling in the Apple Developer Program for a public
website on its own domain. This is that site.

Plain HTML and CSS, no build step. Files:

| File | What it is |
|---|---|
| `index.html` | Home page: hero, game, studio and contact sections |
| `privacy.html` | Privacy notice for this website |
| `style.css` | Shared styles (one dark theme on the PHASE palette; the logo itself is black and white) |
| `img/` | Studio logo, favicon, iPhone icon, PHASE icon, art and screenshots |
| `brand/` | The FWDS & BCKS logo as SVG and as transparent PNGs (512 and 1024 wide) for use elsewhere |
| `space-grotesk-latin.woff2` | The site font, served locally |
| `CNAME` | Tells GitHub Pages the domain is `www.fwdsandbcks.com` |

## Why it is not published by this repo's Pages workflow

`.github/workflows/pages.yml` publishes phaserugbymanager.com, and one GitHub repo
can only have one Pages custom domain. So this folder is published from its own
repo.

## Publishing it (GitHub Pages, free)

1. On GitHub, create a new **public** repository, for example `fwdsandbcks-site`.
2. Upload everything in this `company/` folder to the **root** of that repo
   (`index.html`, `privacy.html`, `style.css`, `CNAME` and the `img/` folder).
3. In that repo: **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Under **Custom domain** enter `www.fwdsandbcks.com` and save.

## DNS at Namecheap

**Domain List → fwdsandbcks.com → Manage → Advanced DNS.** Remove the default
parking records, then add:

| Type | Host | Value |
|---|---|---|
| A Record | @ | 185.199.108.153 |
| A Record | @ | 185.199.109.153 |
| A Record | @ | 185.199.110.153 |
| A Record | @ | 185.199.111.153 |
| CNAME Record | www | `<your-github-username>.github.io` |

For this account that CNAME value is `craigjswayne-cyber.github.io`.

After DNS updates (can take a few hours), go back to **Settings → Pages** and tick
**Enforce HTTPS**. `fwdsandbcks.com` without the `www` redirects to the `www` address.

## Company email

The site lists `info@fwdsandbcks.com`. For that address to receive mail, set it up
at Namecheap: **Domain → Redirect Email** (free forwarding to an existing inbox),
or buy a Namecheap Private Email mailbox if you also need to send from it.
Apple uses this address to contact the organisation, so it must work before you enrol.
