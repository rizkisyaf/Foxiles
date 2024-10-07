//homepage.js
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
  getConnection,
  prepareInstructionData,
} from "../utils/registerService";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Oval } from "react-loader-spinner";
import { initializePlatformState } from "../utils/PlatformService";
import "./HomePage.css";
import { SolanaWallet } from "@web3auth/solana-provider";
import { FileRegistration } from "../utils/types";
import { sha256 } from "js-sha256";
import { QRCodeCanvas } from "qrcode.react";
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

function HomePage({ provider, walletServicesPlugin, web3auth }) {
  const [file, setFile] = useState(null);
  const [fileSizeMB, setFileSizeMB] = useState(0);
  const [fileCid, setFileCid] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
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
        console.log(
          "Fetched Platform State Public Key:",
          platformStatePubKey.toBase58()
        );
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
          console.log("Fetched wallet public key:", accounts[0]);

          // Fetch wallet balance
          const connection = new Connection("https://api.devnet.solana.com");
          const balance = await connection.getBalance(
            new PublicKey(accounts[0])
          );
          setWalletBalance(balance / LAMPORTS_PER_SOL);

          // Show top-up modal if balance is zero
          if (balance === 0) {
            setShowTopUpModal(true);
          }
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
    }
  }, [provider, web3auth]);

  const navigateToDashboard = () => {
    navigate("/uploaderdashboard");
  };

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    const fileSizeMB = parseFloat(
      (selectedFile.size / (1024 * 1024)).toFixed(2)
    );
    const maxSizeMB = 500;

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
      console.log("File uploaded:", selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": [],
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

    setLoading(true);
    setStatusColor("");
    setStatus("Processing and uploading file...");

    try {
      // Step 1: Read the file into a buffer
      const fileArrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(fileArrayBuffer);

      console.log("File type: ", file.type); // Debug log
      console.log("File size (bytes): ", file.size); // Debug log

      const fileType = file.type;

      // Step 2: Process the file by sending it to the backend
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

      // Step 3: Upload processed file to Pinata
      const uploadResponse = await fetch(
        "/.netlify/functions/uploadToPinata",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileBuffer: processedFileBuffer.toString("base64"),
          }),
        }
      );

      const uploadData = await uploadResponse.json();
      const cid = uploadData?.cid;

      if (!cid) {
        throw new Error("Failed to retrieve CID from Pinata");
      }

      setFileCid(cid);
      setFileUrl(`https://ipfs.io/ipfs/${cid}`);

      // Store uploaded file's metadata in state
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
      // Register file on-chain and pass the encryption key
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
      console.log("Registering file with size (MB):", fileSizeMB);

      // Validate user input
      validateInput(cid, fileName, description, price, fileType);

      if (!provider || !walletPublicKey) {
        throw new Error("Wallet or platform state not available.");
      }

      const solanaWallet = new SolanaWallet(provider);

      // Get connection details
      const connectionConfig = await solanaWallet.request({
        method: "solana_provider_config",
        params: [],
      });
      const connection = new Connection(connectionConfig.rpcTarget);

      // Get accounts
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
      console.log(
        "Instruction data prepared for transaction:",
        instructionData
      );

      const platformFeeAccount = new PublicKey(
        process.env.REACT_APP_PLATFORM_FEE_ACCOUNT
      );

      // Hash the file name
      const fileNameHash = Buffer.from(sha256.digest(fileName));

      // Deriving the Program Derived Address (PDA)
      const [fileInfoPda, bumpSeed] = await PublicKey.findProgramAddressSync(
        [
          new PublicKey(walletPublicKey).toBuffer(),
          Buffer.from("file_info"),
          fileNameHash,
        ],
        programID
      );

      console.log("Derived File Info PDA:", fileInfoPda.toBase58());

      // Check if PDA already exists
      const fileInfoAccount = await connection.getAccountInfo(fileInfoPda);

      if (!fileInfoAccount) {
        console.log("File info account does not exist, creating it...");

        // Fetch latest blockhash
        const block = await connection.getLatestBlockhash("finalized");
        console.log("Latest Blockhash:", block.blockhash);
        console.log("Last Valid Block Height:", block.lastValidBlockHeight);

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

        // Use signAndSendTransaction directly
        const { signature } =
          await solanaWallet.signAndSendTransaction(transaction);
        console.log("Transaction successful with signature:", signature);

        // Update UI status
        setStatusColor("green");
        setStatus("File successfully registered.");
        navigate("/uploaderdashboard", { state: { shouldReload: true } });
      } else {
        console.log("File info account already exists, skipping creation.");
        // Proceed with updating or using the file account logic here...
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

  return (
    <div className="homepage-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo" onClick={() => navigate("/")}>
          <img src={logo} alt="Logo" className="logo" />
        </div>
        <div className="wallet-info" onClick={handleTopUp}>
          {walletPublicKey ? (
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
          ) : (
            <p>Loading wallet...</p>
          )}
          <p className="wallet-extra-info">Click Here to Fund Your Wallet</p>
        </div>
        <div>
          <button onClick={navigateToDashboard} className="dashboard-button">
            Dashboard
          </button>
        </div>
      </nav>

      {/* Top-Up Modal */}
      {showTopUpModal && (
        <div className="topup-modal">
          <div className="modal-content">
            <h3>Fund Your Wallet</h3>
            <p>
              To proceed with uploading, please fund your wallet. You can use
              the QR code or wallet address below to deposit SOL.
            </p>
            <QRCodeCanvas
              value={`solana:${walletPublicKey}?amount=1`}
              size={200}
            />
            <p className="wallet-address-full">
              {walletPublicKey}{" "}
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
                  <p>Drag and drop files here, or click to upload</p>
                  <p className="drop-instructions">Accepted: Images, PDFs</p>
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
              <p>File uploaded: {fileName}</p>
              <p>File size: {fileSizeMB} MB</p>
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
            placeholder="File URL (Generate Automatically)"
            value={fileUrl}
            readOnly
            className="input-field"
          />
          <input
            type="number"
            placeholder="Price (in SOL)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-field"
          />
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
          <p>{description.length}/1000</p> {/* Display character count */}
        </motion.div>

        {/* Upload and Payment Buttons */}
        {!loading ? (
          <>
            <motion.button className="upload-button" onClick={uploadToPinata}>
              Upload and Pay with Crypto
            </motion.button>
            <motion.button className="fiat-button" onClick={handleFiatPayment}>
              Pay with Fiat
            </motion.button>
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
