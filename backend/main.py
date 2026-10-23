import os
import shutil
import tempfile
import json
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from models import (
    CallAnalysisRequest, RiskAnalysisResult,
    MFAPushRequest, MFAPushResponse, UnlockRequest,
    JITAccessRequest, JITSession, ChainVerificationResponse,
    TamperRequest, SimulateResourceRequest, EmployeeProfile,
    ComplianceCertificateResponse
)
from audit_chain import audit_ledger
from mfa_guard import mfa_guard
from jit_vault import jit_vault
from ai_analyzer import ai_analyzer, transcribe_audio_file

app = FastAPI(
    title="Zero-Trust AI Helpdesk & Access Guard (Human-Risk)",
    description="Real-Time AI-Powered Protection Against Outsourced Helpdesk Vishing & MFA Fatigue",
    version="2.0.0"
)

# CORS setup for local React Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Corporate Directory Database Simulation
CORPORATE_DIRECTORY = [
    {
        "id": "emp-4092",
        "name": "David Miller",
        "role": "Senior Financial Analyst",
        "department": "Corporate Finance & Treasury",
        "privilege_tier": "Tier 2 (Elevated SAP & Banking Access)",
        "mfa_device": "Okta Verify Hardware FIDO2 + iOS",
        "phone": "+1 (312) 555-0149 (Chicago Branch)"
    },
    {
        "id": "emp-1088",
        "name": "Sarah Jenkins",
        "role": "Vice President & CFO",
        "department": "Executive Leadership",
        "privilege_tier": "Tier 1 (C-Suite Wire & Financial Approver)",
        "mfa_device": "YubiKey 5C NFC + Duo Mobile",
        "phone": "+1 (212) 555-0811 (New York HQ)"
    },
    {
        "id": "emp-7721",
        "name": "Rajesh Kumar",
        "role": "Lead Cloud DevOps Architect",
        "department": "Infrastructure & Cloud Platform",
        "privilege_tier": "Tier 0 (Root AWS/K8s Multi-Account Admin)",
        "mfa_device": "Hardware Token + Okta Verify",
        "phone": "+91 (80) 4122-7721 (Bengaluru Center)"
    },
    {
        "id": "emp-3309",
        "name": "Elena Rostova",
        "role": "HR Director & People Operations",
        "department": "Human Resources & Payroll",
        "privilege_tier": "Tier 2 (Workday HRIS Master Record)",
        "mfa_device": "Microsoft Authenticator (Android)",
        "phone": "+44 (20) 7946-3309 (London Office)"
    }
]

# WebSocket Connection Manager for Real-Time SOC Alerts
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WebSocket] Client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WebSocket] Client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "SYSTEM_INFO",
            "message": "Connected to Zero-Trust SOC Guard Real-Time Stream",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# ----------------- EMPLOYEE DIRECTORY -----------------
@app.get("/api/employees", response_model=List[EmployeeProfile])
async def get_employees():
    result = []
    for emp in CORPORATE_DIRECTORY:
        locked = mfa_guard.is_locked(emp["id"])
        status = mfa_guard.get_status(emp["id"])
        threat = "LOCKED (MFA FATIGUE ATTACK)" if locked else f"NORMAL ({status['push_count_60s']}/3 pushes)"
        result.append(EmployeeProfile(
            **emp,
            is_locked=locked,
            threat_status=threat
        ))
    return result

# ----------------- 1. LIVE VOICE & CALL VISHING ANALYZER -----------------
@app.post("/api/analyze-call", response_model=RiskAnalysisResult)
async def analyze_call(req: CallAnalysisRequest):
    result = ai_analyzer.analyze(
        transcript=req.transcript,
        caller_name=req.caller_name or "Unknown",
        employee_target=req.employee_target or "emp-4092",
        ticket_id=req.ticket_id or "INC-GEN"
    )

    # Log to immutable SHA-256 chain
    audit_entry = audit_ledger.log_event(
        actor=f"Helpdesk:{req.caller_name}",
        action=f"CALL_ANALYZED_{result['recommendation']}",
        details=f"Ticket: {req.ticket_id} | Target: {req.employee_target} | Tactics: {', '.join(result['tactics'])} | Deepfake: {result.get('synthetic_voice_probability')}%",
        risk_score=result["risk_score"]
    )

    # Broadcast real-time SOC alert
    await manager.broadcast({
        "type": "CALL_ANALYZED",
        "data": result,
        "audit_entry": audit_entry
    })

    return RiskAnalysisResult(**result)

