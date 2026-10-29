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

// Replace with your own secret key (e.g., from `solana-keygen`)
const secret = [62,233,93,177,248,73,193,168,209,68,48,14,77,237,242,176,56,100,159,85,177,1,140,27,90,230,153,237,20,228,254,244,189,90,229,84,25,30,118,69,70,111,208,144,10,17,37,24,18,125,144,58,140,43,34,57,208,53,23,49,52,186,146,30];
const tokenAuthority = Keypair.fromSecretKey(new Uint8Array(secret));
const receiver = Keypair.generate();
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
  // 1. Create the mint
  const balance = await connection.getBalance(tokenAuthority.publicKey);
  console.log(`Wallet: ${tokenAuthority.publicKey.toBase58()}`);
  console.log(`Balance: ${balance / 1e9} SOL`);
  if (balance < 0.01 * 1e9) {
    throw new Error("Insufficient SOL. Run: solana airdrop 2 <pubkey> --url devnet");
  }
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
      createMintToInstruction(mintKeypair.publicKey, receiverAta.address, tokenAuthority.publicKey, 1_000_000_000,[],TOKEN_PROGRAM_ID)
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
        receiverAta.address,      // source ATA
        destinationAta.address,   // destination ATA
        receiver.publicKey,       // owner (must sign)
        500_000_000,              // amount
        [],                       //   multiSigners   empty
        TOKEN_PROGRAM_ID          //  program ID
      )
    ),
    [tokenAuthority, receiver]
  );
  console.log(`Transferred to: ${destinationAta.address.toBase58()}`);
}

main().catch(console.error);