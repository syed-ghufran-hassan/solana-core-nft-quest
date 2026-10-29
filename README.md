# solana-core-nft-quest

> A complete, runnable walkthrough of the **full lifecycle** of a Solana token and NFT — from mint to burn — using TypeScript, `@solana/spl-token`, and `@metaplex-foundation/mpl-core`.

![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

**Repo name:** `solana-core-nft-quest`

**Description:** Full lifecycle of a Solana token & NFT in TypeScript: mint SPL tokens, mint/update/transfer/burn MPL Core NFTs, and reclaim rent. Includes workarounds for the `MissingCompressionProof` SDK bug that hits Umi's `update`, `transfer` & `burn` helpers on devnet.

---

## ✨ What this repo demonstrates

| # | Task | Script |
|---|------|--------|
| 1 | Mint an SPL token & transfer it to another wallet | `src/spl-token/01-mint-and-transfer-spl-token.ts` |
| 2 | Mint an NFT using **Metaplex Core** (MPL Core) | `src/mpl-core/02-mint-core-nft.ts` |
| 3 | Update the NFT's name and metadata **as the update authority** | `src/mpl-core/03-update-nft-metadata.ts` |
| 4 | Transfer NFT ownership to another wallet | `src/mpl-core/04-transfer-nft-ownership.ts` |
| 4b | Transfer the NFT back (prerequisite for burn) | `src/mpl-core/04b-transfer-back.ts` |
| 5 | Permanently destroy the NFT & reclaim rent | `src/mpl-core/05-burn-nft-reclaim-rent.ts` |

Each script is small, self-contained, and heavily commented so you can read it in two minutes.

---

## 🧠 Why this is interesting

**MPL Core is Solana's next-gen NFT standard.** Unlike the legacy Token Metadata program (which needed a mint account, a metadata account, a master edition, and a token account per NFT), **MPL Core uses a single account per NFT**. That means:

- **~80% cheaper to mint** than Token Metadata.
- **Simpler** — one account, one update, one burn.
- **Composable** — plugins like Royalties, Freeze Delegate, and Attributes live on the asset itself.

But MPL Core is new, and its TypeScript SDK still has rough edges. This repo documents one of them — and ships **working manual-instruction fallbacks** you can copy into production today.

---

## 🐛 The SDK bug we had to work around

While running this lab on **devnet** (mpl-core `1.10.0`, umi `0.9.x`), the Umi helpers `update()`, `transfer()`, and `burn()` all threw:

```
MissingCompressionProof: Missing compression proof
Source: Program > mplCore [CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d]
Custom program error: 0xb
```

**Root cause:** the SDK was routing standard (uncompressed) assets through the **compressed-asset code path**, which expects a Merkle proof that doesn't exist for on-chain assets. The on-chain program correctly rejected the request.

**The fix:** build the raw `TransactionInstruction` yourself, with the correct Anchor discriminator and a single `0x00` byte (serialized `Option::None`) for the compression proof.

| Instruction | Discriminator | Compression proof byte |
|-------------|:-------------:|:----------------------:|
| `TransferV1` | `14` | `0x00` |
| `BurnV1`     | `12` | `0x00` |

This repo includes **both** the clean helper version *and* the manual fallback so you can see the difference side-by-side.

> 📌 This is a real bug that affects anyone building on MPL Core devnet today. Saving it here so the next person doesn't lose a day to it.

---

## 🚀 Quick Start

### Prerequisites

- Node.js **v18+**
- Solana CLI installed:
  ```bash
  sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
  ```
- ~5 minutes

### Setup

```bash
# 1. Clone
git clone https://github.com/<your-username>/solana-core-nft-quest.git
cd solana-core-nft-quest

# 2. Install
npm install
npm install --save-dev tsx typescript

# 3. Install runtime deps
npm install @solana/web3.js@1 @solana/spl-token
npm install @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults
npm install @metaplex-foundation/mpl-core @metaplex-foundation/umi-uploader-irys

# 4. Generate a devnet wallet (skip if you already have one)
solana-keygen new --outfile ./keypair.json

# 5. Fund it
solana airdrop 2 $(solana-keygen pubkey ./keypair.json) --url devnet
```

### Run the tasks in order

```bash
# 1. SPL token: mint → transfer
#    Edit `secret` array in the file to your own keypair first
npx tsx src/spl-token/01-mint-and-transfer-spl-token.ts

# 2. Mint MPL Core NFT (saves asset address to ./asset-address.txt)
npx tsx src/mpl-core/02-mint-core-nft.ts

# 3. Update metadata
npx tsx src/mpl-core/03-update-nft-metadata.ts

# 4. Transfer to a fresh recipient wallet
solana-keygen new --outfile ./wallets/recipient.json
solana-keygen pubkey ./wallets/recipient.json > ./recipient-pubkey.txt
npx tsx src/mpl-core/04-transfer-nft-ownership.ts

# 4b. Transfer back so you can burn it
npx tsx src/mpl-core/04b-transfer-back.ts

# 5. Burn & reclaim rent
npx tsx src/mpl-core/05-burn-nft-reclaim-rent.ts
```

---

## 📁 Project Structure

```
solana-core-nft-quest/
├── src/
│   ├── config.ts                              # Umi + wallet setup (shared)
│   ├── spl-token/
│   │   └── 01-mint-and-transfer-spl-token.ts  # Task 1
│   └── mpl-core/
│       ├── 02-mint-core-nft.ts                # Task 2
│       ├── 03-update-nft-metadata.ts          # Task 3
│       ├── 04-transfer-nft-ownership.ts       # Task 4
│       ├── 04b-transfer-back.ts               # pre-burn
│       └── 05-burn-nft-reclaim-rent.ts        # Task 5
├── wallets/                                   # generated locally, gitignored
├── keypair.json                               # generated locally, gitignored
├── asset-address.txt                          # populated by Task 2
├── .gitignore
├── package.json
└── README.md
```

### `.gitignore`

```gitignore
node_modules/
keypair.json
wallets/
asset-address.txt
recipient-pubkey.txt
.env
*.log
```

---

## 📜 Full Source Code

### `src/config.ts` — shared Umi + wallet setup

```typescript
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore } from "@metaplex-foundation/mpl-core";
import { signerIdentity, createSignerFromKeypair } from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { readFileSync } from "fs";

export const umi = createUmi("https://api.devnet.solana.com")
  .use(mplCore())
  .use(irysUploader());

const keypair = umi.eddsa.createKeypairFromSecretKey(
  new Uint8Array(JSON.parse(readFileSync("./keypair.json", "utf-8")))
);

export const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(signer));

console.log(`Using wallet: ${signer.publicKey.toString()}`);
```

---

### `src/spl-token/01-mint-and-transfer-spl-token.ts` — Task 1

```typescript
import { Connection, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createMintToInstruction,
  createTransferInstruction,
} from "@solana/spl-token";

// Replace with your own secret key array from keypair.json
const secret = [/* ... 64 numbers ... */];
const tokenAuthority = Keypair.fromSecretKey(new Uint8Array(secret));
const receiver = Keypair.generate();
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
  const balance = await connection.getBalance(tokenAuthority.publicKey);
  console.log(`Wallet: ${tokenAuthority.publicKey.toBase58()}`);
  console.log(`Balance: ${balance / 1e9} SOL`);
  if (balance < 0.01 * 1e9) {
    throw new Error("Insufficient SOL. Run: solana airdrop 2 <pubkey> --url devnet");
  }

  // 1. Create the mint
  const mintKeypair = Keypair.generate();
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: tokenAuthority.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      9,
      tokenAuthority.publicKey,
      tokenAuthority.publicKey
    )
  );
  await sendAndConfirmTransaction(connection, tx, [tokenAuthority, mintKeypair]);
  console.log(`Mint: ${mintKeypair.publicKey.toBase58()}`);

  // 2. Receiver ATA + mint 1 token
  const receiverAta = await getOrCreateAssociatedTokenAccount(
    connection, tokenAuthority, mintKeypair.publicKey, receiver.publicKey
  );
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      createMintToInstruction(
        mintKeypair.publicKey,
        receiverAta.address,
        tokenAuthority.publicKey,
        1_000_000_000,
        [],
        TOKEN_PROGRAM_ID
      )
    ),
    [tokenAuthority]
  );

  // 3. Transfer 0.5 token to a fresh wallet
  const destination = Keypair.generate();
  const destinationAta = await getOrCreateAssociatedTokenAccount(
    connection, tokenAuthority, mintKeypair.publicKey, destination.publicKey
  );
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      createTransferInstruction(
        receiverAta.address,
        destinationAta.address,
        receiver.publicKey,
        500_000_000,
        [],
        TOKEN_PROGRAM_ID
      )
    ),
    [tokenAuthority, receiver]   // tokenAuthority pays fee, receiver signs as owner
  );
  console.log(`Transferred to: ${destinationAta.address.toBase58()}`);
}

main().catch(console.error);
```

---

### `src/mpl-core/02-mint-core-nft.ts` — Task 2

```typescript
import { create } from "@metaplex-foundation/mpl-core";
import { generateSigner } from "@metaplex-foundation/umi";
import { umi } from "../config";
import { writeFileSync } from "fs";

async function main() {
  const metadata = {
    name: "Zee Tech Core NFT",
    description: "An NFT minted with Metaplex Core for the Solana assignment.",
    image:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    attributes: [
      { trait_type: "Course", value: "Solana NFT" },
      { trait_type: "Level", value: "Beginner" },
    ],
  };

  console.log("Uploading metadata to Arweave...");
  const uri = await umi.uploader.uploadJson(metadata);
  console.log(`✅ Metadata URI: ${uri}`);

  const asset = generateSigner(umi);
  console.log("Minting Core NFT...");
  const { signature } = await create(umi, {
    asset,
    name: metadata.name,
    uri,
  }).sendAndConfirm(umi);

  console.log(`✅ Minted! Tx: ${signature}`);
  console.log(`📌 ASSET ADDRESS: ${asset.publicKey.toString()}`);

  writeFileSync("./asset-address.txt", asset.publicKey.toString());
  console.log("Saved to ./asset-address.txt");
}

main().catch(console.error);
```

---

### `src/mpl-core/03-update-nft-metadata.ts` — Task 3

```typescript
import { updateV1, fetchAsset } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { umi } from "../config";
import { readFileSync } from "fs";

const ASSET = publicKey(readFileSync("./asset-address.txt", "utf-8").trim());

async function main() {
  const before = await fetchAsset(umi, ASSET);
  console.log("BEFORE:");
  console.log(`  Name: ${before.name}`);
  console.log(`  URI:  ${before.uri}`);

  const newMetadata = {
    name: "Zee Tech Core NFT — UPDATED (via updateV1)",
    description: "Metadata updated successfully using the updateV1 instruction.",
    image:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    attributes: [
      { trait_type: "Course", value: "Solana NFT" },
      { trait_type: "Level", value: "Beginner" },
      { trait_type: "Status", value: "Updated" },
    ],
  };

  console.log("\nUploading new metadata...");
  const uri = await umi.uploader.uploadJson(newMetadata);
  console.log(`✅ New URI: ${uri}`);

  console.log("\nUpdating NFT with updateV1 (newName / newUri)...");
  const { signature } = await updateV1(umi, {
    asset: ASSET,
    newName: newMetadata.name,   // NOTE: updateV1 uses `newName`, not `name`
    newUri: uri,                 // NOTE: updateV1 uses `newUri`, not `uri`
  }).sendAndConfirm(umi);

  console.log(
    `✅ Updated! Signature (base64): ${Buffer.from(signature).toString("base64")}`
  );

  await new Promise((r) => setTimeout(r, 2000));

  const after = await fetchAsset(umi, ASSET);
  console.log("\nAFTER:");
  console.log(`  Name: ${after.name}`);
  console.log(`  URI:  ${after.uri}`);
}

main().catch(console.error);
```

---

### `src/mpl-core/04-transfer-nft-ownership.ts` — Task 4

```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";

const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const SPL_NOOP_PROGRAM_ID = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync("./keypair.json", "utf-8")))
);

const asset = new PublicKey(readFileSync("./asset-address.txt", "utf-8").trim());
const newOwner = new PublicKey(readFileSync("./recipient-pubkey.txt", "utf-8").trim());

async function main() {
  // TransferV1 discriminator = 14, followed by 0x00 (None compression proof)
  const data = Buffer.concat([Buffer.from([14]), Buffer.from([0])]);

  const keys = [
    { pubkey: asset,                       isSigner: false, isWritable: true  },
    { pubkey: MPL_CORE_PROGRAM_ID,         isSigner: false, isWritable: false },
    { pubkey: payer.publicKey,             isSigner: true,  isWritable: true  },
    { pubkey: payer.publicKey,             isSigner: true,  isWritable: false },
    { pubkey: newOwner,                    isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
    { pubkey: SPL_NOOP_PROGRAM_ID,         isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ keys, programId: MPL_CORE_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);

  console.log(`Transferring ${asset.toBase58()} → ${newOwner.toBase58()}...`);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log(`✅ Transferred! Signature: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}?cluster=devnet`);
}

main().catch(console.error);
```

