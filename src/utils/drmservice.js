import crypto from "crypto";

// Extract metadata and data from the file buffer
const extractMetadata = (fileBuffer) => {
  const metadataLengthBuffer = fileBuffer.slice(0, 4);
  const metadataLength = metadataLengthBuffer.readUInt32BE(0);

  const metadataBuffer = fileBuffer.slice(4, 4 + metadataLength);
  const dataBuffer = fileBuffer.slice(4 + metadataLength);

  const metadata = JSON.parse(metadataBuffer.toString("utf-8"));

  return { metadata, dataBuffer };
};

// Fetch encrypted file data from IPFS
export const fetchEncryptedFileData = async (fileCid) => {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_GATEWAY_URL}/${fileCid}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch encrypted file data from IPFS");
    }

    const fileBuffer = await response.arrayBuffer();
    const { metadata, dataBuffer } = extractMetadata(Buffer.from(fileBuffer));

    return { encryptedData: dataBuffer, metadata };
  } catch (error) {
    console.error("Error fetching encrypted file data:", error);
    throw error;
  }
};

// Decrypt the file with AES-256-CBC
export const decryptFile = (encryptedData, encryptionKey, iv) => {
    const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, iv);
  
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return decrypted;
  };