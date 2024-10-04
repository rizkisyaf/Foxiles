import React, { useState } from "react";
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

  const handleLogin = (web3authInstance, web3authProvider) => {
    setWeb3auth(web3authInstance);
    setProvider(web3authProvider);
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
          element={
            <BuyerPage
              provider={provider} // Pass these props but they can be null until login
              walletServicesPlugin={WalletServicesPlugin}
            />
          }
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
