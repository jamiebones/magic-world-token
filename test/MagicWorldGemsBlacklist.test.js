const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MagicWorldGems - Blacklist Feature", function () {
    let MagicWorldGems;
    let token;
    let owner;
    let blacklistManager;
    let user1;
    let user2;
    let user3;

    const TOKEN_NAME = "Magic World Gems";
    const TOKEN_SYMBOL = "MWG";
    const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens
    const THREE_DAYS = 3 * 24 * 60 * 60; // 3 days in seconds

    beforeEach(async function () {
        [owner, blacklistManager, user1, user2, user3] = await ethers.getSigners();

        MagicWorldGems = await ethers.getContractFactory("MagicWorldGems");
        token = await MagicWorldGems.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY);
        await token.waitForDeployment();

        // Grant BLACKLIST_MANAGER_ROLE to blacklistManager
        const BLACKLIST_MANAGER_ROLE = await token.BLACKLIST_MANAGER_ROLE();
        await token.grantRole(BLACKLIST_MANAGER_ROLE, blacklistManager.address);

        // Distribute some tokens for testing
        await token.transfer(user1.address, ethers.parseEther("10000"));
        await token.transfer(user2.address, ethers.parseEther("10000"));
        await token.transfer(user3.address, ethers.parseEther("10000"));
    });

    describe("Blacklist Management", function () {
        it("Should blacklist an address with reason", async function () {
            const reason = "Suspicious activity detected";

            const tx = await token.connect(blacklistManager).blacklistAddress(user1.address, reason);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);

            await expect(tx)
                .to.emit(token, "AddressBlacklisted")
                .withArgs(user1.address, blacklistManager.address, block.timestamp, reason);

            expect(await token.isBlacklisted(user1.address)).to.be.true;
        });

        it("Should not allow non-authorized to blacklist", async function () {
            await expect(
                token.connect(user2).blacklistAddress(user1.address, "Test")
            ).to.be.revertedWith("MWG: Caller is not authorized");
        });

        it("Should allow DEFAULT_ADMIN to blacklist", async function () {
            await expect(
                token.connect(owner).blacklistAddress(user1.address, "Admin blacklist")
            ).to.not.be.reverted;

            expect(await token.isBlacklisted(user1.address)).to.be.true;
        });

        it("Should not allow blacklisting zero address", async function () {
            await expect(
                token.connect(blacklistManager).blacklistAddress(ethers.ZeroAddress, "Test")
            ).to.be.revertedWith("MWG: Cannot blacklist zero address");
        });

        it("Should not allow blacklisting already blacklisted address", async function () {
            await token.connect(blacklistManager).blacklistAddress(user1.address, "First time");

            await expect(
                token.connect(blacklistManager).blacklistAddress(user1.address, "Second time")
            ).to.be.revertedWith("MWG: Address already blacklisted");
        });

        it("Should batch blacklist multiple addresses", async function () {
            const accounts = [user1.address, user2.address, user3.address];
            const reason = "Bulk blacklist";

            await token.connect(blacklistManager).blacklistAddresses(accounts, reason);

            expect(await token.isBlacklisted(user1.address)).to.be.true;
            expect(await token.isBlacklisted(user2.address)).to.be.true;
            expect(await token.isBlacklisted(user3.address)).to.be.true;
        });

        it("Should skip already blacklisted addresses in batch", async function () {
            // Blacklist user1 first
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Single");

            // Batch blacklist including user1
            const accounts = [user1.address, user2.address];
            await expect(
                token.connect(blacklistManager).blacklistAddresses(accounts, "Batch")
            ).to.not.be.reverted;

            expect(await token.isBlacklisted(user1.address)).to.be.true;
            expect(await token.isBlacklisted(user2.address)).to.be.true;
        });

        it("Should not allow empty array in batch blacklist", async function () {
            await expect(
                token.connect(blacklistManager).blacklistAddresses([], "Test")
            ).to.be.revertedWith("MWG: Empty array");
        });

        it("Should not allow batch size exceeding 100", async function () {
            // Create array of 101 addresses
            const accounts = new Array(101).fill(ethers.Wallet.createRandom().address);

            await expect(
                token.connect(blacklistManager).blacklistAddresses(accounts, "Test")
            ).to.be.revertedWith("MWG: Batch size exceeds maximum");
        });
    });

    describe("Transfer Restrictions", function () {
        beforeEach(async function () {
            // Blacklist user1
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Test");
        });

        it("Should prevent blacklisted address from sending tokens", async function () {
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("MWG: Sender address is blacklisted");
        });

        it("Should allow blacklisted address to receive tokens", async function () {
            const balanceBefore = await token.balanceOf(user1.address);

            await token.connect(user2).transfer(user1.address, ethers.parseEther("100"));

            const balanceAfter = await token.balanceOf(user1.address);
            expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("100"));
        });

        it("Should prevent transferFrom when 'from' address is blacklisted", async function () {
            // Unblacklist user1 first
            await token.connect(blacklistManager).requestUnblacklist(user1.address);
            await time.increase(THREE_DAYS);
            await token.connect(blacklistManager).executeUnblacklist(user1.address);

            // Blacklist user2
            await token.connect(blacklistManager).blacklistAddress(user2.address, "Test");

            // user2 approves user1 to spend their tokens
            await token.connect(user2).approve(user1.address, ethers.parseEther("1000"));

            // user1 tries to transfer from user2 (blacklisted) to user3
            // This should fail because user2 (the 'from' address) is blacklisted
            await expect(
                token.connect(user1).transferFrom(user2.address, user3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("MWG: Sender address is blacklisted");
        });

        it("Should allow non-blacklisted to transfer normally", async function () {
            await expect(
                token.connect(user2).transfer(user3.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
        });

        it("Should prevent batch transfers from blacklisted addresses", async function () {
            // Grant GAME_OPERATOR_ROLE to user1
            const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
            await token.grantRole(GAME_OPERATOR_ROLE, user1.address);

            const recipients = [user2.address, user3.address];
            const amounts = [ethers.parseEther("10"), ethers.parseEther("20")];

            await expect(
                token.connect(user1).batchTransfer(recipients, amounts)
            ).to.be.revertedWith("MWG: Sender address is blacklisted");
        });
    });

    describe("Unblacklist with Timelock", function () {
        beforeEach(async function () {
            // Blacklist user1
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Test");
        });

        it("Should request unblacklist successfully", async function () {
            const currentTime = await time.latest();
            const effectiveTime = currentTime + THREE_DAYS + 1;

            await expect(
                token.connect(blacklistManager).requestUnblacklist(user1.address)
            )
                .to.emit(token, "UnblacklistRequested")
                .withArgs(user1.address, blacklistManager.address, effectiveTime);

            const info = await token.getBlacklistInfo(user1.address);
            expect(info.blacklisted).to.be.true;
            expect(info.unblacklistRequestTime).to.be.gt(0);
        });

        it("Should not allow non-authorized to request unblacklist", async function () {
            await expect(
                token.connect(user2).requestUnblacklist(user1.address)
            ).to.be.revertedWith("MWG: Caller is not authorized");
        });

        it("Should not allow requesting unblacklist for non-blacklisted address", async function () {
            await expect(
                token.connect(blacklistManager).requestUnblacklist(user2.address)
            ).to.be.revertedWith("MWG: Address not blacklisted");
        });

        it("Should not allow duplicate unblacklist requests", async function () {
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            await expect(
                token.connect(blacklistManager).requestUnblacklist(user1.address)
            ).to.be.revertedWith("MWG: Unblacklist already requested");
        });

        it("Should not execute unblacklist before timelock", async function () {
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            ).to.be.revertedWith("MWG: Timelock period not elapsed");
        });

        it("Should execute unblacklist after timelock period", async function () {
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            // Fast forward 3 days
            await time.increase(THREE_DAYS);

            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            )
                .to.emit(token, "AddressUnblacklisted")
                .withArgs(user1.address, blacklistManager.address, await time.latest() + 1);

            expect(await token.isBlacklisted(user1.address)).to.be.false;

            // Should be able to transfer now
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
        });

        it("Should not execute unblacklist without request", async function () {
            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            ).to.be.revertedWith("MWG: Unblacklist not requested");
        });

        it("Should cancel unblacklist request", async function () {
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            await token.connect(blacklistManager).cancelUnblacklistRequest(user1.address);

            const info = await token.getBlacklistInfo(user1.address);
            expect(info.unblacklistRequestTime).to.equal(0);

            // Should not be able to execute now
            await time.increase(THREE_DAYS);
            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            ).to.be.revertedWith("MWG: Unblacklist not requested");
        });

        it("Should not cancel non-existent request", async function () {
            await expect(
                token.connect(blacklistManager).cancelUnblacklistRequest(user1.address)
            ).to.be.revertedWith("MWG: No pending unblacklist request");
        });

        it("Should reset unblacklist request when re-blacklisting", async function () {
            // Request unblacklist
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            let info = await token.getBlacklistInfo(user1.address);
            expect(info.unblacklistRequestTime).to.be.gt(0);

            // Execute unblacklist
            await time.increase(THREE_DAYS);
            await token.connect(blacklistManager).executeUnblacklist(user1.address);

            // Blacklist again
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Re-blacklist");

            info = await token.getBlacklistInfo(user1.address);
            expect(info.blacklisted).to.be.true;
            expect(info.unblacklistRequestTime).to.equal(0); // Should be reset
        });
    });

    describe("View Functions", function () {
        it("Should return correct blacklist status", async function () {
            expect(await token.isBlacklisted(user1.address)).to.be.false;

            await token.connect(blacklistManager).blacklistAddress(user1.address, "Test");

            expect(await token.isBlacklisted(user1.address)).to.be.true;
        });

        it("Should return complete blacklist info", async function () {
            const currentTime = await time.latest();

            await token.connect(blacklistManager).blacklistAddress(user1.address, "Test");

            let info = await token.getBlacklistInfo(user1.address);
            expect(info.blacklisted).to.be.true;
            expect(info.blacklistedAt).to.be.gte(currentTime);
            expect(info.unblacklistRequestTime).to.equal(0);

            // Request unblacklist
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            info = await token.getBlacklistInfo(user1.address);
            expect(info.blacklisted).to.be.true;
            expect(info.unblacklistRequestTime).to.be.gt(0);
        });

        it("Should return zero info for non-blacklisted address", async function () {
            const info = await token.getBlacklistInfo(user1.address);
            expect(info.blacklisted).to.be.false;
            expect(info.blacklistedAt).to.equal(0);
            expect(info.unblacklistRequestTime).to.equal(0);
        });
    });

    describe("Role Management", function () {
        it("Should grant BLACKLIST_MANAGER_ROLE", async function () {
            const BLACKLIST_MANAGER_ROLE = await token.BLACKLIST_MANAGER_ROLE();

            await token.grantRole(BLACKLIST_MANAGER_ROLE, user1.address);

            expect(await token.hasRole(BLACKLIST_MANAGER_ROLE, user1.address)).to.be.true;

            // Should be able to blacklist now
            await expect(
                token.connect(user1).blacklistAddress(user2.address, "Test")
            ).to.not.be.reverted;
        });

        it("Should revoke BLACKLIST_MANAGER_ROLE", async function () {
            const BLACKLIST_MANAGER_ROLE = await token.BLACKLIST_MANAGER_ROLE();

            await token.revokeRole(BLACKLIST_MANAGER_ROLE, blacklistManager.address);

            await expect(
                token.connect(blacklistManager).blacklistAddress(user1.address, "Test")
            ).to.be.revertedWith("MWG: Caller is not authorized");
        });
    });

    describe("Configurable Timelock", function () {
        it("Should have default timelock of 3 days", async function () {
            const timelock = await token.unblacklistTimelock();
            expect(timelock).to.equal(THREE_DAYS);
        });

        it("Should allow admin to change timelock period", async function () {
            const newTimelock = 7 * 24 * 60 * 60; // 7 days

            await expect(token.connect(owner).setUnblacklistTimelock(newTimelock))
                .to.emit(token, "UnblacklistTimelockUpdated")
                .withArgs(THREE_DAYS, newTimelock, owner.address);

            expect(await token.unblacklistTimelock()).to.equal(newTimelock);
        });

        it("Should not allow non-admin to change timelock", async function () {
            await expect(
                token.connect(user1).setUnblacklistTimelock(5 * 24 * 60 * 60)
            ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
        });

        it("Should not allow timelock less than 1 day", async function () {
            await expect(
                token.connect(owner).setUnblacklistTimelock(23 * 60 * 60) // 23 hours
            ).to.be.revertedWith("MWG: Timelock too short");
        });

        it("Should not allow timelock more than 30 days", async function () {
            await expect(
                token.connect(owner).setUnblacklistTimelock(31 * 24 * 60 * 60) // 31 days
            ).to.be.revertedWith("MWG: Timelock too long");
        });

        it("Should allow timelock of exactly 1 day", async function () {
            const oneDay = 1 * 24 * 60 * 60;
            await expect(token.connect(owner).setUnblacklistTimelock(oneDay))
                .to.not.be.reverted;
            expect(await token.unblacklistTimelock()).to.equal(oneDay);
        });

        it("Should allow timelock of exactly 30 days", async function () {
            const thirtyDays = 30 * 24 * 60 * 60;
            await expect(token.connect(owner).setUnblacklistTimelock(thirtyDays))
                .to.not.be.reverted;
            expect(await token.unblacklistTimelock()).to.equal(thirtyDays);
        });

        it("Should use new timelock for future requests", async function () {
            // Change timelock to 5 days
            const newTimelock = 5 * 24 * 60 * 60;
            await token.connect(owner).setUnblacklistTimelock(newTimelock);

            // Blacklist user1
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Test");

            // Request unblacklist
            const currentTime = await time.latest();
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            const info = await token.getBlacklistInfo(user1.address);
            expect(info.unblacklistRequestTime).to.be.closeTo(
                BigInt(currentTime) + BigInt(newTimelock),
                2n // Allow 2 second tolerance
            );

            // Should not be unlockable after 3 days
            await time.increase(THREE_DAYS);
            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            ).to.be.revertedWith("MWG: Timelock period not elapsed");

            // Should be unlockable after 5 days total
            await time.increase(2 * 24 * 60 * 60); // 2 more days
            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            ).to.not.be.reverted;
        });

        it("Should not affect pending unblacklist requests when timelock is changed", async function () {
            // Blacklist user1
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Test");

            // Request unblacklist with 3 day timelock
            await token.connect(blacklistManager).requestUnblacklist(user1.address);
            const info1 = await token.getBlacklistInfo(user1.address);
            const originalEffectiveTime = info1.unblacklistRequestTime;

            // Change timelock to 10 days
            await token.connect(owner).setUnblacklistTimelock(10 * 24 * 60 * 60);

            // Original request should still be effective after 3 days
            const info2 = await token.getBlacklistInfo(user1.address);
            expect(info2.unblacklistRequestTime).to.equal(originalEffectiveTime);

            await time.increase(THREE_DAYS);
            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            ).to.not.be.reverted;
        });
    });

    describe("Integration with Existing Features", function () {
        it("Should work with pausable functionality", async function () {
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Test");

            // Pause the contract
            await token.pause();

            // Should still enforce blacklist (but also fail due to pause)
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(token, "EnforcedPause");

            // Unpause
            await token.unpause();

            // Should now fail only due to blacklist
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("MWG: Sender address is blacklisted");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle timelock at exact boundary", async function () {
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Test");
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            const info = await token.getBlacklistInfo(user1.address);
            const timelockEnd = info.unblacklistRequestTime;

            // Fast forward to exact timelock end
            await time.increaseTo(timelockEnd);

            // Should succeed at exact boundary
            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            ).to.not.be.reverted;
        });

        it("Should handle multiple blacklist/unblacklist cycles", async function () {
            // Cycle 1
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Cycle 1");
            expect(await token.isBlacklisted(user1.address)).to.be.true;

            await token.connect(blacklistManager).requestUnblacklist(user1.address);
            await time.increase(THREE_DAYS);
            await token.connect(blacklistManager).executeUnblacklist(user1.address);
            expect(await token.isBlacklisted(user1.address)).to.be.false;

            // Cycle 2
            await token.connect(blacklistManager).blacklistAddress(user1.address, "Cycle 2");
            expect(await token.isBlacklisted(user1.address)).to.be.true;

            await token.connect(blacklistManager).requestUnblacklist(user1.address);
            await time.increase(THREE_DAYS);
            await token.connect(blacklistManager).executeUnblacklist(user1.address);
            expect(await token.isBlacklisted(user1.address)).to.be.false;

            // Should work normally
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
        });

        it("Should maintain separate timelock for different addresses", async function () {
            // Blacklist both users
            await token.connect(blacklistManager).blacklistAddress(user1.address, "User1");
            await token.connect(blacklistManager).blacklistAddress(user2.address, "User2");

            // Request unblacklist for user1
            await token.connect(blacklistManager).requestUnblacklist(user1.address);

            // Wait 1 day
            await time.increase(1 * 24 * 60 * 60);

            // Request unblacklist for user2
            await token.connect(blacklistManager).requestUnblacklist(user2.address);

            // Wait 2 more days (total 3 for user1, 2 for user2)
            await time.increase(2 * 24 * 60 * 60);

            // user1 should be unlockable
            await expect(
                token.connect(blacklistManager).executeUnblacklist(user1.address)
            ).to.not.be.reverted;

            // user2 should still be locked
            await expect(
                token.connect(blacklistManager).executeUnblacklist(user2.address)
            ).to.be.revertedWith("MWG: Timelock period not elapsed");
        });
    });
});
