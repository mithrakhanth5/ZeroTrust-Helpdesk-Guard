from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class CallAnalysisRequest(BaseModel):
    caller_name: Optional[str] = "Unknown Caller"
    caller_phone: Optional[str] = "Unknown"
    employee_target: Optional[str] = "emp-4092 (David Miller)"
    ticket_id: Optional[str] = "INC-88910"
    transcript: str

class RiskAnalysisResult(BaseModel):
    caller_name: str
    employee_target: str
    ticket_id: str
    transcript: str
    risk_score: int = Field(ge=0, le=100)
    recommendation: str  # "ALLOW" or "BLOCK"
    tactics: List[str]
    reasoning: str
    is_gemini_powered: bool = False
    timestamp: str
    synthetic_voice_probability: Optional[int] = 5
    caller_id_spoof_risk: Optional[str] = "LOW"
    carrier_origin: Optional[str] = "Verified Corporate SIM"
    acoustic_anomalies: Optional[List[str]] = []

class MFAPushRequest(BaseModel):
    employee_id: str = "emp-4092"
    device_name: Optional[str] = "Okta Verify (iOS)"
    ip_address: Optional[str] = "198.51.100.42"
    source: Optional[str] = "Helpdesk Portal Reset"

class MFAPushResponse(BaseModel):
    employee_id: str
    push_count_60s: int
    threshold: int = 3
    is_locked: bool
    status: str
    alert: Optional[str] = None
    timestamp: str

class UnlockRequest(BaseModel):
    employee_id: str

class JITAccessRequest(BaseModel):
    ticket_id: str
    employee_id: str
    target_environment: str = "prod-aws-tcs-client"
    role_requested: str = "Temporary-Helpdesk-Admin"
    risk_score: int
    duration_minutes: int = 15

class JITSession(BaseModel):
    session_id: str
    ticket_id: str
    employee_id: str
    target_environment: str
    role_requested: str
    token: str
    token_fingerprint: Optional[str] = None
    permissions: Optional[List[str]] = []
    issued_at: str
    expires_at: str
    ttl_seconds: int
    is_revoked: bool

class AuditLogItem(BaseModel):
    id: int
    timestamp: str
    actor: str
    action: str
    details: str
    risk_score: int
    prev_hash: str
    current_hash: str

class ChainVerificationResponse(BaseModel):
    is_valid: bool
    total_records: int
    message: str
    tampered_record_id: Optional[int] = None
    computed_chain_head: Optional[str] = None

class TamperRequest(BaseModel):
    record_id: Optional[int] = None

class SimulateResourceRequest(BaseModel):
    token: str
    resource: str = "prod-aws-tcs-client/ecs/restart"

class EmployeeProfile(BaseModel):
    id: str
    name: str
    role: str
    department: str
    privilege_tier: str
    mfa_device: str
    phone: str
    is_locked: bool
    threat_status: str

class ComplianceCertificateResponse(BaseModel):
    certificate_id: str
    standard: str
    issued_at: str
    attestation_status: str
    is_valid: bool
    total_blocks_audited: int
    genesis_block_hash: str
    chain_head_hash: str
    cryptographic_algorithm: str
    storage_path: str
    auditor_note: str
    digital_seal: str
