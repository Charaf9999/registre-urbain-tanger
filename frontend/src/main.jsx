import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import meta from "./registry.json";
import { message, shortAddress } from "./data.js";
import { CreateIssue, IssueDetail, Register } from "./IssueViews.jsx";
import ImportPanel from "./ImportPanel.jsx";
import "./style.css";

const rpc = new JsonRpcProvider(meta.rpc, meta.chainId, {
  staticNetwork: true,
  cacheTimeout: -1,
});
const readContract = new Contract(meta.address, meta.abi, rpc);
const hexId = "0x" + meta.chainId.toString(16);
const sections = {
  register: ["Registre public", "Consultez les signalements et suivez leur traitement."],
  create: ["Déclarer un problème", "Un signalement citoyen démarre au statut « Déclaré »."],
  import: [
    "Import de données",
    "Enregistrez sur la blockchain les lignes de votre fichier Excel ou CSV.",
  ],
  detail: ["Fiche du signalement", "Déclaration et suivi des interventions municipales."],
};
function preferredWallet() {
  return window.ethereum?.providers?.find((p) => p.isMetaMask) || window.ethereum;
}
function App() {
  const [view, setView] = useState("register"),
    [id, setId] = useState(""),
    [ready, setReady] = useState(false);
  const [revision, revise] = useState(0),
    [attempt, retry] = useState(0),
    [rpcError, setRpcError] = useState("");
  const [wallet, setWallet] = useState(preferredWallet),
    [account, setAccount] = useState(""),
    [chain, setChain] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(null);
  const waiting = useRef(false);
  const connected = chain?.toLowerCase() === hexId ? account : "";
  const isCity = !!connected && connected.toLowerCase() === meta.municipality.toLowerCase();
  const registry = ready ? readContract : null;
  useEffect(() => {
    function announce(e) {
      if (e.detail?.info?.rdns === "io.metamask") setWallet(e.detail.provider);
    }
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", announce);
  }, []);
  useEffect(() => {
    if (!wallet) return;
    let live = true;
    const accounts = (a) => {
        if (live) setAccount(a?.[0] || "");
      },
      chainChanged = (c) => {
        if (live) setChain(c);
      };
    wallet
      .request({ method: "eth_accounts" })
      .then(accounts)
      .catch(() => accounts([]));
    wallet
      .request({ method: "eth_chainId" })
      .then(chainChanged)
      .catch(() => chainChanged(""));
    wallet.on?.("accountsChanged", accounts);
    wallet.on?.("chainChanged", chainChanged);
    return () => {
      live = false;
      wallet.removeListener?.("accountsChanged", accounts);
      wallet.removeListener?.("chainChanged", chainChanged);
    };
  }, [wallet]);
  useEffect(() => {
    let live = true;
    setRpcError("");
    setReady(false);
    (async () => {
      if (BigInt(await rpc.send("eth_chainId", [])) !== BigInt(meta.chainId))
        throw Error("Identifiant de chaîne inattendu.");
      if ((await rpc.getCode(meta.address)) === "0x")
        throw Error("Contrat absent. Relancez npm run deploy.");
      if ((await readContract.municipality()).toLowerCase() !== meta.municipality.toLowerCase())
        throw Error("Déploiement différent de la configuration.");
      if (live) setReady(true);
    })().catch((e) => {
      if (live)
        setRpcError(
          "Réseau local indisponible. Vérifiez le nœud et le déploiement. " + message(e)
        );
    });
    return () => {
      live = false;
    };
  }, [attempt]);
  function navigate(next) {
    if (waiting.current) return;
    setView(next);
    setNotice(null);
  }
  function open(issueId) {
    setId(issueId);
    setView("detail");
    window.scrollTo(0, 0);
  }
  async function connect() {
    if (!wallet) {
      setNotice({
        error: true,
        text: "Ouvrez cette page dans un navigateur équipé de MetaMask.",
      });
      return;
    }
    try {
      const accounts = await wallet.request({ method: "eth_requestAccounts" });
      const current = await wallet.request({ method: "eth_chainId" });
      if (current.toLowerCase() !== hexId) {
        try {
          await wallet.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: hexId }],
          });
        } catch (e) {
          if ((e?.code ?? e?.data?.originalError?.code) !== 4902) throw e;
          await wallet.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexId,
                chainName: "M115 Tanger",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: [meta.rpc],
              },
            ],
          });
          await wallet.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: hexId }],
          });
        }
      }
      setChain(await wallet.request({ method: "eth_chainId" }));
      setAccount(accounts[0] || "");
      setNotice(null);
    } catch (e) {
      setNotice({ error: true, text: message(e) });
    }
  }
  async function transact(operation) {
    if (waiting.current) return false;
    waiting.current = true;
    setBusy(true);
    try {
      if (!wallet || !connected || !registry)
        throw Error("Connectez MetaMask au réseau local.");
      const browser = new BrowserProvider(wallet);
      if ((await browser.getNetwork()).chainId !== BigInt(meta.chainId))
        throw Error("Réseau du portefeuille incorrect.");
      const signer = await browser.getSigner(connected);
      setNotice({ text: "Confirmez la transaction dans votre portefeuille…" });
      const tx = await operation(readContract.connect(signer));
      setNotice({ text: "Transaction envoyée. Confirmation en cours…", hash: tx.hash });
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1)
        throw Error("La transaction n’a pas été confirmée.");
      setNotice({
        text: "Transaction confirmée · bloc " + receipt.blockNumber,
        hash: receipt.hash,
      });
      revise((x) => x + 1);
      return true;
    } catch (e) {
      setNotice({ error: true, text: message(e) });
      return false;
    } finally {
      waiting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <header className="mast">
        <div className="brand">
          <img className="mark" src="/registre-tanger.png" alt="" width="52" height="52" />
          <span>
            <b>Registre urbain</b>
            <small>Tanger · Services municipaux</small>
          </span>
        </div>
        <div className="wallet">
          <span className="network">
            <i className={ready ? "live" : ""}></i>Hardhat local
          </span>
          <button
            className="walletbutton"
            disabled={busy || !!connected}
            onClick={connect}
            title={connected || undefined}
          >
            {connected
              ? (isCity ? "Municipalité" : "Citoyen") + " · " + shortAddress(connected)
              : account
              ? "Changer de réseau"
              : "Connecter MetaMask"}
          </button>
        </div>
      </header>
      <main>
        <nav aria-label="Navigation principale">
          {[
            ["register", "Registre"],
            ["create", "Déclarer"],
            ["import", "Importer"],
          ].map(([k, t]) => (
            <button
              className={view === k || (view === "detail" && k === "register") ? "active" : ""}
              disabled={busy}
              key={k}
              onClick={() => navigate(k)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="pagehead">
          <h1>{sections[view][0]}</h1>
          <p>{sections[view][1]}</p>
        </div>
        {rpcError && (
          <div className="notice error" role="alert">
            {rpcError}{" "}
            <button className="back" onClick={() => retry(attempt + 1)}>
              Réessayer
            </button>
          </div>
        )}
        {notice && (
          <div
            className={"notice " + (notice.error ? "error" : "")}
            role={notice.error ? "alert" : "status"}
          >
            {notice.text}
            {notice.hash && <small className="hash">{notice.hash}</small>}
          </div>
        )}
        {view === "register" && (
          <Register
            registry={registry}
            revision={revision}
            open={open}
            busy={busy}
            refresh={() => (ready ? revise(revision + 1) : retry(attempt + 1))}
          />
        )}
        {view === "create" && (
          <CreateIssue
            account={ready && connected}
            busy={busy}
            transact={transact}
            open={open}
          />
        )}
        {view === "import" && (
          <ImportPanel
            registry={registry}
            account={ready && connected}
            isCity={isCity}
            transact={transact}
            busy={busy}
          />
        )}
        {view === "detail" && (
          <IssueDetail
            key={id}
            id={id}
            registry={registry}
            revision={revision}
            isCity={isCity}
            transact={transact}
            busy={busy}
            back={() => navigate("register")}
          />
        )}
        <footer>
          <span>M115 · Smart City & Blockchain</span>
          <span title={meta.address}>
            Contrat {shortAddress(meta.address)} · Chaîne {meta.chainId}
          </span>
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
