"use client";

import { useState, useCallback } from "react";
import {
  burnTokens,
  getTotalBurned,
  getUserBurned,
  getBurnCount,
  CONTRACT_ADDRESS,
} from "@/hooks/contract";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Icons ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ── Styled Input ─────────────────────────────────────────────

function Input({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
          {label}
        </label>
        {hint && <span className="text-[10px] text-white/20 font-mono">{hint}</span>}
      </div>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#ff6b35]/30 focus-within:shadow-[0_0_20px_rgba(255,107,53,0.08)]">
        <input
          {...props}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
        />
      </div>
    </div>
  );
}

// ── Method Signature ─────────────────────────────────────────

function MethodSignature({
  name,
  params,
  returns,
  color,
}: {
  name: string;
  params: string;
  returns?: string;
  color: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
      <span style={{ color }} className="font-semibold">fn</span>
      <span className="text-white/70">{name}</span>
      <span className="text-white/20 text-xs">{params}</span>
      {returns && (
        <span className="ml-auto text-white/15 text-[10px]">{returns}</span>
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">{label}</span>
      </div>
      <p className="font-mono text-xl font-bold text-white/90" style={{ color }}>{value}</p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

type Tab = "burn" | "stats";

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("burn");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Burn form
  const [burnToken, setBurnToken] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [isBurning, setIsBurning] = useState(false);

  // Stats form
  const [statsToken, setStatsToken] = useState("");
  const [statsUser, setStatsUser] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [statsResult, setStatsResult] = useState<{
    totalBurned: bigint;
    userBurned: bigint;
    burnCount: number;
  } | null>(null);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const fmt = (n: bigint) => {
    // Format i128 with 7 decimal places (Stellar standard: 1 XLM = 10_000_000 stroops)
    const s = n.toString();
    if (s === "0") return "0";
    return Number(n).toLocaleString();
  };

  const handleBurn = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!burnToken.trim()) return setError("Enter a token contract address");
    if (!burnAmount.trim() || isNaN(Number(burnAmount)) || Number(burnAmount) <= 0)
      return setError("Enter a valid positive amount");

    setError(null);
    setIsBurning(true);
    setTxStatus("Awaiting signature...");
    try {
      // Convert amount to i128 (assuming 7 decimal places — Stellar standard)
      const rawAmount = BigInt(Math.round(Number(burnAmount) * 10_000_000));
      await burnTokens(walletAddress, burnToken.trim(), rawAmount);
      setTxStatus(`Burned ${burnAmount} tokens — gone forever!`);
      setBurnAmount("");
      setTimeout(() => setTxStatus(null), 6000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsBurning(false);
    }
  }, [walletAddress, burnToken, burnAmount]);

  const handleQueryStats = useCallback(async () => {
    if (!statsToken.trim()) return setError("Enter a token contract address");
    setError(null);
    setIsQuerying(true);
    setStatsResult(null);
    try {
      const [totalBurned, burnCount] = await Promise.all([
        getTotalBurned(statsToken.trim(), walletAddress || undefined),
        getBurnCount(statsToken.trim(), walletAddress || undefined),
      ]);
      let userBurned = BigInt(0);
      if (statsUser.trim()) {
        userBurned = await getUserBurned(statsToken.trim(), statsUser.trim(), walletAddress || undefined);
      }
      setStatsResult({ totalBurned, userBurned, burnCount });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setIsQuerying(false);
    }
  }, [statsToken, statsUser, walletAddress]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "burn", label: "Burn", icon: <FlameIcon />, color: "#ff6b35" },
    { key: "stats", label: "Stats", icon: <SearchIcon />, color: "#4fc3f7" },
  ];

  return (
    <div className="w-full max-w-2xl animate-fade-in-up-delayed">
      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f87171]/15 bg-[#f87171]/[0.05] px-4 py-3 backdrop-blur-sm animate-slide-down">
          <span className="mt-0.5 text-[#f87171]"><AlertIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#f87171]/90">Error</p>
            <p className="text-xs text-[#f87171]/50 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-[#f87171]/30 hover:text-[#f87171]/70 text-lg leading-none">&times;</button>
        </div>
      )}

      {txStatus && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#ff6b35]/15 bg-[#ff6b35]/[0.05] px-4 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(255,107,53,0.06)] animate-slide-down">
          <span className="text-[#ff6b35]">
            {txStatus.includes("Burned") ? <CheckIcon /> : <SpinnerIcon />}
          </span>
          <span className="text-sm text-[#ff6b35]/90">{txStatus}</span>
        </div>
      )}

      {/* Main Card */}
      <Spotlight className="rounded-2xl">
        <AnimatedCard className="p-0" containerClassName="rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6b35]/20 to-[#fbbf24]/20 border border-white/[0.06]">
                <FlameIcon size={14} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Token Burn</h3>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">{truncate(CONTRACT_ADDRESS)}</p>
              </div>
            </div>
            <Badge variant="warning" className="text-[10px]">Permissionless</Badge>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); setStatsResult(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all",
                  activeTab === t.key ? "text-white/90" : "text-white/35 hover:text-white/55"
                )}
              >
                <span style={activeTab === t.key ? { color: t.color } : undefined}>{t.icon}</span>
                {t.label}
                {activeTab === t.key && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all"
                    style={{ background: `linear-gradient(to right, ${t.color}, ${t.color}66)` }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">

            {/* ── Burn Tab ── */}
            {activeTab === "burn" && (
              <div className="space-y-5">
                <MethodSignature
                  name="burn"
                  params="(caller: Address, token: Address, amount: i128)"
                  color="#ff6b35"
                />

                {/* Permissionless notice */}
                <div className="flex items-start gap-2.5 rounded-xl border border-[#fbbf24]/10 bg-[#fbbf24]/[0.04] px-4 py-3">
                  <span className="mt-0.5 text-[#fbbf24] shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </span>
                  <p className="text-[11px] text-[#fbbf24]/60 leading-relaxed">
                    Fully permissionless — no admin, no whitelist. Anyone can burn their own tokens from any SAC-compatible token contract. Burns are <span className="text-[#fbbf24]/80 font-medium">irreversible</span>.
                  </p>
                </div>

                <Input
                  label="Token Contract Address"
                  hint="C... address"
                  value={burnToken}
                  onChange={(e) => setBurnToken(e.target.value)}
                  placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                />
                <Input
                  label="Amount to Burn"
                  hint="in token units"
                  value={burnAmount}
                  onChange={(e) => setBurnAmount(e.target.value)}
                  placeholder="e.g. 100"
                  type="number"
                  min="0"
                  step="any"
                />

                {walletAddress ? (
                  <ShimmerButton onClick={handleBurn} disabled={isBurning} shimmerColor="#ff6b35" className="w-full">
                    {isBurning
                      ? <><SpinnerIcon /> Burning...</>
                      : <><FlameIcon /> Burn Tokens</>}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#ff6b35]/20 bg-[#ff6b35]/[0.03] py-4 text-sm text-[#ff6b35]/60 hover:border-[#ff6b35]/30 hover:text-[#ff6b35]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    {isConnecting ? "Connecting..." : "Connect wallet to burn tokens"}
                  </button>
                )}

                {/* Connected wallet auto-fill hint */}
                {walletAddress && (
                  <p className="text-[10px] text-white/20 text-center font-mono">
                    burning from <span className="text-white/40">{truncate(walletAddress)}</span>
                  </p>
                )}
              </div>
            )}

            {/* ── Stats Tab ── */}
            {activeTab === "stats" && (
              <div className="space-y-5">
                <MethodSignature
                  name="get_total_burned / get_user_burned / get_burn_count"
                  params="(token: Address)"
                  returns="-> i128 / u32"
                  color="#4fc3f7"
                />

                <Input
                  label="Token Contract Address"
                  hint="C... address"
                  value={statsToken}
                  onChange={(e) => setStatsToken(e.target.value)}
                  placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                />

                <Input
                  label="User Address (optional)"
                  hint="lookup per-user burns"
                  value={statsUser}
                  onChange={(e) => setStatsUser(e.target.value)}
                  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                />

                <ShimmerButton onClick={handleQueryStats} disabled={isQuerying} shimmerColor="#4fc3f7" className="w-full">
                  {isQuerying ? <><SpinnerIcon /> Querying...</> : <><SearchIcon /> Query Stats</>}
                </ShimmerButton>

                {statsResult && (
                  <div className="space-y-3 animate-fade-in-up">
                    {/* Stat cards row */}
                    <div className="flex gap-3">
                      <StatCard
                        label="Total Burned"
                        value={fmt(statsResult.totalBurned)}
                        color="#ff6b35"
                        icon={<FlameIcon />}
                      />
                      <StatCard
                        label="Burn Events"
                        value={statsResult.burnCount.toString()}
                        color="#fbbf24"
                        icon={
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                          </svg>
                        }
                      />
                    </div>

                    {/* User burned */}
                    {statsUser.trim() && (
                      <div className="flex gap-3">
                        <StatCard
                          label="Your Burns"
                          value={fmt(statsResult.userBurned)}
                          color="#a78bfa"
                          icon={<UserIcon />}
                        />
                        <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">Share of Total</span>
                          </div>
                          <p className="font-mono text-xl font-bold text-white/90">
                            {statsResult.totalBurned > BigInt(0)
                              ? `${(Number(statsResult.userBurned * BigInt(10000) / statsResult.totalBurned) / 100).toFixed(2)}%`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {statsResult.totalBurned === BigInt(0) && (
                      <p className="text-center text-xs text-white/25 py-2">
                        No tokens have been burned for this token yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-white/15">Token Burn &middot; Soroban Testnet</p>
            <div className="flex items-center gap-1.5 text-[9px] text-white/15 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b35]/40" />
              permissionless
              <span className="mx-1 text-white/10">&middot;</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]/40" />
              irreversible
            </div>
          </div>
        </AnimatedCard>
      </Spotlight>
    </div>
  );
}