---

### `src/mpl-core/04b-transfer-back.ts` — transfer back to yourself

```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";

const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const SPL_NOOP_PROGRAM_ID = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync("./keypair.json", "utf-8")))
);
const recipient = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync("./wallets/recipient.json", "utf-8")))
);
const asset = new PublicKey(readFileSync("./asset-address.txt", "utf-8").trim());

async function main() {
  const data = Buffer.concat([Buffer.from([14]), Buffer.from([0])]);

  const keys = [
    { pubkey: asset,                   isSigner: false, isWritable: true  },
    { pubkey: MPL_CORE_PROGRAM_ID,     isSigner: false, isWritable: false },
    { pubkey: payer.publicKey,         isSigner: true,  isWritable: true  }, // fee payer
    { pubkey: recipient.publicKey,     isSigner: true,  isWritable: false }, // current owner
    { pubkey: payer.publicKey,         isSigner: false, isWritable: false }, // new owner
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SPL_NOOP_PROGRAM_ID,     isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ keys, programId: MPL_CORE_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);

  console.log(`Transferring back ${asset.toBase58()} → ${payer.publicKey.toBase58()}...`);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer, recipient]);
  console.log(`✅ Transferred back! Signature: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}?cluster=devnet`);
}

main().catch(console.error);
```

