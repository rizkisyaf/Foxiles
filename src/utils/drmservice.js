import CryptoJS from "crypto-js";

// Extract metadata and data from the file buffer
const extractMetadata = (fileBuffer) => {
  try {
    const metadataLengthBuffer = fileBuffer.slice(0, 4);
    const metadataLength = metadataLengthBuffer.readUInt32BE(0);

    const metadataBuffer = fileBuffer.slice(4, 4 + metadataLength);
    const dataBuffer = fileBuffer.slice(4 + metadataLength);

    const metadata = JSON.parse(metadataBuffer.toString("utf-8"));
    console.log("Extracted Metadata:", metadata);

    if (!metadata.encryptionKey || !metadata.iv) {
      console.error(
        "Missing encryption key or IV in metadata after extraction"
      );
      throw new Error("Missing encryption key or IV in metadata");
    }

    return { metadata, dataBuffer };
  } catch (error) {
    console.error("Error extracting metadata from file buffer:", error);
    throw new Error(
      "Failed to extract metadata, file format might be incorrect."
    );
  }
};

// Fetch encrypted file data from IPFS
export const fetchEncryptedFileData = async (fileCid) => {
  try {
    console.log(`Fetching file data for CID: ${fileCid}`); // Debugging log

    const response = await fetch(
      `https://foxiles.xyz/.netlify/functions/fetch-encrypted-file/${fileCid}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch encrypted file data. Status: ${response.status}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/octet-stream")) {
      console.warn(`Unexpected Content-Type from response: ${contentType}`);
      throw new Error("Unexpected response type, expecting binary data");
    }

    const fileBuffer = await response.arrayBuffer();
    const { metadata, dataBuffer } = extractMetadata(Buffer.from(fileBuffer));

    if (!metadata.encryptionKey || !metadata.iv) {
      console.error("Missing encryption key or IV in metadata");
      throw new Error("Missing encryption key or IV in metadata");
    }

    return { encryptedData: dataBuffer, metadata };
  } catch (error) {
    console.error("Error fetching encrypted file data:", error);
    throw error;
  }
};

// Decrypt the file with AES-256-CBC using CryptoJS
export const decryptFile = (encryptedData, encryptionKey, iv) => {
  console.log("Encryption Key:", encryptionKey);
  console.log("IV:", iv);

  if (!encryptionKey || !iv) {
    throw new Error("Encryption key or IV is missing.");
  }

  // Convert encryption key and IV from base64 to CryptoJS-compatible word arrays
  const key = CryptoJS.enc.Base64.parse(encryptionKey);
  const ivWordArray = CryptoJS.enc.Base64.parse(iv);

  // Convert the encrypted data to a word array
  const encryptedWordArray = CryptoJS.lib.WordArray.create(encryptedData);

  // Create CipherParams from the encrypted word array
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: encryptedWordArray,
  });

  // Decrypt using AES with CBC mode and PKCS7 padding
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv: ivWordArray,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // Convert the decrypted word array back to a Uint8Array
  const decryptedBytes = CryptoJS.enc.Base64.parse(
    decrypted.toString(CryptoJS.enc.Base64)
  );
  const decodedBuffer = new Uint8Array(
    decryptedBytes.words.flatMap((word) => [
      (word >>> 24) & 0xff,
      (word >>> 16) & 0xff,
      (word >>> 8) & 0xff,
      word & 0xff,
    ])
  );

  return decodedBuffer;
};
