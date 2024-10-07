// fetchEncryptedFile.js

import axios from "axios";

// Fetch encrypted file from IPFS
export const fetchEncryptedFile = async (fileCid) => {
  try {
    const response = await axios.get(`${process.env.REACT_APP_GATEWAY_URL}/ipfs/${fileCid}`, {
      responseType: "arraybuffer", // Binary data
    });

    return response.data; // Return file buffer
  } catch (error) {
    console.error("Error fetching encrypted file from IPFS:", error);
    throw error;
  }
};
