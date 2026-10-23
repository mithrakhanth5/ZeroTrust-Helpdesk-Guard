# Zero-Trust AI Helpdesk & Access Guard (Human-Risk)

An end-to-end, real-time cybersecurity platform designed to protect outsourced IT helpdesks from **social engineering (vishing)**, **MFA-fatigue attacks**, and **permanent third-party network over-privilege**.

All components, caches, models, and dependencies are strictly isolated on the **`D:` drive** to protect `C:` drive storage.

---

## Architecture Overview

```
D:\ZeroTrust-Helpdesk-Guard\
├── backend\
│   ├── .venv\                     # Python virtual environment (D: drive only)
│   ├── data\
│   │   └── zerotrust_audit.db     # SQLite SHA-256 Hash-Chained Audit Ledger
│   ├── main.py                    # FastAPI app + WebSockets real-time broadcaster
│   ├── ai_analyzer.py             # Whisper STT + Gemini 3.8 Flash / SOC heuristic
│   ├── mfa_guard.py               # Redis / Sliding-window MFA rate limiter
│   ├── jit_vault.py               # 15-minute auto-expiring JWT access vault
│   ├── audit_chain.py             # Tamper-proof SHA-256 hash-chaining engine
│   ├── models.py                  # Pydantic data schemas
│   ├── requirements.txt           # Python backend dependencies
│   ├── .env                       # Environment configuration
│   └── .env.example
├── frontend\
│   ├── node_modules\              # Frontend dependencies (D: drive only)
│   ├── src\
│   │   ├── App.jsx                # 4-Panel Dark SOC Dashboard
│   │   ├── main.jsx
│   │   └── index.css              # Tailwind styling
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── .cache\                        # Isolated cache directory
│   ├── pip\                       # Pip package cache
│   ├── npm\                       # NPM package cache
│   └── models\                    # Whisper & Hugging Face models (HF_HOME, TORCH_HOME)
└── start_demo.bat                 # One-click launcher for Windows
```

---

## 4 Core Defensive Panels

1. **Live Helpdesk Call & Vishing Analyzer**
   - Live microphone voice capture using browser `MediaRecorder API` + local `faster-whisper`.
   - 1-click attack simulation presets (*"Normal Employee Call"*, *"Scattered Spider Vishing Call"*, *"Urgent Executive Impersonation"*).
   - Real-time LLM analysis powered by **Google Gemini API** (`gemini-3.8-flash`) with automatic offline heuristic fallback.
   - Dynamic 0–100 Risk Score, manipulation tactics breakdown, and **ALLOW / BLOCK** policy decision.

2. **MFA-Fatigue Shield**
   - Sliding-window rate limiter (Redis / in-memory buffer).
   - Enforces threshold: **3 MFA push requests within 60 seconds triggers instant account lock**.
   - Immediate broadcast of red **"MFA-FATIGUE ATTACK BLOCKED"** alert banner across WebSockets.
   - Administrative one-click lock release.

3. **Just-in-Time (JIT) Client Access Vault**
   - Enforces Zero-Trust policy: only issues access if call Risk Score < 40 and account is not locked.
   - Issues **15-minute auto-expiring JWT tokens** scoped strictly to a single ticket ID and client environment (`prod-aws-tcs-client`).
   - Live interactive countdown timer (`15:00` down to `00:00`).
   - Emergency kill-switch button to immediately revoke compromised sessions.

4. **Tamper-Proof SHA-256 Audit Ledger**
   - Mathematical hash-chained audit table:
     $$\text{current\_hash} = \text{SHA256}(\text{prev\_hash} + \text{timestamp} + \text{actor} + \text{action} + \text{risk\_score} + \text{details})$$
   - **"Verify Chain Integrity"** button recomputes the entire chain from genesis to detect any database tampering or insider fraud.

---

## Launch Instructions

### 1-Click Launch (Windows)
Double-click or run:
```cmd
D:\ZeroTrust-Helpdesk-Guard\start_demo.bat
```

### Manual Launch
**Backend**:
```powershell
cd D:\ZeroTrust-Helpdesk-Guard\backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend**:
```powershell
cd D:\ZeroTrust-Helpdesk-Guard\frontend
npm run dev
```

Dashboard will be live at: **`http://localhost:5173`**
API Docs will be live at: **`http://localhost:8000/docs`**
