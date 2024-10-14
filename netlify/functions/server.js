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
const { handler: fetchEncryptedFileHandler } = require("./fetchEncryptedFile.js");

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

// Fetch encrypted file from IPFS
app.get("/.netlify/functions/fetchEncryptedFile/:fileCid", async (req, res) => {
  const { fileCid } = req.params;

  try {
    console.log(`Received request for file CID: ${fileCid}`);
    const fileBuffer = await fetchEncryptedFileHandler(fileCid);

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
});

module.exports.handler = serverless(app);
