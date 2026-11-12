# SehatKampus UIN

Login + registration, 6 health-habit trackers, admin dashboard, QR code.

## Run locally (VS Code)
1. Install Node.js 18+ then open this folder in VS Code (`File > Open Folder`).
2. Terminal: `npm install`
3. Copy `.env.example` to `.env` and **change the admin password and secret**.
4. `npm start` and open http://localhost:3000

Admin login (default if no `.env`): username `admin`, password `Admin#12345`.
Optional images: put your logo at `public/img/logo.png` and campus photo at `public/img/campus.jpg`.

## Share it without buying a domain
- **Quick (today):** install cloudflared, run `cloudflared tunnel --url http://localhost:3000`. You get a free `https://xxxx.trycloudflare.com` link (works while your PC and the command are running; the link changes each time).
- **Permanent:** push to GitHub, create a free Web Service on render.com (Build: `npm install`, Start: `npm start`). You get `https://your-name.onrender.com`.
  Note: Render's free disk is wiped on restart/redeploy, so for real use switch the JSON store to a hosted database.

## QR code
Log in as admin: the QR is at the bottom of the admin page, or open `/qr.png` on your live URL. It always encodes the address it is opened from (set `PUBLIC_URL` in `.env` to force one).
