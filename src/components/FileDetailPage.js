import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchFileMetadata } from "../utils/UploaderService";

const FileDetailPage = () => {
  const { fileCid } = useParams();
  const [fileMetadata, setFileMetadata] = useState(null);

  useEffect(() => {
    const loadFileMetadata = async () => {
      try {
        // Fetch file metadata using your custom function
        const metadata = await fetchFileMetadata(fileCid);
        setFileMetadata(metadata);
      } catch (error) {
        console.error("Error fetching file metadata:", error);
      }
    };

    if (fileCid) {
      loadFileMetadata();
    }
  }, [fileCid]);

  return (
    <div>
      <h1>File Details</h1>
      {fileMetadata ? (
        <div>
          <p>File Name: {fileMetadata.fileName}</p>
          <p>Description: {fileMetadata.description}</p>
          <p>Price: {fileMetadata.price} SOL</p>
          <p>
            File URL:{" "}
            <a
              href={`${process.env.REACT_APP_PINATA_GATEWAY_URL}${fileMetadata.fileCid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View File on Pinata
            </a>
          </p>
        </div>
      ) : (
        <p>Loading metadata...</p>
      )}
    </div>
  );
};

export default FileDetailPage;
