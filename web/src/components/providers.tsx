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
import { http, type Address } from "viem";
import { WagmiProvider, createConfig, useAccount, useConnect, useDisconnect } from "wagmi";
import { injected, mock } from "wagmi/connectors";
import { ANVIL_ACCOUNTS, anvil, bscTestnet, configureLocalChain, type LocalChainInfo } from "@/lib/chain/chains";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
const DEV_WALLET = process.env.NEXT_PUBLIC_DEV_WALLET === "1";
const FORCED = process.env.NEXT_PUBLIC_WALLET_MODE;
/** Origins the Privy app allows (its dashboard setting). Elsewhere Privy's iframe is blocked, so browser wallets lead. */
const PRIVY_ORIGINS = (process.env.NEXT_PUBLIC_PRIVY_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
export function privyOriginAllowed(): boolean {
  return PRIVY_ORIGINS.length === 0 || (typeof window !== "undefined" && PRIVY_ORIGINS.includes(window.location.origin));
}

export type WalletMode = "privy" | "browser";

function readMode(): WalletMode {
  if (!APP_ID || FORCED === "injected") return "browser";
  try {
    const saved = localStorage.getItem("wallet-mode");
    if (saved === "browser" || saved === "privy") return saved;
  } catch { /* storage blocked: fall through */ }
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
    if (tried.current || !DEV_WALLET || status !== "disconnected") return;
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
    devWallet: DEV_WALLET,
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
    setMode,
    devWallet: DEV_WALLET,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function localConnectors() {
  if (!DEV_WALLET) return [];
  return ANVIL_ACCOUNTS.map((a, i) =>
    (config: Parameters<ReturnType<typeof mock>>[0]) => {
      const c = mock({ accounts: [a], features: { reconnect: true } })(config);
      return { ...c, id: `local-${i}`, name: `Local test account #${i}` };
    });
}

const subscribeNoop = () => () => {};

/** The local chain first; BSC testnet too unless the local chain already is 97. */
function chainsFor() {
  return (anvil.id === bscTestnet.id ? [anvil] : [anvil, bscTestnet]) as unknown as readonly [typeof anvil, ...(typeof anvil)[]];
}

export function Providers({ children, localChain }: { children: ReactNode; localChain?: LocalChainInfo | null }) {
  configureLocalChain(localChain);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }));
  // The server renders the Privy stack's shape; the client reads the remembered mode before the first effect.
  const mode = useSyncExternalStore(subscribeNoop, readMode, () => (APP_ID && FORCED !== "injected" ? "privy" : "browser") as WalletMode);
  const theme = useSyncExternalStore(subscribeNoop, () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"), () => "light" as const);

  const chainKey = `${anvil.id}:${anvil.rpcUrls.default.http[0]}`;
  const transports = useMemo(() => Object.fromEntries(chainsFor().map((c) => [c.id, http(c.rpcUrls.default.http[0])])), [chainKey]); // eslint-disable-line react-hooks/exhaustive-deps
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
        appearance: { theme, accentColor: "#2b5cff", showWalletLoginFirst: true, landingHeader: "Connect to Covenant" },
        loginMethods: ["wallet", "email"],
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
