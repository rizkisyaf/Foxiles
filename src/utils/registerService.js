// registerService.js
import { Connection, PublicKey } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";
import {
  FileRegistration,
  FileRegistrationSchema,
  UpdateMetadataInstruction,
  UpdateMetadataInstructionSchema,
} from "./types";
import { serialize } from "borsh";
import { borshSerialize } from "borsher";

// Validates the input data
export const validateInput = (cid, fileName, description, price, fileType) => {
  if (!cid || !fileName || !description || !price || !fileType) {
    throw new Error(
      "Missing required data (cid, fileName, description, price, or file type)"
    );
  }
};

// Creates a Solana connection
export const getConnection = async (provider) => {
  const connectionConfig = await provider.request({
    method: "solana_provider_config",
    params: [],
  });
  return new Connection(connectionConfig.rpcTarget);
};

// Prepare instruction data
/* eslint-disable no-undef */
export const prepareInstructionData = (
  fileName,
  cid,
  description,
  priceInLamports,
  fileSizeMB,
  fileType,
  encryptionKey
) => {
  return Buffer.concat([
    Buffer.from(new Uint8Array([1])), // 'register_file' instruction
    Buffer.from(new BN(fileName.length).toArray("le", 4)),
    Buffer.from(fileName),
    Buffer.from(new BN(cid.length).toArray("le", 4)),
    Buffer.from(cid),
    Buffer.from(new BN(description.length).toArray("le", 4)),
    Buffer.from(description),
    Buffer.from(new BN(priceInLamports).toArray("le", 8)),
    Buffer.from(new BN(fileSizeMB).toArray("le", 8)),
    Buffer.from(new BN(fileType.length).toArray("le", 4)),
    Buffer.from(fileType),
    Buffer.from(encryptionKey, "base64"),
  ]);
};

export const prepareUpdateMetadataInstructionData = (
  description,
  price
) => {
  const instruction = new UpdateMetadataInstruction({
    instruction: 4,
    description: description,
    price: BigInt(price), // Ensure price is a BigInt
  });

  const data = borshSerialize(UpdateMetadataInstructionSchema, instruction);
  return Buffer.from(data);
};