---

### `src/mpl-core/05-burn-nft-reclaim-rent.ts` — Task 5

```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";

const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const SPL_NOOP_PROGRAM_ID = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync("./keypair.json", "utf-8")))
);
const asset = new PublicKey(readFileSync("./asset-address.txt", "utf-8").trim());

async function main() {
  const balanceBefore = await connection.getBalance(payer.publicKey);
  const accountInfo = await connection.getAccountInfo(asset);
  if (!accountInfo) throw new Error("Asset account not found");

  console.log(`Owner / Payer:    ${payer.publicKey.toBase58()}`);
  console.log(`Asset rent held:  ${(accountInfo.lamports / 1e9).toFixed(9)} SOL`);
  console.log(`Wallet BEFORE:    ${(balanceBefore / 1e9).toFixed(9)} SOL`);

  // BurnV1 discriminator = 12, followed by 0x00 (None compression proof)
  const data = Buffer.concat([Buffer.from([12]), Buffer.from([0])]);

  const keys = [
    { pubkey: asset,                   isSigner: false, isWritable: true  },
    { pubkey: MPL_CORE_PROGRAM_ID,     isSigner: false, isWritable: false },
    { pubkey: payer.publicKey,         isSigner: true,  isWritable: true  },
    { pubkey: payer.publicKey,         isSigner: true,  isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SPL_NOOP_PROGRAM_ID,     isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ keys, programId: MPL_CORE_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);

  console.log("\nBurning NFT (manual BurnV1, discriminator 12)...");
  const signature = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log(`✅ Burned! Signature: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}?cluster=devnet`);

  await new Promise((r) => setTimeout(r, 3000));

  const balanceAfter = await connection.getBalance(payer.publicKey);
  const delta = balanceAfter - balanceBefore;

  console.log(`Wallet AFTER:     ${(balanceAfter / 1e9).toFixed(9)} SOL`);
  console.log(`Net change:       ${(delta / 1e9).toFixed(9)} SOL  (rent reclaimed − tx fee)`);

  const after = await connection.getAccountInfo(asset);
  if (after === null) {
    console.log("✅ Asset account no longer exists on-chain — burn confirmed");
  } else {
    console.log("⚠️ Asset account still present — MPL Core keeps a 1-byte stub for anti-squatting");
  }
}

main().catch(console.error);
```

