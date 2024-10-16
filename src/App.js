import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import BuyerPage from "./components/BuyerPage";
import LandingPage from "./components/LandingPage";
import UploaderDashboard from "./components/UploaderDashboard";
import FileDetailPage from "./components/FileDetailPage";
import { WalletServicesPlugin } from "@web3auth/wallet-services-plugin";
import { v4 as uuidv4 } from "uuid";

const App = () => {
  const [provider, setProvider] = useState(null);
  const [web3auth, setWeb3auth] = useState(null);
  const [noLoginAccount, setNoLoginAccount] = useState(() => {
    // Check if the user already has a no-login account in localStorage
    const storedAccount = localStorage.getItem("noLoginAccount");
    return storedAccount ? JSON.parse(storedAccount) : null;
  });

  const createNoLoginAccount = () => {
    const account = {
      id: uuidv4(), // Generate a unique ID
      createdAt: new Date().toISOString(),
    };
    setNoLoginAccount(account);
    localStorage.setItem("noLoginAccount", JSON.stringify(account));
  };

  const handleLogin = (web3authInstance, web3authProvider) => {
    setWeb3auth(web3authInstance);
    setProvider(web3authProvider);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<LandingPage onCreateNoLogin={createNoLoginAccount} />}
        />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route
          path="/dashboard"
          element={
            provider && web3auth ? (
              <HomePage
                provider={provider}
                walletServicesPlugin={WalletServicesPlugin}
                web3auth={web3auth}
                noLoginAccount={noLoginAccount}
              />
            ) : noLoginAccount ? (
              <HomePage noLoginAccount={noLoginAccount} />
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
              <UploaderDashboard
                provider={provider}
                web3auth={web3auth}
                noLoginAccount={noLoginAccount}
              />
            ) : noLoginAccount ? (
              <UploaderDashboard noLoginAccount={noLoginAccount} />
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
