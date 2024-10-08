import axios from "axios";

export const fetchEncryptedFile = async (fileCid) => {
  try {
    console.log(`Fetching file data for CID: ${fileCid}`);

    const response = await axios.get(
      `${process.env.REACT_APP_PINATA_GATEWAY_URL}/ipfs/${fileCid}`,
      {
        responseType: "arraybuffer", // Ensure it's expecting binary data
        headers: {
          Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
        },
      }
    );

    if (response.headers['content-type'] !== 'application/octet-stream') {
      throw new Error(
        `Unexpected response type: ${response.headers['content-type']}`
      );
    }

    return response.data; // Return the file buffer
  } catch (error) {
    console.error("Error fetching encrypted file from IPFS:", error);
    throw error;
  }
};
