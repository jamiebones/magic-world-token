const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MagicWorldGems - EIP-2612 Permit", function () {
    let magicWorldGems;
    let owner, spender, receiver, other;
    let initialSupply = ethers.parseEther("1000000"); // 1M tokens
    const TOKEN_NAME = "Magic World Gems";
    const TOKEN_SYMBOL = "MWG";

    // EIP-2612 constants
    const PERMIT_TYPEHASH = ethers.keccak256(
        ethers.toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
    );

    beforeEach(async function () {
        [owner, spender, receiver, other] = await ethers.getSigners();

        // Deploy token contract
        const MagicWorldGems = await ethers.getContractFactory("MagicWorldGems");
        magicWorldGems = await MagicWorldGems.deploy(TOKEN_NAME, TOKEN_SYMBOL, initialSupply);
        await magicWorldGems.waitForDeployment();

        // Transfer some tokens to other accounts for testing
        await magicWorldGems.transfer(spender.address, ethers.parseEther("10000"));
        await magicWorldGems.transfer(other.address, ethers.parseEther("10000"));
    });

    describe("EIP-2612 Domain Separator", function () {
        it("Should have correct domain separator", async function () {
            const domainSeparator = await magicWorldGems.DOMAIN_SEPARATOR();
            expect(domainSeparator).to.be.a('string');
            expect(domainSeparator).to.match(/^0x[a-fA-F0-9]{64}$/); // 32 bytes = 64 hex chars
        });

        it("Should return consistent domain separator", async function () {
            const separator1 = await magicWorldGems.DOMAIN_SEPARATOR();
            const separator2 = await magicWorldGems.DOMAIN_SEPARATOR();
            expect(separator1).to.equal(separator2);
        });
    });

    describe("Nonces", function () {
        it("Should start with nonce 0", async function () {
            expect(await magicWorldGems.nonces(owner.address)).to.equal(0);
            expect(await magicWorldGems.nonces(spender.address)).to.equal(0);
        });

        it("Should increment nonce after successful permit", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) + 3600; // 1 hour from now
            const nonce = await magicWorldGems.nonces(owner.address);

            // Get domain separator
            const domain = {
                name: TOKEN_NAME,
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await magicWorldGems.getAddress()
            };

            // Create permit signature
            const types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const message = {
                owner: owner.address,
                spender: spender.address,
                value: value,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, message);
            const { v, r, s } = ethers.Signature.from(signature);

            // Execute permit
            await magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s);

            // Nonce should be incremented
            expect(await magicWorldGems.nonces(owner.address)).to.equal(nonce + 1n);
        });

        it("Should have independent nonces per address", async function () {
            expect(await magicWorldGems.nonces(owner.address)).to.equal(0);
            expect(await magicWorldGems.nonces(spender.address)).to.equal(0);
            expect(await magicWorldGems.nonces(other.address)).to.equal(0);
        });
    });

    describe("Permit Functionality", function () {
        async function getPermitSignature(ownerWallet, spenderAddress, value, deadline, nonce) {
            const domain = {
                name: TOKEN_NAME,
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await magicWorldGems.getAddress()
            };

            const types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const message = {
                owner: ownerWallet.address,
                spender: spenderAddress,
                value: value,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await ownerWallet.signTypedData(domain, types, message);
            return ethers.Signature.from(signature);
        }

        it("Should allow permit approval", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) + 3600;
            const nonce = await magicWorldGems.nonces(owner.address);

            const { v, r, s } = await getPermitSignature(owner, spender.address, value, deadline, nonce);

            // Check initial allowance
            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(0);

            // Execute permit
            await expect(magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s))
                .to.emit(magicWorldGems, "Approval")
                .withArgs(owner.address, spender.address, value);

            // Check final allowance
            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(value);
        });

        it("Should allow spender to transferFrom after permit", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) + 3600;
            const nonce = await magicWorldGems.nonces(owner.address);

            const { v, r, s } = await getPermitSignature(owner, spender.address, value, deadline, nonce);

            // Execute permit
            await magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s);

            // Spender can now transfer tokens
            const initialBalance = await magicWorldGems.balanceOf(receiver.address);
            await magicWorldGems.connect(spender).transferFrom(owner.address, receiver.address, value);

            expect(await magicWorldGems.balanceOf(receiver.address)).to.equal(initialBalance + value);
        });

        it("Should reject expired permit", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) - 1; // Already expired
            const nonce = await magicWorldGems.nonces(owner.address);

            const { v, r, s } = await getPermitSignature(owner, spender.address, value, deadline, nonce);

            // Should revert with expired signature
            await expect(
                magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s)
            ).to.be.revertedWithCustomError(magicWorldGems, "ERC2612ExpiredSignature");
        });

        it("Should reject invalid nonce", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) + 3600;
            const invalidNonce = 999n;

            const { v, r, s } = await getPermitSignature(owner, spender.address, value, deadline, invalidNonce);

            // Should revert with invalid signature
            await expect(
                magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s)
            ).to.be.revertedWithCustomError(magicWorldGems, "ERC2612InvalidSigner");
        });

        it("Should reject reused signature", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) + 3600;
            const nonce = await magicWorldGems.nonces(owner.address);

            const { v, r, s } = await getPermitSignature(owner, spender.address, value, deadline, nonce);

            // First permit succeeds
            await magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s);

            // Second attempt with same signature should fail
            await expect(
                magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s)
            ).to.be.revertedWithCustomError(magicWorldGems, "ERC2612InvalidSigner");
        });

        it("Should reject signature from wrong signer", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) + 3600;
            const nonce = await magicWorldGems.nonces(owner.address);

            // Sign with wrong wallet (other instead of owner)
            const { v, r, s } = await getPermitSignature(other, spender.address, value, deadline, nonce);

            // Should revert because signature doesn't match owner
            await expect(
                magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s)
            ).to.be.revertedWithCustomError(magicWorldGems, "ERC2612InvalidSigner");
        });

        it("Should allow permit for max uint256 value", async function () {
            const value = ethers.MaxUint256;
            const deadline = (await time.latest()) + 3600;
            const nonce = await magicWorldGems.nonces(owner.address);

            const { v, r, s } = await getPermitSignature(owner, spender.address, value, deadline, nonce);

            await magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s);

            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(value);
        });

        it("Should handle multiple permits in sequence", async function () {
            const value1 = ethers.parseEther("100");
            const value2 = ethers.parseEther("200");
            const deadline = (await time.latest()) + 3600;

            // First permit
            const nonce1 = await magicWorldGems.nonces(owner.address);
            const sig1 = await getPermitSignature(owner, spender.address, value1, deadline, nonce1);
            await magicWorldGems.permit(owner.address, spender.address, value1, deadline, sig1.v, sig1.r, sig1.s);

            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(value1);

            // Second permit (overwrites first)
            const nonce2 = await magicWorldGems.nonces(owner.address);
            const sig2 = await getPermitSignature(owner, spender.address, value2, deadline, nonce2);
            await magicWorldGems.permit(owner.address, spender.address, value2, deadline, sig2.v, sig2.r, sig2.s);

            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(value2);
        });

        it("Should allow permits for different spenders", async function () {
            const value1 = ethers.parseEther("100");
            const value2 = ethers.parseEther("200");
            const deadline = (await time.latest()) + 3600;

            // Permit for first spender
            const nonce1 = await magicWorldGems.nonces(owner.address);
            const sig1 = await getPermitSignature(owner, spender.address, value1, deadline, nonce1);
            await magicWorldGems.permit(owner.address, spender.address, value1, deadline, sig1.v, sig1.r, sig1.s);

            // Permit for second spender
            const nonce2 = await magicWorldGems.nonces(owner.address);
            const sig2 = await getPermitSignature(owner, other.address, value2, deadline, nonce2);
            await magicWorldGems.permit(owner.address, other.address, value2, deadline, sig2.v, sig2.r, sig2.s);

            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(value1);
            expect(await magicWorldGems.allowance(owner.address, other.address)).to.equal(value2);
        });
    });

    describe("Permit with Contract State", function () {
        it("Should work when contract is not paused", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) + 3600;
            const nonce = await magicWorldGems.nonces(owner.address);

            const domain = {
                name: TOKEN_NAME,
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await magicWorldGems.getAddress()
            };

            const types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const message = {
                owner: owner.address,
                spender: spender.address,
                value: value,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, message);
            const { v, r, s } = ethers.Signature.from(signature);

            await magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s);
            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(value);
        });

        it("Should work even when contract is paused (permit doesn't transfer)", async function () {
            const value = ethers.parseEther("100");
            const deadline = (await time.latest()) + 3600;
            const nonce = await magicWorldGems.nonces(owner.address);

            const domain = {
                name: TOKEN_NAME,
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await magicWorldGems.getAddress()
            };

            const types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const message = {
                owner: owner.address,
                spender: spender.address,
                value: value,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, message);
            const { v, r, s } = ethers.Signature.from(signature);

            // Pause the contract
            await magicWorldGems.pause();

            // Permit should still work (it only sets allowance)
            await magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s);
            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(value);

            // But transferFrom should fail while paused
            await expect(
                magicWorldGems.connect(spender).transferFrom(owner.address, receiver.address, value)
            ).to.be.revertedWithCustomError(magicWorldGems, "EnforcedPause");
        });
    });

    describe("Gas Comparison: Permit vs Approve", function () {
        it("Should demonstrate gas savings with permit", async function () {
            const value = ethers.parseEther("100");

            // Method 1: Traditional approve (costs gas)
            const approveTx = await magicWorldGems.approve(spender.address, value);
            const approveReceipt = await approveTx.wait();
            const approveGas = approveReceipt.gasUsed;

            // Reset allowance
            await magicWorldGems.approve(spender.address, 0);

            // Method 2: Permit (signature is free, only permit execution costs gas)
            const deadline = (await time.latest()) + 3600;
            const nonce = await magicWorldGems.nonces(owner.address);

            const domain = {
                name: TOKEN_NAME,
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await magicWorldGems.getAddress()
            };

            const types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const message = {
                owner: owner.address,
                spender: spender.address,
                value: value,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await owner.signTypedData(domain, types, message);
            const { v, r, s } = ethers.Signature.from(signature);

            const permitTx = await magicWorldGems.permit(owner.address, spender.address, value, deadline, v, r, s);
            const permitReceipt = await permitTx.wait();
            const permitGas = permitReceipt.gasUsed;

            console.log(`\n  Gas comparison:`);
            console.log(`    Approve gas: ${approveGas.toString()}`);
            console.log(`    Permit gas: ${permitGas.toString()}`);
            console.log(`    Note: Permit signature is FREE (off-chain)\n`);

            // Both should result in same allowance
            expect(await magicWorldGems.allowance(owner.address, spender.address)).to.equal(value);
        });
    });
});
