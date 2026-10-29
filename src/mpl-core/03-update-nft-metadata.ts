import { updateV1, fetchAsset } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { umi, signer } from "../config";
import { readFileSync } from "fs";

const ASSET = publicKey(
  readFileSync("./asset-address.txt", "utf-8").trim()
);

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
    newName: newMetadata.name,   // ✅ was `name`
    newUri: uri,                 // ✅ was `uri`
  }).sendAndConfirm(umi);

  console.log(
    `✅ Updated! Signature (base64): ${Buffer.from(signature).toString("base64")}`
  );

  // Small delay to let the RPC index the new account state
  await new Promise((r) => setTimeout(r, 2000));

  const after = await fetchAsset(umi, ASSET);
  console.log("\nAFTER:");
  console.log(`  Name: ${after.name}`);
  console.log(`  URI:  ${after.uri}`);
}

main().catch(console.error);