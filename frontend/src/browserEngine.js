// In-Browser High-Performance Zero-Trust Engine
// Enables 100% standalone execution on GitHub Pages using Web Crypto API

export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const INITIAL_EMPLOYEES = [
  {
    id: "emp-4092",
    name: "David Miller",
    role: "Senior Financial Analyst",
    department: "Corporate Finance & Treasury",
    privilege_tier: "Tier 2 (Elevated SAP & Banking Access)",
    mfa_device: "Okta Verify Hardware FIDO2 + iOS",
    phone: "+1 (312) 555-0149 (Chicago Branch)",
    is_locked: false,
    threat_status: "NORMAL (0/3 pushes)"
  },
  {
    id: "emp-1088",
    name: "Sarah Jenkins",
    role: "Vice President & CFO",
    department: "Executive Leadership",
    privilege_tier: "Tier 1 (C-Suite Wire & Financial Approver)",
    mfa_device: "YubiKey 5C NFC + Duo Mobile",
    phone: "+1 (212) 555-0811 (New York HQ)",
    is_locked: false,
    threat_status: "NORMAL (0/3 pushes)"
  },
  {
    id: "emp-7721",
    name: "Rajesh Kumar",
    role: "Lead Cloud DevOps Architect",
    department: "Infrastructure & Cloud Platform",
    privilege_tier: "Tier 0 (Root AWS/K8s Multi-Account Admin)",
    mfa_device: "Hardware Token + Okta Verify",
    phone: "+91 (80) 4122-7721 (Bengaluru Center)",
    is_locked: false,
    threat_status: "NORMAL (0/3 pushes)"
  },
  {
    id: "emp-3309",
    name: "Elena Rostova",
    role: "HR Director & People Operations",
    department: "Human Resources & Payroll",
    privilege_tier: "Tier 2 (Workday HRIS Master Record)",
    mfa_device: "Microsoft Authenticator (Android)",
    phone: "+44 (20) 7946-3309 (London Office)",
    is_locked: false,
    threat_status: "NORMAL (0/3 pushes)"
  }
];

class BrowserAuditLedger {
  constructor() {
    this.chain = [];
    this._tamperedBackup = null;
    this._initialized = false;
  }

  async init() {
    if (this._initialized && this.chain.length > 0) return;
    const genesisTs = new Date().toISOString();
    const genesisPrev = "0".repeat(64);
    const genesisActor = "ROOT_SECURITY_KERNEL";
    const genesisAction = "SYSTEM_INITIALIZED";
    const genesisDetails = "Zero-Trust SHA-256 Immutable Audit Ledger Initialized (Web Crypto API)";
    const genesisRisk = 0;

    const payload = `${genesisPrev}|${genesisTs}|${genesisActor}|${genesisAction}|${genesisRisk}|${genesisDetails}`;
    const genesisHash = await sha256(payload);

    this.chain = [
      {
        id: 1,
        timestamp: genesisTs,
        actor: genesisActor,
        action: genesisAction,
        details: genesisDetails,
        risk_score: genesisRisk,
        prev_hash: genesisPrev,
        current_hash: genesisHash
      }
    ];
    this._initialized = true;
  }

  async logEvent(actor, action, details, riskScore = 0) {
    await this.init();
    const lastBlock = this.chain[this.chain.length - 1];
    const prevHash = lastBlock ? lastBlock.current_hash : "0".repeat(64);
    const timestamp = new Date().toISOString();
    const payload = `${prevHash}|${timestamp}|${actor}|${action}|${riskScore}|${details}`;
    const currentHash = await sha256(payload);

    const entry = {
      id: this.chain.length + 1,
      timestamp,
      actor,
      action,
      details,
      risk_score: riskScore,
      prev_hash: prevHash,
      current_hash: currentHash
    };

    this.chain.push(entry);
    return entry;
  }

  getLedger(limit = 50) {
    return [...this.chain].reverse().slice(0, limit);
  }

