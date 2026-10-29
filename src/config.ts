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