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

// Your wallet = owner + payer + authority
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

  // BurnV1 discriminator = 12, then None compression_proof (0x00)
  const data = Buffer.concat([Buffer.from([12]), Buffer.from([0])]);

  const keys = [
    { pubkey: asset,                   isSigner: false, isWritable: true  }, // asset
    { pubkey: MPL_CORE_PROGRAM_ID,     isSigner: false, isWritable: false }, // collection = none → placeholder
    { pubkey: payer.publicKey,         isSigner: true,  isWritable: true  }, // payer
    { pubkey: payer.publicKey,         isSigner: true,  isWritable: false }, // authority = owner
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    { pubkey: SPL_NOOP_PROGRAM_ID,     isSigner: false, isWritable: false }, // log_wrapper
  ];

  const ix = new TransactionInstruction({ keys, programId: MPL_CORE_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);

  console.log("\nBurning NFT (manual BurnV1, discriminator 12)...");
  const signature = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log(`✅ Burned! Signature: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}?cluster=devnet`);

  // Let RPC index the deletion
  await new Promise((r) => setTimeout(r, 3000));

  const balanceAfter = await connection.getBalance(payer.publicKey);
  const delta = balanceAfter - balanceBefore;

  console.log(`Wallet AFTER:     ${(balanceAfter / 1e9).toFixed(9)} SOL`);
  console.log(
    `Net change:       ${(delta / 1e9).toFixed(9)} SOL  (rent reclaimed − tx fee)`
  );

  const after = await connection.getAccountInfo(asset);
  if (after === null) {
    console.log("✅ Asset account no longer exists on-chain — burn confirmed");
  } else {
    console.log("⚠️ Asset still exists — RPC lag, check explorer in a few seconds");
  }
}

main().catch(console.error);