@app.post("/api/transcribe-and-analyze")
async def transcribe_and_analyze(
    file: UploadFile = File(...),
    caller_name: str = Form("Voice Caller"),
    employee_target: str = Form("emp-4092 (David Miller)"),
    ticket_id: str = Form("INC-88910")
):
    temp_dir = r"D:\ZeroTrust-Helpdesk-Guard\.cache"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, f"audio_{file.filename}")

    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        transcript = transcribe_audio_file(temp_file_path)
    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass

    result = ai_analyzer.analyze(
        transcript=transcript,
        caller_name=caller_name,
        employee_target=employee_target,
        ticket_id=ticket_id
    )

    audit_entry = audit_ledger.log_event(
        actor=f"VoiceAudio:{caller_name}",
        action=f"VOICE_ANALYZED_{result['recommendation']}",
        details=f"Ticket: {ticket_id} | Target: {employee_target} | Transcript: {transcript[:70]}... | Deepfake: {result.get('synthetic_voice_probability')}%",
        risk_score=result["risk_score"]
    )

    await manager.broadcast({
        "type": "VOICE_CALL_ANALYZED",
        "data": result,
        "audit_entry": audit_entry
    })

    return result

# ----------------- 2. INSTANT MFA-FATIGUE RATE LIMITER -----------------
@app.post("/api/mfa-push", response_model=MFAPushResponse)
async def trigger_mfa_push(req: MFAPushRequest):
    count, is_locked, alert = mfa_guard.record_push_request(req.employee_id)

    action = "MFA_PUSH_BLOCKED" if is_locked else "MFA_PUSH_DISPATCHED"
    details = f"Push count in 60s: {count}/3 | Device: {req.device_name} | IP: {req.ip_address}"
    risk_score = 95 if is_locked else (count * 20)

    audit_entry = audit_ledger.log_event(
        actor=req.employee_id,
        action=action,
        details=details,
        risk_score=risk_score
    )

    response_data = {
        "employee_id": req.employee_id,
        "push_count_60s": count,
        "threshold": 3,
        "is_locked": is_locked,
        "status": "LOCKED" if is_locked else f"ACTIVE ({count}/3)",
        "alert": alert,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    await manager.broadcast({
        "type": "MFA_STATUS_UPDATE",
        "data": response_data,
        "audit_entry": audit_entry
    })

    return MFAPushResponse(**response_data)

@app.post("/api/mfa-unlock")
async def unlock_account(req: UnlockRequest):
    mfa_guard.unlock_account(req.employee_id)
    audit_entry = audit_ledger.log_event(
        actor="SOC_ADMIN",
        action="MFA_LOCK_CLEARED",
        details=f"Admin cleared MFA fatigue lock for employee {req.employee_id}",
        risk_score=0
    )
    await manager.broadcast({
        "type": "MFA_ACCOUNT_UNLOCKED",
        "employee_id": req.employee_id,
        "audit_entry": audit_entry
    })
    return {"status": "SUCCESS", "employee_id": req.employee_id, "message": "Account unlocked"}

@app.get("/api/mfa-status/{employee_id}")
async def get_mfa_status(employee_id: str):
    return mfa_guard.get_status(employee_id)

# ----------------- 3. JUST-IN-TIME CLIENT ACCESS VAULT & API SIMULATOR -----------------
@app.post("/api/jit/issue")
async def issue_jit_access(req: JITAccessRequest):
    if mfa_guard.is_locked(req.employee_id):
        raise HTTPException(status_code=403, detail="Access Denied: Employee account is currently locked under MFA-Fatigue defense.")

    if req.risk_score >= 40:
        raise HTTPException(status_code=403, detail=f"Access Denied: Call Risk Score ({req.risk_score}) exceeds Zero-Trust threshold (< 40).")

    session = jit_vault.issue_token(
        employee_id=req.employee_id,
        ticket_id=req.ticket_id,
        target_environment=req.target_environment,
        role_requested=req.role_requested,
        duration_minutes=req.duration_minutes
    )

    audit_entry = audit_ledger.log_event(
        actor=req.employee_id,
        action="JIT_TOKEN_ISSUED",
        details=f"Session: {session['session_id']} | Env: {req.target_environment} | Role: {req.role_requested} | Fingerprint: {session.get('token_fingerprint')}",
        risk_score=req.risk_score
    )

    await manager.broadcast({
        "type": "JIT_SESSION_CREATED",
        "session": session,
        "audit_entry": audit_entry
    })

    return session

@app.post("/api/jit/simulate-access")
async def simulate_resource_access(req: SimulateResourceRequest):
    result = jit_vault.simulate_resource_access(token=req.token, resource=req.resource)
    
    # Log access attempt to audit trail
    audit_entry = audit_ledger.log_event(
        actor=result.get("claims", {}).get("sub", "Unknown-Token"),
        action=f"JIT_API_ACCESS_{result['access']}",
        details=f"Resource: {req.resource} | HTTP {result['status_code']} | Result: {result.get('message') or result.get('error')}",
        risk_score=0 if result["access"] == "GRANTED" else 60
    )

    await manager.broadcast({
        "type": "JIT_API_SIMULATION",
        "result": result,
        "audit_entry": audit_entry
    })

    return result

@app.post("/api/jit/revoke")
async def revoke_jit_access(session_id: str = Form(...), reason: str = Form("SOC Emergency Kill-Switch Activated")):
    session = jit_vault.revoke_session(session_id, reason)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    audit_entry = audit_ledger.log_event(
        actor="SOC_ADMIN",
        action="JIT_TOKEN_REVOKED",
        details=f"Killed session {session_id} | Reason: {reason}",
        risk_score=10
    )

    await manager.broadcast({
        "type": "JIT_SESSION_REVOKED",
        "session": session,
        "audit_entry": audit_entry
    })

    return {"status": "REVOKED", "session": session}

@app.get("/api/jit/sessions")
async def get_jit_sessions():
    return jit_vault.get_sessions()

# ----------------- 4. TAMPER-PROOF SHA-256 AUDIT LEDGER & COMPLIANCE -----------------
@app.get("/api/audit/logs")
async def get_audit_logs(limit: int = 50):
    return audit_ledger.get_ledger(limit=limit)

@app.post("/api/audit/verify", response_model=ChainVerificationResponse)
async def verify_chain():
    result = audit_ledger.verify_chain_integrity()
    return ChainVerificationResponse(**result)

@app.post("/api/audit/tamper")
async def simulate_tamper(req: TamperRequest):
    result = audit_ledger.simulate_tampering(req.record_id)
    await manager.broadcast({
        "type": "TAMPER_SIMULATED",
        "data": result
    })
    return result

@app.post("/api/audit/restore")
async def restore_chain():
    result = audit_ledger.restore_ledger()
    await manager.broadcast({
        "type": "CHAIN_RESTORED",
        "data": result
    })
    return result

@app.get("/api/audit/compliance-certificate", response_model=ComplianceCertificateResponse)
async def get_compliance_certificate():
    cert = audit_ledger.generate_compliance_certificate()
    return ComplianceCertificateResponse(**cert)

# ----------------- HEALTH CHECK -----------------
@app.get("/api/health")
async def health_check():
    gemini_configured = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "status": "HEALTHY",
        "version": "2.0.0-Enterprise",
        "project": "Zero-Trust AI Helpdesk & Access Guard (Human-Risk)",
        "d_drive_root": r"D:\ZeroTrust-Helpdesk-Guard",
        "database_path": r"D:\ZeroTrust-Helpdesk-Guard\backend\data\zerotrust_audit.db",
        "cache_paths": {
            "pip": r"D:\ZeroTrust-Helpdesk-Guard\.cache\pip",
            "models": r"D:\ZeroTrust-Helpdesk-Guard\.cache\models",
            "npm": r"D:\ZeroTrust-Helpdesk-Guard\.cache\npm"
        },
        "gemini_api_configured": gemini_configured,
        "whisper_configured": True,
        "active_websockets": len(manager.active_connections)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
