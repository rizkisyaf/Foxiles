import axios from "axios";

// Fetch encrypted file from IPFS using Pinata gateway with JWT authorization
export const fetchEncryptedFile = async (fileCid) => {
  try {
    console.log("Fetching file from IPFS CID:", fileCid); // Debugging log

    const response = await axios.get(
      `${process.env.REACT_APP_PINATA_GATEWAY_URL}/ipfs/${fileCid}`,
      {
        responseType: "arraybuffer", // Expect binary data
        headers: {
          Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
        },
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
