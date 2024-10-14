import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { decryptFile } from "../utils/drmservice";
import FileViewer from "react-file-viewer";
import { pdfjs } from "react-pdf";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "./FileDetailPage.css";

// Set the worker URL globally
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.13.216/pdf.worker.min.js`;

const FileDetailPage = () => {
  const { fileCid } = useParams();
  const location = useLocation();
  const [fileMetadata, setFileMetadata] = useState(null);
  const [decryptedFileUrl, setDecryptedFileUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFileData = async () => {
      try {
        setLoading(true);

        // Determine if the link contains the query parameter ?type=no-login
        const searchParams = new URLSearchParams(location.search);
        const type = searchParams.get("type");

        // Use the Netlify function to fetch encrypted file from IPFS
        const response = await fetch(
          `/.netlify/functions/fetchEncryptedFile/${fileCid}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch file data from Netlify function.");
        }

        // The file is returned as a base64 encoded string, decode it to buffer
        const base64File = await response.text();
        const fileBuffer = Buffer.from(base64File, "base64");

        // Extract metadata from the file buffer
        const metadataLength = fileBuffer.readUInt32BE(0); // First 4 bytes contain metadata length
        const metadataBuffer = fileBuffer.slice(4, 4 + metadataLength);
        const metadata = JSON.parse(metadataBuffer.toString());

        if (!metadata.encryptionKey || !metadata.iv) {
          throw new Error("Missing encryption key or IV in file metadata");
        }

        setFileMetadata(metadata);

        // Extract the encrypted file part and decrypt if necessary
        const encryptedFileBuffer = fileBuffer.slice(4 + metadataLength);

        if (metadata.isEncrypted) {
          const decryptedFile = decryptFile(
            encryptedFileBuffer,
            metadata.encryptionKey,
            metadata.iv
          );

          // Create a Blob URL for the decrypted file
          const mimeType = getMimeType(metadata);
          const blob = new Blob([decryptedFile], { type: mimeType });
          const fileUrl = URL.createObjectURL(blob);
          setDecryptedFileUrl(fileUrl);
        } else {
          // If the file is not encrypted, create a Blob URL directly
          const blob = new Blob([encryptedFileBuffer], {
            type: getMimeType(metadata),
          });
          const fileUrl = URL.createObjectURL(blob);
          setDecryptedFileUrl(fileUrl);
        }
      } catch (error) {
        console.error("Error loading file data:", error);
        setError("Error loading file. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (fileCid) {
      loadFileData();
    }
  }, [fileCid, location.search]);

  // Function to get the correct MIME type
  const getMimeType = (metadata) => {
    // Force .pptx to have the correct MIME type
    if (
      metadata.fileName?.endsWith(".pptx") ||
      metadata.fileType === "application/zip"
    ) {
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }
    return metadata.fileType;
  };

  const onError = (e) => {
    console.error("Error rendering the file:", e);
    setError(
      "Unable to display the file. You can download it instead to view locally."
    );
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="file-detail-container">
      <h1>File Details</h1>
      <button className="back-button" onClick={handleBack}>
        Back to Previous Page
      </button>
      {loading ? (
        <p>Loading file data...</p>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          {decryptedFileUrl && (
            <a
              href={decryptedFileUrl}
              download={fileMetadata?.fileName}
              className="download-link"
            >
              Download {fileMetadata?.fileName}
            </a>
          )}
        </div>
      ) : fileMetadata ? (
        <div>
          <p>
            <strong>File Name:</strong> {fileMetadata.fileName}
          </p>
          <p>
            <strong>Description:</strong> {fileMetadata.description}
          </p>
          {fileMetadata.price && (
            <p>
              <strong>Price:</strong> {fileMetadata.price} SOL
            </p>
          )}

          <div className="file-viewer-container">
            {decryptedFileUrl ? (
              // Handling different file types
              fileMetadata.fileType === "application/pdf" ? (
                <iframe
                  src={decryptedFileUrl}
                  title="PDF Viewer"
                  width="100%"
                  height="100%"
                  style={{ border: "none" }}
                />
              ) : fileMetadata.fileType.startsWith("video/") ? (
                <video
                  controls
                  width="100%"
                  height="auto"
                  src={decryptedFileUrl}
                >
                  Your browser does not support the video tag.
                </video>
              ) : [
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                  "application/zip",
                ].includes(fileMetadata.fileType) ? (
                // Suggest download for .docx, .pptx, .zip
                <div>
                  <p>
                    Preview not available for this file type. Please download to
                    view it locally.
                  </p>
                  <a
                    href={decryptedFileUrl}
                    download={fileMetadata.fileName}
                    className="download-link"
                  >
                    Download {fileMetadata.fileName}
                  </a>
                </div>
              ) : (
                <FileViewer
                  fileType={fileMetadata.fileType.split("/")[1]} // Extract the extension (e.g., "pdf", "jpg")
                  filePath={decryptedFileUrl} // Path to the decrypted file Blob URL
                  onError={onError}
                />
              )
            ) : (
              <p>Decrypting and preparing file for preview...</p>
            )}
          </div>
        </div>
      ) : (
        <p>Loading metadata...</p>
      )}
    </div>
  );
};

export default FileDetailPage;
