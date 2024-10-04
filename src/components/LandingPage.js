import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import logo from '../assets/logo.svg';

const LandingPage = () => {
  return (
    <div className="landing-container">
      {/* Section 1: Hero with subtle animation */}
      <section className="hero-section">
        <motion.img
          src={logo}
          alt="Filyte Logo"
          className="hero-logo"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        />
        <motion.h1
          className="hero-title"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Empower Your Digital Creativity
        </motion.h1>
        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2 }}
        >
          Share, sell, and protect your digital assets with the power of decentralization.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5, type: 'spring', stiffness: 100 }}
        >
          <Link to="/login" className="cta-button">
            Start Selling Now
          </Link>
        </motion.div>
      </section>

      {/* Section 2: Narrative - Why Filyte is different */}
      <section className="narrative-section">
        <motion.div
          className="narrative-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <h2>Why Filyte?</h2>
          <p>
            At Filyte, we believe in empowering creators by giving them full control over their digital assets. 
            Whether you're a developer, artist, educator, or entrepreneur, Filyte offers a seamless, wallet-free 
            onboarding experience with decentralized identity (DID), allowing you to sell your creations with 
            complete anonymity and security.
          </p>
        </motion.div>
        <motion.img
          src="https://source.unsplash.com/featured/?creativity,technology"
          alt="Creative technology"
          className="narrative-image"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        />
      </section>

      {/* Section 3: Key Features */}
      <section className="features-section">
        <motion.div className="feature-card" whileHover={{ scale: 1.05 }}>
          <img
            src="https://source.unsplash.com/100x100/?money"
            alt="Maximize Revenue"
            className="feature-icon"
          />
          <h3>Maximize Revenue</h3>
          <p>Earn 95% of every sale, no hidden fees or intermediaries.</p>
        </motion.div>

        <motion.div className="feature-card" whileHover={{ scale: 1.05 }}>
          <img
            src="https://source.unsplash.com/100x100/?speed"
            alt="Fast Payments"
            className="feature-icon"
          />
          <h3>Instant Payments</h3>
          <p>Receive instant payments directly into your non-custodial wallet.</p>
        </motion.div>

        <motion.div className="feature-card" whileHover={{ scale: 1.05 }}>
          <img
            src="https://source.unsplash.com/100x100/?security"
            alt="Blockchain Security"
            className="feature-icon"
          />
          <h3>Blockchain Security</h3>
          <p>Your assets are securely stored on-chain, fully protected from piracy.</p>
        </motion.div>

        <motion.div className="feature-card" whileHover={{ scale: 1.05 }}>
          <img
            src="https://source.unsplash.com/100x100/?decentralization"
            alt="Decentralized Identity"
            className="feature-icon"
          />
          <h3>Decentralized Identity</h3>
          <p>Your identity is protected through DID, ensuring privacy and security.</p>
        </motion.div>
      </section>

      {/* Section 4: Short Overview */}
      <section className="narrative-section">
        <motion.div
          className="narrative-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <h2>For Creators, By Creators</h2>
          <p>
            Filyte is built by creators, for creators. Whether you’re an artist looking to protect your
            intellectual property or a developer wanting to sell your code, we’ve created a platform where
            your creations are safe, your identity is protected, and your earnings go directly to you—without
            the need for intermediaries or wallets.
          </p>
        </motion.div>
        <motion.img
          src="https://source.unsplash.com/featured/?content,security"
          alt="Secure Content"
          className="narrative-image"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        />
      </section>

      {/* Section 5: Call to Action */}
      <section className="cta-section">
        <motion.h2
          className="cta-heading"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Ready to Sell Your Digital Content?
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Link to="/login" className="cta-button">
            Get Started
          </Link>
        </motion.div>
      </section>
    </div>
  );
};

export default LandingPage;
