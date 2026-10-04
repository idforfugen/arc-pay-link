export const ARC_CHAIN = Object.freeze({
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
const MAX_UINT256 = (1n << 256n) - 1n;

export function isArcChainId(value) {
  try {
    return BigInt(value) === BigInt(ARC_CHAIN.idDecimal);
  } catch {
    return false;
  }
}

export function normalizeAmount(value) {
  const normalized = String(value).trim();

  if (normalized.includes(",")) {
    throw new Error("Use a dot as the decimal separator; commas are rejected to avoid ambiguity.");
  }

  const match = normalized.match(AMOUNT_PATTERN);

  if (!match) {
    throw new Error("Enter a positive USDC amount with no more than 18 decimals.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const units = BigInt(whole) * 10n ** 18n + BigInt((fraction + "0".repeat(18)).slice(0, 18));

  if (units <= 0n) {
    throw new Error("The payment amount must be greater than zero.");
  }

  if (units > MAX_UINT256) {
    throw new Error("The payment amount exceeds the EVM transaction limit.");
  }

  return { display: normalized, units };
}

export function validateRecipient(value) {
  const address = String(value).trim();

  if (!ADDRESS_PATTERN.test(address)) {
    throw new Error("Enter a valid 42-character EVM address beginning with 0x.");
  }

  if (address.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("Arc rejects value transfers to the zero address.");
  }

  return address;
}

export function formatBalance(value) {
  const units = BigInt(value);
  const whole = units / 10n ** 18n;
  const fraction = (units % 10n ** 18n).toString().padStart(18, "0").slice(0, 4);
  return `${whole.toLocaleString("en-US")}.${fraction} USDC`;
}

export function buildPaymentUrl(baseUrl, request) {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("to", validateRecipient(request.recipient));
  url.searchParams.set("amount", normalizeAmount(request.amount).display);

  const label = String(request.label || "").trim().slice(0, 64);
  if (label) url.searchParams.set("label", label);

  return url.toString();
}

export function parsePaymentUrl(urlValue) {
  const url = new URL(urlValue);
  const recipient = url.searchParams.get("to");
  const amount = url.searchParams.get("amount");

  if (!recipient && !amount) return null;

  const validRecipient = validateRecipient(recipient || "");
  const validAmount = normalizeAmount(amount || "");

  return {
    recipient: validRecipient,
    amount: validAmount.display,
    units: validAmount.units,
    label: (url.searchParams.get("label") || "").slice(0, 64),
  };
}
