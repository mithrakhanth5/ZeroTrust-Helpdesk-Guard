@echo off
title Zero-Trust AI Helpdesk & Access Guard Launcher
color 0B

echo ==============================================================================
echo        Zero-Trust AI Helpdesk & Access Guard (Human-Risk SOC Guard)
echo        Strict D: Drive Execution - Preserving C: System Storage
echo ==============================================================================

:: Configure strict D: drive cache variables
set "HF_HOME=D:\ZeroTrust-Helpdesk-Guard\.cache\models"
set "TORCH_HOME=D:\ZeroTrust-Helpdesk-Guard\.cache\models"
set "XDG_CACHE_HOME=D:\ZeroTrust-Helpdesk-Guard\.cache"
set "PIP_CACHE_DIR=D:\ZeroTrust-Helpdesk-Guard\.cache\pip"
set "DATABASE_PATH=D:\ZeroTrust-Helpdesk-Guard\backend\data\zerotrust_audit.db"

echo [1/3] Starting FastAPI Backend on http://localhost:8000 ...
start "ZeroTrust Backend (Port 8000)" cmd /k "cd /d D:\ZeroTrust-Helpdesk-Guard\backend && .venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/3] Starting React + Vite Frontend on http://localhost:5173 ...
start "ZeroTrust Frontend (Port 5173)" cmd /k "cd /d D:\ZeroTrust-Helpdesk-Guard\frontend && npm run dev"

echo [3/3] Waiting 4 seconds for services to initialize...
timeout /t 4 /nobreak >nul

echo Launching browser to SOC Dashboard...
start http://localhost:5173

echo ==============================================================================
echo  ALL SERVICES RUNNING:
echo    - SOC Web Dashboard: http://localhost:5173
echo    - Backend API & Docs: http://localhost:8000/docs
echo    - Real-time WebSockets: ws://localhost:8000/ws
echo    - SQLite Audit Ledger: D:\ZeroTrust-Helpdesk-Guard\backend\data\zerotrust_audit.db
echo ==============================================================================
echo To stop services, close the backend and frontend terminal windows.
pause
