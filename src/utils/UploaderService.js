import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { connection, pinata } from "./config";
import { FileRegistration } from "./types";

// Fetch all files uploaded by the uploader from on-chain storage
export const fetchUploaderFiles = async (uploaderPublicKey, options = {}) => {
  try {
    const programId = new PublicKey(`${process.env.REACT_APP_PROGRAM_ID}`);
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        {
          memcmp: {
            offset: 0, // Offset to the 'uploader' field in the account data
            bytes: uploaderPublicKey.toBase58(),
          },
        },
      ],
    });

    // Apply the limit if it exists in options
    const limitedAccounts = options.limit
      ? accounts.slice(0, options.limit)
      : accounts;

    return limitedAccounts.map((account) => {
      const fileData = FileRegistration.deserialize(account.account.data);
      return {
        fileName: fileData.file_name,
        description: fileData.description,
        price: Number(fileData.price) / LAMPORTS_PER_SOL,
        fileCid: fileData.file_url,
        fileType: fileData.file_type,
        fileSizeMB: fileData.file_size,
        // Include any other fields needed
      };
    });
  } catch (error) {
    console.error("Error fetching uploader files:", error);
    throw error;
  }
};


// Update file metadata and upload DRM-protected version through backend
export const updateFileMetadata = async (
  fileCid,
  newFileName,
  newDescription,
  newPriceInLamports,
  uploaderPublicKey,
  drmRules
) => {
  try {
    // Send metadata to backend to process DRM and upload to IPFS
    const response = await fetch("/.netlify/functions/processFile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileCid,
        newFileName,
        newDescription,
        newPriceInLamports,
        uploaderPublicKey,
        drmRules,
      }),
    });

    const { drmFileCid } = await response.json();
    return drmFileCid;
  } catch (error) {
    console.error("Error updating file metadata:", error);
    throw error;
  }
};

// Fetch file or metadata for a specific file from Pinata
export const fetchFileMetadata = async (fileCid) => {
  try {
    // Fetch the file or data from the Pinata gateway using the CID
    const response = await fetch(
      `${process.env.REACT_APP_PINATA_GATEWAY_URL}/ipfs/${fileCid}`
    );

    // Log the raw response and inspect its content type
    console.log("Raw Response:", response);

    const contentType = response.headers.get("Content-Type");
    console.log("Content-Type:", contentType);

    if (contentType.includes("application/json")) {
      // Handle the case where you receive JSON metadata
      const metadata = await response.json();
      console.log("Fetched Metadata:", metadata);
      return {
        name: metadata.file_name, // Adjust based on actual structure
        description: metadata.description,
        price: Number(metadata.price) / 1e9, // Convert price from Lamports to SOL
        fileCid: fileCid,
      };
    } else if (contentType.includes("application/octet-stream")) {
      // Handle binary file data
      const blob = await response.blob();
      console.log("Fetched file as blob:", blob);

      // You can return the blob if you need to use it elsewhere in your app
      return {
        fileBlob: blob,
        fileCid: fileCid,
      };
    } else {
      throw new Error(`Unexpected content type: ${contentType}`);
    }
  } catch (error) {
    console.error("Error fetching file or metadata:", error);
    throw error;
  }
};
