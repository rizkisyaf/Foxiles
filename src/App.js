import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import BuyerPage from "./components/BuyerPage";
import LandingPage from "./components/LandingPage";
import UploaderDashboard from "./components/UploaderDashboard";
import FileDetailPage from "./components/FileDetailPage";
import { WalletServicesPlugin } from "@web3auth/wallet-services-plugin";

const App = () => {
  const [provider, setProvider] = useState(null);
  const [web3auth, setWeb3auth] = useState(null);

  useEffect(() => {
    // Attempt to restore the authentication state from localStorage or session
    const savedProvider = localStorage.getItem("provider");
    const savedWeb3Auth = localStorage.getItem("web3auth");

    if (savedProvider && savedWeb3Auth) {
      setProvider(JSON.parse(savedProvider));
      setWeb3auth(JSON.parse(savedWeb3Auth));
    }
  }, []);

  const handleLogin = (web3authInstance, web3authProvider) => {
    setWeb3auth(web3authInstance);
    setProvider(web3authProvider);

    // Save the authentication state in localStorage or session
    localStorage.setItem("provider", JSON.stringify(web3authProvider));
    localStorage.setItem("web3auth", JSON.stringify(web3authInstance));
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route
          path="/dashboard"
          element={
            provider && web3auth ? (
              <HomePage
                provider={provider}
                walletServicesPlugin={WalletServicesPlugin}
                web3auth={web3auth}
              />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/u/:influencerId"
          element={<BuyerPage provider={provider} />}
        />
        <Route
          path="/uploaderdashboard"
          element={
            provider && web3auth ? (
              <UploaderDashboard provider={provider} web3auth={web3auth} />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />
        <Route path="/file/:fileCid" element={<FileDetailPage />} />
      </Routes>
    </Router>
  );
};

export default App;
