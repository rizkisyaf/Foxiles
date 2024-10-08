import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Oval } from "react-loader-spinner";
import { motion } from "framer-motion";
import { fetchUploaderFiles } from "../utils/UploaderService";
import { decryptFile, fetchEncryptedFileData } from "../utils/drmservice";
import { createQR, encodeURL } from "@solana/pay";
import logo from "../assets/2.png";
import { v4 as uuidv4 } from "uuid";
import BigNumber from "bignumber.js";
import "./BuyerPage.css";

const ITEMS_PER_PAGE = 8;

function BuyerPage({ provider, walletServicesPlugin }) {
  const { influencerId } = useParams();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uniqueMemo, setUniqueMemo] = useState(null);
  const [transactionSignature, setTransactionSignature] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Fetch uploader files metadata
  const fetchUploaderFilesMetadata = useCallback(async () => {
    setLoading(true);
    setStatus("Fetching uploader's files...");
    try {
      const uploaderPublicKey = new PublicKey(influencerId);
      const uploadedFiles = await fetchUploaderFiles(uploaderPublicKey, {
        limit: 100,
      });
      const filesWithMetadata = uploadedFiles.map((file) => ({
        ...file,
        fileType: file.fileType,
        fileSizeMB: file.fileSizeMB,
      }));

      setFiles(filesWithMetadata);
      setTotalPages(Math.ceil(filesWithMetadata.length / ITEMS_PER_PAGE));
      setStatus("");
    } catch (err) {
      console.error("Error fetching files:", err);
      setStatus("Error fetching files. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [influencerId]);

  useEffect(() => {
    fetchUploaderFilesMetadata();
  }, [fetchUploaderFilesMetadata]);

  // Handle payment confirmation logic
  const handlePaymentConfirmed = useCallback(async () => {
    setStatus("Payment confirmed. Preparing your file for decryption...");
    setOverlayLoading(true);

    try {
      const { encryptedData, metadata } = await fetchEncryptedFileData(
        selectedFile.fileCid
      );
      setStatus("Decrypting file...");
      const decryptedFile = decryptFile(
        encryptedData,
        metadata.encryptionKey,
        metadata.iv
      );

      const mimeType = metadata.fileType || "application/octet-stream";
      const fileExtension = mimeType.split("/")[1];
      const fileName = `${selectedFile.fileName}.${fileExtension}`;

      const blob = new Blob([decryptedFile], {
        type: mimeType,
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();

      setStatus("Download started... DRM and self-destruction applied...");
    } catch (err) {
      console.error("Error during file decryption or download:", err);
      setStatus("Error processing the download. Please try again.");
    } finally {
      setOverlayLoading(false);
      setShowCryptoModal(false);
      setUniqueMemo(null); // Reset memo after transaction completes
      setSelectedFile(null); // Reset selected file
      setTransactionSignature(""); // Reset transaction signature
    }
  }, [selectedFile]);

  // Generate QR code and start payment
  useEffect(() => {
    if (showCryptoModal && selectedFile && uniqueMemo) {
      const recipient = new PublicKey(influencerId);

      // Ensure the price is properly parsed as a number and multiplied by LAMPORTS_PER_SOL
      let priceInSOL = parseFloat(selectedFile.price);

      // Check if the price is NaN or less than zero; handle as an error if so
      if (isNaN(priceInSOL) || priceInSOL <= 0) {
        console.error("Invalid price for selected file:", selectedFile.price);
        setStatus("Invalid price for the selected file. Please try again.");
        return;
      }
      console.log("Selected file price in SOL for QR code:", priceInSOL);

      // Generate the URL for the payment request
      const url = encodeURL({
        recipient,
        amount: new BigNumber(priceInSOL),
        memo: uniqueMemo,
      });

      // Create a QR code for the payment request
      const qr = createQR(url, 200, "transparent");
      const qrCodeElement = document.getElementById("solana-payment-qr");
      if (qrCodeElement) {
        qrCodeElement.innerHTML = "";
        qr.append(qrCodeElement);
      }
    }
  }, [showCryptoModal, selectedFile, uniqueMemo, influencerId]);

  // Attempt to automatically retrieve transaction signature
  const attemptAutoRetrieveSignature = async () => {
    if (walletServicesPlugin && provider) {
      try {
        console.log("Attempting to retrieve transaction signature...");
        setStatus(
          "Attempting to retrieve transaction signature automatically..."
        );

        // Assuming walletServicesPlugin can retrieve a completed transaction signature
        const response = await walletServicesPlugin.getTransactionSignature();
        if (response && response.signature) {
          setTransactionSignature(response.signature);
          console.log("Transaction signature retrieved:", response.signature);
          verifyPayment(response.signature);
        } else {
          throw new Error(
            "No signature retrieved. Please make sure the payment is completed."
          );
        }
      } catch (error) {
        console.error("Auto-retrieval of signature failed:", error);
        setStatus(
          "Could not retrieve signature automatically. Please try again."
        );
      }
    }
  };

  // Handle verifying the payment by sending the signature to backend
  const verifyPayment = async (signature) => {
    if (!signature) {
      setStatus("Transaction signature is required for verification.");
      return;
    }

    try {
      setStatus("Verifying payment...");
      console.log("Sending request to checkPayment function...");

      const response = await fetch(
        "https://foxiles.netlify.app/.netlify/functions/checkPayment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiver: influencerId,
            amount: selectedFile.price,
            memo: uniqueMemo,
            signature: signature,
          }),
        }
      );

      console.log("CheckPayment request sent. Awaiting response...");
      const data = await response.json();
      console.log("Response from checkPayment:", data);

      if (response.status === 200) {
        setStatus("Payment verified successfully.");
        handlePaymentConfirmed(); // Call payment confirmation handler
      } else {
        console.log("Verification failed with status:", response.status);
        setStatus("Verification failed: " + data.message);

        if (retryCount < 3) {
          console.log(`Retrying verification... attempt ${retryCount + 1}`);
          setRetryCount((prev) => prev + 1);
          verifyPayment(signature);
        } else {
          console.log("Maximum retry attempts reached. Verification failed.");
        }
      }
    } catch (error) {
      console.error("Error during payment verification:", error);
      setStatus("Error during verification. Please try again.");

      if (retryCount < 3) {
        console.log(`Retrying verification... attempt ${retryCount + 1}`);
        setRetryCount((prev) => prev + 1);
        verifyPayment(signature);
      } else {
        console.log("Maximum retry attempts reached. Verification failed.");
      }
    }
  };

  // Pagination and file display logic
  const paginatedFiles = files.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleBuyFileWithCrypto = (file) => {
    // Generate a unique memo only when a file is selected for purchase
    if (!uniqueMemo || selectedFile !== file) {
      const newMemo = uuidv4(); // Use UUID for uniqueness
      setUniqueMemo(newMemo);
    }

    setSelectedFile(file);
    setShowCryptoModal(true);
    setStatus("Please complete the payment to receive the file.");

    // Attempt to automatically retrieve transaction signature
    attemptAutoRetrieveSignature();
  };

  return (
    <div className="buyer-page-container">
      {loading ? (
        <div className="buyer-loading-container">
          <Oval color="#007bff" height={50} width={50} />
          <p>{status}</p>
        </div>
      ) : (
        <motion.div className="buyer-file-details-container">
          <div className="header-section">
            <div className="logo-container">
              <img src={logo} alt="Foxiles Logo" className="logo" />
              <div className="beta-tag">
                <span>BETA IN DEVNET</span>
              </div>
            </div>
            <button
              onClick={() => {
                const profileLink = `${window.location.origin}/u/${influencerId}`;
                navigator.clipboard.writeText(profileLink);
                alert("Uploader profile link copied to clipboard!");
              }}
              className="copy-profile-button"
            >
              Copy Profile Link
            </button>
          </div>
          <h2 className="files-header">Files Uploaded by {influencerId}</h2>
          <div className="files-section">
            {paginatedFiles.length === 0 ? (
              <p>No files found for this uploader.</p>
            ) : (
              paginatedFiles.map((file) => (
                <div key={file.fileCid} className="buyer-file-item">
                  <h3>{file.fileName}</h3>
                  <p>Type: {file.fileType}</p>
                  <p>Size: {file.fileSizeMB} MB</p>
                  <p>{file.description}</p>
                  <p>Price: {file.price} SOL</p>

                  <button
                    className="buyer-ds-button"
                    onClick={() => handleBuyFileWithCrypto(file)}
                  >
                    Buy with Crypto
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-button"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-button"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
          {showCryptoModal && selectedFile && uniqueMemo && (
            <div className="crypto-modal">
              <div className="buyer-modal-content">
                <h4>Payment Instructions</h4>
                <p>Scan the QR code or use a compatible wallet to pay:</p>
                <div id="solana-payment-qr"></div>{" "}
                {/* Place to render Solana Pay QR Code */}
                <p className="wallet-address-full">{influencerId}</p>
                {overlayLoading && (
                  <div className="overlay-loading">
                    <Oval color="#007bff" height={50} width={50} />
                    <p>{status}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default BuyerPage;