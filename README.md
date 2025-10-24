# Traceable-Drug-Provenance-System# 🔍 Traceable Drug Provenance System

Welcome to a blockchain-powered solution for combating counterfeit medicines in developing countries! This project uses the Stacks blockchain and Clarity smart contracts to create an immutable, transparent supply chain for pharmaceuticals, ensuring drugs can be traced from manufacturer to end-user.

## ✨ Features

🔒 Register drug batches with unique identifiers and metadata  
📍 Track ownership transfers through the supply chain (manufacturer → distributor → pharmacy → patient)  
✅ Verify drug authenticity at any point using batch IDs  
🚨 Issue and manage recalls for contaminated or counterfeit batches  
📊 Generate audit logs for regulatory compliance  
🌍 Support for multi-party verification in resource-limited settings  
🛡️ Prevent tampering with immutable timestamps and hashes  
🔄 Integrate with IoT devices for real-time scanning (e.g., QR codes on packaging)

## 🛠 How It Works

This system leverages 8 Clarity smart contracts to handle different aspects of drug provenance, ensuring security and scalability on the Stacks blockchain. Here's a high-level overview:

### Core Smart Contracts
1. **ManufacturerRegistry.clar**: Registers verified manufacturers and their credentials to ensure only authorized entities can create drug batches.  
2. **DrugBatchRegistry.clar**: Allows manufacturers to register new drug batches with details like batch ID, production date, expiration, composition hash, and metadata.  
3. **SupplyChainTracker.clar**: Tracks the chain of custody by logging transfers between parties (e.g., manufacturer to distributor).  
4. **OwnershipTransfer.clar**: Handles secure transfers of batch ownership, requiring signatures from both parties and updating the provenance trail.  
5. **VerificationContract.clar**: Enables anyone to query and verify a drug's history using its batch ID, checking for authenticity and tampering.  
6. **RecallManager.clar**: Allows authorities or manufacturers to flag batches for recall, notifying all holders and blocking further transfers.  
7. **AuditLogger.clar**: Maintains an immutable log of all actions (registrations, transfers, verifications) for audits and investigations.  
8. **UserRegistry.clar**: Manages roles for distributors, pharmacies, and end-users, with access controls for sensitive operations.

**For Manufacturers**  
- Register your company via ManufacturerRegistry.  
- Create a new batch in DrugBatchRegistry, including a SHA-256 hash of the drug's composition and packaging details.  
- Transfer ownership to distributors using OwnershipTransfer.

**For Distributors and Pharmacies**  
- Receive batches via SupplyChainTracker and update the chain with each handover.  
- Use VerificationContract to confirm incoming batches are legitimate before acceptance.

**For Patients and Verifiers**  
- Scan a QR code or enter a batch ID to call verify-batch in VerificationContract.  
- Check for recalls via RecallManager to ensure safety.

**For Regulators**  
- Access AuditLogger for full transparency and compliance reports.

This setup solves the real-world issue of counterfeit drugs by providing end-to-end traceability, reducing fraud, and building trust in healthcare supply chains—especially in developing countries where fakes cause thousands of deaths annually. Deploy on Stacks for low-cost, secure transactions!