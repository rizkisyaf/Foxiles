module.exports.handler = async (event) => {
    try {
      // Use dynamic import to load the ES module
      const { processFile } = await import("./drmservice.mjs");
  
      const { fileBuffer, uploaderPublicKey, fileType, fileSizeMB } = JSON.parse(event.body);
      const decodedBuffer = Buffer.from(fileBuffer, "base64");
  
      const { drmBuffer, encryptionKey } = await processFile(
        decodedBuffer,
        uploaderPublicKey,
        fileType
      );
  
      return {
        statusCode: 200,
        body: JSON.stringify({
          processedFile: drmBuffer.toString("base64"),
          encryptionKey: encryptionKey.toString("base64"),
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "File processing failed: " + error.message }),
      };
    }
  };
  