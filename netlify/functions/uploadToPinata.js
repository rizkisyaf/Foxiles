/** @type {any} */
const axios = require('axios');
const FormData = require('form-data');

const uploadToPinata = async (event) => {
  try {
    const { fileBuffer } = JSON.parse(event.body); // Parse the body to get fileBuffer
    const buffer = Buffer.from(fileBuffer, "base64");

    const formData = new FormData();
    formData.append("file", buffer, "drmFile");

    const metadata = JSON.stringify({
      name: "DRM File",
      keyvalues: {
        encrypted: "true",
      },
    });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({ cidVersion: 1 });
    formData.append("pinataOptions", options);

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          "Content-Type": `multipart/form-data`,
          Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
          ...formData.getHeaders(),
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ cid: response.data.IpfsHash }),
    };
  } catch (error) {
    console.error("Error uploading file to Pinata:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to upload file to Pinata",
        details: error.message || error,
      }),
    };
  }
};

// Export the handler for serverless function
module.exports.handler = uploadToPinata;
