const ARC_CHAIN = Object.freeze({
  idDecimal: 5042,
  idHex: "0x13b2",
  name: "Arc Mainnet",
  rpcUrl: "https://rpc.mainnet.arc.io",
  explorerUrl: "https://explorer.arc.io",
  currency: Object.freeze({ name: "USDC", symbol: "USDC", decimals: 18 }),
});

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d{1,18}))?$/;

const elements = {
  connectButton: document.querySelector("#connectButton"),
  createTab: document.querySelector("#createTab"),
  payTab: document.querySelector("#payTab"),
  createPanel: document.querySelector("#createPanel"),
  payPanel: document.querySelector("#payPanel"),
  requestForm: document.querySelector("#requestForm"),
  recipientInput: document.querySelector("#recipientInput"),
  amountInput: document.querySelector("#amountInput"),
  labelInput: document.querySelector("#labelInput"),
  formMessage: document.querySelector("#formMessage"),
  linkResult: document.querySelector("#linkResult"),
  linkOutput: document.querySelector("#linkOutput"),
  copyButton: document.querySelector("#copyButton"),
  emptyRequest: document.querySelector("#emptyRequest"),
  paymentCard: document.querySelector("#paymentCard"),
  paymentLabel: document.querySelector("#paymentLabel"),
  paymentAmount: document.querySelector("#paymentAmount"),
  paymentRecipient: document.querySelector("#paymentRecipient"),
  walletBalanceRow: document.querySelector("#walletBalanceRow"),
  walletBalance: document.querySelector("#walletBalance"),
  payButton: document.querySelector("#payButton"),
  paymentMessage: document.querySelector("#paymentMessage"),
  transactionLink: document.querySelector("#transactionLink"),
};

const state = {
  account: null,
  request: null,
  generatedUrl: null,
  busy: false,
};