  async verifyChainIntegrity() {
    await this.init();
    if (this.chain.length === 0) {
      return { is_valid: true, total_records: 0, message: "Audit chain is empty" };
    }

    let expectedPrevHash = "0".repeat(64);

    for (const row of this.chain) {
      if (row.id === 1) {
        if (row.prev_hash !== expectedPrevHash) {
          return {
            is_valid: false,
            total_records: this.chain.length,
            tampered_record_id: row.id,
            message: `Genesis block parent pointer altered at record #${row.id}`
          };
        }
      } else {
        if (row.prev_hash !== expectedPrevHash) {
          return {
            is_valid: false,
            total_records: this.chain.length,
            tampered_record_id: row.id,
            message: `Broken chain pointer detected at record #${row.id}. Expected prev_hash ${expectedPrevHash.slice(0, 10)}..., got ${row.prev_hash.slice(0, 10)}...`
          };
        }
      }

      const payload = `${row.prev_hash}|${row.timestamp}|${row.actor}|${row.action}|${row.risk_score}|${row.details}`;
      const recomputedHash = await sha256(payload);

      if (recomputedHash !== row.current_hash) {
        return {
          is_valid: false,
          total_records: this.chain.length,
          tampered_record_id: row.id,
          message: `Cryptographic integrity violation: Record #${row.id} content modified by rogue entity without matching hash!`
        };
      }

      expectedPrevHash = row.current_hash;
    }

    return {
      is_valid: true,
      total_records: this.chain.length,
      message: `All ${this.chain.length} cryptographically chained records verified successfully. Zero tampering detected.`,
      computed_chain_head: expectedPrevHash
    };
  }

  simulateTamper() {
    if (this.chain.length <= 1) return { status: "ERROR", message: "Need at least 2 records to tamper." };
    const target = this.chain[this.chain.length - 1];
    this._tamperedBackup = { ...target };

    // Maliciously modify SQL/memory row without updating hash
    target.action = "MALICIOUS_LOG_ALTERATION [INSIDER_FRAUD]";
    target.details = "Rogue DB Admin wiped attack evidence: Modified action & reduced risk score to 0";
    target.risk_score = 0;

    return {
      status: "TAMPERED",
      tampered_record_id: target.id,
      message: `Insider attack simulated on Record #${target.id}. Data changed without hash update.`
    };
  }

  restoreLedger() {
    if (!this._tamperedBackup) return { status: "NOOP", message: "No active tamper simulation detected." };
    const idx = this.chain.findIndex(r => r.id === this._tamperedBackup.id);
    if (idx !== -1) {
      this.chain[idx] = { ...this._tamperedBackup };
    }
    const restoredId = this._tamperedBackup.id;
    this._tamperedBackup = null;
    return {
      status: "RESTORED",
      restored_record_id: restoredId,
      message: `Record #${restoredId} restored to pristine cryptographic state.`
    };
  }

  async generateComplianceCertificate() {
    const integrity = await this.verifyChainIntegrity();
    const nowIso = new Date().toISOString();
    const genesisHash = this.chain[0]?.current_hash || "0".repeat(64);
    const chainHead = this.chain[this.chain.length - 1]?.current_hash || "0".repeat(64);
    const certId = `CERT-SOC2-${(await sha256(chainHead + nowIso)).slice(0, 12).toUpperCase()}`;

    return {
      certificate_id: certId,
      standard: "SOC 2 Type II / ISO/IEC 27001:2022 Security Control A.12.4 (Cryptographic Logging)",
      issued_at: nowIso,
      attestation_status: integrity.is_valid ? "CERTIFIED_SECURE" : "INTEGRITY_BREACH_DETECTED",
      is_valid: integrity.is_valid,
      total_blocks_audited: integrity.total_records,
      genesis_block_hash: genesisHash,
      chain_head_hash: chainHead,
      cryptographic_algorithm: "SHA-256 Chained Hash Sequence (Web Crypto API)",
      storage_path: "In-Browser Web Crypto / IndexedDB Engine",
      auditor_note: integrity.message,
      digital_seal: await sha256(`SOC2_SEAL|${certId}|${chainHead}|${integrity.is_valid}`)
    };
  }
}

class BrowserMFAGuard {
  constructor() {
    this.pushes = {}; // { empId: [ts1, ts2] }
    this.locks = {};  // { empId: { locked: true, locked_at: ts } }
  }

  recordPush(employeeId, threshold = 3, windowSeconds = 60) {
    const now = Date.now() / 1000;
    if (this.isLocked(employeeId)) {
      return { count: threshold, isLocked: true, alert: `CRITICAL: Account ${employeeId} is LOCKED due to active MFA-Fatigue defense.` };
    }

    if (!this.pushes[employeeId]) this.pushes[employeeId] = [];
    const cutoff = now - windowSeconds;
    this.pushes[employeeId] = this.pushes[employeeId].filter(t => t > cutoff);
    this.pushes[employeeId].push(now);

    const count = this.pushes[employeeId].length;
    if (count >= threshold) {
      this.locks[employeeId] = { locked: true, lockedAt: now };
      return {
        count,
        isLocked: true,
        alert: `MFA-FATIGUE ATTACK BLOCKED: ${count} rapid MFA pushes in <${windowSeconds}s against ${employeeId}. Account locked automatically!`
      };
    }

    return { count, isLocked: false, alert: null };
  }

