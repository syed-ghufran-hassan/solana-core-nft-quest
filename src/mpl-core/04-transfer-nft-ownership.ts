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

const asset = new PublicKey(
  readFileSync("./asset-address.txt", "utf-8").trim()
);
const newOwner = new PublicKey(
  readFileSync("./recipient-pubkey.txt", "utf-8").trim()
);

async function main() {
  // Instruction data: discriminator 14 (Transfer) + None compression_proof (1 byte 0x00)
  const data = Buffer.concat([Buffer.from([14]), Buffer.from([0])]);

  // Accounts required by TransferV1 (see MPL Core program docs)
  const keys = [
    { pubkey: asset, isSigner: false, isWritable: true },           // asset
    { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false }, // collection (dummy when none)
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },  // payer
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // authority (current owner)
    { pubkey: newOwner, isSigner: false, isWritable: false },       // new_owner
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false }, // log_wrapper
  ];

  const ix = new TransactionInstruction({
    keys,
    programId: MPL_CORE_PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);

  console.log(`Transferring ${asset.toBase58()} → ${newOwner.toBase58()}...`);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log(`✅ Transferred! Signature: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}?cluster=devnet`);
}

main().catch(console.error);