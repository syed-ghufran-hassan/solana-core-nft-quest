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

// Your wallet (pays the fee, becomes new owner)
const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync("./keypair.json", "utf-8")))
);

// Recipient wallet (current owner — must sign as `authority`)
const recipient = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync("./wallets/recipient.json", "utf-8")))
);

const asset = new PublicKey(readFileSync("./asset-address.txt", "utf-8").trim());

async function main() {
  // discriminator 14 = Transfer, then 0x00 = None compression proof
  const data = Buffer.concat([Buffer.from([14]), Buffer.from([0])]);

  const keys = [
    { pubkey: asset,                       isSigner: false, isWritable: true  }, // asset
    { pubkey: MPL_CORE_PROGRAM_ID,         isSigner: false, isWritable: false }, // collection (none)
    { pubkey: payer.publicKey,             isSigner: true,  isWritable: true  }, // payer
    { pubkey: recipient.publicKey,         isSigner: true,  isWritable: false }, // authority = current owner
    { pubkey: payer.publicKey,             isSigner: false, isWritable: false }, // new_owner = you
    { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
    { pubkey: SPL_NOOP_PROGRAM_ID,         isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ keys, programId: MPL_CORE_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);

  console.log(`Transferring back ${asset.toBase58()} → ${payer.publicKey.toBase58()}...`);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer, recipient]);
  console.log(`✅ Transferred back! Signature: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}?cluster=devnet`);
}

main().catch(console.error);