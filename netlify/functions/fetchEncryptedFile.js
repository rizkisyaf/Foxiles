import axios from "axios";

// Fetch encrypted file from IPFS
export const fetchEncryptedFile = async (fileCid) => {
  try {
    console.log("Fetching file from IPFS CID:", fileCid); // Debugging log

    const response = await axios.get(
      `${process.env.REACT_APP_GATEWAY_URL}/ipfs/${fileCid}`,
      {
        responseType: "arraybuffer", // Expect binary data
      }
    );

    if (response.headers['content-type'] !== 'application/octet-stream') {
      throw new Error(`Unexpected response type: ${response.headers['content-type']}`);
    }

    return response.data; // Return file buffer
  } catch (error) {
    console.error("Error fetching encrypted file from IPFS:", error);
    throw error;
  }
};
