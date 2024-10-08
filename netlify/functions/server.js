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

// Fetch encrypted file from IPFS
app.get(
  "/.netlify/functions/fetch-encrypted-file/:fileCid",
  async (req, res) => {
    const { fileCid } = req.params;

    try {
      console.log(`Received request for file CID: ${fileCid}`);
      const fileBuffer = await fetchEncryptedFile(fileCid);

      if (!fileBuffer) {
        console.log("File not found in IPFS.");
        return res.status(404).send("File not found.");
      }

      console.log(`File buffer size: ${fileBuffer.length}`);
      res.set("Content-Type", "application/octet-stream");
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error fetching file from IPFS:", error);
      res.status(500).json({ error: "Failed to fetch file from IPFS" });
    }
  }
);

module.exports.handler = serverless(app);