  isLocked(employeeId) {
    const lock = this.locks[employeeId];
    if (lock && lock.locked) {
      // 5 min auto-expire
      if ((Date.now() / 1000) - lock.lockedAt > 300) {
        delete this.locks[employeeId];
        return false;
      }
      return true;
    }
    return false;
  }

  unlock(employeeId) {
    delete this.locks[employeeId];
    delete this.pushes[employeeId];
    return true;
  }

  getStatus(employeeId) {
    const now = Date.now() / 1000;
    const pushes = (this.pushes[employeeId] || []).filter(t => t > now - 60);
    return {
      employee_id: employeeId,
      push_count_60s: pushes.length,
      is_locked: this.isLocked(employeeId),
      storage: "In-Browser Sliding Window"
    };
  }
}

class BrowserAIAnalyzer {
  analyze(transcript, callerName = "Unknown", employeeTarget = "emp-4092", ticketId = "INC-88910") {
    const text = transcript.toLowerCase();
    const tactics = [];
    let score = 10;

    // Rule 1: Urgency
    const urgencyKeywords = ["urgent", "immediately", "right now", "emergency", "asap", "boss will fire", "c-suite", "deadline"];
    const foundUrgency = urgencyKeywords.filter(w => text.includes(w));
    if (foundUrgency.length > 0) {
      score += 25;
      tactics.push(`Manufactured Urgency & Pressure (${foundUrgency.slice(0, 2).join(', ')})`);
    }

    // Rule 2: Credential Resets
    const credKeywords = ["password reset", "reset my password", "temp password", "temporary credentials", "locked out of okta", "locked out"];
    const foundCred = credKeywords.filter(w => text.includes(w));
    if (foundCred.length > 0) {
      score += 30;
      tactics.push("Direct Credential / SSO Reset Request");
    }

    // Rule 3: MFA Bypass
    const mfaKeywords = ["mfa", "2fa", "okta", "authenticator", "push", "bypass", "broke my phone", "new number", "lost my device"];
    const foundMfa = mfaKeywords.filter(w => text.includes(w));
    if (foundMfa.length > 0) {
      score += 35;
      tactics.push(`MFA Bypass / Push Coercion Attempt (${foundMfa.slice(0, 2).join(', ')})`);
    }

    // Rule 4: Authority
    const authKeywords = ["vp", "ceo", "cfo", "director", "executive", "board meeting", "outside contractor"];
    const foundAuth = authKeywords.filter(w => text.includes(w));
    if (foundAuth.length > 0) {
      score += 20;
      tactics.push(`High-Authority Impersonation (${foundAuth.slice(0, 2).join(', ')})`);
    }

    // Rule 5: Verification Evasion
    const avoidKeywords = ["don't call", "do not call", "can't join", "no camera", "flight"];
    const foundAvoid = avoidKeywords.filter(w => text.includes(w));
    if (foundAvoid.length > 0) {
      score += 25;
      tactics.push("Identity Verification Evasion / Bypass Request");
    }

    score = Math.min(100, score);
    const recommendation = score >= 40 ? "BLOCK" : "ALLOW";
    const reasoning = score >= 40
      ? `High-risk indicators detected (${tactics.length} tactics flagged). Potential outsourced helpdesk vishing or Scattered Spider social engineering attack. Action blocked under Zero-Trust policy.`
      : "Normal conversational cadence with no credential bypass or urgency anomalies. Helpdesk verification criteria satisfied.";

    // Acoustic Deepfake Scan Simulation
    let syntheticVoiceProb = 4;
    let carrierOrigin = "AT&T Corporate Encrypted LTE / VoWiFi";
    let spoofRisk = "MINIMAL / VERIFIED";
    let acousticAnomalies = ["Natural Vocal Formant Variability", "Authentic Ambient Background Reverberation"];

    if (score >= 70) {
      syntheticVoiceProb = 84 + (score % 15);
      spoofRisk = "CRITICAL / HIGH PROBABILITY";
      carrierOrigin = "Twilio / Bandwidth.com Virtual VoIP Gateway (Untrusted SIP Trunk)";
      acousticAnomalies = [
        "Robotic Pitch Quantization (Phase Vocoder Artifact)",
        "Synthesized Cadence Jitter (< 12ms latency fluctuation)",
        "Acoustic Room Reflection Void (Synthetic Studio Isolation)",
        "Caller ID Telco Geofence Discrepancy"
      ];
    } else if (score >= 40) {
      syntheticVoiceProb = 52;
      spoofRisk = "ELEVATED RISK";
      carrierOrigin = "Disposable MVNO / Prepaid Virtual Cellular";
      acousticAnomalies = ["Coached Speech Cadence Anomaly", "Caller ID Mismatch with Active Directory"];
    }

    return {
      caller_name: callerName,
      employee_target: employeeTarget,
      ticket_id: ticketId,
      transcript,
      risk_score: score,
      recommendation,
      tactics: tactics.length > 0 ? tactics : ["Standard Routine Helpdesk Inquiry", "No Coercive Indicators"],
      reasoning,
      is_gemini_powered: false,
      timestamp: new Date().toISOString(),
      synthetic_voice_probability: syntheticVoiceProb,
      caller_id_spoof_risk: spoofRisk,
      carrier_origin: carrierOrigin,
      acoustic_anomalies: acousticAnomalies
    };
  }
}

