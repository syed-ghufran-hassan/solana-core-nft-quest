import { create } from "@metaplex-foundation/mpl-core";
import { generateSigner } from "@metaplex-foundation/umi";
import { umi, wallet } from "../config";
import { writeFileSync } from "fs";

async function main() {
  // 1. Metadata JSON
  const metadata = {
    name: "Zee Tech Core NFT",
    description: "An NFT minted with Metaplex Core for the Solana assignment.",
    image:
      // Option A: public URL. Replace with your own image if you want.
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    // Option B (proper upload):
    //   const imgData = readFileSync("./assets/nft.png");
    //   const [imgUri] = await umi.uploader.upload([imgData]);
    //   image: imgUri,
    attributes: [
      { trait_type: "Course", value: "Solana NFT" },
      { trait_type: "Level", value: "Beginner" },
    ],
  };

  console.log("Uploading metadata to Arweave...");
  const uri = await umi.uploader.uploadJson(metadata);
  console.log(`✅ Metadata URI: ${uri}`);

  // 2. Mint the Core NFT
  const asset = generateSigner(umi);
  console.log("Minting Core NFT...");
  const { signature } = await create(umi, {
    asset,
    name: metadata.name,
    uri,
  }).sendAndConfirm(umi);

  console.log(`✅ Minted! Tx: ${signature}`);
  console.log(`📌 ASSET ADDRESS (save this for Tasks 3–5):`);
  console.log(asset.publicKey.toString());

  // Save it to a file for convenience
  writeFileSync("./asset-address.txt", asset.publicKey.toString());
  console.log("Saved to ./asset-address.txt");
}

main().catch(console.error);