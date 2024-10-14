import React, { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  Connection,
} from "@solana/web3.js";
import {
  validateInput,
  prepareInstructionData,
} from "../utils/registerService";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Oval } from "react-loader-spinner";
import { initializePlatformState } from "../utils/PlatformService";
import "./HomePage.css";
import { SolanaWallet } from "@web3auth/solana-provider";
import { sha256 } from "js-sha256";
import { v4 as uuidv4 } from "uuid";
import { createQR, encodeURL } from "@solana/pay";
import logo from "../assets/2.png";
import fox from "../assets/foxlogo.png";
import {
  FaClipboard,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaFileAlt,
} from "react-icons/fa";
import { BsTwitterX } from "react-icons/bs";

const programID = new PublicKey(`${process.env.REACT_APP_PROGRAM_ID}`);

const createSharedDirectory = () => {
  const directoryId = uuidv4();
  localStorage.setItem("sharedDirectory", directoryId);
  return directoryId;
};

const NO_LOGIN_MAX_SIZE_MB = 5;

function HomePage({
  provider = null,
  walletServicesPlugin = null,
  web3auth = null,
  noLoginAccount,
}) {
  const [file, setFile] = useState(null);
  const [fileSizeMB, setFileSizeMB] = useState(0);
  const [fileCid, setFileCid] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [sharedDirectory, setSharedDirectory] = useState(
    () => localStorage.getItem("sharedDirectory") || null
  );
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [walletPublicKey, setWalletPublicKey] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusColor, setStatusColor] = useState("");
  const [platformStatePubKey, setPlatformStatePubKey] = useState(null);
  const [platformFee, setPlatformFee] = useState(0.01);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlatformState = async () => {
      try {
        const platformStatePubKey = await initializePlatformState();
        setPlatformStatePubKey(platformStatePubKey);
      } catch (error) {
        console.error("Error fetching platform state:", error);
      }
    };

    const fetchWalletDetails = async () => {
      try {
        if (!web3auth || !web3auth.provider) {
          throw new Error("Web3Auth provider not initialized");
        }

        const accounts = await web3auth.provider.request({
          method: "requestAccounts",
        });

        if (accounts && accounts[0]) {
          setWalletPublicKey(accounts[0]);

          const connection = new Connection("https://api.devnet.solana.com");
          const balance = await connection.getBalance(
            new PublicKey(accounts[0])
          );
          setWalletBalance(balance / LAMPORTS_PER_SOL);

          if (balance === 0) {
            setShowTopUpModal(true);
          }

          // Clear any no-login account data from local storage when the user logs in
          localStorage.removeItem("noLoginAccount");
        } else {
          console.error("No accounts found.");
        }
      } catch (error) {
        console.error("Error fetching wallet details:", error);
      }
    };

    if (provider && web3auth) {
      fetchPlatformState();
      fetchWalletDetails();
    } else if (noLoginAccount && !walletPublicKey) {
      console.log("Using no-login account:", noLoginAccount);
    }
  }, [provider, web3auth, noLoginAccount]);

  useEffect(() => {
    if (showTopUpModal) {
      const recipient = new PublicKey(walletPublicKey);
      const url = encodeURL({ recipient });

      const qr = createQR(url, 200, "transparent");
      const qrCodeElement = document.getElementById("solana-top-up-qr");
      if (qrCodeElement) {
        qrCodeElement.innerHTML = "";
        qr.append(qrCodeElement);
      }
    }
  }, [showTopUpModal, walletPublicKey]);

  const navigateToDashboard = () => {
    navigate("/uploaderdashboard");
  };

  const onDrop = useCallback(
    (acceptedFiles) => {
      const selectedFile = acceptedFiles[0];
      const fileSizeMB = parseFloat(
        (selectedFile.size / (1024 * 1024)).toFixed(2)
      );
      const maxSizeMB = noLoginAccount ? NO_LOGIN_MAX_SIZE_MB : 500;

      if (fileSizeMB > maxSizeMB) {
        alert(
          `The selected file is too large. Maximum allowed size is ${maxSizeMB} MB.`
        );
        setFile(null);
        setFileSizeMB(0);
      } else {
        setFile(selectedFile);
        setFileSizeMB(fileSizeMB);
        setFileName(selectedFile.name);
        setFileType(selectedFile.type);
      }
    },
    [noLoginAccount]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [],
      "application/vnd.ms-excel": [],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],
      "application/vnd.ms-powerpoint": [],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [],
      "text/plain": [],
      "application/zip": [],
      "application/x-7z-compressed": [],
      "application/x-rar-compressed": [],
      "video/*": [],
      "audio/*": [],
    },
    maxFiles: 1,
  });

  const uploadToPinata = async () => {
    if (!file || !fileName || !price || !description || !platformStatePubKey) {
      alert("Please provide all file details.");
      return;
    }

    if (description.length > 1000) {
      alert("Description too long! Limit it to 1000 characters.");
      return;
    }

    if (noLoginAccount && fileSizeMB > NO_LOGIN_MAX_SIZE_MB) {
      alert("No-login users can only upload files up to 5MB.");
      return;
    }

    setLoading(true);
    setStatusColor("");
    setStatus("Processing and uploading file...");

    try {
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(fileArrayBuffer);

      const uploaderId = noLoginAccount ? noLoginAccount.id : walletPublicKey;
      const directoryId = sharedDirectory || createSharedDirectory();

      const fileType = file.type;

      const processResponse = await fetch("/.netlify/functions/processFile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileBuffer: fileBuffer.toString("base64"),
          uploaderPublicKey: walletPublicKey,
          fileType,
          fileSizeMB,
        }),
      });

      if (!processResponse.ok) {
        throw new Error(`Server error: ${processResponse.status}`);
      }

      const { processedFile, encryptionKey } = await processResponse.json();
      const encryptionKeyBuffer = Buffer.from(encryptionKey, "base64");
      const processedFileBuffer = Buffer.from(processedFile, "base64");

      const uploadResponse = await fetch("/.netlify/functions/uploadToPinata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileBuffer: processedFileBuffer.toString("base64"),
        }),
      });

      const uploadData = await uploadResponse.json();
      const cid = uploadData?.cid;

      if (!cid) {
        throw new Error("Failed to retrieve CID from Pinata");
      }

      setFileCid(cid);
      setFileUrl(`https://ipfs.io/ipfs/${cid}`);

      if (noLoginAccount) {
        setPrice("0");
      }

      const newFileMetadata = {
        fileName,
        fileCid: cid,
        description,
        price,
        encryptionKey,
        fileType,
        fileSizeMB,
      };
      setUploadedFiles((prevFiles) => [...prevFiles, newFileMetadata]);

      setStatus("File uploaded. Registering file on-chain...");
      await registerFileOnChain(
        cid,
        fileName,
        price,
        description,
        0,
        encryptionKeyBuffer,
        fileSizeMB,
        fileType
      );
    } catch (error) {
      console.error("Error during file processing or upload:", error);
      setStatusColor("red");
      setStatus("Error during upload or Registering File.");
    } finally {
      setLoading(false);
    }
  };

  const registerFileOnChain = async (
    cid,
    fileName,
    price,
    description,
    additionalFee,
    encryptionKeyBuffer,
    fileSizeMB,
    fileType
  ) => {
    try {
      validateInput(cid, fileName, description, price, fileType);

      if (!provider || !walletPublicKey) {
        throw new Error("Wallet or platform state not available.");
      }

      const solanaWallet = new SolanaWallet(provider);

      const connectionConfig = await solanaWallet.request({
        method: "solana_provider_config",
        params: [],
      });
      const connection = new Connection(connectionConfig.rpcTarget);

      const accounts = await solanaWallet.requestAccounts();

      const priceInLamports =
        (parseFloat(price) + additionalFee) * LAMPORTS_PER_SOL;

      const instructionData = prepareInstructionData(
        fileName,
        cid,
        description,
        priceInLamports,
        fileSizeMB,
        fileType,
        encryptionKeyBuffer
      );

      const platformFeeAccount = new PublicKey(
        process.env.REACT_APP_PLATFORM_FEE_ACCOUNT
      );

      const fileNameHash = Buffer.from(sha256.digest(fileName));

      const [fileInfoPda, bumpSeed] = await PublicKey.findProgramAddressSync(
        [
          new PublicKey(walletPublicKey).toBuffer(),
          Buffer.from("file_info"),
          fileNameHash,
        ],
        programID
      );

      const fileInfoAccount = await connection.getAccountInfo(fileInfoPda);

      if (!fileInfoAccount) {
        const block = await connection.getLatestBlockhash("finalized");

        const transaction = new Transaction({
          blockhash: block.blockhash,
          lastValidBlockHeight: block.lastValidBlockHeight,
          feePayer: new PublicKey(accounts[0]),
        }).add({
          keys: [
            {
              pubkey: new PublicKey(walletPublicKey),
              isSigner: true,
              isWritable: true,
            },
            { pubkey: fileInfoPda, isSigner: false, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
            { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
          ],
          programId: programID,
          data: instructionData,
        });

        const { signature } =
          await solanaWallet.signAndSendTransaction(transaction);
        setStatusColor("green");
        setStatus("File successfully registered.");
        navigate("/uploaderdashboard", { state: { shouldReload: true } });
      } else {
        console.log("File info account already exists, skipping creation.");
      }
    } catch (err) {
      console.error("Error during transaction:", err);
      handleErrorStatus(err);
    }
  };

  const handleErrorStatus = (err) => {
    if (err.message.includes("transaction")) {
      setStatusColor("red");
      setStatus(
        "Transaction failed. Please check your network or wallet connection."
      );
    } else if (err.message.includes("insufficient funds")) {
      setStatusColor("red");
      setStatus("Insufficient funds to complete the transaction.");
    } else {
      setStatusColor("red");
      setStatus(
        "An issue occurred while securely processing your file. Please try again."
      );
    }
  };

  const handleTopUp = () => {
    setShowTopUpModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(walletPublicKey)
      .then(() => {
        alert("Wallet address copied to clipboard!");
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
      });
  };

  const handleFiatPayment = async () => {
    try {
      if (!walletServicesPlugin) {
        throw new Error("Wallet Services Plugin is not initialized");
      }

      const fiatOnRampResponse = await walletServicesPlugin.connectToOnramp({
        provider: "moonpay",
        amount: platformFee,
        currency: "USD",
      });

      window.location.href = fiatOnRampResponse.onrampURL;
    } catch (error) {
      console.error("Error processing fiat payment:", error);
      setStatusColor("red");
      setStatus("Error during fiat payment. Please try again.");
    }
  };

  const getShortenedIdentifier = (identifier) => {
    if (!identifier) return "";
    return `${identifier.slice(0, 4)}...${identifier.slice(-4)}`;
  };

  const uploadToPinataNoLogin = async () => {
    if (!file || !fileName) {
      alert("Please provide the file and name.");
      return;
    }

    setLoading(true);
    setStatusColor("");
    setStatus("Processing and uploading file for guest user...");

    try {
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(fileArrayBuffer);
      const fileType = file.type;

      const uploadResponse = await fetch("/.netlify/functions/uploadToPinata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileBuffer: fileBuffer.toString("base64"),
        }),
      });

      const uploadData = await uploadResponse.json();
      const cid = uploadData?.cid;

      if (!cid) {
        throw new Error("Failed to retrieve CID from Pinata");
      }

      setFileCid(cid);
      setFileUrl(`https://ipfs.io/ipfs/${cid}`);

      const newFileMetadata = {
        fileName,
        fileCid: cid,
        fileType,
        fileSizeMB,
        description,
      };
      setUploadedFiles((prevFiles) => [...prevFiles, newFileMetadata]);

      const storedFiles =
        JSON.parse(localStorage.getItem(`files_${noLoginAccount.id}`)) || [];
      storedFiles.push(newFileMetadata);
      localStorage.setItem(
        `files_${noLoginAccount.id}`,
        JSON.stringify(storedFiles)
      );

      setStatus("File successfully uploaded without on-chain registration.");
      setStatusColor("green");

      navigate("/uploaderdashboard", { state: { shouldReload: true } });
    } catch (error) {
      console.error(
        "Error during file processing or upload for no-login user:",
        error
      );
      setStatusColor("red");
      setStatus("Error during file upload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="homepage-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo" onClick={() => navigate("/")}>
          <img src={logo} alt="Logo" className="logo" />
        </div>

        {walletPublicKey ? (
          <div className="wallet-info" onClick={handleTopUp}>
            <div className="wallet-container">
              <div className="wallet-address">
                <span className="wallet-icon">🔑</span>
                <div className="wallet-display">
                  <p>{`${walletPublicKey.slice(0, 4)}...${walletPublicKey.slice(-4)}`}</p>
                </div>
              </div>
              <div className="wallet-balance">
                <span className="balance-icon">💰</span>
                <div>
                  <p>{walletBalance.toFixed(2)} SOL</p>
                </div>
              </div>
            </div>
            <p className="wallet-extra-info">Click Here to Fund Your Wallet</p>
          </div>
        ) : noLoginAccount ? (
          <div className="guest-account-info">
            <p>
              You are in guest account:{" "}
              {getShortenedIdentifier(noLoginAccount.id)}
            </p>
          </div>
        ) : (
          <p>Loading...</p>
        )}

        <div>
          <button onClick={navigateToDashboard} className="dashboard-button">
            Dashboard
          </button>
        </div>
      </nav>

      {/* Top-Up Modal - only show if user is logged-in */}
      {walletPublicKey && showTopUpModal && (
        <div className="topup-modal">
          <div className="modal-content">
            <h3>Fund Your Wallet</h3>
            <p>
              To proceed with uploading, please fund your wallet using the QR
              code below.
            </p>

            {/* Render the Solana Pay QR Code */}
            <div id="solana-top-up-qr"></div>

            <p className="wallet-address-full">
              {walletPublicKey}
              <FaClipboard
                onClick={copyToClipboard}
                style={{ cursor: "pointer", marginLeft: "10px" }}
              />
            </p>

            <button
              onClick={() => setShowTopUpModal(false)}
              className="dashboard-button"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Drag-and-Drop Section */}
      <section className="hero-container">
        <div className="drag-drop-section" {...getRootProps()}>
          <input {...getInputProps()} />
          {!file && !isUploading ? (
            <>
              {isDragActive ? (
                <div className="drag-active">
                  <p>Drop your files here...</p>
                </div>
              ) : (
                <div className="drag-inactive">
                  <img src={fox} alt="Logo" className="drag-image" />
                  <p>Drag and drop files here,</p>
                  <p>or click to upload</p>
                </div>
              )}
            </>
          ) : file && !isUploading ? (
            <motion.div
              className="file-info"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <FaFileAlt size={50} />
              <p>{fileName}</p>
              <p>{fileSizeMB} MB</p>
            </motion.div>
          ) : (
            <motion.div
              className="uploading-status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <Oval color="#007bff" height={50} width={50} />
              <p>{status}</p>
            </motion.div>
          )}
        </div>
      </section>

      {/* File Upload Section */}
      <div className="file-upload-section">
        <motion.h2 className="file-upload-heading">
          Upload Your Digital Asset
        </motion.h2>

        {/* File Upload Inputs (only file name and price inputs remain) */}
        <motion.div className="file-upload-input">
          <input
            type="text"
            placeholder="File Name"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="input-field"
          />
          <input
            type="text"
            placeholder="File URL (Generated Automatically)"
            value={fileUrl}
            readOnly
            className="input-field"
          />
          {walletPublicKey && (
            <>
              <input
                type="number"
                placeholder="Price (in SOL)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input-field"
              />
            </>
          )}
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => {
              if (e.target.value.length <= 1000) {
                setDescription(e.target.value);
              }
            }}
            className="textarea"
          />
          <p>{description.length}/1000</p>
        </motion.div>

        {/* Upload and Payment Buttons */}
        {!loading ? (
          <>
            {walletPublicKey ? (
              <>
                <motion.button
                  className="upload-button"
                  onClick={uploadToPinata}
                >
                  Upload and Pay with Crypto
                </motion.button>
                <motion.button
                  className="fiat-button"
                  onClick={handleFiatPayment}
                >
                  Pay with Fiat
                </motion.button>
              </>
            ) : (
              <motion.button
                className="upload-button"
                onClick={uploadToPinataNoLogin}
              >
                Upload
              </motion.button>
            )}
          </>
        ) : (
          <div className="loading-container">
            <Oval color="#007bff" height={50} width={50} />
            <p>{status}</p>
          </div>
        )}
      </div>

      {/* Status Message */}
      {!loading && status && (
        <div
          className={`status-message ${
            statusColor === "red" ? "error" : "success"
          }`}
        >
          {status}
        </div>
      )}

      {/* Footer */}
      <footer className="footer-container">
        <div className="footer-mid">
          <img src={logo} alt="Website Logo" className="footer-logo" />
        </div>
        <div className="footer-right">
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
          >
            <FaFacebook className="social-icon" />
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Twitter"
          >
            <BsTwitterX className="social-icon" />
          </a>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
          >
            <FaInstagram className="social-icon" />
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
          >
            <FaLinkedin className="social-icon" />
          </a>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
