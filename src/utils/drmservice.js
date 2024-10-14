import CryptoJS from "crypto-js";

// Extract metadata and data from the file buffer (for encrypted files)
const extractMetadata = (fileBuffer) => {
  try {
    if (fileBuffer.length < 4) {
      throw new Error("File buffer too short, cannot read metadata length.");
    }

    // Get the first 4 bytes as metadata length
    const metadataLengthBuffer = fileBuffer.slice(0, 4);
    let metadataLength = metadataLengthBuffer.readUInt32BE(0);

    // Add a sanity check for metadata length
    if (metadataLength > fileBuffer.length || metadataLength < 0) {
      console.warn("Invalid metadata length detected, attempting fallback.");
      metadataLength = metadataLengthBuffer.readUInt32LE(0);
    }

    // Further fallback to skip metadata if the length seems wrong
    if (metadataLength > fileBuffer.length || metadataLength < 0) {
      throw new Error("Metadata length still invalid after fallback attempts.");
    }

    const metadataBuffer = fileBuffer.slice(4, 4 + metadataLength);
    const dataBuffer = fileBuffer.slice(4 + metadataLength);

    console.log("Raw metadata buffer:", metadataBuffer);

    const metadata = JSON.parse(metadataBuffer.toString("utf-8"));
    console.log("Extracted Metadata:", metadata);

    if (
      !metadata.encryptionKey ||
      typeof metadata.encryptionKey !== "string" ||
      metadata.encryptionKey.trim() === ""
    ) {
      console.error("encryptionKey is missing from metadata:", metadata);
      throw new Error("Missing or invalid encryptionKey in metadata.");
    }
    if (
      !metadata.iv ||
      typeof metadata.iv !== "string" ||
      metadata.iv.trim() === ""
    ) {
      console.error("iv is missing from metadata:", metadata);
      throw new Error("Missing or invalid iv in metadata.");
    }
    if (
      !metadata.fileType ||
      typeof metadata.fileType !== "string" ||
      metadata.fileType.trim() === ""
    ) {
      console.error("fileType is missing from metadata:", metadata);
      throw new Error("Missing or invalid fileType in metadata.");
    }
    if (!metadata.fileExtension && !metadata.fileType) {
      console.warn("Missing fileExtension; using fileType as fallback.");
      metadata.fileExtension = metadata.fileType.split("/")[1] || "bin";
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
      `/.netlify/functions/fetchEncryptedFile/${fileCid}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch encrypted file data. Status: ${response.status}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType) {
      throw new Error("Missing Content-Type in response");
    }

    // Log the content type for debugging purposes
    console.log(`Content-Type from response: ${contentType}`);

    // Handling .pptx, .docx, and .zip files differently
    const isZipPptxOrDocx =
      contentType === "application/zip" ||
      contentType ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      contentType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (isZipPptxOrDocx) {
      console.warn(
        "File is a zip, pptx, or docx, skipping metadata extraction."
      );
      const fileBuffer = await response.arrayBuffer();

      // Determine the MIME type accordingly
      let mimeType = contentType;
      if (contentType === "application/zip") {
        mimeType =
          "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      } else if (
        contentType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        mimeType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }

      const blob = new Blob([Buffer.from(fileBuffer)], { type: mimeType });
      const fileUrl = URL.createObjectURL(blob);

      return {
        metadata: { fileType: mimeType }, // Provide a default metadata with mime type
        dataBuffer: Buffer.from(fileBuffer),
      };
    }

    // If the content is an image or another standard type (not encrypted), return the file buffer as is.
    if (
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/pdf"
    ) {
      const fileBuffer = await response.arrayBuffer();
      return {
        fileType: contentType,
        fileBuffer: Buffer.from(fileBuffer),
        metadata: null,
      };
    }

    // For encrypted content, assume there is metadata to extract
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
  console.log("Attempting to decrypt with the following:");
  console.log("Encryption Key:", encryptionKey);
  console.log("IV:", iv);
  console.log("Encrypted Data Length:", encryptedData.length);

  if (!encryptionKey || !iv) {
    throw new Error("Encryption key or IV is missing.");
  }

  try {
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

    // Check if decryption was successful
    if (!decrypted) {
      throw new Error("Decryption failed, result is null or undefined.");
    }

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
  } catch (err) {
    console.error("Decryption failed with error:", err);
    throw new Error("Error decrypting file, please verify encryptionKey and IV.");
  }
};
