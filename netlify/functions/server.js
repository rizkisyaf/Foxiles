// server.js

const express = require("express");
/** @type {any} */
const axios = require("axios");
const FormData = require("form-data");
const cors = require("cors");
const { Connection, PublicKey } = require("@solana/web3.js");
const serverless = require("serverless-http");
const { handler: processFileHandler } = require("./processFile");
const { handler: uploadToPinataHandler } = require("./uploadToPinata");
const { fetchEncryptedFile } = require("./fetchEncryptedFile.js");

const app = express();
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

app.use(express.json({ limit: "500mb" }));

// Route to process the file (via DRM service)
app.post("/.netlify/functions/processFile", async (req, res) => {
  const result = await processFileHandler({ body: JSON.stringify(req.body) });
  res.status(result.statusCode).json(JSON.parse(result.body));
});

// Route to upload processed DRM file to Pinata
app.post("/.netlify/functions/uploadToPinata", async (req, res) => {
  const result = await uploadToPinataHandler({
    body: JSON.stringify(req.body),
  });
  res.status(result.statusCode).json(JSON.parse(result.body));
});

// Route to upload processed file to IPFS via Pinata
app.post("/.netlify/functions/uploadToPinata", async (req, res) => {
  try {
    const fileBuffer = Buffer.from(req.body.fileBuffer, "base64");

    const formData = new FormData();
    formData.append("file", fileBuffer, "drmFile");

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

    res.json({ cid: response.data.IpfsHash });
  } catch (error) {
    console.error("Error uploading file to Pinata:", error);
    res.status(500).json({
      error: "Failed to upload file to Pinata",
      details: error.message || error,
    });
  }
});

// Fetch encrypted file from IPFS via Netlify Function
app.get("/.netlify/functions/fetch-encrypted-file/:fileCid", async (req, res) => {
  const { fileCid } = req.params;
  console.log(`Fetching file for CID: ${fileCid}`);

  try {
    console.log(`Fetching encrypted file with CID: ${fileCid}`); // Debugging log

    const fileBuffer = await fetchEncryptedFile(fileCid); // Fetch the file
    if (!fileBuffer || fileBuffer.length === 0) {
      console.error("File buffer is empty or not found.");
      return res.status(404).send("File not found.");
    }

    // Log the file size for debugging
    console.log(`File buffer received, size: ${fileBuffer.length} bytes`);

    // Set the correct Content-Type for binary files
    res.set("Content-Type", "application/octet-stream");

    // Send the file buffer as the response
    res.send(fileBuffer);
  } catch (error) {
    // Catch any errors and return a 500 status
    console.error("Error fetching encrypted file data:", error.message);
    return res.status(500).json({ error: "Failed to fetch encrypted file data" });
  }
});


module.exports.handler = serverless(app);
