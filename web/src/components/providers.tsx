"use client";

/*
 * Wallet and data providers. Privy (the owner's existing app ID) is the default login and drives wagmi through
 * @privy-io/wagmi. "Browser wallet" mode skips Privy and uses wagmi's injected connector, plus anvil's public test
 * accounts on chain 31337 when NEXT_PUBLIC_DEV_WALLET=1, so the local flow works with no extension at all.
 * The visitor's choice is remembered in localStorage; switching reloads the page so only one stack is mounted.
 */
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider, createConfig as createPrivyConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { fallback, http, type Address } from "viem";
import { WagmiProvider, createConfig, useAccount, useConnect, useDisconnect } from "wagmi";
import { injected, mock } from "wagmi/connectors";
import { ANVIL_ACCOUNTS, ANVIL_ROLES, anvil, bscTestnet, configureLocalChain, localAccountsAllowed, type LocalChainInfo } from "@/lib/chain/chains";
import { LOCAL_MODE, TESTNET_RPCS } from "@/lib/chain/target";

/** The owner's Privy app (a public id, not a secret); NEXT_PUBLIC_PRIVY_APP_ID overrides it. */
const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmwxgt4at00fz0hjkdtasmncg";
const DEV_WALLET_FLAG = process.env.NEXT_PUBLIC_DEV_WALLET === "1";
/** anvil's public accounts only on a chain running on this machine, never on BNB testnet or BNB Chain. */
const devWallet = () => DEV_WALLET_FLAG && localAccountsAllowed();
const FORCED = process.env.NEXT_PUBLIC_WALLET_MODE;
/** Origins the Privy app allows (its dashboard setting). Elsewhere Privy's iframe is blocked, so browser wallets lead. */
const PRIVY_ORIGINS = (process.env.NEXT_PUBLIC_PRIVY_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
export function privyOriginAllowed(): boolean {
  return PRIVY_ORIGINS.length === 0 || (typeof window !== "undefined" && PRIVY_ORIGINS.includes(window.location.origin));
}

export type WalletMode = "privy" | "browser";

/**
 * Privy whenever an app id is set and this origin is on its allow list, so Connect opens Privy's modal directly.
 * A saved "browser" choice (the local anvil test accounts) counts only with NEXT_PUBLIC_DEV_WALLET=1, off by default;
 * a Settings screen sets it through useWalletSettings().
 */
function readMode(): WalletMode {
  if (!APP_ID || FORCED === "injected") return "browser";
  if (DEV_WALLET_FLAG) {
    try {
      const saved = localStorage.getItem("wallet-mode");
      if (saved === "browser" || saved === "privy") return saved;
    } catch { /* storage blocked: fall through */ }
  }
  return privyOriginAllowed() ? "privy" : "browser";
}

export interface WalletUi {
  mode: WalletMode;
  privyAvailable: boolean;
  ready: boolean;
  address?: Address;
  chainId?: number;
  label?: string; // how the wallet connected: "Privy", "MetaMask", "Local test account #1"
  connect: () => void;
  connectLocal: (index: number) => void;
  disconnect: () => void;
  /** Privy: log out and open the login again with another account or wallet. */
  switchAccount?: () => void;
  setMode: (m: WalletMode) => void;
  devWallet: boolean;
}

const Ctx = createContext<WalletUi | null>(null);
export function useWallet(): WalletUi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside Providers");
  return v;
}

function setMode(m: WalletMode) {
  try { localStorage.setItem("wallet-mode", m); } catch { /* the choice lasts for this page only */ }
  window.location.reload();
}


const LOCAL_KEY = "covenant-local-account";
const remember = (i: number | null) => {
  try { if (i === null) localStorage.removeItem(LOCAL_KEY); else localStorage.setItem(LOCAL_KEY, String(i)); } catch { /* this page only */ }
};

