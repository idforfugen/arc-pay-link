# ArcPay Link

ArcPay Link is a minimal, non-custodial payment-link app for native USDC on
[Arc](https://www.arc.io/). A recipient enters an Arc address and an amount,
shares the generated URL, and the payer signs a direct native-USDC transfer in
their own EVM wallet.

The app has no backend, no payment contract, no account system, and no access
to private keys.

## Why Arc

Arc uses USDC as its native gas token and provides sub-second deterministic
finality. That makes a small payment request easier to understand: the amount,
balance, and network fee are all denominated in USDC.

ArcPay Link handles Arc's native-USDC behavior explicitly:

- Arc mainnet chain ID: `5042` (`0x13b2`)
- Primary RPC: `https://rpc.mainnet.arc.io`
- Explorer: `https://explorer.arc.io`
- Native USDC transfers use 18 decimal places
- Transfers to the zero address are rejected before the wallet is opened

The canonical reference is the [Arc documentation](https://docs.arc.io/arc/references/rpc-endpoints).

## Features

- Generate a shareable payment URL from an address, amount, and optional label
- Validate EVM addresses and Arc-native USDC amounts locally
- Add or switch to Arc mainnet through the connected EVM wallet
- Display the connected wallet's native USDC balance
- Submit a direct native-USDC transfer without custody or an intermediary contract
- Poll for the transaction receipt and link to Arc Explorer
- Responsive static interface with no build step

## Run locally

Serve the directory over HTTP; browser wallets usually do not inject providers
into `file://` pages.

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Deploy

Because this is a static app, it can be deployed with GitHub Pages, Cloudflare
Pages, Netlify, or Vercel. The deployment must preserve query parameters so that
shared payment links continue to work.

## Suggested Arc Microgrants submission copy

**One-line description**

> ArcPay Link turns an Arc address and USDC amount into a shareable,
> non-custodial payment request that settles directly in the payer's wallet.

**What it uses Arc for**

> ArcPay Link uses Arc's native USDC model to make lightweight payment requests
> with a single asset for value and gas. It configures Arc mainnet in an EVM
> wallet, reads native USDC balances with `eth_getBalance`, submits a native
> value transfer with `eth_sendTransaction`, and verifies finality from the
> transaction receipt. The app explicitly supports Arc's 18-decimal native
> representation and rejects zero-address transfers before a wallet prompt.

## Security and privacy

- Never enter a private key or seed phrase into this app.
- The payer must review and approve every transaction in their wallet.
- Payment details are encoded in the URL. Do not put private information in the
  optional label.
- Keep enough USDC in the payer wallet to cover Arc network fees.
- Verify the recipient address before sharing or paying a request.

## License

MIT