class BrowserJITVault {
  constructor() {
    this.sessions = [];
  }

  issueToken(employeeId, ticketId, targetEnv = "prod-aws-tcs-client", roleRequested = "Temporary-Helpdesk-Admin", durationMinutes = 15) {
    const sessionId = `JIT-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
    const now = Date.now();
    const expiresTimestamp = now + (durationMinutes * 60 * 1000);

    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
      sub: employeeId,
      session_id: sessionId,
      ticket_id: ticketId,
      environment: targetEnv,
      role: roleRequested,
      exp: Math.floor(expiresTimestamp / 1000)
    }))}.SIMULATED_HMAC_SIG_${Math.random().toString(16).slice(2, 10)}`;

    const session = {
      session_id: sessionId,
      ticket_id: ticketId,
      employee_id: employeeId,
      target_environment: targetEnv,
      role_requested: roleRequested,
      token,
      token_fingerprint: sessionId,
      issued_at: new Date(now).toISOString(),
      expires_at: new Date(expiresTimestamp).toISOString(),
      expires_timestamp: expiresTimestamp / 1000,
      ttl_seconds: durationMinutes * 60,
      is_active: true,
      is_revoked: false
    };

    this.sessions.unshift(session);
    return session;
  }

  revoke(sessionId, reason = "SOC Emergency Kill-Switch Activated") {
    const sess = this.sessions.find(s => s.session_id === sessionId);
    if (sess) {
      sess.is_revoked = true;
      sess.is_active = false;
      sess.revocation_reason = reason;
      return sess;
    }
    return null;
  }

  getSessions() {
    const nowSec = Date.now() / 1000;
    return this.sessions.map(s => {
      const remaining = Math.max(0, Math.floor(s.expires_timestamp - nowSec));
      return {
        ...s,
        ttl_seconds: remaining,
        is_active: remaining > 0 && !s.is_revoked
      };
    });
  }

  simulateApiAccess(token, resource = "prod-aws-tcs-client/ecs/restart") {
    const sess = this.sessions.find(s => s.token === token);
    const nowIso = new Date().toISOString();

    if (!sess) {
      return {
        status_code: 403,
        access: "DENIED",
        error: "Access Denied: JIT Session not found or token invalid.",
        resource,
        timestamp: nowIso
      };
    }

    if (sess.is_revoked) {
      return {
        status_code: 403,
        access: "DENIED",
        error: `Access Denied: Session ${sess.session_id} was explicitly terminated by SOC Emergency Kill-Switch (${sess.revocation_reason})`,
        resource,
        timestamp: nowIso
      };
    }

    const nowSec = Date.now() / 1000;
    if (sess.expires_timestamp < nowSec) {
      return {
        status_code: 403,
        access: "DENIED",
        error: "Access Denied: 15-Minute JIT token has expired.",
        resource,
        timestamp: nowIso
      };
    }

    return {
      status_code: 200,
      access: "GRANTED",
      message: `Zero-Trust Policy Verified: Authorized temporary session for ticket ${sess.ticket_id} to restart ECS services.`,
      resource,
      environment: sess.target_environment,
      authorized_role: sess.role_requested,
      timestamp: nowIso
    };
  }
}

export const browserAuditLedger = new BrowserAuditLedger();
export const browserMFAGuard = new BrowserMFAGuard();
export const browserAIAnalyzer = new BrowserAIAnalyzer();
export const browserJITVault = new BrowserJITVault();
