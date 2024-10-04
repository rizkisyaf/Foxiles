import { BorshSchema, borshSerialize, borshDeserialize } from "borsher";

// Define the FileRegistration schema using Borsher
export const FileRegistrationSchema = BorshSchema.Struct({
  uploader: BorshSchema.Array(BorshSchema.u8, 32), // Uint8Array of 32 bytes for PublicKey
  file_name: BorshSchema.String,
  file_url: BorshSchema.String,
  description: BorshSchema.String,
  price: BorshSchema.u64, // 64-bit unsigned integer
  file_size: BorshSchema.u64, // 64-bit unsigned integer
  file_type: BorshSchema.String,
  encryption_key: BorshSchema.Array(BorshSchema.u8, 32), // Uint8Array of 32 bytes
});

// Define the FileRegistration class
export class FileRegistration {
  constructor({
    uploader,
    file_name,
    file_url,
    description,
    price,
    file_size,
    file_type,
    encryption_key,
  }) {
    this.uploader = uploader;
    this.file_name = file_name;
    this.file_url = file_url;
    this.description = description;
    this.price = price;
    this.file_size = file_size;
    this.file_type = file_type;
    this.encryption_key = encryption_key;
  }

  // Serialize the object using Borsher
  static serialize(fileRegistration) {
    return borshSerialize(FileRegistrationSchema, fileRegistration);
  }

  // Deserialize the object using Borsher
  static deserialize(buffer) {
    return borshDeserialize(FileRegistrationSchema, buffer);
  }

  // Function to calculate the size of file registration
  static size() {
    // Compute the size based on the schema
    return (
      32 + // uploader (Pubkey)
      4 +
      Buffer.byteLength(fileRegistration.file_name, "utf8") +
      4 +
      Buffer.byteLength(fileRegistration.file_url, "utf8") +
      4 +
      Buffer.byteLength(fileRegistration.description, "utf8") +
      8 + // price (u64)
      8 + // file_size (u64)
      4 +
      Buffer.byteLength(fileRegistration.file_type, "utf8") +
      32 // encryption_key (32 bytes)
    );
  }
}

/* eslint-disable no-undef */
// Create a FileRegistration object
const fileRegistration = new FileRegistration({
  uploader: new Uint8Array(32),
  file_name: "MyFile",
  file_url: "https://ipfs.io/ipfs/Qm...",
  description: "A test file",
  price: BigInt(1000),
  file_size: BigInt(500),
  file_type: "image/png",
  encryption_key: new Uint8Array(32),
});

// Serialize
export const serializedData = FileRegistration.serialize(fileRegistration);

// Deserialize
export const deserializedData = FileRegistration.deserialize(serializedData);

console.log(deserializedData);

const UpdateMetadataInstructionSchema = BorshSchema.Struct({
  instruction: BorshSchema.u8,
  description: BorshSchema.String,
  price: BorshSchema.u64,
});

class UpdateMetadataInstruction {
  constructor(properties) {
    Object.assign(this, properties);
  }
}
export { UpdateMetadataInstruction, UpdateMetadataInstructionSchema };