function BrowserBridge({ children }: { children: ReactNode }) {
  const { address, chainId, connector, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  // wagmi's mock connector cannot reconnect after a page load (it keeps no session), so the chosen local test
  // account is remembered here and connected again once on mount.
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || !devWallet() || status !== "disconnected") return;
    tried.current = true;
    let saved: string | null = null;
    try { saved = localStorage.getItem(LOCAL_KEY); } catch { /* storage blocked */ }
    const c = saved === null ? undefined : connectors.find((x) => x.id === `local-${saved}`);
    if (c) connect({ connector: c, chainId: anvil.id });
  }, [status, connectors, connect]);
  const value: WalletUi = {
    mode: "browser",
    privyAvailable: Boolean(APP_ID),
    ready: status !== "reconnecting",
    address,
    chainId,
    label: connector?.id.startsWith("local-") ? connector.name : connector?.name,
    connect: () => { const c = connectors.find((x) => x.type === "injected"); if (c) connect({ connector: c }); },
    connectLocal: (i) => { const c = connectors.find((x) => x.id === `local-${i}`); if (c) { remember(i); connect({ connector: c, chainId: anvil.id }); } },
    disconnect: () => { remember(null); disconnect(); },
    setMode,
    devWallet: devWallet(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function PrivyBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address, chainId } = useAccount();
  const value: WalletUi = {
    mode: "privy",
    privyAvailable: true,
    ready,
    address: authenticated ? address : undefined,
    chainId,
    label: "Privy",
    connect: () => login(),
    connectLocal: () => setMode("browser"),
    disconnect: () => { void logout(); },
    switchAccount: () => { void logout().then(() => login()); },
    setMode,
    devWallet: devWallet(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function localConnectors() {
  if (!devWallet()) return [];
  return ANVIL_ACCOUNTS.map((a, i) =>
    (config: Parameters<ReturnType<typeof mock>>[0]) => {
      const c = mock({ accounts: [a], features: { reconnect: true } })(config);
      return { ...c, id: `local-${i}`, name: `Local test account #${i}` };
    });
}

const subscribeNoop = () => () => {};

/** The configured chain first (its own RPC); BNB testnet too on a local stack, so a wallet can still switch to it. */
function chainsFor() {
  return (anvil.id === bscTestnet.id || !localAccountsAllowed() ? [anvil] : [anvil, bscTestnet]) as unknown as readonly [typeof anvil, ...(typeof anvil)[]];
}

export function Providers({ children, localChain }: { children: ReactNode; localChain?: LocalChainInfo | null }) {
  configureLocalChain(localChain);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }));
  // The server renders the Privy stack's shape; the client reads the remembered mode before the first effect.
  const mode = useSyncExternalStore(subscribeNoop, readMode, () => (APP_ID && FORCED !== "injected" ? "privy" : "browser") as WalletMode);
  const theme = useSyncExternalStore(subscribeNoop, () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"), () => "light" as const);

  const chainKey = `${anvil.id}:${anvil.rpcUrls.default.http[0]}`;
  const transports = useMemo(() => Object.fromEntries(chainsFor().map((c) => [c.id, c.id === 97 && !LOCAL_MODE ? fallback(TESTNET_RPCS.map((u) => http(u))) : http(c.rpcUrls.default.http[0])])), [chainKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const browserConfig = useMemo(() => createConfig({ chains: chainsFor(), transports, connectors: [injected(), ...localConnectors()], ssr: true }), [transports]);
  const privyConfig = useMemo(() => createPrivyConfig({ chains: chainsFor(), transports, ssr: true }), [transports]);

  if (mode === "browser") {
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={browserConfig}>
          <BrowserBridge>{children}</BrowserBridge>
        </WagmiProvider>
      </QueryClientProvider>
    );
  }
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        // One popup: email (an embedded wallet is created for it) and external wallets: the ones the browser has,
        // MetaMask, Coinbase, Binance, OKX, Rainbow, and any other through WalletConnect.
        appearance: {
          theme, accentColor: "#2b5cff", showWalletLoginFirst: true, landingHeader: "Connect to Covenant",
          walletList: ["detected_ethereum_wallets", "metamask", "coinbase_wallet", "binance", "okx_wallet", "rainbow", "wallet_connect"],
        },
        loginMethods: ["email", "wallet"],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: anvil,
        supportedChains: [...chainsFor()],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={privyConfig}>
          <PrivyBridge>{children}</PrivyBridge>
        </PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

/**
 * For a Settings screen: the wallet stack in use and, with NEXT_PUBLIC_DEV_WALLET=1 on a chain on this machine, the
 * anvil test accounts. setMode("browser") then connectLocal(i) connects one; setMode("privy") goes back to Privy.
 * The header's Connect never shows these: it opens Privy (or the browser's wallet) directly.
 */
export function useWalletSettings() {
  const w = useWallet();
  return {
    mode: w.mode,
    setMode: w.setMode,
    privyAvailable: w.privyAvailable,
    localAccountsAvailable: DEV_WALLET_FLAG && localAccountsAllowed(),
    localAccounts: DEV_WALLET_FLAG && localAccountsAllowed() ? ANVIL_ACCOUNTS.map((address, index) => ({ index, address, role: ANVIL_ROLES[index] ?? "" })) : [],
    connectLocal: w.connectLocal,
  };
}
