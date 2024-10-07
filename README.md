# Foxiles

**Foxiles** is a decentralized platform designed for content creators, influencers, and file owners to share, monetize, and protect their digital assets with enhanced DRM features. Foxiles utilizes blockchain technology and Web3Auth integration, allowing users to securely manage transactions and retain control over their content distribution. The platform supports uploading files to IPFS via Pinata, where they can be accessed, purchased, and downloaded.

## Key Features

- **User Authentication**: The platform uses Google authentication integrated with Web3Auth to ensure secure and simple onboarding for users.
- **Decentralized File Upload and Sharing**: Users can upload their files to IPFS via Pinata and create unique links for sharing with buyers.
- **Content Protection**: Foxiles applies DRM protection to all files, incorporating encryption, watermarking, and restricted sharing, ensuring that unauthorized use is minimized.
- **Monetization for Content Owners**: Users can set prices for their files in SOL and manage their digital content easily. Buyers can pay either in cryptocurrency or through fiat (with SpherePay integration).
- **Uploader Dashboard**: Provides users with insights into their uploaded files, allowing them to edit metadata such as file name, description, and price.
- **Buyer Page**: Buyers can browse content uploaded by specific influencers and purchase it with a secure transaction process.

## Application Flow

1. **Login and Authentication**:

   - Users can log in using Google through Firebase authentication. Web3Auth then integrates their wallet, allowing them to interact with the blockchain.

2. **Uploader Dashboard**:

   - Content creators can upload their digital assets, set descriptions, set a price, and generate a shareable link for each file. Metadata such as file name and price can be updated later via the uploader dashboard.

3. **Buying Files**:

   - Buyers can view files uploaded by an influencer or content creator, proceed with purchasing using SOL, and download the file securely. The platform enforces DRM rules and self-destruction logic for enhanced protection against unauthorized distribution.

4. **File Registration on Chain**:

   - After a file is uploaded, Foxiles registers it on the Solana blockchain, including important metadata such as uploader public key, file CID, price, and file type.

5. **DRM Features**:
   - Files are encrypted and watermarked before being uploaded to IPFS. During the buying process, only the buyer with valid permissions can decrypt and download the content.

## Technology Stack

- **React**: Frontend framework for building the user interface.
- **Web3Auth**: Used for easy wallet integration and decentralized authentication.
- **Solana Blockchain**: Provides the backend infrastructure for storing metadata and managing transactions.
- **Pinata/IPFS**: Decentralized storage solution for uploaded files.
- **Firebase**: Handles user authentication.
- **Express (Backend)**: Backend server to process file encryption, DRM, and upload files to IPFS.
- **Framer Motion**: Used for animations on the web interface.
- **SpherePay**: For enabling fiat payments.

## Getting Started

To get started with Foxiles:

1. **Clone the Repository**:

   ```bash
   git clone <repo_url>
   cd foxiles
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file with the required configurations:

   - Firebase credentials.
   - Web3Auth client ID.
   - Pinata API credentials.
   - Solana Program ID.

4. **Run the Application**:
   ```bash
   npm start
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000).

## Contribution

Feel free to submit issues or pull requests. We welcome contributions that improve the functionality, security, and efficiency of the platform.

## License

This project is licensed under the MIT License.
