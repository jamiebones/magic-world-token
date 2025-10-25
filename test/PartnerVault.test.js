const { expect, anyValue } = require("chai");
const { ethers } = require("hardhat");

describe("PartnerVault", function () {
    let partnerVault;
    let magicWorldGems;
    let owner, admin, partner1, partner2, partner3;
    let initialSupply = ethers.parseEther("1000000"); // 1M tokens
    const TOKEN_NAME = "Magic World Token";
    const TOKEN_SYMBOL = "MWT";

    beforeEach(async function () {
        [owner, admin, partner1, partner2, partner3] = await ethers.getSigners();

        // Deploy token contract
        const MagicWorldGems = await ethers.getContractFactory("MagicWorldGems");
        magicWorldGems = await MagicWorldGems.deploy(TOKEN_NAME, TOKEN_SYMBOL, initialSupply);
        await magicWorldGems.waitForDeployment();

        // Deploy partner vault
        const PartnerVault = await ethers.getContractFactory("PartnerVault");
        partnerVault = await PartnerVault.deploy(await magicWorldGems.getAddress());
        await partnerVault.waitForDeployment();

        // Transfer 10% to partner vault (100K tokens)
        const partnerAllocation = initialSupply / 10n; // 10%
        await magicWorldGems.transfer(await partnerVault.getAddress(), partnerAllocation);
    });

    describe("Deployment", function () {
        it("Should set the correct token address", async function () {
            expect(await partnerVault.token()).to.equal(await magicWorldGems.getAddress());
        });

        it("Should have correct initial balance", async function () {
            const expectedBalance = initialSupply / 10n;
            expect(await magicWorldGems.balanceOf(await partnerVault.getAddress())).to.equal(expectedBalance);
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

            const initialBalance = await magicWorldGems.balanceOf(partner1.address);

            await expect(partnerVault.connect(partner1).withdraw())
                .to.emit(partnerVault, "PartnerWithdrawn");

            const finalBalance = await magicWorldGems.balanceOf(partner1.address);
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

            const initialBalance = await magicWorldGems.balanceOf(partner1.address);

            await partnerVault.emergencyWithdraw(partner1.address);

            const finalBalance = await magicWorldGems.balanceOf(partner1.address);
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

    describe("Partner List Functions", function () {
        const allocation1 = ethers.parseEther("10000");
        const allocation2 = ethers.parseEther("20000");
        const allocation3 = ethers.parseEther("30000");

        describe("getAllPartners", function () {
            it("Should return empty array when no partners allocated", async function () {
                const partners = await partnerVault.getAllPartners();
                expect(partners.length).to.equal(0);
            });

            it("Should return all partner addresses", async function () {
                await partnerVault.allocateToPartner(partner1.address, allocation1);
                await partnerVault.allocateToPartner(partner2.address, allocation2);
                await partnerVault.allocateToPartner(partner3.address, allocation3);

                const partners = await partnerVault.getAllPartners();
                expect(partners.length).to.equal(3);
                expect(partners[0]).to.equal(partner1.address);
                expect(partners[1]).to.equal(partner2.address);
                expect(partners[2]).to.equal(partner3.address);
            });

            it("Should maintain order of allocation", async function () {
                await partnerVault.allocateToPartner(partner3.address, allocation3);
                await partnerVault.allocateToPartner(partner1.address, allocation1);
                await partnerVault.allocateToPartner(partner2.address, allocation2);

                const partners = await partnerVault.getAllPartners();
                expect(partners[0]).to.equal(partner3.address);
                expect(partners[1]).to.equal(partner1.address);
                expect(partners[2]).to.equal(partner2.address);
            });
        });

        describe("getPartnerCount", function () {
            it("Should return zero when no partners allocated", async function () {
                expect(await partnerVault.getPartnerCount()).to.equal(0);
            });

            it("Should return correct count after allocations", async function () {
                await partnerVault.allocateToPartner(partner1.address, allocation1);
                expect(await partnerVault.getPartnerCount()).to.equal(1);

                await partnerVault.allocateToPartner(partner2.address, allocation2);
                expect(await partnerVault.getPartnerCount()).to.equal(2);

                await partnerVault.allocateToPartner(partner3.address, allocation3);
                expect(await partnerVault.getPartnerCount()).to.equal(3);
            });
        });

        describe("getPartnersWithDetails", function () {
            beforeEach(async function () {
                await partnerVault.allocateToPartner(partner1.address, allocation1);
                await partnerVault.allocateToPartner(partner2.address, allocation2);
                await partnerVault.allocateToPartner(partner3.address, allocation3);
            });

            it("Should return all partners when limit exceeds count", async function () {
                const [partners, amounts, allocatedAts, withdrawns, withdrawableAts] =
                    await partnerVault.getPartnersWithDetails(0, 10);

                expect(partners.length).to.equal(3);
                expect(amounts.length).to.equal(3);
                expect(allocatedAts.length).to.equal(3);
                expect(withdrawns.length).to.equal(3);
                expect(withdrawableAts.length).to.equal(3);

                expect(partners[0]).to.equal(partner1.address);
                expect(partners[1]).to.equal(partner2.address);
                expect(partners[2]).to.equal(partner3.address);

                expect(amounts[0]).to.equal(allocation1);
                expect(amounts[1]).to.equal(allocation2);
                expect(amounts[2]).to.equal(allocation3);

                expect(withdrawns[0]).to.be.false;
                expect(withdrawns[1]).to.be.false;
                expect(withdrawns[2]).to.be.false;
            });

            it("Should support pagination with offset and limit", async function () {
                // Get first 2 partners
                const [partners1, amounts1] = await partnerVault.getPartnersWithDetails(0, 2);
                expect(partners1.length).to.equal(2);
                expect(partners1[0]).to.equal(partner1.address);
                expect(partners1[1]).to.equal(partner2.address);
                expect(amounts1[0]).to.equal(allocation1);
                expect(amounts1[1]).to.equal(allocation2);

                // Get next partner
                const [partners2, amounts2] = await partnerVault.getPartnersWithDetails(2, 2);
                expect(partners2.length).to.equal(1);
                expect(partners2[0]).to.equal(partner3.address);
                expect(amounts2[0]).to.equal(allocation3);
            });

            it("Should return empty arrays when offset exceeds count", async function () {
                const [partners, amounts, allocatedAts, withdrawns, withdrawableAts] =
                    await partnerVault.getPartnersWithDetails(10, 5);

                expect(partners.length).to.equal(0);
                expect(amounts.length).to.equal(0);
                expect(allocatedAts.length).to.equal(0);
                expect(withdrawns.length).to.equal(0);
                expect(withdrawableAts.length).to.equal(0);
            });

            it("Should handle single item pagination", async function () {
                const [partners, amounts] = await partnerVault.getPartnersWithDetails(1, 1);
                expect(partners.length).to.equal(1);
                expect(partners[0]).to.equal(partner2.address);
                expect(amounts[0]).to.equal(allocation2);
            });

            it("Should show correct withdrawal status", async function () {
                // Fast forward 3 years and withdraw for partner1
                await ethers.provider.send("evm_increaseTime", [3 * 365 * 24 * 60 * 60]);
                await ethers.provider.send("evm_mine");
                await partnerVault.connect(partner1).withdraw();

                const [partners, amounts, allocatedAts, withdrawns] =
                    await partnerVault.getPartnersWithDetails(0, 3);

                expect(withdrawns[0]).to.be.true;  // partner1 withdrawn
                expect(withdrawns[1]).to.be.false; // partner2 not withdrawn
                expect(withdrawns[2]).to.be.false; // partner3 not withdrawn
            });

            it("Should calculate correct withdrawable timestamps", async function () {
                const [partners, amounts, allocatedAts, withdrawns, withdrawableAts] =
                    await partnerVault.getPartnersWithDetails(0, 3);

                const LOCKUP_PERIOD = 3 * 365 * 24 * 60 * 60;

                expect(withdrawableAts[0]).to.equal(allocatedAts[0] + BigInt(LOCKUP_PERIOD));
                expect(withdrawableAts[1]).to.equal(allocatedAts[1] + BigInt(LOCKUP_PERIOD));
                expect(withdrawableAts[2]).to.equal(allocatedAts[2] + BigInt(LOCKUP_PERIOD));
            });

            it("Should handle zero offset", async function () {
                const [partners, amounts] = await partnerVault.getPartnersWithDetails(0, 1);
                expect(partners.length).to.equal(1);
                expect(partners[0]).to.equal(partner1.address);
            });

            it("Should return correct data for middle page", async function () {
                // Allocate 5 more partners to have more data
                const [addr4, addr5, addr6, addr7, addr8] = await ethers.getSigners();
                await partnerVault.allocateToPartner(addr4.address, ethers.parseEther("40000"));
                await partnerVault.allocateToPartner(addr5.address, ethers.parseEther("50000"));

                // Get middle page (offset 2, limit 2)
                const [partners, amounts] = await partnerVault.getPartnersWithDetails(2, 2);
                expect(partners.length).to.equal(2);
                expect(partners[0]).to.equal(partner3.address);
                expect(partners[1]).to.equal(addr4.address);
            });
        });

        describe("Integration with withdrawals", function () {
            beforeEach(async function () {
                await partnerVault.allocateToPartner(partner1.address, allocation1);
                await partnerVault.allocateToPartner(partner2.address, allocation2);
            });

            it("Should maintain partner list after withdrawals", async function () {
                // Fast forward and withdraw
                await ethers.provider.send("evm_increaseTime", [3 * 365 * 24 * 60 * 60]);
                await ethers.provider.send("evm_mine");
                await partnerVault.connect(partner1).withdraw();

                // Partner should still be in list
                const partners = await partnerVault.getAllPartners();
                expect(partners.length).to.equal(2);
                expect(partners[0]).to.equal(partner1.address);

                // Verify withdrawal status in details
                const [, , , withdrawns] = await partnerVault.getPartnersWithDetails(0, 2);
                expect(withdrawns[0]).to.be.true;
                expect(withdrawns[1]).to.be.false;
            });

            it("Should show correct data for mix of withdrawn and pending partners", async function () {
                // Fast forward and withdraw for partner1
                await ethers.provider.send("evm_increaseTime", [3 * 365 * 24 * 60 * 60]);
                await ethers.provider.send("evm_mine");
                await partnerVault.connect(partner1).withdraw();

                const [partners, amounts, , withdrawns] =
                    await partnerVault.getPartnersWithDetails(0, 10);

                expect(partners.length).to.equal(2);
                expect(amounts[0]).to.equal(allocation1);
                expect(amounts[1]).to.equal(allocation2);
                expect(withdrawns[0]).to.be.true;  // withdrawn
                expect(withdrawns[1]).to.be.false; // pending
            });
        });
    });
});