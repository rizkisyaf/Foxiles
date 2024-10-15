/** @type {any} */
const axios = require("axios");
const FormData = require("form-data");

const uploadToPinata = async (event) => {
  try {
    const { fileBuffer, pinataMetadata, pinataOptions } = JSON.parse(
      event.body
    );
    const buffer = Buffer.from(fileBuffer, "base64");

    const formData = new FormData();
    formData.append("file", buffer, pinataMetadata.name || "uploadedFile"); // Use the fileName from metadata or default name

    // Attach metadata to the request
    if (pinataMetadata) {
      formData.append("pinataMetadata", JSON.stringify(pinataMetadata));
    }

    // Attach options to the request
    if (pinataOptions) {
      formData.append("pinataOptions", JSON.stringify(pinataOptions));
    }

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
