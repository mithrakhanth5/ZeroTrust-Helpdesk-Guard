import sqlite3
import hashlib
import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DB_PATH = os.getenv("DATABASE_PATH", r"D:\ZeroTrust-Helpdesk-Guard\backend\data\zerotrust_audit.db")

class AuditLedger:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._tampered_backup: Optional[Dict[str, Any]] = None
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_chain (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT NOT NULL,
                    risk_score INTEGER NOT NULL,
                    prev_hash TEXT NOT NULL,
                    current_hash TEXT NOT NULL
                )
            """)
            conn.commit()

            # Initialize Genesis Block if table is empty
            cursor.execute("SELECT COUNT(*) FROM audit_chain")
            if cursor.fetchone()[0] == 0:
                genesis_ts = datetime.now(timezone.utc).isoformat()
                genesis_prev = "0" * 64
                genesis_action = "SYSTEM_INITIALIZED"
                genesis_actor = "ROOT_SECURITY_KERNEL"
                genesis_details = "Zero-Trust SHA-256 Immutable Audit Ledger Initialized on D: Drive"
                genesis_risk = 0
                
                payload = f"{genesis_prev}|{genesis_ts}|{genesis_actor}|{genesis_action}|{genesis_risk}|{genesis_details}"
                genesis_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

                cursor.execute("""
                    INSERT INTO audit_chain (timestamp, actor, action, details, risk_score, prev_hash, current_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (genesis_ts, genesis_actor, genesis_action, genesis_details, genesis_risk, genesis_prev, genesis_hash))
                conn.commit()

    def get_latest_hash(self) -> str:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT current_hash FROM audit_chain ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            if row:
                return row["current_hash"]
            return "0" * 64

    def log_event(self, actor: str, action: str, details: str, risk_score: int = 0) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT current_hash FROM audit_chain ORDER BY id DESC LIMIT 1")
            last_row = cursor.fetchone()
            prev_hash = last_row["current_hash"] if last_row else ("0" * 64)

            timestamp = datetime.now(timezone.utc).isoformat()
            payload = f"{prev_hash}|{timestamp}|{actor}|{action}|{risk_score}|{details}"
            current_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

            cursor.execute("""
                INSERT INTO audit_chain (timestamp, actor, action, details, risk_score, prev_hash, current_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (timestamp, actor, action, details, risk_score, prev_hash, current_hash))
            entry_id = cursor.lastrowid
            conn.commit()

            return {
                "id": entry_id,
                "timestamp": timestamp,
                "actor": actor,
                "action": action,
                "details": details,
                "risk_score": risk_score,
                "prev_hash": prev_hash,
                "current_hash": current_hash
            }

    def get_ledger(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_chain ORDER BY id DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def verify_chain_integrity(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_chain ORDER BY id ASC")
            rows = cursor.fetchall()

            if not rows:
                return {"is_valid": True, "total_records": 0, "message": "Audit chain is empty"}

            expected_prev_hash = "0" * 64

            for row in rows:
                row_id = row["id"]
                timestamp = row["timestamp"]
                actor = row["actor"]
                action = row["action"]
                details = row["details"]
                risk_score = row["risk_score"]
                prev_hash = row["prev_hash"]
                stored_hash = row["current_hash"]

                # 1. Check parent hash linkage
                if row_id == 1:
                    if prev_hash != expected_prev_hash:
                        return {
                            "is_valid": False,
                            "total_records": len(rows),
                            "tampered_record_id": row_id,
                            "message": f"Genesis block parent pointer altered at record #{row_id}"
                        }
                else:
                    if prev_hash != expected_prev_hash:
                        return {
                            "is_valid": False,
                            "total_records": len(rows),
                            "tampered_record_id": row_id,
                            "message": f"Broken chain pointer detected at record #{row_id}. Expected prev_hash {expected_prev_hash[:12]}..., got {prev_hash[:12]}..."
                        }

                # 2. Recompute current hash
                payload = f"{prev_hash}|{timestamp}|{actor}|{action}|{risk_score}|{details}"
                recomputed_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

                if recomputed_hash != stored_hash:
                    return {
                        "is_valid": False,
                        "total_records": len(rows),
                        "tampered_record_id": row_id,
                        "message": f"Cryptographic integrity violation: Record #{row_id} content modified by rogue entity without matching hash!"
                    }

                expected_prev_hash = stored_hash

            return {
                "is_valid": True,
                "total_records": len(rows),
                "message": f"All {len(rows)} cryptographically chained records verified successfully. Zero tampering detected.",
                "computed_chain_head": expected_prev_hash
            }

    def simulate_tampering(self, record_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Simulates insider fraud: A rogue database administrator alters a row
        directly in the SQLite DB (e.g., changes a critical attack record to 'NORMAL_ACTIVITY'
        and risk score from 100 to 0) WITHOUT updating the cryptographic SHA-256 hash.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if record_id is None:
                # Pick a non-genesis record if available
                cursor.execute("SELECT * FROM audit_chain WHERE id > 1 ORDER BY id DESC LIMIT 1")
                row = cursor.fetchone()
                if not row:
                    cursor.execute("SELECT * FROM audit_chain ORDER BY id DESC LIMIT 1")
                    row = cursor.fetchone()
            else:
                cursor.execute("SELECT * FROM audit_chain WHERE id = ?", (record_id,))
                row = cursor.fetchone()

            if not row:
                return {"status": "ERROR", "message": "No records available to tamper with."}

            target_id = row["id"]
            # Save original for restoration
            self._tampered_backup = dict(row)

            # Illegitimately mutate data in the database
            fraudulent_action = "MALICIOUS_LOG_ALTERATION [INSIDER_FRAUD]"
            fraudulent_details = "Rogue DB Admin wiped attack evidence: Modified action & reduced risk score to 0"
            fraudulent_risk = 0

            cursor.execute("""
                UPDATE audit_chain
                SET action = ?, details = ?, risk_score = ?
                WHERE id = ?
            """, (fraudulent_action, fraudulent_details, fraudulent_risk, target_id))
            conn.commit()

            return {
                "status": "TAMPERED",
                "tampered_record_id": target_id,
                "message": f"Insider attack simulated on Record #{target_id}. Data changed in SQL without hash update.",
                "original": self._tampered_backup
            }

    def restore_ledger(self) -> Dict[str, Any]:
        """
        Restores the ledger to its legitimate untampered state using the saved backup.
        """
        if not self._tampered_backup:
            return {"status": "NOOP", "message": "No active tamper simulation detected to restore."}

        with self._get_connection() as conn:
            cursor = conn.cursor()
            b = self._tampered_backup
            cursor.execute("""
                UPDATE audit_chain
                SET action = ?, details = ?, risk_score = ?, prev_hash = ?, current_hash = ?
                WHERE id = ?
            """, (b["action"], b["details"], b["risk_score"], b["prev_hash"], b["current_hash"], b["id"]))
            conn.commit()
            restored_id = b["id"]
            self._tampered_backup = None

            return {
                "status": "RESTORED",
                "restored_record_id": restored_id,
                "message": f"Record #{restored_id} restored to pristine cryptographic state."
            }

    def generate_compliance_certificate(self) -> Dict[str, Any]:
        """
        Produces an exportable SOC 2 Type II & ISO 27001 Cryptographic Assurance Certificate.
        """
        integrity = self.verify_chain_integrity()
        now_iso = datetime.now(timezone.utc).isoformat()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT current_hash FROM audit_chain WHERE id = 1")
            genesis_row = cursor.fetchone()
            genesis_hash = genesis_row["current_hash"] if genesis_row else "0" * 64

            cursor.execute("SELECT current_hash FROM audit_chain ORDER BY id DESC LIMIT 1")
            latest_row = cursor.fetchone()
            chain_head = latest_row["current_hash"] if latest_row else "0" * 64

        cert_id = f"CERT-SOC2-{hashlib.sha256(f'{chain_head}{now_iso}'.encode()).hexdigest()[:12].upper()}"

        return {
            "certificate_id": cert_id,
            "standard": "SOC 2 Type II / ISO/IEC 27001:2022 Security Control A.12.4 (Cryptographic Logging)",
            "issued_at": now_iso,
            "attestation_status": "CERTIFIED_SECURE" if integrity["is_valid"] else "INTEGRITY_BREACH_DETECTED",
            "is_valid": integrity["is_valid"],
            "total_blocks_audited": integrity["total_records"],
            "genesis_block_hash": genesis_hash,
            "chain_head_hash": chain_head,
            "cryptographic_algorithm": "SHA-256 Chained Hash Sequence",
            "storage_path": self.db_path,
            "auditor_note": integrity["message"],
            "digital_seal": hashlib.sha256(f"SOC2_SEAL|{cert_id}|{chain_head}|{integrity['is_valid']}".encode()).hexdigest()
        }

audit_ledger = AuditLedger()
