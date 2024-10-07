import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { PublicKey, Connection, SystemProgram } from "@solana/web3.js";
import { Oval } from "react-loader-spinner";
import { motion } from "framer-motion";
import { fetchUploaderFiles } from "../utils/UploaderService";
import { createTransferTransaction } from "../utils/transactionService";
import { decryptFile, fetchEncryptedFileData } from "../utils/drmservice";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";
import logo from "../assets/2.png";
import "./BuyerPage.css";

const connection = new Connection("http://api.devnet.solana.com", "processed");
const platformFeeAccount = new PublicKey(
  process.env.REACT_APP_PLATFORM_FEE_ACCOUNT
);
const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_SERVER_URL;
const PAYMENT_TIMEOUT = 180; // 3 minutes
const ITEMS_PER_PAGE = 6;

function BuyerPage({ provider, walletServicesPlugin }) {
  const { influencerId } = useParams();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [socket, setSocket] = useState(null);
  const [timer, setTimer] = useState(PAYMENT_TIMEOUT);
  const [timerInterval, setTimerInterval] = useState(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

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

  useEffect(() => {
    if (socket && selectedFile && showCryptoModal) {
      socket.emit("watchPayment", {
        receiver: influencerId,
        amount: selectedFile.price,
      });

      socket.on("paymentConfirmed", async (data) => {
        if (
          data.receiver === influencerId &&
          data.amount === parseFloat(selectedFile.price)
        ) {
          clearTimer();
          setStatus("Payment confirmed. Preparing your file for decryption...");
          setOverlayLoading(true); // Show loading animation after confirmation

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
            setOverlayLoading(false); // Hide loading animation
            setShowCryptoModal(false); // Close modal after success
          }
        }
      });

      startTimer();
    }

    return () => {
      clearTimer();
      if (socket) {
        socket.off("paymentConfirmed");
      }
    };
  }, [socket, selectedFile, influencerId, showCryptoModal]);

  const startTimer = () => {
    setTimer(PAYMENT_TIMEOUT);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearTimer();
          setStatus("Payment timeout. Please try again.");
          setShowCryptoModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimerInterval(interval);
  };

  const clearTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

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
    setSelectedFile(file);
    setShowCryptoModal(true);
    setStatus("Please complete the payment to receive the file.");
  };

  const handleBuyFileWithFiat = async (file) => {
    if (!provider) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setStatus("Processing transaction...");

      const ownerPublicKey = new PublicKey(influencerId);
      const priceInLamports = parseFloat(file.price) * 1e9;

      const transaction = await createTransferTransaction(
        connection,
        provider.publicKey,
        ownerPublicKey,
        (priceInLamports * 95) / 100
      );

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: platformFeeAccount,
          lamports: (priceInLamports * 5) / 100,
        })
      );

      const signedTx = await provider.signAndSendTransaction(transaction);
      console.log("Transaction successful with signature:", signedTx);

      setStatus(
        "Transaction completed. Fetching DRM-protected download link..."
      );

      const response = await fetch(
        `${process.env.REACT_APP_GATEWAY_URL}/ipfs/${file.fileCid}`
      );
      const encryptedFile = await response.arrayBuffer();
      const encryptionKey = process.env.REACT_APP_ENCRYPTION_KEY;
      const { encryptedData, iv } = await fetchEncryptedFileData(file.fileCid);
      const decryptedFile = decryptFile(encryptedData, encryptionKey, iv);

      const blob = new Blob([decryptedFile], {
        type: "application/octet-stream",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.fileName;
      link.click();

      setStatus("Download started. DRM and self-destruction applied.");
    } catch (err) {
      console.error("Error during transaction:", err);
      setStatus("Error processing the transaction. Please try again.");
    } finally {
      setLoading(false);
    }
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

          <h2 className="files-header">Files Uploaded by {influencerId}</h2> {/* Added this header */}

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

          {showCryptoModal && selectedFile && (
            <div className="crypto-modal">
              <div className="buyer-modal-content">
                <h4>Payment Instructions</h4>
                <p>Scan the QR code or copy the wallet address below to pay:</p>
                <QRCodeCanvas
                  value={`solana:${influencerId}?amount=${selectedFile.price}`}
                  size={200}
                />
                <p className="wallet-address-full">{influencerId}</p>
                <p>Time left to pay: {timer} seconds</p> {/* Countdown timer */}
                <button
                  onClick={() => setShowCryptoModal(false)}
                  className="close-modal-button"
                >
                  Close
                </button>

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
