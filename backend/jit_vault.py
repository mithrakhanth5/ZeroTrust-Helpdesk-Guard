import os
import time
import uuid
import jwt
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any

JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-zerotrust-token-key-2026-audit")
ALGORITHM = "HS256"

class JITVault:
    def __init__(self, secret: str = JWT_SECRET):
        self.secret = secret
        # Active sessions: { session_id: dict }
        self._active_sessions: Dict[str, Dict[str, Any]] = {}

    def issue_token(
        self,
        employee_id: str,
        ticket_id: str,
        target_environment: str = "prod-aws-tcs-client",
        role_requested: str = "Temporary-Helpdesk-Admin",
        duration_minutes: int = 15
    ) -> Dict[str, Any]:
        session_id = f"JIT-{uuid.uuid4().hex[:8].upper()}"
        now_dt = datetime.now(timezone.utc)
        expires_dt = now_dt + timedelta(minutes=duration_minutes)

        payload = {
            "sub": employee_id,
            "session_id": session_id,
            "ticket_id": ticket_id,
            "environment": target_environment,
            "role": role_requested,
            "permissions": ["read:cloudwatch_logs", "restart:ecs_service", "view:ticket_context"],
            "iat": int(now_dt.timestamp()),
            "exp": int(expires_dt.timestamp()),
            "iss": "ZeroTrust-AccessGuard-SOC"
        }

        token = jwt.encode(payload, self.secret, algorithm=ALGORITHM)
        token_fingerprint = hashlib.sha256(token.encode()).hexdigest()[:16]

        session_record = {
            "session_id": session_id,
            "ticket_id": ticket_id,
            "employee_id": employee_id,
            "target_environment": target_environment,
            "role_requested": role_requested,
            "permissions": payload["permissions"],
            "token": token,
            "token_fingerprint": token_fingerprint,
            "issued_at": now_dt.isoformat(),
            "expires_at": expires_dt.isoformat(),
            "expires_timestamp": expires_dt.timestamp(),
            "is_revoked": False
        }

        self._active_sessions[session_id] = session_record
        return session_record

    def revoke_session(self, session_id: str, reason: str = "Manual SOC Admin Revocation") -> Optional[Dict[str, Any]]:
        session = self._active_sessions.get(session_id)
        if session:
            session["is_revoked"] = True
            session["revoked_at"] = datetime.now(timezone.utc).isoformat()
            session["revocation_reason"] = reason
            return session
        return None

    def get_sessions(self) -> List[Dict[str, Any]]:
        now = time.time()
        result = []
        for sid, sess in list(self._active_sessions.items()):
            remaining = max(0, int(sess["expires_timestamp"] - now))
            is_active = remaining > 0 and not sess.get("is_revoked", False)
            sess_copy = dict(sess)
            sess_copy["ttl_seconds"] = remaining
            sess_copy["is_active"] = is_active
            result.append(sess_copy)
        
        # Sort newest first
        result.sort(key=lambda s: s["issued_at"], reverse=True)
        return result

    def verify_token(self, token: str) -> Dict[str, Any]:
        try:
            payload = jwt.decode(token, self.secret, algorithms=[ALGORITHM])
            session_id = payload.get("session_id")
            session = self._active_sessions.get(session_id)
            if not session:
                return {"valid": False, "reason": "Session not registered or expired"}
            if session.get("is_revoked"):
                return {
                    "valid": False,
                    "reason": f"Access Denied: Session {session_id} was explicitly terminated by SOC Emergency Kill-Switch ({session.get('revocation_reason', 'Revoked')})"
                }
            return {"valid": True, "payload": payload, "session": session}
        except jwt.ExpiredSignatureError:
            return {"valid": False, "reason": "Access Denied: 15-Minute JIT token has expired."}
        except jwt.PyJWTError as e:
            return {"valid": False, "reason": f"Invalid Cryptographic Signature: {str(e)}"}

    def simulate_resource_access(self, token: str, resource: str = "prod-aws-tcs-client/ecs/restart") -> Dict[str, Any]:
        verification = self.verify_token(token)
        now_iso = datetime.now(timezone.utc).isoformat()

        if not verification["valid"]:
            return {
                "status_code": 403,
                "access": "DENIED",
                "error": verification["reason"],
                "resource": resource,
                "timestamp": now_iso
            }

        payload = verification["payload"]
        return {
            "status_code": 200,
            "access": "GRANTED",
            "message": f"Zero-Trust Policy Verified: Authorized temporary session for ticket {payload.get('ticket_id')}",
            "resource": resource,
            "environment": payload.get("environment"),
            "authorized_role": payload.get("role"),
            "claims": payload,
            "timestamp": now_iso
        }

jit_vault = JITVault()
