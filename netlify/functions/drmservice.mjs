// netlify/functions/drmService.js

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { fileTypeFromBuffer } from "file-type";

// Process the file: encrypt, add DRM, and prepare for upload
export const processFile = async (fileBuffer, uploaderPublicKey, fileType) => {
  try {
    // Generate a 32-byte encryption key for AES-256
    const encryptionKey = crypto.randomBytes(32);
    console.log("Generated Encryption Key (before serialization):", encryptionKey.toString("base64"));

    // Encrypt the file
    const { encryptedData, iv } = encryptFile(fileBuffer, encryptionKey);

    // Define DRM rules
    const drmRules = {
      preventCloudUpload: true,
      preventFileCopy: true,
      preventNetworkSharing: true,
    };

    // Add DRM metadata and watermark
    const drmBuffer = await addDRM(encryptedData, iv, encryptionKey, uploaderPublicKey, drmRules, fileType);

    console.log("DRM Buffer Length:", drmBuffer.length);
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

// Add DRM metadata and watermark
export const addDRM = async (encryptedData, iv, encryptionKey, uploaderPublicKey, drmRules, fileType) => {
  try {
    // Add watermark
    const watermarkedBuffer = await addWatermark(encryptedData, uploaderPublicKey, fileType);

    // Generate unique tracking ID
    const trackingId = uuidv4();

    // Prepare metadata
    const metadata = {
      uploaderPublicKey,
      trackingId,
      drmRules,
      fileType,
      iv: iv.toString("base64"),
      encryptionKey: encryptionKey.toString("base64"),
    };

    // Serialize metadata
    const metadataBuffer = Buffer.from(JSON.stringify(metadata), "utf-8");

    // Prepend the length of the metadata for extraction
    const metadataLengthBuffer = Buffer.alloc(4);
    metadataLengthBuffer.writeUInt32BE(metadataBuffer.length, 0);

    // Combine metadata and encrypted data
    return Buffer.concat([metadataLengthBuffer, metadataBuffer, watermarkedBuffer]);
  } catch (error) {
    console.error("Error in addDRM function:", error.message || error);
    throw error;
  }
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
  const watermarkText = `Uploader: ${uploaderPublicKey}`;
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Create SVG overlay with the watermark text
  const svgImage = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <text x="10" y="30" font-size="24" fill="white" opacity="0.5">${watermarkText}</text>
    </svg>
  `;

  return await image.composite([{ input: Buffer.from(svgImage), blend: "overlay" }]).toBuffer();
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
        const watermarkedVideoBuffer = require("fs").readFileSync(tempOutputFile);
        require("fs").unlinkSync(tempInputFile);
        require("fs").unlinkSync(tempOutputFile);
        resolve(watermarkedVideoBuffer);
      })
      .on("error", (err) => {
        require("fs").unlinkSync(tempInputFile);
        reject(err);
      })
      .save(tempOutputFile);
  });
};