function normalizeAmount(value) {
  const normalized = String(value).trim().replace(",", ".");
  const match = normalized.match(AMOUNT_PATTERN);

  if (!match) {
    throw new Error("Enter a positive USDC amount with no more than 18 decimals.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const units = BigInt(whole) * 10n ** 18n + BigInt((fraction + "0".repeat(18)).slice(0, 18));

  if (units <= 0n) {
    throw new Error("The payment amount must be greater than zero.");
  }

  return { display: normalized, units };
}

function validateRecipient(value) {
  const address = String(value).trim();

  if (!ADDRESS_PATTERN.test(address)) {
    throw new Error("Enter a valid 42-character EVM address beginning with 0x.");
  }

  if (address.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("Arc rejects value transfers to the zero address.");
  }

  return address;
}

function shortenAddress(address) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function formatBalance(value) {
  const units = BigInt(value);
  const whole = units / 10n ** 18n;
  const fraction = (units % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole.toLocaleString("en-US")}.${fraction} USDC`;
}

function setMessage(target, message = "", kind = "error") {
  target.textContent = message;
  target.classList.toggle("success", kind === "success");
}

function showMode(mode) {
  const isCreate = mode === "create";
  elements.createPanel.hidden = !isCreate;
  elements.payPanel.hidden = isCreate;
  elements.createTab.classList.toggle("is-active", isCreate);
  elements.payTab.classList.toggle("is-active", !isCreate);
  elements.createTab.setAttribute("aria-selected", String(isCreate));
  elements.payTab.setAttribute("aria-selected", String(!isCreate));
}

function buildPaymentUrl(request) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("to", request.recipient);
  url.searchParams.set("amount", request.amount);

  if (request.label) {
    url.searchParams.set("label", request.label);
  }

  return url.toString();
}

function readPaymentUrl() {
  const params = new URLSearchParams(window.location.search);
  const recipient = params.get("to");
  const amount = params.get("amount");

  if (!recipient && !amount) return null;

  try {
    const validRecipient = validateRecipient(recipient || "");
    const validAmount = normalizeAmount(amount || "");
    return {
      recipient: validRecipient,
      amount: validAmount.display,
      units: validAmount.units,
      label: (params.get("label") || "").slice(0, 64),
    };
  } catch (error) {
    setMessage(elements.paymentMessage, `This payment link is invalid: ${error.message}`);
    return null;
  }
}

function renderPaymentRequest(request) {
  state.request = request;
  elements.emptyRequest.hidden = true;
  elements.paymentCard.hidden = false;
  elements.paymentLabel.textContent = request.label || "Payment request";
  elements.paymentAmount.textContent = request.amount;
  elements.paymentRecipient.textContent = shortenAddress(request.recipient);
  elements.paymentRecipient.title = request.recipient;
  elements.transactionLink.hidden = true;
  setMessage(elements.paymentMessage);
  updateWalletUi();
}

async function switchToArc() {
  if (!window.ethereum) {
    throw new Error("No compatible browser wallet was found.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN.idHex }],
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: ARC_CHAIN.idHex,
          chainName: ARC_CHAIN.name,
          nativeCurrency: ARC_CHAIN.currency,
          rpcUrls: [ARC_CHAIN.rpcUrl],
          blockExplorerUrls: [ARC_CHAIN.explorerUrl],
        },
      ],
    });
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("Install an EVM browser wallet such as MetaMask to continue.");
  }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) throw new Error("No wallet account was selected.");

  await switchToArc();
  state.account = accounts[0];
  await updateWalletUi();
  return state.account;
}

async function updateWalletUi() {
  elements.connectButton.textContent = state.account ? shortenAddress(state.account) : "Connect wallet";

  if (!state.request) return;

  elements.payButton.textContent = state.account ? `Pay ${state.request.amount} USDC` : "Connect wallet to pay";

  if (!state.account || !window.ethereum) {
    elements.walletBalanceRow.hidden = true;
    return;
  }

  try {
    const balance = await window.ethereum.request({
      method: "eth_getBalance",
      params: [state.account, "latest"],
    });
    elements.walletBalance.textContent = formatBalance(balance);
    elements.walletBalanceRow.hidden = false;
  } catch {
    elements.walletBalanceRow.hidden = true;
  }
}

async function waitForReceipt(transactionHash, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const receipt = await window.ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    });

    if (receipt) return receipt;
    await new Promise((resolve) => window.setTimeout(resolve, 900));
  }

  return null;
}

async function sendPayment() {
  if (!state.request || state.busy) return;

  state.busy = true;
  elements.payButton.disabled = true;
  elements.transactionLink.hidden = true;
  setMessage(elements.paymentMessage);

  try {
    if (!state.account) await connectWallet();
    await switchToArc();

    elements.payButton.textContent = "Confirm in wallet…";
    const transactionHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: state.account,
          to: state.request.recipient,
          value: `0x${state.request.units.toString(16)}`,
        },
      ],
    });

    elements.transactionLink.href = `${ARC_CHAIN.explorerUrl}/tx/${transactionHash}`;
    elements.transactionLink.hidden = false;
    elements.payButton.textContent = "Waiting for finality…";
    setMessage(elements.paymentMessage, "Transaction submitted. Waiting for Arc finality…", "success");

    const receipt = await waitForReceipt(transactionHash);
    if (!receipt) {
      setMessage(
        elements.paymentMessage,
        "The transaction was submitted but confirmation timed out. Check Arc Explorer.",
        "success",
      );
    } else if (receipt.status === "0x1") {
      setMessage(elements.paymentMessage, "Payment confirmed on Arc.", "success");
      await updateWalletUi();
    } else {
      setMessage(elements.paymentMessage, "The transaction reverted. No payment was completed.");
    }
  } catch (error) {
    const rejected = error?.code === 4001;
    setMessage(
      elements.paymentMessage,
      rejected ? "The wallet request was cancelled." : error?.message || "The payment could not be submitted.",
    );
  } finally {
    state.busy = false;
    elements.payButton.disabled = false;
    updateWalletUi();
  }
}

elements.createTab.addEventListener("click", () => showMode("create"));
elements.payTab.addEventListener("click", () => showMode("pay"));

elements.requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setMessage(elements.formMessage);

  try {
    const recipient = validateRecipient(elements.recipientInput.value);
    const parsedAmount = normalizeAmount(elements.amountInput.value);
    const request = {
      recipient,
      amount: parsedAmount.display,
      units: parsedAmount.units,
      label: elements.labelInput.value.trim().slice(0, 64),
    };

    state.generatedUrl = buildPaymentUrl(request);
    elements.linkOutput.textContent = state.generatedUrl;
    elements.linkOutput.title = state.generatedUrl;
    elements.linkResult.hidden = false;
    renderPaymentRequest(request);
    setMessage(elements.formMessage, "Payment link ready. Review it before sharing.", "success");
  } catch (error) {
    elements.linkResult.hidden = true;
    setMessage(elements.formMessage, error.message);
  }
});

elements.copyButton.addEventListener("click", async () => {
  if (!state.generatedUrl) return;

  try {
    await navigator.clipboard.writeText(state.generatedUrl);
    elements.copyButton.textContent = "Copied";
    window.setTimeout(() => {
      elements.copyButton.textContent = "Copy link";
    }, 1800);
  } catch {
    setMessage(elements.formMessage, "Copying failed. Select the URL and copy it manually.");
  }
});

elements.connectButton.addEventListener("click", async () => {
  try {
    await connectWallet();
    setMessage(elements.paymentMessage);
  } catch (error) {
    setMessage(elements.paymentMessage, error?.message || "Wallet connection failed.");
  }
});

elements.payButton.addEventListener("click", sendPayment);

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    state.account = accounts?.[0] || null;
    await updateWalletUi();
  });

  window.ethereum.on("chainChanged", async () => {
    await updateWalletUi();
  });
}

const requestFromUrl = readPaymentUrl();
if (requestFromUrl) {
  renderPaymentRequest(requestFromUrl);
  showMode("pay");
}

updateWalletUi();
