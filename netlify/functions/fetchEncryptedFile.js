// Required dependencies
const axios = require("axios").default;

/**
 * Lambda function to fetch the encrypted file from IPFS using Pinata's gateway.
 * @param {Object} event - The event object containing path parameters
 * @returns {Promise} - The response object or error
 */
exports.handler = async (event) => {
  try {
    console.log("Event received:", event);

    // Extract fileCid from the path manually
    const pathSegments = event.path.split('/');
    const fileCid = pathSegments[pathSegments.length - 1];
    
    if (!fileCid) {
      throw new Error("File CID is missing from the path.");
    }

    console.log(`Fetching file data for CID: ${fileCid}`);

    // Get the gateway URL from environment variables
    const gatewayUrl = process.env.REACT_APP_PINATA_GATEWAY_URL;
    if (!gatewayUrl) {
      throw new Error("Gateway URL is not defined. Please check your .env file.");
    }

    // Construct the URL using the Pinata gateway and CID
    const url = `${gatewayUrl}/ipfs/${fileCid}`;

    // Make the request to fetch the file from IPFS
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
      },
    });

    // Log the received content type
    const contentType = response.headers["content-type"];
    console.log(`Content-Type received: ${contentType}`);

    // Return the file buffer as a base64 encoded string
    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType, // Return the original content type
      },
      body: response.data.toString("base64"),
      isBase64Encoded: true, // Indicate that the response body is base64 encoded
    };
  } catch (error) {
    console.error("Error fetching encrypted file from IPFS:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch encrypted file data." }),
    };
  }
};
