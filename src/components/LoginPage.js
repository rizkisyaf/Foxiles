import React, { useEffect, useState } from "react";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { SolanaPrivateKeyProvider } from "@web3auth/solana-provider";
import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import "./LoginPage.css";
import { useNavigate } from "react-router-dom";
import { motion } from 'framer-motion';
import logo from '../assets/2.png';
import hero from '../assets/hero.png';

// Web3Auth configuration for Solana
const clientId = process.env.REACT_APP_WEB3AUTH_CLIENT_ID;
const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.SOLANA,
  chainId: "0x2", // Solana Devnet
  rpcTarget: "https://api.devnet.solana.com",
  displayName: "Solana Devnet",
  ticker: "SOL",
  tickerName: "Solana",
};

// Firebase Configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const LoginPage = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [web3auth, setWeb3auth] = useState(null);
  const navigate = useNavigate();

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);

  useEffect(() => {
    const initWeb3Auth = async () => {
      try {
        const privateKeyProvider = new SolanaPrivateKeyProvider({
          config: { chainConfig },
        });
        const web3authInstance = new Web3Auth({
          clientId,
          chainConfig,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          privateKeyProvider,
        });
        await web3authInstance.initModal();
        setWeb3auth(web3authInstance);

        // Handle redirect result after signInWithRedirect
        const auth = getAuth(app);
        const result = await getRedirectResult(auth);
        if (result) {
          const web3authProvider = await web3authInstance.connect();
          onLogin(web3authInstance, web3authProvider);
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Web3Auth initialization error:", error);
      }
    };

    initWeb3Auth();
  }, [app, navigate, onLogin]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const auth = getAuth(app);
      const googleProvider = new GoogleAuthProvider();
      await signInWithPopup(auth, googleProvider);
      setLoading(false);
    } catch (err) {
      if (err.code === "auth/popup-blocked") {
        console.warn("Popup was blocked. Using redirect instead.");
        const auth = getAuth(app);
        const googleProvider = new GoogleAuthProvider();
        await signInWithRedirect(auth, googleProvider);
      } else {
        console.error("Error during Google login:", err);
        setLoading(false);
      }
    }
  };

  const login = async () => {
    if (!web3auth) {
      console.log("Web3Auth not initialized yet");
      return;
    }
    try {
      setLoading(true);
      const web3authProvider = await web3auth.connect();
      await signInWithGoogle();
      onLogin(web3auth, web3authProvider); // Pass both web3auth and the provider
      navigate("/dashboard");
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <img src={logo} alt="logo" className="logo-login" />
        </button>
        <div className="login-form">
          <h1>Login</h1>
          <p style={{ color: "#fafafa" }}>
            Sign in with your Google account to get started.
          </p>
          {loading ? (
            <p style={{ color: "#fafafa" }}>Loading...</p>
          ) : (
            <button className="btn login" onClick={login}>
              Login with Google
            </button>
          )}
        </div>
      </div>
      <div className="login-right">
        <h2>Secure, Seamless, and Anonymous Access</h2>
        <p>
          No wallet? No problem. Start using the platform with just your email.
        </p>
        <p>
          Get paid instantly, upload content securely, and enjoy full privacy
          through decentralized identity (DID).
        </p>
        <p>
          Content protection via DRM ensures your files are safe, and invisible
          tracking prevents unauthorized actions.
        </p>
        <motion.img
          src={hero}
          alt="background image"
          className="image-right"
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </div>
  );
};

export default LoginPage;
