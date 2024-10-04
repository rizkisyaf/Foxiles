// drmservice.js

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { fileTypeFromBuffer } from "file-type";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Process the file: encrypt, add DRM, and prepare for upload
export const processFile = async (fileBuffer, uploaderPublicKey, fileType) => {
  try {
    // Generate a 32-byte encryption key for AES-256
    const encryptionKey = crypto.randomBytes(32);

    // Encrypt the file
    const { encryptedData, iv } = encryptFile(fileBuffer, encryptionKey);

    // Define DRM rules
    const drmRules = {
      preventCloudUpload: true,
      preventFileCopy: true,
      preventNetworkSharing: true,
    };

    // Add DRM metadata and watermark
    const drmBuffer = await addDRM(
      encryptedData,
      iv,
      uploaderPublicKey,
      drmRules,
      fileType
    );

    return { drmBuffer, encryptionKey }; // Return the DRM-protected file buffer
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
};

// Encrypt the file with AES-256-CBC
export const encryptFile = (buffer, encryptionKey) => {
  const iv = crypto.randomBytes(16); // Initialization vector
  const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);

  const encryptedData = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { iv, encryptedData };
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

// Add DRM metadata and watermark
export const addDRM = async (
  encryptedData,
  iv,
  uploaderPublicKey,
  drmRules,
  fileType
) => {
  // Add watermark
  const watermarkedBuffer = await addWatermark(
    encryptedData,
    uploaderPublicKey,
    fileType
  );

  // Generate unique tracking ID
  const trackingId = uuidv4();

  // Get original device environment for self-destruct checks
  const originalEnvironment = await getDeviceEnvironment();

  // Prepare metadata
  const metadata = {
    uploaderPublicKey,
    trackingId,
    drmRules,
    originalEnvironment: originalEnvironment,
    iv: iv.toString("hex"), // Include IV for decryption
  };

  // Serialize metadata
  const metadataBuffer = Buffer.from(JSON.stringify(metadata), "utf-8");

  // Prepend the length of the metadata for extraction
  const metadataLengthBuffer = Buffer.alloc(4);
  metadataLengthBuffer.writeUInt32BE(metadataBuffer.length, 0);

  // Combine metadata and encrypted data
  return Buffer.concat([
    metadataLengthBuffer,
    metadataBuffer,
    watermarkedBuffer,
  ]);
};

// Add watermark based on file type
export const addWatermark = async (fileBuffer, uploaderPublicKey, fileType) => {
  if (fileType === "image") {
    return await addImageWatermark(fileBuffer, uploaderPublicKey);
  } else if (fileType === "video") {
    return await addVideoWatermark(fileBuffer, uploaderPublicKey);
  } else {
    // For unsupported types, return the original buffer
    return fileBuffer;
  }
};

// Add watermark to an image using sharp
export const addImageWatermark = async (imageBuffer, uploaderPublicKey) => {
  try {
    // Use fileType to detect the MIME type
    const fileTypeResult = await fileTypeFromBuffer(imageBuffer);
    if (
      !fileTypeResult ||
      !["image/png", "image/jpeg", "image/webp"].includes(fileTypeResult.mime)
    ) {
      throw new Error("Unsupported image format or unable to detect file type");
    }

    const watermarkText = `Uploader: ${uploaderPublicKey}`;
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    console.log("Detected file type:", fileTypeResult.mime);
    console.log("Image Metadata:", metadata);

    // Create SVG overlay with the watermark text
    const svgImage = `
      <svg width="${metadata.width}" height="${metadata.height}">
        <text x="10" y="30" font-size="24" fill="white" opacity="0.5">${watermarkText}</text>
      </svg>
    `;

    const watermarkedImageBuffer = await image
      .composite([{ input: Buffer.from(svgImage), blend: "overlay" }])
      .toBuffer();

    return watermarkedImageBuffer;
  } catch (error) {
    console.error("Error adding watermark to image:", error.message || error);
    throw error;
  }
};

// Add watermark to a video using ffmpeg
export const addVideoWatermark = (videoBuffer, uploaderPublicKey) => {
  return new Promise((resolve, reject) => {
    const tempInputFile = `input_${Date.now()}.mp4`;
    const tempOutputFile = `output_${Date.now()}.mp4`;

    require("fs").writeFileSync(tempInputFile, videoBuffer);

    const watermarkText = `Uploader: ${uploaderPublicKey}`;

    ffmpeg(tempInputFile)
      .outputOptions([
        "-vf",
        `drawtext=text='${watermarkText}':fontcolor=white:fontsize=24:x=10:y=10`,
      ])
      .on("end", () => {
        const watermarkedVideoBuffer =
          require("fs").readFileSync(tempOutputFile);

        // Clean up temporary files
        require("fs").unlinkSync(tempInputFile);
        require("fs").unlinkSync(tempOutputFile);

        resolve(watermarkedVideoBuffer);
      })
      .on("error", (err) => {
        // Clean up temporary files
        require("fs").unlinkSync(tempInputFile);
        reject(err);
      })
      .save(tempOutputFile);
  });
};

// Self-destruct the file if DRM conditions are violated
export const selfDestruct = async (fileBuffer, uploaderPublicKey) => {
  const currentEnvironment = await getDeviceEnvironment();

  // Extract metadata and data
  const { metadata, dataBuffer } = extractMetadata(fileBuffer);
  const originalEnvironment = metadata.originalEnvironment;

  // Check for unauthorized activity
  const isUnauthorized = await detectUnauthorizedActivity(
    currentEnvironment,
    originalEnvironment,
    metadata.drmRules
  );

  if (isUnauthorized) {
    console.log(
      "Unauthorized activity detected. Triggering self-destruction..."
    );
    return Buffer.from([]); // Return an empty buffer to corrupt the file
  }

  return dataBuffer; // Return the original data if authorized
};

// Extract metadata and data from the file buffer
const extractMetadata = (fileBuffer) => {
  const metadataLengthBuffer = fileBuffer.slice(0, 4);
  const metadataLength = metadataLengthBuffer.readUInt32BE(0);

  const metadataBuffer = fileBuffer.slice(4, 4 + metadataLength);
  const dataBuffer = fileBuffer.slice(4 + metadataLength);

  const metadata = JSON.parse(metadataBuffer.toString("utf-8"));

  return { metadata, dataBuffer };
};

// Fetch and embed device environment (without live checking)
export const getDeviceEnvironment = async () => {
  const environmentData = {
    deviceId: "dummy_device_id", // Replace with actual fingerprint generation logic
    userAgent: "dummy_user_agent", // Replace with real data if needed
    // Add any other data needed to identify the environment
  };
  return environmentData;
};

// Detect unauthorized activities
const detectUnauthorizedActivity = async (
  currentEnvironment,
  originalEnvironment,
  drmRules
) => {
  // Check if the device environment has changed
  if (currentEnvironment !== originalEnvironment) {
    return true;
  }

  // Check for DRM violations
  if (drmRules.preventCloudUpload && (await detectCloudUploadAttempt())) {
    console.log("Attempt to upload to cloud detected!");
    return true;
  }

  if (drmRules.preventFileCopy && (await detectFileCopyAttempt())) {
    console.log("Attempt to copy file detected!");
    return true;
  }

  if (drmRules.preventNetworkSharing && (await detectNetworkSharingAttempt())) {
    console.log("Attempt to share file over the network detected!");
    return true;
  }

  return false;
};

// Detect if the file is being uploaded to cloud or social media platforms
const detectCloudUploadAttempt = async () => {
  const fileTransferServices = [
    "google.com",
    "dropbox.com",
    "icloud.com",
    "onedrive.com",
    "whatsapp.com",
    "telegram.org",
    "messenger.com",
    "facebook.com",
    "twitter.com",
    "linkedin.com",
    "instagram.com",
    "signal.org",
    "wetransfer.com",
    "discord.com",
    "slack.com",
    "skype.com",
    "teams.microsoft.com",
    "zoom.us",
  ];

  const isFileTransferService = fileTransferServices.some((service) =>
    window.location.href.includes(service)
  );
  return isFileTransferService;
};

// Detect if the file is being copied
const detectFileCopyAttempt = async () => {
  return new Promise((resolve) => {
    document.addEventListener("copy", (event) => {
      if (event.clipboardData.files.length > 0) {
        console.log("File copy detected");
        resolve(true);
      }
    });
    resolve(false);
  });
};

// Detect if the file is being shared over a network drive
const detectNetworkSharingAttempt = async () => {
  const isNetworkDrive =
    window.location.protocol.includes("file:") &&
    window.location.href.includes("network");
  return isNetworkDrive;
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

export const getFileBufferFromIPFS = async (fileCid) => {
  try {
    const response = await fetch(
      `https://gateway.pinata.cloud/ipfs/${fileCid}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch file from IPFS");
    }

    const fileBuffer = await response.arrayBuffer();
    return fileBuffer; // Return file buffer for further processing
  } catch (error) {
    console.error("Error fetching file buffer from IPFS:", error);
    throw error;
  }
};

// Upload DRM-protected file to IPFS via Pinata
export const uploadDRMFileToIPFS = async (fileBuffer) => {
  try {
    const response = await axios.post(
      "http://localhost:5000/upload-to-pinata",
      {
        fileBuffer: fileBuffer.toString("base64"), // Convert buffer to base64 string
      }
    );

    if (response.status !== 200) {
      throw new Error("Failed to upload DRM file to IPFS");
    }

    const cid = response.data.cid;
    return cid; // Return the CID of the uploaded file
  } catch (error) {
    console.error("Error uploading file to IPFS:", error);
    throw error;
  }
};
