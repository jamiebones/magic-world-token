const { expect, anyValue } = require("chai");
const { ethers } = require("hardhat");

describe("PartnerVault", function () {
    let partnerVault;
    let magicWorldToken;
    let owner, admin, partner1, partner2, partner3;
    let initialSupply = ethers.parseEther("1000000"); // 1M tokens
    const TOKEN_NAME = "Magic World Token";
    const TOKEN_SYMBOL = "MWT";

    beforeEach(async function () {
        [owner, admin, partner1, partner2, partner3] = await ethers.getSigners();

        // Deploy token contract
        const MagicWorldToken = await ethers.getContractFactory("MagicWorldToken");
        magicWorldToken = await MagicWorldToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, initialSupply);
        await magicWorldToken.waitForDeployment();

        // Deploy partner vault
        const PartnerVault = await ethers.getContractFactory("PartnerVault");
        partnerVault = await PartnerVault.deploy(await magicWorldToken.getAddress());
        await partnerVault.waitForDeployment();

        // Transfer 10% to partner vault (100K tokens)
        const partnerAllocation = initialSupply / 10n; // 10%
        await magicWorldToken.transfer(await partnerVault.getAddress(), partnerAllocation);
    });

    describe("Deployment", function () {
        it("Should set the correct token address", async function () {
            expect(await partnerVault.token()).to.equal(await magicWorldToken.getAddress());
        });

        it("Should have correct initial balance", async function () {
            const expectedBalance = initialSupply / 10n;
            expect(await magicWorldToken.balanceOf(await partnerVault.getAddress())).to.equal(expectedBalance);
        });

        it("Should grant admin role to deployer", async function () {
            const ADMIN_ROLE = await partnerVault.ADMIN_ROLE();
            expect(await partnerVault.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Partner Allocation", function () {
        const allocation1 = ethers.parseEther("10000");
        const allocation2 = ethers.parseEther("20000");

        it("Should allow admin to allocate tokens to partners", async function () {
            await expect(partnerVault.allocateToPartner(partner1.address, allocation1))
                .to.emit(partnerVault, "PartnerAllocated");

            const allocation = await partnerVault.partnerAllocations(partner1.address);
            expect(allocation.amount).to.equal(allocation1);
            expect(allocation.withdrawn).to.be.false;
        });

        it("Should not allow allocating to same partner twice", async function () {
            await partnerVault.allocateToPartner(partner1.address, allocation1);
            await expect(partnerVault.allocateToPartner(partner1.address, allocation2))
                .to.be.revertedWith("Partner already allocated");
        });

        it("Should not allow non-admin to allocate", async function () {
            await expect(partnerVault.connect(partner1).allocateToPartner(partner2.address, allocation1))
                .to.be.revertedWithCustomError(partnerVault, "AccessControlUnauthorizedAccount");
        });

        it("Should reject zero amount allocations", async function () {
            await expect(partnerVault.allocateToPartner(partner1.address, 0))
                .to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should reject zero address allocations", async function () {
            await expect(partnerVault.allocateToPartner(ethers.ZeroAddress, allocation1))
                .to.be.revertedWith("Invalid partner address");
        });
    });

    describe("Partner Withdrawal", function () {
        const allocation = ethers.parseEther("10000");

        beforeEach(async function () {
            await partnerVault.allocateToPartner(partner1.address, allocation);
        });

        it("Should not allow withdrawal before lockup period", async function () {
            await expect(partnerVault.connect(partner1).withdraw())
                .to.be.revertedWith("Lockup period not ended");
        });

        it("Should allow withdrawal after 3 years", async function () {
            // Fast forward 3 years
            await ethers.provider.send("evm_increaseTime", [3 * 365 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            const initialBalance = await magicWorldToken.balanceOf(partner1.address);

            await expect(partnerVault.connect(partner1).withdraw())
                .to.emit(partnerVault, "PartnerWithdrawn");

            const finalBalance = await magicWorldToken.balanceOf(partner1.address);
            expect(finalBalance - initialBalance).to.equal(allocation);

            const partnerAllocation = await partnerVault.partnerAllocations(partner1.address);
            expect(partnerAllocation.withdrawn).to.be.true;
        });

        it("Should not allow double withdrawal", async function () {
            // Fast forward 3 years
            await ethers.provider.send("evm_increaseTime", [3 * 365 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            await partnerVault.connect(partner1).withdraw();
            await expect(partnerVault.connect(partner1).withdraw())
                .to.be.revertedWith("Already withdrawn");
        });

        it("Should not allow withdrawal without allocation", async function () {
            await expect(partnerVault.connect(partner2).withdraw())
                .to.be.revertedWith("No allocation found");
        });
    });

    describe("View Functions", function () {
        const allocation = ethers.parseEther("10000");

        beforeEach(async function () {
            await partnerVault.allocateToPartner(partner1.address, allocation);
        });

        it("Should return correct partner allocation info", async function () {
            const [amount, allocatedAt, withdrawn, withdrawableAt] =
                await partnerVault.getPartnerAllocation(partner1.address);

            expect(amount).to.equal(allocation);
            expect(withdrawn).to.be.false;
            expect(withdrawableAt).to.be.gt(allocatedAt);
        });

        it("Should return zero withdrawable amount before lockup", async function () {
            const withdrawableAmount = await partnerVault.getWithdrawableAmount(partner1.address);
            expect(withdrawableAmount).to.equal(0);
        });

        it("Should return correct withdrawable amount after lockup", async function () {
            // Fast forward 3 years
            await ethers.provider.send("evm_increaseTime", [3 * 365 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            const withdrawableAmount = await partnerVault.getWithdrawableAmount(partner1.address);
            expect(withdrawableAmount).to.equal(allocation);
        });

        it("Should return zero for unallocated partners", async function () {
            const withdrawableAmount = await partnerVault.getWithdrawableAmount(partner2.address);
            expect(withdrawableAmount).to.equal(0);
        });
    });

    describe("Emergency Functions", function () {
        const allocation = ethers.parseEther("10000");

        beforeEach(async function () {
            await partnerVault.allocateToPartner(partner1.address, allocation);
        });

        it("Should allow admin emergency withdrawal when paused", async function () {
            await partnerVault.pause();

            // Fast forward 3 years
            await ethers.provider.send("evm_increaseTime", [3 * 365 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            const initialBalance = await magicWorldToken.balanceOf(partner1.address);

            await partnerVault.emergencyWithdraw(partner1.address);

            const finalBalance = await magicWorldToken.balanceOf(partner1.address);
            expect(finalBalance - initialBalance).to.equal(allocation);

            const partnerAllocation = await partnerVault.partnerAllocations(partner1.address);
            expect(partnerAllocation.withdrawn).to.be.true;
        });

        it("Should not allow emergency withdrawal when not paused", async function () {
            await expect(partnerVault.emergencyWithdraw(partner1.address))
                .to.be.revertedWithCustomError(partnerVault, "ExpectedPause");
        });

        it("Should not allow non-admin emergency withdrawal", async function () {
            await partnerVault.pause();
            await expect(partnerVault.connect(partner1).emergencyWithdraw(partner1.address))
                .to.be.revertedWithCustomError(partnerVault, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Pause Functionality", function () {
        it("Should allow admin to pause and unpause", async function () {
            await partnerVault.pause();
            expect(await partnerVault.paused()).to.be.true;

            await partnerVault.unpause();
            expect(await partnerVault.paused()).to.be.false;
        });

        it("Should prevent allocations when paused", async function () {
            await partnerVault.pause();
            await expect(partnerVault.allocateToPartner(partner1.address, ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(partnerVault, "EnforcedPause");
        });

        it("Should prevent withdrawals when paused", async function () {
            await partnerVault.allocateToPartner(partner1.address, ethers.parseEther("1000"));
            await partnerVault.pause();

            await expect(partnerVault.connect(partner1).withdraw())
                .to.be.revertedWithCustomError(partnerVault, "EnforcedPause");
        });
    });

    describe("Statistics", function () {
        it("Should track total allocated amount", async function () {
            const allocation1 = ethers.parseEther("10000");
            const allocation2 = ethers.parseEther("20000");

            await partnerVault.allocateToPartner(partner1.address, allocation1);
            expect(await partnerVault.totalAllocated()).to.equal(allocation1);

            await partnerVault.allocateToPartner(partner2.address, allocation2);
            expect(await partnerVault.totalAllocated()).to.equal(allocation1 + allocation2);
        });

        it("Should return correct vault balance", async function () {
            const vaultBalance = await partnerVault.getVaultBalance();
            expect(vaultBalance).to.equal(initialSupply / 10n);
        });
    });
});