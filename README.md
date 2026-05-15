# HVAC Cost Estimator — AI-Powered

A full-stack web app that replaces your Excel workbook with AI-enhanced estimation, drawing analysis, and proposal generation.

## Quick Start

### 1. One-click launch
```
Double-click START.bat
```
This installs all dependencies and opens the app automatically.

---

### 2. Manual Start

**Backend:**
```bash
cd backend
cp .env.example .env        # Then add your ANTHROPIC_API_KEY
npm install
npm run dev                 # Runs on http://localhost:3001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                 # Runs on http://localhost:5173
```

---

## Configuration

Edit `backend/.env`:
```env
ANTHROPIC_API_KEY=sk-ant-...        # Required for all AI features
EMAIL_USER=you@gmail.com            # For sending RFQ/proposal emails
EMAIL_PASS=your-app-password        # Gmail App Password (not your login password)
```

> For Gmail: Enable 2FA → Go to Google Account → Security → App Passwords → Create one for "Mail"

---

## Features

| Module | Description |
|--------|-------------|
| **Metal Duct Estimator** | Full duct estimation engine ported from Excel — gauge selection, surface area, labor & material |
| **AI Drawing Analyzer** | Upload mechanical drawings → Claude extracts duct sizes, unit schedules |
| **Live Price Monitor** | AI-powered material pricing — galvanized steel, insulation, labor rates |
| **Supplier RFQ Emails** | Auto-generate and send RFQ emails to suppliers from extracted unit schedules |
| **Proposal Generator** | AI writes a professional bid proposal PDF and emails it to the client |
| **Bid Summary** | Roll up all modules with overhead and profit into your final number |

---

## Project Structure

```
cost-estimator/
├── frontend/          React + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── Layout/
│       │   ├── modules/MetalDuct/
│       │   ├── modules/Summary/
│       │   └── ai/
│       ├── utils/ductCalculations.js   ← All Excel formulas live here
│       └── services/api.js
├── backend/           Node.js + Express
│   ├── routes/        prices, drawings, emails, proposals
│   └── services/      claudeService, emailService, pdfService
└── START.bat          One-click launcher
```

---

## Excel → Web Mapping

| Excel Sheet | Web Module |
|-------------|-----------|
| Metal Duct | `/duct` — MetalDuctModule |
| Summary | `/summary` — SummaryModule |
| OverheadCalculator | Overhead % inputs in both modules |
| Pricing | `/prices` — PriceMonitor (AI-updated) |
| Unit Sched | Drawing Analyzer extracts + sends RFQ |

---

## Next Steps (Phase 2)

- [ ] CW Pipe Schedule module
- [ ] VAV Schedule module  
- [ ] Electric Heat module
- [ ] Fan Schedule module
- [ ] Diffuser Schedule module
- [ ] Project save/load (database)
- [ ] User authentication
- [ ] PDF drawing support (auto-convert)
- [ ] Spring Boot backend migration
