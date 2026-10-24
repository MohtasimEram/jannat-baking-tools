<div align="center">

# 🧁 Jannat Baking Tools

**A fast, mobile-first online shop for baking tools, silicone molds, essence and home decor, built for customers in Bangladesh.**

[![Live Site](https://img.shields.io/badge/live-jannatbakingtools.vercel.app-E85A4F?style=for-the-badge&logo=vercel&logoColor=white)](https://jannatbakingtools.vercel.app)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore_&_Auth-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Images-3448C5?style=flat-square&logo=cloudinary&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## ✨ Overview

Jannat Baking Tools is a complete e-commerce storefront and admin panel with **no build step and no framework**. It is plain HTML, CSS and ES modules, backed by Firebase and a handful of Vercel serverless functions. Customers browse, search, build a cart and order with **Cash on Delivery**. The owner manages products and orders from a private dashboard and gets an instant Telegram alert for every new order.

<!--
  📸 Add screenshots here once you have them, for example:
  <p align="center">
    <img src="docs/home.png" width="48%" alt="Home page">
    <img src="docs/mobile.png" width="22%" alt="Mobile view">
  </p>
-->

## 🛍️ Features

### For customers
- **Browse and filter** by category (Molds, Tools, Decor, Essence), with sorting and a "Featured" rail the owner controls
- **Smart search** with live suggestions that forgives typos, ignores plurals and works with Bangla
- **Product pages** with multi-image gallery, colour options, stock status, quick view, share links and WhatsApp ordering
- **Cart and checkout** with saved details, delivery zones (Inside CTG ৳80 / Outside CTG ৳150) and Cash on Delivery
- **Order tracking** by phone number or order code
- **Wishlist** and **recently viewed** products
- **AI shopping assistant** that answers questions about products, prices, stock, delivery and returns using the live catalogue
- **Mobile-first design** with a bottom navigation bar and responsive images

### For the owner
- **Admin dashboard** to add, edit and delete products with multiple photos and colours
- **Order dashboard** with live updates, status management, revenue stats and **CSV export**
- **Telegram notifications** for every new order
- **Automatic image compression** in the browser before upload, which saves cloud storage

### Performance and SEO
- Images are resized and served as WebP/AVIF through Cloudinary with `srcset`
- Dynamic `sitemap.xml`, `robots.txt`, canonical URLs, Open Graph and Twitter cards
- Server-rendered meta tags and `Product` structured data on every product page, so link previews work on WhatsApp and Facebook

## 🧰 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript (ES modules), Tailwind CSS (CDN) |
| Database and auth | Firebase Firestore and Firebase Authentication |
| Images | Cloudinary, with client-side compression |
| Backend | Vercel serverless functions (`/api`) |
| AI assistant | Google Gemini (free), Groq, OpenRouter or Anthropic Claude |
| Notifications | Telegram Bot API |
| Hosting | Vercel |

## 📁 Project Structure

```
jannat-baking/
├── index.html · product.html · cart.html · track.html   # Storefront
├── login.html · admin.html · orders.html                # Owner area
├── css/styles.css
├── js/
│   ├── store.js            # Shared helpers, cart, wishlist, image URLs
│   ├── app.js · product.js · cart.js · track.js
│   ├── search.js           # Typo-tolerant search + suggestions
│   ├── chatbot.js          # AI assistant widget
│   ├── image-compress.js   # Browser-side image compression
│   ├── admin.js · orders.js · admin-shell.js · auth_guard.js
│   └── firebase.js · theme.js · ui.js
├── api/
│   ├── chat.js             # AI assistant endpoint
│   ├── notify-order.js     # Telegram order alerts
│   ├── product.js          # SEO-enriched product pages
│   ├── sitemap.js          # Live sitemap.xml
│   └── _lib/               # Firestore reader + store knowledge for the assistant
├── firestore.rules         # Security rules (publish in the Firebase console)
├── server.js               # Zero-dependency local dev server
└── vercel.json
```

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) 18 or newer
- A [Firebase](https://console.firebase.google.com) project with **Firestore** and **Email/Password Authentication**
- A [Cloudinary](https://cloudinary.com) account with an unsigned upload preset
- (Optional) A Telegram bot and an AI API key

### Run locally

```bash
git clone https://github.com/MohtasimEram/jannat-baking-tools.git
cd jannat-baking-tools

cp .env.example .env.local     # then fill in your values
node server.js                 # serves the site and /api on http://localhost:5000
```

### Configure

1. **Firebase:** put your web app config in `js/firebase.js`, then publish `firestore.rules` in *Firestore → Rules*.
2. **Cloudinary:** set your cloud name and upload preset at the top of `js/admin.js`.
3. **Admin user:** create your admin account in *Firebase → Authentication → Users*.
4. **Store details:** edit `api/_lib/store-knowledge.js` (delivery, returns, contact) so the AI assistant answers correctly.

### Environment variables

| Variable | Required | Purpose |
| --- | :---: | --- |
| `TELEGRAM_BOT_TOKEN` | Optional | Bot token for new-order alerts |
| `TELEGRAM_CHAT_ID` | Optional | Chat that receives the alerts |
| `AI_API_KEY` | Optional | Key for the AI assistant (Gemini `AIza…`, Groq `gsk_…`, OpenRouter `sk-or-…` or Anthropic `sk-ant-…`) |
| `AI_PROVIDER` | Optional | Force a provider: `gemini`, `groq`, `openrouter`, `anthropic` |
| `CHAT_MODEL` | Optional | Override the default model |
| `SITE_URL` | Optional | Public URL used in the sitemap and canonical links |

> Never commit real keys. `.env` files are git-ignored. Add secrets in **Vercel → Settings → Environment Variables** for production.

## ☁️ Deployment

1. Push the repository to GitHub.
2. Import it into [Vercel](https://vercel.com/new). No build command is needed.
3. Add the environment variables above and deploy.

## 🔐 Security Notes

- The Firebase web config is meant to be public. Your protection is **Firestore Security Rules** and **Authentication settings**, so keep `firestore.rules` published and restrict the API key to your domain in Google Cloud Console.
- Admin and AI secrets live only in serverless environment variables, never in browser code.
- The AI assistant never sees orders or customer data; it only reads the public product catalogue.

## 🗺️ Roadmap

- [ ] Online payments (bKash / Nagad)
- [ ] Private order tracking through a server function
- [ ] Discount codes
- [ ] Bangla language toggle

---

<div align="center">

Made with ❤️ in Chittagong, Bangladesh

</div>