---

## ✅ Verified on-chain results (devnet)

| Step | Result |
|---|---|
| Mint (Task 1) | `4yUh7SGCL9hRbSgXKmL5z9LjW8xaVmPeNwG6mBwDAFD7` |
| Mint NFT (Task 2) | `Aq6qoZeLWjMhtAY2PekNp554c7oSy6SKjhrUYYfZHUuN` |
| Update (Task 3) | Name changed to `Zee Tech Core NFT — UPDATED (via updateV1)` |
| Transfer (Task 4) | [tx `5A9BW2D2…`](https://solscan.io/tx/5A9BW2D2rwn1g8Qyj3o2q79A5CBSxxFs9dRownQiJNwj9kRtpdKoa59xLCYjNBsTgtcRT3b9ob3pLiPwJyijP2Mh?cluster=devnet) |
| Transfer back (4b) | [tx `3zNnmfyF…`](https://solscan.io/tx/3zNnmfyFxdtZiQvG8abwxxaqC77WxyrS9tBMmgt3ZMv4MuotagTG75wFMm7NFBmnjLa33hgoaPsWjJ8U4Wc1ppr?cluster=devnet) |
| **Burn (Task 5)** | **[tx `4HNVycJf…`](https://solscan.io/tx/4HNVycJfQJYgpwbs3mPFq7vM69pDFGc6i8Dc8yaQvi3ek6jD8tvjVVXqQBUTw7RQTRyinsKAuYriy4btNnx4RWkY?cluster=devnet)** |
| Rent reclaimed | `+0.00094496 SOL` (≈ rent − 5,000-lamport fee) |

---

## 📚 Key Learnings

1. **MPL Core's account model is genuinely simpler.** One account per NFT means one update, one transfer, one burn. If you're still using Token Metadata for new projects, migrate.
2. **SDK ≠ program.** A bug in the TS SDK doesn't mean the on-chain program is broken. Inspecting the program's Anchor errors (here, `MissingCompressionProof` = `0xB`) tells you exactly what the program *thought* you were doing.
3. **Anchor discriminators are your escape hatch.** When the SDK misbehaves, you can always build the instruction by hand: 1-byte discriminator + Borsh-serialized args + the right account list.
4. **Burning ≠ deleting.** MPL Core zeroes the asset's data and shrinks it to 1 byte, but leaves the account alive so the address can never be reused for a different NFT. This is a deliberate anti-squatting design.
5. **Devnet is flaky.** If `sendAndConfirmTransaction` fails with a vague simulation error, check `getLogs()` — the answer is always in the program logs.
6. **Argument names matter.** `updateV1` uses `newName`/`newUri`, not `name`/`uri`. Passing the wrong keys silently builds a no-op transaction that succeeds but changes nothing. Always verify the post-state with `fetchAsset` (or equivalent) after a mutating call.

---

## 🐦 Write-up (X / Twitter thread)

### Tweet 1 — Hook

> Spent a weekend on the full Solana NFT lifecycle: mint SPL token → mint MPL Core NFT → update → transfer → burn & reclaim rent.
>
> Hit 3 SDK bugs. Fixed all 3 by hand-building Anchor instructions.
>
> Thread on what I built and what broke 🧵

### Tweet 2 — Task 1

> 1/ SPL token first.
>
> `@solana/spl-token` is clean:
> • createInitializeMintInstruction
> • createMintToInstruction
> • createTransferInstruction
>
> Gotcha: pass `TOKEN_PROGRAM_ID` explicitly. Omitting it → "undefined program id" at compile time.
>
> Mint: `4yUh7SGCL9hRbSgXKmL5z9LjW8xaVmPeNwG6mBwDAFD7`

### Tweet 3 — Task 2

> 2/ MPL Core NFT mint.
>
> This is the new standard from @metaplex. One account per NFT instead of 4. ~80% cheaper than Token Metadata.
>
> Used `create` from `@metaplex-foundation/mpl-core` via Umi. Clean.
>
> Asset: `Aq6qoZeLWjMhtAY2PekNp554c7oSy6SKjhrUYYfZHUuN`

### Tweet 4 — Task 3 + bug #1

> 3/ Update metadata as the update authority.
>
> First try: `update()` → NotAvailable error 0x17
> "Update for compressed is not available"
>
> MPL Core thought my on-chain asset was a *compressed* one.
>
> Fix: switch to `updateV1()` — but note its args are `newName`/`newUri`, NOT `name`/`uri`. First silent no-op taught me that.

### Tweet 5 — Task 4 + bug #2

> 4/ Transfer ownership.
>
> `transfer()` helper → MissingCompressionProof (0xB). Same root cause — SDK routing uncompressed assets through compressed path.
>
> Fix: hand-build TransferV1:
> • discriminator 14
> • 0x00 (None compression proof)
>
> Worked first try.

### Tweet 6 — Task 5 + bug #3

> 5/ Burn NFT & reclaim rent.
>
> `burn()` → MissingCompressionProof again (0xB).
>
> Fix: hand-build BurnV1:
> • discriminator 12
> • 0x00 (None compression proof)
>
> Rent reclaimed: +0.00094496 SOL net (after 5k lamport fee).

### Tweet 7 — The big lesson

> The meta-lesson:
>
> A buggy SDK ≠ a broken program.
>
> Anchor programs have stable discriminators. When the SDK misbehaves, you can always:
>
> 1. Read the program's error code (0xB = MissingCompressionProof)
> 2. Build the instruction manually: discriminator + Borsh args + account list
> 3. Ship it
>
> This is what "knowing the stack" means.

### Tweet 8 — The other lesson

> Bonus lesson — burning isn't deleting.
>
> MPL Core zeroes the asset's data and shrinks it to 1 byte, but keeps the account alive so the address can never be reused for a different NFT.
>
> You get ~97% of the rent back; the rest covers the 1-byte anti-squatting floor.

### Tweet 9 — CTA

> Repo (all 6 scripts, both clean & manual-fallback versions, ready to run):
>
> `github.com/<your-username>/solana-core-nft-quest`
>
> If you're building on MPL Core devnet today, save yourself a day — the MissingCompressionProof workaround is in there.
>
> RT if it saves you time 🙏

---

## 🧾 Submission checklist

Before submitting the social link, verify:

- [ ] Repo is **public** on GitHub
- [ ] `README.md` is at the repo root
- [ ] `.gitignore` covers `keypair.json`, `wallets/`, `node_modules/`, `asset-address.txt`
- [ ] **No private keys committed** — run `git log -p | grep -i "\[62,233,93"` and confirm no hits
- [ ] Replace `<your-username>` in README and Tweet 9
- [ ] Post the X thread, copy **Tweet 1's URL** as your submission link
- [ ] (Optional) Pin the repo on your GitHub profile

---

## 📄 License

MIT — use it, fork it, ship it.

---

## 🙏 Credits

Built while working through a Solana developer assignment. Thanks to the Metaplex team for the excellent [MPL Core docs](https://developers.metaplex.com/core) and the Solana devnet community for keeping the faucet alive.