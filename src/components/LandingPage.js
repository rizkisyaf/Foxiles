import React from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import "./LandingPage.css";
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";
import {
  BsTwitterX,
  BsIncognito,
  BsPaletteFill,
  BsCameraReelsFill,
  BsFillEasel2Fill,
  BsBriefcaseFill,
  BsCodeSquare,
  BsEyedropper,
  BsNewspaper,
  BsFillFolderFill,
  BsShieldFillCheck,
  BsCameraFill,
  BsStars,
} from "react-icons/bs";
import logo from "../assets/2.png";
import hero from "../assets/hero.png";
import why from "../assets/why.png";
import creator from "../assets/creator.png";
import f1 from "../assets/f1.png";
import f2 from "../assets/f2.png";
import f3 from "../assets/f3.png";
import f4 from "../assets/f4.png";

const LandingPage = ({ onCreateNoLogin }) => {
  const navigate = useNavigate();
  // Array for "who" section
  const who = [
    { icon: <BsIncognito />, title: "Whistleblowers" },
    {
      icon: <BsPaletteFill />,
      title: "Creative Professionals Selling Digital Art",
    },
    { icon: <BsCameraReelsFill />, title: "Exclusive Video or Audio Content" },
    { icon: <BsFillEasel2Fill />, title: "Educational Content" },
    {
      icon: <BsBriefcaseFill />,
      title: "Confidential Business Document Sharing",
    },
    {
      icon: <BsEyedropper />,
      title: "Scientific Research and Academic Papers",
    },
    { icon: <BsCodeSquare />, title: "Independent Software Developers" },
    { icon: <BsNewspaper />, title: "Journalists and Media" },
    { icon: <BsFillFolderFill />, title: "Legal Document Sharing" },
    { icon: <BsShieldFillCheck />, title: "Secretive Information Exchanges" },
    {
      icon: <BsCameraFill />,
      title: "Specialized Photography and Videography",
    },
    { icon: <BsStars />, title: "Celebrity or Influencer Exclusive Content" },
  ];

  const handleNoLoginButtonClick = () => {
    onCreateNoLogin();
    navigate("/dashboard");
  };

  return (
    <div className="landing-container">
      {/* Section 1: Hero with subtle animation */}
      <section className="page-container">
        <div className="hero-section">
          <div className="content-column">
            <motion.img
              src={logo}
              alt="Foxiles Logo"
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
              Organize, Label, and Securely Share Your Documents, Hassle-Free.
            </motion.h1>

            <motion.p
              className="hero-subtitle"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 0.6, y: 0 }}
              transition={{ duration: 1.2 }}
            >
              Imagine a file-sharing solution that automatically organizes,
              labels, and indexes your documents, <br />
              providing top-tier security and monetization options—without the
              hassle of login.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.5, type: "spring", stiffness: 100 }}
            >
              <Link to="/login" className="cta-button">
                Log Me In
              </Link>
            </motion.div>
            {/* No-login account button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.7, type: "spring", stiffness: 100 }}
              style={{ marginTop: "20px" }}
            >
              <button
                onClick={handleNoLoginButtonClick}
                className="cta-button no-login-button"
              >
                Start as Guest
              </button>
              <p>
                No account needed. Upload and share privately with our no-login
                feature.
              </p>
            </motion.div>
          </div>
          <div className="image-column">
            <motion.img
              src={hero}
              alt="background image"
              className="hero-image"
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
      </section>

      {/* Section 2: Narrative - Why Foxiles is different */}
      <section className="narrative-section">
        <div className="left-column">
          <motion.img
            src={why}
            alt="Creative technology"
            className="narrative-image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 1 }}
          />
        </div>
        <div className="right-column">
          <motion.div
            className="narrative-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <h2>Why Foxiles?</h2>
            <p>
              Foxiles eliminates the complexity of file-sharing. No login
              required—just upload, organize, and share your files with ease.
              Automatically index your documents and gain peace of mind with
              robust security and monetization options built-in.
            </p>
            <p>
              Whether you're a content creator, business professional, or simply
              someone who values privacy, Foxiles makes it easy to secure and
              monetize your digital assets, all without any of the usual
              barriers.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section 3: Who Section */}
      <section className="who-section">
        <h2 className="who-titlee">Who is This For?</h2>
        <div className="who-grid">
          {who.map((who, index) => (
            <div key={index} className="who-card">
              <div className="who-header">
                <div className="who-icon">{who.icon}</div>
                <h3 className="who-title">{who.title}</h3>
              </div>
              <div className="who-divider"></div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Key Features */}
      <section className="features-section">
        <div className="overview-text">
          <h2>Our Features</h2>
        </div>
        <motion.div className="feature-card" whileHover={{ scale: 1.05 }}>
          <img src={f1} alt="Maximize Revenue" className="feature-icon" />
          <h3>Automatic Document Organization</h3>
          <p>
            Foxiles automatically organizes your files, making it easy to find
            and manage your documents.
          </p>
        </motion.div>

        <motion.div className="feature-card" whileHover={{ scale: 1.05 }}>
          <img src={f3} alt="Fast Payments" className="feature-icon" />
          <h3>Monetization Without Barriers</h3>
          <p>
            Monetize your content seamlessly, with instant payments and no
            hidden fees.
          </p>
        </motion.div>

        <motion.div className="feature-card" whileHover={{ scale: 1.05 }}>
          <img src={f2} alt="Blockchain Security" className="feature-icon" />
          <h3>Top-Tier Security</h3>
          <p>
            Your files are protected by blockchain security, ensuring that your
            data is safe from unauthorized access.
          </p>
        </motion.div>

        <motion.div className="feature-card" whileHover={{ scale: 1.05 }}>
          <img src={f4} alt="Decentralized Identity" className="feature-icon" />
          <h3>Decentralized Identity</h3>
          <p>
            Your identity is protected through DID, ensuring privacy and
            security.
          </p>
        </motion.div>
      </section>

      {/* Section 5: Short Overview */}
      <section className="overview-section">
        <div className="right-column">
          <motion.div
            className="overview-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <h2>For Creators, By Creators</h2>
            <p>
              Foxiles is built by creators, for creators. Whether you’re an
              artist looking to protect your intellectual property or a
              developer wanting to sell your code, we’ve created a platform
              where your creations are safe, your identity is protected, and
              your earnings go directly to you—without the need for
              intermediaries or wallets.
            </p>
          </motion.div>
        </div>
        <div className="left-column">
          <motion.img
            src={creator}
            alt="Secure Content"
            className="overview-image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: 1 }}
          />
        </div>
      </section>

      {/* Section 6: Call to Action */}
      <section className="cta-section">
        <motion.h2
          className="cta-heading"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Ready to Securely Share Your Files?
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

      <footer className="footer-container">
        {/* <div className="footer-left">
          <h1>Exclusive newslatter for 500 of our closest friends.</h1>
          <p>A currated hit list of our favorite things happening across product, design, and building for the future</p>
          <Link to="/login" className="footer-button">
            Get Started
          </Link>
        </div> */}
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
};

export default LandingPage;
