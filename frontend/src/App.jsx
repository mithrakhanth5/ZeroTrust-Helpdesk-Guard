import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, Key, Lock, Unlock,
  PhoneCall, Mic, MicOff, AlertTriangle, CheckCircle,
  RefreshCw, Terminal, Activity, Zap, Database, Server,
  Clock, Hash, FileText, ChevronRight, UserCheck, UserX,
  Volume2, Cpu, Globe, ArrowUpRight, Radio, Award, Download,
  Bug, RotateCcw, Users, Layers, ExternalLink, X, Search,
  Check, ArrowRight
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:8000/ws';

export default function App() {
  // Global & System state
  const [wsConnected, setWsConnected] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);

  // Employee Directory state
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Panel 1: Call & Vishing Analyzer
  const [callerName, setCallerName] = useState('David Miller (Finance)');
  const [employeeTarget, setEmployeeTarget] = useState('emp-4092');
  const [ticketId, setTicketId] = useState('INC-88910');
  const [transcript, setTranscript] = useState(
    "Hi Helpdesk, this is David Miller. I broke my phone while traveling in Chicago and I'm locked out of Okta. I have a critical VP meeting in 10 minutes. Please reset my MFA immediately and register my personal number."
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Panel 2: MFA-Fatigue Shield
  const [mfaEmployee, setMfaEmployee] = useState('emp-4092');
  const [mfaStatus, setMfaStatus] = useState({ push_count_60s: 0, is_locked: false, storage: 'Sliding Window' });
  const [mfaLoading, setMfaLoading] = useState(false);

  // Panel 3: JIT Vault & API Simulation
  const [targetEnv, setTargetEnv] = useState('prod-aws-tcs-client');
  const [roleRequested, setRoleRequested] = useState('Temporary-Helpdesk-Admin');
  const [jitSessions, setJitSessions] = useState([]);
  const [jitIssuing, setJitIssuing] = useState(false);
  const [jitError, setJitError] = useState(null);
  const [selectedSessionForTest, setSelectedSessionForTest] = useState(null);
  const [apiSimulationResult, setApiSimulationResult] = useState(null);
  const [isSimulatingApi, setIsSimulatingApi] = useState(false);

  // Panel 4: Tamper-Proof Audit Chain & Tamper Lab
  const [auditLogs, setAuditLogs] = useState([]);
  const [chainVerification, setChainVerification] = useState(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [tamperSimulated, setTamperSimulated] = useState(null);
  const [complianceCert, setComplianceCert] = useState(null);
  const [showCertModal, setShowCertModal] = useState(false);

  // WebSocket & Initial Fetch
  useEffect(() => {
    fetchHealth();
    fetchEmployees();
    fetchMfaStatus(mfaEmployee);
    fetchJitSessions();
    fetchAuditLogs();

    let ws;
    const connectWs = () => {
      ws = new WebSocket(WS_BASE);
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          handleWebSocketMessage(payload);
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 3000);
      };
      ws.onerror = () => setWsConnected(false);
    };

    connectWs();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Timer loop for JIT countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setJitSessions(prev =>
        prev.map(s => {
          if (!s.is_active || s.ttl_seconds <= 0) return s;
          const nextTtl = Math.max(0, s.ttl_seconds - 1);
          return {
            ...s,
            ttl_seconds: nextTtl,
            is_active: nextTtl > 0 && !s.is_revoked
          };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleWebSocketMessage = (msg) => {
    if (msg.type === 'MFA_STATUS_UPDATE') {
      setMfaStatus(prev => ({
        ...prev,
        push_count_60s: msg.data.push_count_60s,
        is_locked: msg.data.is_locked
      }));
      if (msg.data.is_locked) {
        triggerGlobalAlert(`CRITICAL: MFA-Fatigue Attack Blocked against ${msg.data.employee_id}! Account locked.`);
      }
      fetchEmployees();
      fetchAuditLogs();
    } else if (msg.type === 'CALL_ANALYZED' || msg.type === 'VOICE_CALL_ANALYZED') {
      fetchAuditLogs();
      if (msg.data.risk_score >= 40) {
        triggerGlobalAlert(`SECURITY WARNING: High-Risk Call Blocked (Score: ${msg.data.risk_score}/100)`);
      }
    } else if (msg.type === 'JIT_SESSION_CREATED' || msg.type === 'JIT_SESSION_REVOKED') {
      fetchJitSessions();
      fetchAuditLogs();
    } else if (msg.type === 'MFA_ACCOUNT_UNLOCKED') {
      setMfaStatus(prev => ({ ...prev, is_locked: false, push_count_60s: 0 }));
      fetchEmployees();
      fetchAuditLogs();
    } else if (msg.type === 'TAMPER_SIMULATED' || msg.type === 'CHAIN_RESTORED') {
      fetchAuditLogs();
    }
  };

  const triggerGlobalAlert = (text) => {
    setActiveAlert(text);
    setTimeout(() => setActiveAlert(null), 8000);
  };

  // REST API Handlers
  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) setSystemHealth(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/employees`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
        if (!selectedEmployee && data.length > 0) {
          setSelectedEmployee(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMfaStatus = async (empId = mfaEmployee) => {
    try {
      const res = await fetch(`${API_BASE}/api/mfa-status/${empId}`);
      if (res.ok) setMfaStatus(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchJitSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/jit/sessions`);
      if (res.ok) {
        const data = await res.json();
        setJitSessions(data);
        if (data.length > 0 && !selectedSessionForTest) {
          setSelectedSessionForTest(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit/logs?limit=50`);
      if (res.ok) setAuditLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  // Employee Selection Handler
  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setMfaEmployee(emp.id);
    setEmployeeTarget(emp.id);
    setCallerName(`${emp.name} (${emp.department.split('&')[0].trim()})`);
    fetchMfaStatus(emp.id);
  };

  // 1. Call Analysis Actions
  const handleAnalyzeText = async () => {
    if (!transcript.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/api/analyze-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_name: callerName,
          employee_target: employeeTarget,
          ticket_id: ticketId,
          transcript: transcript
        })
      });
      const data = await res.json();
      setAnalysisResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Audio Recording with MediaRecorder API
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      alert("Microphone access denied or unavailable. Please use the preset scenario buttons below!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (blob) => {
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('file', blob, 'call_recording.webm');
    formData.append('caller_name', callerName);
    formData.append('employee_target', employeeTarget);
    formData.append('ticket_id', ticketId);

    try {
      const res = await fetch(`${API_BASE}/api/transcribe-and-analyze`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setAnalysisResult(data);
      setTranscript(data.transcript);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Attack Presets
  const loadPreset = (type) => {
    if (type === 'normal') {
      const emp = employees.find(e => e.id === 'emp-4092') || { id: 'emp-4092', name: 'David Miller', department: 'Finance' };
      handleSelectEmployee(emp);
      setTicketId('INC-10245');
      setTranscript("Hi Helpdesk, this is David Miller. I'm having trouble opening our quarterly budget Excel file on SharePoint after this morning's update. Could you please refresh my document cache when you get a chance? No rush at all.");
    } else if (type === 'scattered_spider') {
      const emp = employees.find(e => e.id === 'emp-4092') || { id: 'emp-4092', name: 'David Miller', department: 'Finance' };
      handleSelectEmployee(emp);
      setCallerName('David Miller (Claimed)');
      setTicketId('INC-88910');
      setTranscript("Hey Helpdesk! This is David Miller. I'm stuck at O'Hare airport and my phone fell and shattered. I'm completely locked out of Okta SSO and have an urgent client deck due in 10 minutes. I need you to bypass standard MFA, register this new temporary number immediately, and generate a temporary admin token. Do NOT call my supervisor, she is on a transatlantic flight!");
    } else if (type === 'cfo_urgency') {
      const emp = employees.find(e => e.id === 'emp-1088') || { id: 'emp-1088', name: 'Sarah Jenkins', department: 'Executive' };
      handleSelectEmployee(emp);
      setCallerName('Sarah Jenkins (CFO)');
      setTicketId('INC-99100');
      setTranscript("This is CFO Sarah Jenkins. I am on an emergency acquisition closing call with outside legal counsel. The wire authentication token is failing. I need you to bypass the change approval process and grant temporary AWS production access to contractor handle 'ops-thirdparty-ext' within 5 minutes or this deal will collapse!");
    } else if (type === 'devops_root') {
      const emp = employees.find(e => e.id === 'emp-7721') || { id: 'emp-7721', name: 'Rajesh Kumar', department: 'Cloud Infra' };
      handleSelectEmployee(emp);
      setCallerName('Rajesh Kumar (DevOps Lead)');
      setTicketId('INC-77002');
      setTranscript("Hi, Rajesh here. Our Kubernetes cluster in us-east-1 is experiencing a rolling pod crash. I am offsite with limited connectivity. Send an immediate MFA push bypass approval to my alternate backup device right now so I can restart the control plane.");
    }
  };

  // 2. MFA Push Actions
  const handleTriggerMfaPush = async () => {
    setMfaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/mfa-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: mfaEmployee,
          device_name: selectedEmployee?.mfa_device || 'Okta Verify',
          ip_address: '198.51.100.42',
          source: 'Simulated Rapid Push Spam'
        })
      });
      const data = await res.json();
      setMfaStatus(data);
      fetchEmployees();
    } catch (e) {
      console.error(e);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleUnlockMfa = async () => {
    try {
      await fetch(`${API_BASE}/api/mfa-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: mfaEmployee })
      });
      setMfaStatus(prev => ({ ...prev, is_locked: false, push_count_60s: 0 }));
      fetchEmployees();
    } catch (e) {
      console.error(e);
    }
  };

  // 3. JIT Vault Actions
  const handleIssueJit = async () => {
    setJitIssuing(true);
    setJitError(null);
    try {
      const currentRisk = analysisResult ? analysisResult.risk_score : 15;
      const res = await fetch(`${API_BASE}/api/jit/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeTarget,
          ticket_id: ticketId,
          target_environment: targetEnv,
          role_requested: roleRequested,
          risk_score: currentRisk,
          duration_minutes: 15
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Access Denied by Zero-Trust Policy');
      }
      const newSession = await res.json();
      setSelectedSessionForTest(newSession);
      fetchJitSessions();
    } catch (e) {
      setJitError(e.message);
    } finally {
      setJitIssuing(false);
    }
  };

  const handleRevokeJit = async (sessionId) => {
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('reason', 'SOC Emergency Kill-Switch Activated');
      await fetch(`${API_BASE}/api/jit/revoke`, {
        method: 'POST',
        body: formData
      });
      fetchJitSessions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateApiAccess = async () => {
    if (!selectedSessionForTest?.token) return;
    setIsSimulatingApi(true);
    try {
      const res = await fetch(`${API_BASE}/api/jit/simulate-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: selectedSessionForTest.token,
          resource: `${targetEnv}/ecs/restart`
        })
      });
      const data = await res.json();
      setApiSimulationResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulatingApi(false);
    }
  };

  // 4. Audit Chain Actions & Tamper Lab
  const handleVerifyChain = async () => {
    setIsVerifyingChain(true);
    try {
      const res = await fetch(`${API_BASE}/api/audit/verify`, { method: 'POST' });
      const data = await res.json();
      setChainVerification(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifyingChain(false);
    }
  };

  const handleSimulateTamper = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit/tamper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setTamperSimulated(data);
      handleVerifyChain();
      fetchAuditLogs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreLedger = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit/restore`, { method: 'POST' });
      const data = await res.json();
      setTamperSimulated(null);
      handleVerifyChain();
      fetchAuditLogs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFetchComplianceCert = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit/compliance-certificate`);
      if (res.ok) {
        const data = await res.json();
        setComplianceCert(data);
        setShowCertModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filtered employees
  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    e.department.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    e.id.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col selection:bg-[#E11D48] selection:text-white">
      {/* ================= 1. COMPACT TOP HEADER BAR (h-16) ================= */}
      <header className="h-16 bg-gradient-to-r from-[#DC2626] to-[#E11D48] text-white px-4 md:px-6 flex items-center justify-between shadow-md shrink-0 z-20">
        <div className="flex items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold tracking-tight text-white leading-tight">
                Zero-Trust AI Helpdesk & Access Guard
              </h1>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full font-mono bg-white/15 text-white border border-white/30 font-semibold">
                Human-Risk SOC
              </span>
            </div>
            <p className="text-[11px] text-red-100 hidden md:block">
              Outsourced Vishing Shield • MFA-Fatigue Rate Limiting • 15m JIT Vault • SHA-256 Hash Chain
            </p>
          </div>
        </div>

        {/* 4-Step Workflow Progress Bar & Status Badges */}
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/20 text-[11px] font-medium text-white font-mono">
            <span className="text-white/90">1. Select Identity</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/60" />
            <span className="text-white/90">2. AI Call Check</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/60" />
            <span className="text-white/90">3. MFA Shield</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/60" />
            <span className="text-white font-bold underline decoration-white/60">4. JIT & Audit</span>
          </div>

          <button
            onClick={handleFetchComplianceCert}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#E11D48] font-bold text-xs hover:bg-red-50 shadow-sm transition"
          >
            <Award className="w-3.5 h-3.5 text-[#E11D48]" />
            <span className="hidden sm:inline">SOC 2 Type II</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/20 text-white text-xs border border-white/20 font-mono">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-300'}`} />
            <span className="hidden sm:inline">{wsConnected ? 'LIVE WS' : 'OFFLINE'}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/20 text-white text-xs border border-white/20 font-mono">
            <Database className="w-3.5 h-3.5 text-white" />
            <span>D:\ STRICT</span>
          </div>
        </div>
      </header>

      {/* Global Alert Notification */}
      {activeAlert && (
        <div className="bg-[#BE123C] text-white px-4 py-2.5 flex items-center justify-between text-xs md:text-sm font-semibold shadow-md animate-fade-in shrink-0 z-10">
          <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            <span>{activeAlert}</span>
          </div>
          <button onClick={() => setActiveAlert(null)} className="text-white/80 hover:text-white ml-2 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* ================= 2. MAIN APP SHELL (SIDEBAR + 2x2 BENTO GRID) ================= */}
      <div className="flex-1 flex flex-col md:flex-row p-4 md:p-5 gap-5 max-w-[1720px] w-full mx-auto">

        {/* LEFT SIDEBAR: Corporate Directory Identity Selector (w-72 shrink-0) */}
        <aside className="w-full md:w-72 shrink-0 bg-white border border-red-100 rounded-xl shadow-sm p-4 flex flex-col justify-between gap-3 h-fit md:min-h-[880px]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E11D48]" />
                <h2 className="font-bold text-sm text-slate-900">Corporate Directory</h2>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-[#E11D48] font-semibold border border-red-100">
                Identity Matrix
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search employee or role..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#E11D48] focus:bg-white"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              Select an identity to test helpdesk call vishing, MFA flooding, and scoped JIT issuance:
            </p>

            {/* Stacked Employee Cards */}
            <div className="space-y-2.5">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmployee?.id === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleSelectEmployee(emp)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-l-4 border-[#E11D48] bg-red-50/60 shadow-sm ring-1 ring-red-200'
                        : 'border-slate-200 hover:border-red-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${isSelected ? 'text-[#BE123C]' : 'text-slate-900'}`}>
                        {emp.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          emp.is_locked
                            ? 'bg-red-100 text-[#BE123C] border border-red-200 animate-pulse'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {emp.is_locked ? 'LOCKED' : 'ACTIVE'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-medium leading-tight">{emp.role}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">{emp.department}</div>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100/80 text-[10px] font-mono">
                      <span className="text-[#E11D48] font-semibold">{emp.id}</span>
                      <span className="text-slate-500 truncate max-w-[120px]">{emp.privilege_tier.split('(')[0]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Directory Summary Footnote */}
          <div className="mt-auto pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex flex-col gap-1 bg-slate-50 p-3 rounded-lg">
            <div className="flex justify-between">
              <span>Active MFA Engine:</span>
              <span className="font-semibold text-slate-700">{mfaStatus.storage || 'Sliding Window'}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Employee:</span>
              <span className="font-mono text-[#E11D48] font-bold">{selectedEmployee?.id || 'emp-4092'}</span>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA: 2x2 Bento Grid (Strict Equal Heights) */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ================= CARD 1: STEP 1 - LIVE CALL VISHING & DEEPFAKE ANALYZER ================= */}
          <div className="bg-white border border-red-100 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col justify-between h-[450px]">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="bg-[#E11D48] text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono">
                  STEP 1
                </span>
                <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-[#E11D48]" />
                  Live Call Vishing & Deepfake Analyzer
                </h2>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-[#E11D48] font-semibold border border-red-100">
                Whisper + Gemini 3.8
              </span>
            </div>

            {/* 4 Preset Scenario Buttons */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Select Attack Simulation Scenario:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  onClick={() => loadPreset('normal')}
                  className="p-1.5 text-left rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                >
                  <div className="text-[11px] font-bold truncate">Normal Call</div>
                  <div className="text-[9px] text-emerald-600 font-medium">Low Risk Pass</div>
                </button>
                <button
                  onClick={() => loadPreset('scattered_spider')}
                  className="p-1.5 text-left rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-900 transition"
                >
                  <div className="text-[11px] font-bold text-[#E11D48] truncate">Scattered Spider</div>
                  <div className="text-[9px] text-red-600 font-medium">MFA Vishing Attack</div>
                </button>
                <button
                  onClick={() => loadPreset('cfo_urgency')}
                  className="p-1.5 text-left rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900 transition"
                >
                  <div className="text-[11px] font-bold text-amber-700 truncate">CFO Coercion</div>
                  <div className="text-[9px] text-amber-600 font-medium">Deepfake Urgency</div>
                </button>
                <button
                  onClick={() => loadPreset('devops_root')}
                  className="p-1.5 text-left rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-purple-900 transition"
                >
                  <div className="text-[11px] font-bold text-purple-700 truncate">DevOps Bypass</div>
                  <div className="text-[9px] text-purple-600 font-medium">Tier 0 Target</div>
                </button>
              </div>
            </div>

            {/* Metadata Inputs (Compact 3-Column) */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Caller Stated Name</label>
                <input
                  type="text"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#E11D48]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Target Employee ID</label>
                <input
                  type="text"
                  value={employeeTarget}
                  onChange={(e) => setEmployeeTarget(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#E11D48]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Ticket ID</label>
                <input
                  type="text"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#E11D48]"
                />
              </div>
            </div>

            {/* Transcript Box (Fixed Height h-20) */}
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-500 font-medium mb-0.5 flex justify-between">
                <span>Call Speech Transcript</span>
                <span className="text-slate-400">Microphone speech or text simulation</span>
              </label>
              <textarea
                rows={2}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#E11D48] resize-none h-16"
              />
            </div>

            {/* Action Buttons: Record Voice (White/Red outline) & Analyze (Solid Red) */}
            <div className="flex items-center gap-2">
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#E11D48] text-white text-xs font-bold animate-pulse"
                >
                  <MicOff className="w-3.5 h-3.5" /> Stop Recording
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#E11D48] border border-[#E11D48] hover:bg-red-50 text-xs font-semibold transition"
                >
                  <Mic className="w-3.5 h-3.5 text-[#E11D48]" /> Record Mic Voice
                </button>
              )}

              <button
                onClick={handleAnalyzeText}
                disabled={isAnalyzing}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Evaluating Scam Tactics...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" /> Run Zero-Trust AI Scam Analysis
                  </>
                )}
              </button>
            </div>

            {/* Analysis Results Footer Strip */}
            {analysisResult && (
              <div className="p-2.5 rounded-lg bg-red-50/70 border border-red-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block leading-tight">Risk Score</span>
                    <span className={`text-base font-black font-mono ${analysisResult.risk_score >= 40 ? 'text-[#BE123C]' : 'text-emerald-700'}`}>
                      {analysisResult.risk_score}/100
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 hidden sm:block">
                    <span className="font-semibold">Deepfake Likelihood: </span>
                    <span className={analysisResult.synthetic_voice_probability > 50 ? 'text-[#BE123C] font-bold' : 'text-emerald-700'}>
                      {analysisResult.synthetic_voice_probability}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      analysisResult.recommendation === 'BLOCK'
                        ? 'bg-[#BE123C] text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {analysisResult.recommendation === 'BLOCK' ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {analysisResult.recommendation}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ================= CARD 2: STEP 2 - MFA-FATIGUE SHIELD ================= */}
          <div className="bg-white border border-red-100 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col justify-between h-[450px]">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="bg-[#E11D48] text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono">
                  STEP 2
                </span>
                <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#E11D48]" />
                  MFA-Fatigue Shield
                </h2>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-[#E11D48] font-semibold border border-red-100">
                60s Sliding Window
              </span>
            </div>

            {/* 3-Column Summary Stat Strip */}
            <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">Target Employee</span>
                <span className="font-mono text-[#BE123C] font-bold truncate block">{mfaEmployee}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">MFA Authenticator</span>
                <span className="text-slate-700 font-medium truncate block">{selectedEmployee?.mfa_device || 'Okta Verify'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Lockout Policy</span>
                <span className="text-slate-700 font-semibold truncate block">Max 3 in 60s</span>
              </div>
            </div>

            {/* 3 Visual Push Progress Slots */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-slate-700">Push Requests within 60s Window:</span>
                <span className="font-mono font-bold text-slate-900">{mfaStatus.push_count_60s} / 3 Threshold</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((step) => {
                  const isFilled = mfaStatus.push_count_60s >= step;
                  const isLockStep = step === 3 && mfaStatus.push_count_60s >= 3;
                  return (
                    <div
                      key={step}
                      className={`h-14 rounded-lg flex flex-col items-center justify-center font-mono text-xs font-bold border transition-all ${
                        isLockStep
                          ? 'bg-[#E11D48] border-[#BE123C] text-white shadow-md animate-pulse'
                          : isFilled
                          ? 'bg-amber-500 border-amber-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <span>PUSH #{step}</span>
                      <span className="text-[10px] font-normal opacity-90">
                        {step === 3 && isFilled ? 'LOCKDOWN' : isFilled ? 'RECORDED' : 'AWAITING'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Account Status Card Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                mfaStatus.is_locked
                  ? 'bg-red-50 border-red-300 text-red-900 shadow-sm'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {mfaStatus.is_locked ? (
                  <Lock className="w-5 h-5 text-[#BE123C] shrink-0" />
                ) : (
                  <Unlock className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold">
                    {mfaStatus.is_locked ? 'ACCOUNT LOCKED (DEFENSE ENGAGED)' : 'ACCOUNT ACTIVE (NORMAL CADENCE)'}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {mfaStatus.is_locked
                      ? '3 rapid push attempts blocked. All password resets & tokens blocked.'
                      : 'Zero-Trust MFA velocity checks satisfied.'}
                  </div>
                </div>
              </div>

              {mfaStatus.is_locked && (
                <button
                  onClick={handleUnlockMfa}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-red-300 text-xs font-bold text-[#BE123C] hover:bg-red-50 shadow-sm transition"
                >
                  Admin Unlock
                </button>
              )}
            </div>

            {/* Simulate Push Spam Button (Solid Bright Red) */}
            <button
              onClick={handleTriggerMfaPush}
              disabled={mfaLoading || mfaStatus.is_locked}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              {mfaLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Simulate Rapid Push Spam (+1 Push)
            </button>
          </div>

          {/* ================= CARD 3: STEP 3 - JUST-IN-TIME ACCESS VAULT & API TESTER ================= */}
          <div className="bg-white border border-red-100 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col justify-between h-[450px]">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="bg-[#E11D48] text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono">
                  STEP 3
                </span>
                <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-[#E11D48]" />
                  Just-in-Time Access Vault & API Tester
                </h2>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-[#E11D48] font-semibold border border-red-100">
                15m Auto-Expiring JWT
              </span>
            </div>

            {/* Environment & Scoped Role Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Target Client Environment</label>
                <input
                  type="text"
                  value={targetEnv}
                  onChange={(e) => setTargetEnv(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#E11D48]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Role Scoped</label>
                <input
                  type="text"
                  value={roleRequested}
                  onChange={(e) => setRoleRequested(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#E11D48]"
                />
              </div>
            </div>

            {/* Zero-Trust Pre-Conditions Checklist */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-700 uppercase font-mono">Zero-Trust Pre-Conditions:</span>
              <div className="flex items-center justify-between text-slate-600">
                <span>• Call Risk Score &lt; 40</span>
                <span className={`font-bold font-mono ${analysisResult?.risk_score >= 40 ? 'text-[#BE123C]' : 'text-emerald-700'}`}>
                  {analysisResult ? `${analysisResult.risk_score} / 100` : '15 (Simulated Pass)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>• Target Account Not Locked</span>
                <span className={`font-bold font-mono ${mfaStatus.is_locked ? 'text-[#BE123C]' : 'text-emerald-700'}`}>
                  {mfaStatus.is_locked ? 'LOCKED (BLOCKED)' : 'ACTIVE (PASS)'}
                </span>
              </div>
            </div>

            {/* Issue JIT Token & Test API Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleIssueJit}
                disabled={jitIssuing || mfaStatus.is_locked || (analysisResult && analysisResult.risk_score >= 40)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {jitIssuing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Issue 15m Token
              </button>

              <button
                onClick={handleSimulateApiAccess}
                disabled={!selectedSessionForTest || isSimulatingApi}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <Terminal className="w-3.5 h-3.5" />
                Test API Access
              </button>
            </div>

            {/* Live API Simulation Output Terminal */}
            {apiSimulationResult ? (
              <div className="p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] h-16 overflow-y-auto">
                <div className="flex justify-between items-center text-slate-400 mb-1">
                  <span>POST /api/v1/aws-client/ecs/restart</span>
                  <span className={`font-bold ${apiSimulationResult.status_code === 200 ? 'text-emerald-400' : 'text-red-400'}`}>
                    HTTP {apiSimulationResult.status_code} {apiSimulationResult.access}
                  </span>
                </div>
                <div className="text-slate-300 truncate">
                  {apiSimulationResult.message || apiSimulationResult.error}
                </div>
              </div>
            ) : (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 flex items-center justify-between font-mono">
                <span>Select an active token to test live AWS access</span>
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
              </div>
            )}

            {/* Active JIT Sessions List */}
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-700 mb-1">Active JIT Sessions & Live Countdown:</span>
              <div className="space-y-1.5 max-h-20 overflow-y-auto pr-1">
                {jitSessions.length === 0 ? (
                  <div className="text-center py-2 text-xs text-slate-400 font-mono">
                    No active JIT tokens issued.
                  </div>
                ) : (
                  jitSessions.map((s) => (
                    <div
                      key={s.session_id}
                      onClick={() => setSelectedSessionForTest(s)}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition ${
                        selectedSessionForTest?.session_id === s.session_id
                          ? 'border-[#E11D48] bg-red-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <span className="font-mono text-xs font-bold text-[#BE123C]">{s.session_id}</span>
                        <span className="text-[10px] text-slate-500 ml-2">Ticket: {s.ticket_id}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-bold ${
                            s.is_active ? 'text-[#E11D48]' : 'text-slate-400'
                          }`}
                        >
                          {s.is_revoked ? 'REVOKED' : s.ttl_seconds > 0 ? formatTimer(s.ttl_seconds) : 'EXPIRED'}
                        </span>

                        {s.is_active && !s.is_revoked && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevokeJit(s.session_id);
                            }}
                            className="px-2 py-0.5 rounded bg-white text-[#BE123C] border border-red-300 hover:bg-red-50 text-[10px] font-bold transition"
                          >
                            Revoke Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ================= CARD 4: STEP 4 - SHA-256 AUDIT LEDGER & TAMPER LAB ================= */}
          <div className="bg-white border border-red-100 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col justify-between h-[450px]">
            {/* Header with Step Badge & Controls */}
            <div className="flex flex-wrap items-center justify-between pb-2 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#E11D48] text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono">
                  STEP 4
                </span>
                <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-[#E11D48]" />
                  SHA-256 Audit Ledger & Tamper Lab
                </h2>
              </div>

              {/* Lab Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSimulateTamper}
                  className="px-2 py-1 rounded bg-white text-[#E11D48] border border-[#E11D48] hover:bg-red-50 text-[11px] font-semibold transition"
                  title="Modify an SQL row without updating cryptographic hash"
                >
                  Simulate DB Tampering
                </button>
                <button
                  onClick={handleVerifyChain}
                  disabled={isVerifyingChain}
                  className="px-2 py-1 rounded bg-[#E11D48] hover:bg-[#BE123C] text-white text-[11px] font-bold transition shadow-sm disabled:opacity-50"
                >
                  Verify Chain
                </button>
                <button
                  onClick={handleRestoreLedger}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Restore
                </button>
              </div>
            </div>

            {/* Chain Verification Status Alert */}
            {chainVerification && (
              <div
                className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                  chainVerification.is_valid
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-red-50 border-red-300 text-red-900 animate-pulse'
                }`}
              >
                <div className="flex items-center gap-2">
                  {chainVerification.is_valid ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#BE123C] shrink-0" />
                  )}
                  <span className="font-semibold">{chainVerification.message}</span>
                </div>
                <span className="font-mono text-[10px] font-bold shrink-0 ml-2">
                  {chainVerification.is_valid ? `Verified ${chainVerification.total_records} Blocks` : `CORRUPTED BLOCK #${chainVerification.tampered_record_id}`}
                </span>
              </div>
            )}

            {/* CRITICAL FIX: Fixed-Height Scrollable Audit Table Container (max-h-[250px]) */}
            <div className="border border-slate-200 rounded-lg overflow-y-auto h-[270px] shadow-inner bg-white">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-red-50 text-red-900 font-semibold border-b border-red-200 uppercase text-[10px] font-mono z-10 shadow-sm">
                  <tr>
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">Action</th>
                    <th className="py-2 px-2.5">Actor</th>
                    <th className="py-2 px-2.5">Risk</th>
                    <th className="py-2 px-2.5">SHA-256 Hash Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {auditLogs.map((log) => {
                    const isCorrupted = chainVerification?.is_valid === false && chainVerification?.tampered_record_id === log.id;
                    return (
                      <tr
                        key={log.id}
                        className={`transition ${
                          isCorrupted
                            ? 'bg-red-100 text-red-900 border-l-4 border-red-600 font-bold'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <td className="py-2 px-2.5 text-slate-500 font-bold">{log.id}</td>
                        <td className="py-2 px-2.5">
                          <span className={`font-semibold ${isCorrupted ? 'text-[#BE123C]' : 'text-slate-900'}`}>
                            {log.action}
                          </span>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">{log.details}</div>
                        </td>
                        <td className="py-2 px-2.5 text-slate-600">{log.actor}</td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.risk_score >= 40 ? 'bg-red-100 text-[#BE123C]' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.risk_score}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-500 text-[10px]">
                          <div className="flex flex-col">
                            <span title={`Prev: ${log.prev_hash}`}>P: {log.prev_hash.slice(0, 10)}...</span>
                            <span className="text-[#BE123C] font-semibold" title={`Current: ${log.current_hash}`}>
                              C: {log.current_hash.slice(0, 10)}...
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>

      {/* Compliance Certificate Modal */}
      {showCertModal && complianceCert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-red-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCertModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="p-2.5 bg-red-50 text-[#E11D48] rounded-xl border border-red-100">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cryptographic Assurance & Compliance Certificate</h3>
                <p className="text-xs text-slate-500">{complianceCert.standard}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-mono bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Certificate ID:</span>
                <span className="text-[#BE123C] font-bold">{complianceCert.certificate_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Attestation Status:</span>
                <span className="text-emerald-700 font-bold">{complianceCert.attestation_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Chained Blocks:</span>
                <span className="text-slate-900 font-bold">{complianceCert.total_blocks_audited} Records</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Genesis Root Hash:</span>
                <span className="text-slate-600 truncate max-w-xs">{complianceCert.genesis_block_hash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chain Head Hash:</span>
                <span className="text-[#BE123C] truncate max-w-xs">{complianceCert.chain_head_hash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Digital Seal (SHA-256):</span>
                <span className="text-emerald-700 truncate max-w-xs">{complianceCert.digital_seal}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(complianceCert, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${complianceCert.certificate_id}.json`;
                  a.click();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold transition shadow-sm"
              >
                <Download className="w-4 h-4" /> Export Signed JSON Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-3 border-t border-slate-200 mt-auto bg-white">
        Zero-Trust AI Helpdesk & Access Guard (Human-Risk) • Running strictly on <code className="text-[#BE123C] font-semibold">D:\ZeroTrust-Helpdesk-Guard</code> • C: Drive Storage Preserved
      </footer>
    </div>
  );
}
