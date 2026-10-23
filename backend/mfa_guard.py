import time
import os
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

try:
    import redis
except ImportError:
    redis = None

class MFAGuard:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "")
        self.redis_client = None
        self._init_redis()
        
        # In-memory sliding-window fallback:
        # { employee_id: [timestamp1, timestamp2, ...] }
        self._memory_pushes: Dict[str, List[float]] = {}
        # { employee_id: { "locked": True, "locked_at": timestamp, "reason": str } }
        self._memory_locks: Dict[str, Dict[str, any]] = {}

    def _init_redis(self):
        if self.redis_url and redis:
            try:
                client = redis.from_url(self.redis_url, socket_timeout=2)
                client.ping()
                self.redis_client = client
                print(f"[MFAGuard] Successfully connected to Redis at {self.redis_url}")
            except Exception as e:
                print(f"[MFAGuard] Redis connection failed ({e}). Defaulting to high-performance in-memory sliding window.")
                self.redis_client = None
        else:
            self.redis_client = None

    def record_push_request(self, employee_id: str, threshold: int = 3, window_seconds: int = 60) -> Tuple[int, bool, Optional[str]]:
        """
        Records an MFA push request. Returns (current_count_in_window, is_locked, alert_message)
        """
        now = time.time()

        # Check if already locked
        if self.is_locked(employee_id):
            return threshold, True, f"CRITICAL: Account {employee_id} is LOCKED due to active MFA-Fatigue defense."

        if self.redis_client:
            try:
                pipe = self.redis_client.pipeline()
                key = f"mfa:push:{employee_id}"
                lock_key = f"mfa:lock:{employee_id}"

                # Add current timestamp to sorted set
                pipe.zadd(key, {str(now): now})
                # Remove timestamps older than window
                pipe.zremrangebyscore(key, 0, now - window_seconds)
                # Count elements in window
                pipe.zcard(key)
                pipe.expire(key, window_seconds * 2)
                results = pipe.execute()

                count = results[2]
                if count >= threshold:
                    self.redis_client.setex(lock_key, 300, json.dumps({
                        "locked_at": now,
                        "count": count,
                        "reason": f"{count} rapid MFA pushes detected within {window_seconds}s"
                    }))
                    return count, True, f"MFA-FATIGUE ATTACK BLOCKED: {count} pushes in <{window_seconds}s against {employee_id}. Account locked automatically!"
                return count, False, None
            except Exception as e:
                print(f"[MFAGuard] Redis error, using memory fallback: {e}")

        # In-Memory fallback implementation
        if employee_id not in self._memory_pushes:
            self._memory_pushes[employee_id] = []

        # Clean old timestamps
        cutoff = now - window_seconds
        self._memory_pushes[employee_id] = [t for t in self._memory_pushes[employee_id] if t > cutoff]
        self._memory_pushes[employee_id].append(now)

        count = len(self._memory_pushes[employee_id])
        if count >= threshold:
            self._memory_locks[employee_id] = {
                "locked": True,
                "locked_at": now,
                "count": count,
                "reason": f"{count} rapid MFA pushes detected in {window_seconds}s window."
            }
            alert_msg = f"MFA-FATIGUE ATTACK BLOCKED: {count} rapid MFA pushes in <{window_seconds}s against {employee_id}. Account locked automatically!"
            return count, True, alert_msg

        return count, False, None

    def is_locked(self, employee_id: str) -> bool:
        if self.redis_client:
            try:
                lock_key = f"mfa:lock:{employee_id}"
                return self.redis_client.exists(lock_key) > 0
            except Exception:
                pass

        lock_info = self._memory_locks.get(employee_id)
        if lock_info and lock_info.get("locked"):
            # Auto-expire lock after 5 minutes if not manually cleared
            if time.time() - lock_info.get("locked_at", 0) > 300:
                del self._memory_locks[employee_id]
                return False
            return True
        return False

    def unlock_account(self, employee_id: str) -> bool:
        if self.redis_client:
            try:
                self.redis_client.delete(f"mfa:lock:{employee_id}")
                self.redis_client.delete(f"mfa:push:{employee_id}")
            except Exception:
                pass

        if employee_id in self._memory_locks:
            del self._memory_locks[employee_id]
        if employee_id in self._memory_pushes:
            del self._memory_pushes[employee_id]
        return True

    def get_status(self, employee_id: str) -> Dict[str, any]:
        now = time.time()
        locked = self.is_locked(employee_id)
        
        # Count pushes in last 60s
        if self.redis_client:
            try:
                key = f"mfa:push:{employee_id}"
                count = self.redis_client.zcount(key, now - 60, "+inf")
                return {
                    "employee_id": employee_id,
                    "push_count_60s": count,
                    "is_locked": locked,
                    "storage": "Redis"
                }
            except Exception:
                pass

        pushes = self._memory_pushes.get(employee_id, [])
        valid_pushes = [t for t in pushes if t > now - 60]
        return {
            "employee_id": employee_id,
            "push_count_60s": len(valid_pushes),
            "is_locked": locked,
            "storage": "In-Memory Sliding Window"
        }

mfa_guard = MFAGuard()
