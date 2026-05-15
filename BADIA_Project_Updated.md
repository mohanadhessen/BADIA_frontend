# BADIA Project Documentation & Improvement Roadmap

## I. Project Overview
**BADIA** is a Kuwait-based business consultancy specializing in operational partnerships, feasibility studies, and accounting services. The primary objective is to transition from a basic landing page to a high-performance, professional business platform and SaaS accounting engine.

## II. Current Project Structure
```
BADIA_frontend/
├── main.html          # Main entry point (single-page app)
├── styles.css         # Global styles (B&W + gold theme)
├── script.js          # Interactivity & components
├── BADIA_Project.md   # This document
└── assets/
    ├── logo.png       # Company logo
    └── hero-bg.jpg    # Hero background image
```

## III. SaaS Plans & Pricing Structure
The platform follows a monthly recurring subscription model (SaaS) targeting SMEs in Kuwait and the GCC.

| Feature | ⭐ Starter | 🔷 Business | 💎 Pro | 🏢 Enterprise |
| :--- | :--- | :--- | :--- | :--- |
| **Monthly Price** | 49.9 KWD | 89.9 KWD | 149.9 KWD | Upon Request |
| **Annual Price (-15%)**| 509.0 KWD | 917.0 KWD | 1,529.0 KWD | Upon Request |
| **Monthly Transactions**| 250 | 500 | 750 | Unlimited |
| **Users** | 1 | 3 | 5 | Unlimited |
| **Reports** | Basic | Advanced | Advanced + KPI | Custom |
| **Storage** | 1 GB | 5 GB | 20 GB | Unlimited |

### Payment Methods & Gateways
* **KNET**: Primary Kuwaiti national gateway.
* **Credit Cards (Visa/MC)**: Processed via Stripe or MyFatoorah (1.5% – 2.5% fee).
* **Apple Pay & Google Pay**: Web-based digital wallet integration.
* **Bank Transfer**: Manual payment with manual confirmation.

---

## IV. Implemented Features (V1.0)
* **Design**: Strict B&W with `#d4af37` (gold) accents; Tajawal typography.
* **Components**: Stats bar with counters, feasibility study tabs, and portfolio filtering.
* **Lead Generation**: WhatsApp floating button with pre-filled Arabic consultation text.
* **SEO**: Schema.org JSON-LD for Local Business and semantic HTML5.

---

## V. NEXT STEP: Phase 2 - Multi-Page Expansion & Client Accounts

The project will now move from a single-page landing site to a structured multi-page application with private client access.

### 1. Multi-Page Architecture
Deconstruct the current `main.html` into standalone pages to improve SEO and user flow:
* **About Page**: Vision, mission, and "Why Choose Us" USP.
* **Services Page**: Individual sections for Operational Partnerships, Feasibility Studies (with tabs), and Accounting (with pricing grid).
* **Portfolio Page**: Full filterable grid of projects across sectors (Restaurants, Retail, Services).
* **Blog Page**: Article layouts for business guidance in the Kuwaiti market.
* **Contact Page**: Standalone contact form with service-specific dropdowns.

### 2. Client Account Portal (`/account`)
A secure area for clients to manage their relationship with BADIA and their SaaS subscription:
* **Authentication**: Secure login/registration with JWT and 2FA.
* **Subscription Dashboard**:
    * Monitor transaction limits (e.g., tracking the 250-transaction cap for Starter).
    * Upgrade/Downgrade plan options.
* **Billing & Invoices**: Access and download professional PDF invoices and payment history.
* **Document Management**: Securely upload and store PDFs/images related to accounting entries and feasibility reports.
* **Profile Management**: Update company details, tax info, and user access roles (RBAC).

---
*Document updated on 2026-05-13 to include SaaS financial structures and Phase 2 roadmap.*
