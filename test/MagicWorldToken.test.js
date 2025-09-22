const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MagicWorldToken", function () {
    let MagicWorldToken;
    let token;
    let owner;
    let gameOperator;
    let user1;
    let user2;
    let user3;
    let users;

    const TOKEN_NAME = "Magic World Token";
    const TOKEN_SYMBOL = "MWT";
    const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens

    beforeEach(async function () {
        [owner, gameOperator, user1, user2, user3, ...users] = await ethers.getSigners();

        MagicWorldToken = await ethers.getContractFactory("MagicWorldToken");
        token = await MagicWorldToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY);
        await token.waitForDeployment();

        // Grant GAME_OPERATOR_ROLE to gameOperator
        const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
        await token.grantRole(GAME_OPERATOR_ROLE, gameOperator.address);
    });

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            expect(await token.name()).to.equal(TOKEN_NAME);
            expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
        });

        it("Should assign the total supply to the owner", async function () {
            const ownerBalance = await token.balanceOf(owner.address);
            expect(await token.totalSupply()).to.equal(ownerBalance);
        });

        it("Should have 18 decimals", async function () {
            expect(await token.decimals()).to.equal(18);
        });

        it("Should grant DEFAULT_ADMIN_ROLE to owner", async function () {
            const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
            expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Role Management", function () {
        it("Should allow admin to grant GAME_OPERATOR_ROLE", async function () {
            const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
            await token.grantRole(GAME_OPERATOR_ROLE, user1.address);
            expect(await token.hasRole(GAME_OPERATOR_ROLE, user1.address)).to.be.true;
        });

        it("Should not allow non-admin to grant roles", async function () {
            const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
            await expect(
                token.connect(user1).grantRole(GAME_OPERATOR_ROLE, user2.address)
            ).to.be.reverted;
        });

        describe("Admin Transfer", function () {
            it("Should transfer admin role successfully", async function () {
                const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();

                // Verify initial state
                expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
                expect(await token.hasRole(DEFAULT_ADMIN_ROLE, user1.address)).to.be.false;

                // Transfer admin role
                await expect(token.transferAdmin(user1.address))
                    .to.emit(token, "AdminTransferred")
                    .withArgs(owner.address, user1.address);

                // Verify final state
                expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.false;
                expect(await token.hasRole(DEFAULT_ADMIN_ROLE, user1.address)).to.be.true;
            });

            it("Should not allow non-admin to transfer admin role", async function () {
                await expect(
                    token.connect(user1).transferAdmin(user2.address)
                ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
            });

            it("Should not allow transfer to zero address", async function () {
                await expect(
                    token.transferAdmin(ethers.ZeroAddress)
                ).to.be.revertedWith("MWT: New admin is zero address");
            });

            it("Should not allow transfer to current admin", async function () {
                await expect(
                    token.transferAdmin(owner.address)
                ).to.be.revertedWith("MWT: New admin is current admin");
            });

            it("Should allow new admin to grant roles", async function () {
                // Transfer admin
                await token.transferAdmin(user1.address);

                // New admin should be able to grant roles
                const PAUSE_ROLE = await token.PAUSE_ROLE();
                await expect(
                    token.connect(user1).grantRole(PAUSE_ROLE, user2.address)
                ).to.not.be.reverted;

                expect(await token.hasRole(PAUSE_ROLE, user2.address)).to.be.true;
            });
        });
    });

    describe("Batch Transfers", function () {
        beforeEach(async function () {
            // Transfer some tokens to gameOperator for testing
            await token.transfer(gameOperator.address, ethers.parseEther("10000"));
        });

        describe("batchTransfer", function () {
            it("Should transfer different amounts to multiple recipients", async function () {
                const recipients = [user1.address, user2.address, user3.address];
                const amounts = [
                    ethers.parseEther("100"),
                    ethers.parseEther("200"),
                    ethers.parseEther("300")
                ];

                await expect(
                    token.connect(gameOperator).batchTransfer(recipients, amounts)
                )
                    .to.emit(token, "BatchTransfer")
                    .withArgs(gameOperator.address, ethers.parseEther("600"), 3);

                expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
                expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("200"));
                expect(await token.balanceOf(user3.address)).to.equal(ethers.parseEther("300"));
            });

            it("Should revert if arrays have different lengths", async function () {
                const recipients = [user1.address, user2.address];
                const amounts = [ethers.parseEther("100")];

                await expect(
                    token.connect(gameOperator).batchTransfer(recipients, amounts)
                ).to.be.revertedWith("MWT: Array length mismatch");
            });

            it("Should revert if called by non-operator", async function () {
                const recipients = [user1.address];
                const amounts = [ethers.parseEther("100")];

                await expect(
                    token.connect(user1).batchTransfer(recipients, amounts)
                ).to.be.reverted;
            });

            it("Should revert if batch size exceeds maximum", async function () {
                const recipients = new Array(201).fill(user1.address);
                const amounts = new Array(201).fill(ethers.parseEther("1"));

                await expect(
                    token.connect(gameOperator).batchTransfer(recipients, amounts)
                ).to.be.revertedWith("MWT: Batch size too large");
            });
        });

        describe("batchTransferEqual", function () {
            it("Should transfer equal amounts to multiple recipients", async function () {
                const recipients = [user1.address, user2.address, user3.address];
                const amount = ethers.parseEther("150");

                await expect(
                    token.connect(gameOperator).batchTransferEqual(recipients, amount)
                )
                    .to.emit(token, "BatchTransferEqual");

                expect(await token.balanceOf(user1.address)).to.equal(amount);
                expect(await token.balanceOf(user2.address)).to.equal(amount);
                expect(await token.balanceOf(user3.address)).to.equal(amount);
            });

            it("Should revert if insufficient balance", async function () {
                const recipients = new Array(100).fill(user1.address);
                const amount = ethers.parseEther("1000"); // Would require 100,000 tokens

                await expect(
                    token.connect(gameOperator).batchTransferEqual(recipients, amount)
                ).to.be.revertedWith("MWT: Insufficient balance");
            });
        });
    });

    describe("Pausable Functionality", function () {
        it("Should allow PAUSE_ROLE to pause the contract", async function () {
            await token.pause();
            expect(await token.paused()).to.be.true;
        });

        it("Should prevent transfers when paused", async function () {
            await token.pause();

            await expect(
                token.transfer(user1.address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("Should allow unpausing", async function () {
            await token.pause();
            await token.unpause();
            expect(await token.paused()).to.be.false;
        });

        it("Should not allow non-pause-role to pause", async function () {
            await expect(
                token.connect(user1).pause()
            ).to.be.reverted;
        });
    });

    describe("Gas Optimization", function () {
        it("Should be more gas efficient for equal transfers", async function () {
            await token.transfer(gameOperator.address, ethers.parseEther("10000"));

            const recipients = [user1.address, user2.address, user3.address];
            const amount = ethers.parseEther("100");
            const amounts = [amount, amount, amount];

            // Test batchTransfer gas usage
            const tx1 = await token.connect(gameOperator).batchTransfer(recipients, amounts);
            const receipt1 = await tx1.wait();

            // Reset balances
            await token.connect(user1).transfer(gameOperator.address, amount);
            await token.connect(user2).transfer(gameOperator.address, amount);
            await token.connect(user3).transfer(gameOperator.address, amount);

            // Test batchTransferEqual gas usage
            const tx2 = await token.connect(gameOperator).batchTransferEqual(recipients, amount);
            const receipt2 = await tx2.wait();

            // batchTransferEqual should use less gas
            expect(receipt2.gasUsed).to.be.lessThan(receipt1.gasUsed);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero address checks", async function () {
            await token.transfer(gameOperator.address, ethers.parseEther("1000"));

            const recipients = [ethers.ZeroAddress];
            const amounts = [ethers.parseEther("100")];

            await expect(
                token.connect(gameOperator).batchTransfer(recipients, amounts)
            ).to.be.revertedWith("MWT: Transfer to zero address");
        });

        it("Should handle zero amount transfers", async function () {
            await token.transfer(gameOperator.address, ethers.parseEther("1000"));

            const recipients = [user1.address];
            const amounts = [0];

            await expect(
                token.connect(gameOperator).batchTransfer(recipients, amounts)
            ).to.be.revertedWith("MWT: Zero amount transfer");
        });
    });
});