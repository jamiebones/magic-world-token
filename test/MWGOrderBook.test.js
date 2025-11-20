const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MWGOrderBook", function () {
    let MagicWorldGems;
    let MWGOrderBook;
    let token;
    let orderBook;
    let owner;
    let admin;
    let user1;
    let user2;
    let user3;
    let feeRecipient;

    const TOKEN_NAME = "Magic World Token";
    const TOKEN_SYMBOL = "MWG";
    const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens
    const ONE_DAY = 86400;
    const ONE_HOUR = 3600;

    beforeEach(async function () {
        [owner, admin, user1, user2, user3, feeRecipient] = await ethers.getSigners();

        // Deploy Token Contract
        MagicWorldGems = await ethers.getContractFactory("MagicWorldGems");
        token = await MagicWorldGems.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOTAL_SUPPLY);
        await token.waitForDeployment();

        // Deploy Order Book Contract
        MWGOrderBook = await ethers.getContractFactory("MWGOrderBook");
        orderBook = await MWGOrderBook.deploy(await token.getAddress(), admin.address);
        await orderBook.waitForDeployment();

        // Transfer tokens to users for testing
        await token.transfer(user1.address, ethers.parseEther("100000"));
        await token.transfer(user2.address, ethers.parseEther("100000"));
        await token.transfer(user3.address, ethers.parseEther("100000"));

        // Approve order book to spend user tokens
        await token.connect(user1).approve(await orderBook.getAddress(), ethers.MaxUint256);
        await token.connect(user2).approve(await orderBook.getAddress(), ethers.MaxUint256);
        await token.connect(user3).approve(await orderBook.getAddress(), ethers.MaxUint256);
    });

    describe("Deployment", function () {
        it("Should set the correct token address", async function () {
            expect(await orderBook.mwgToken()).to.equal(await token.getAddress());
        });

        it("Should set the correct admin", async function () {
            const ADMIN_ROLE = await orderBook.ADMIN_ROLE();
            expect(await orderBook.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
        });

        it("Should set correct initial parameters", async function () {
            expect(await orderBook.minMWGAmount()).to.equal(ethers.parseEther("100"));
            expect(await orderBook.minBNBAmount()).to.equal(ethers.parseEther("0.0001"));
            expect(await orderBook.feePercentage()).to.equal(0);
            expect(await orderBook.feeRecipient()).to.equal(admin.address);
        });

        it("Should reject zero address for token", async function () {
            await expect(
                MWGOrderBook.deploy(ethers.ZeroAddress, admin.address)
            ).to.be.revertedWith("Invalid MWG token address");
        });

        it("Should reject zero address for admin", async function () {
            await expect(
                MWGOrderBook.deploy(await token.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid admin address");
        });
    });

    describe("BUY Order Creation", function () {
        it("Should create a BUY order successfully", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await expect(
                orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount })
            ).to.emit(orderBook, "OrderCreated");

            const order = await orderBook.orders(1);
            expect(order.user).to.equal(user1.address);
            expect(order.orderType).to.equal(0); // BUY
            expect(order.mwgAmount).to.equal(mwgAmount);
            expect(order.remaining).to.equal(mwgAmount);
            expect(order.status).to.equal(0); // ACTIVE
        });

        it("Should reject BUY order with insufficient MWG amount", async function () {
            const mwgAmount = ethers.parseEther("50"); // Below minimum
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await expect(
                orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount })
            ).to.be.revertedWith("MWG amount below minimum");
        });

        it("Should reject BUY order with incorrect BNB amount", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const wrongBnbAmount = ethers.parseEther("0.05");

            await expect(
                orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: wrongBnbAmount })
            ).to.be.revertedWith("Incorrect BNB amount sent");
        });

        it("Should reject BUY order with zero price", async function () {
            const mwgAmount = ethers.parseEther("1000");

            await expect(
                orderBook.connect(user1).createBuyOrder(mwgAmount, 0, ONE_DAY, { value: 0 })
            ).to.be.revertedWith("Price must be greater than 0");
        });

        it("Should reject BUY order with excessive expiry", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");
            const excessiveExpiry = 31 * ONE_DAY; // More than MAX_EXPIRY (30 days)

            await expect(
                orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, excessiveExpiry, { value: bnbAmount })
            ).to.be.revertedWith("Invalid expiry time");
        });

        it("Should store fee at order creation", async function () {
            // Set fee to 1%
            await orderBook.connect(admin).setFee(100, feeRecipient.address);

            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });

            const order = await orderBook.orders(1);
            expect(order.feeAtCreation).to.equal(100); // 1%
        });
    });

    describe("SELL Order Creation", function () {
        it("Should create a SELL order successfully", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");

            const balanceBefore = await token.balanceOf(user1.address);

            await expect(
                orderBook.connect(user1).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY)
            ).to.emit(orderBook, "OrderCreated");

            const balanceAfter = await token.balanceOf(user1.address);
            expect(balanceBefore - balanceAfter).to.equal(mwgAmount);

            const order = await orderBook.orders(1);
            expect(order.user).to.equal(user1.address);
            expect(order.orderType).to.equal(1); // SELL
            expect(order.mwgAmount).to.equal(mwgAmount);
        });

        it("Should reject SELL order without token approval", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");

            // Revoke approval
            await token.connect(user1).approve(await orderBook.getAddress(), 0);

            await expect(
                orderBook.connect(user1).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY)
            ).to.be.reverted;
        });

        it("Should reject SELL order with insufficient balance", async function () {
            const mwgAmount = ethers.parseEther("200000"); // More than user has
            const pricePerMWG = ethers.parseEther("0.0001");

            await expect(
                orderBook.connect(user1).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY)
            ).to.be.reverted;
        });
    });

    describe("Fill BUY Order", function () {
        let orderId;
        const mwgAmount = ethers.parseEther("1000");
        const pricePerMWG = ethers.parseEther("0.0001");
        const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

        beforeEach(async function () {
            // User1 creates BUY order
            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });
            orderId = 1;
        });

        it("Should fill BUY order completely", async function () {
            const user2BalanceBefore = await token.balanceOf(user2.address);

            await expect(
                orderBook.connect(user2).fillBuyOrder(orderId, mwgAmount)
            ).to.emit(orderBook, "OrderFilled");

            // User2 sent MWG
            const user2BalanceAfter = await token.balanceOf(user2.address);
            expect(user2BalanceBefore - user2BalanceAfter).to.equal(mwgAmount);

            // User1 received MWG (starts with 100000, receives 1000)
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("101000"));

            // User2 has pending BNB withdrawal
            expect(await orderBook.pendingWithdrawals(user2.address)).to.equal(bnbAmount);

            // Order status updated
            const order = await orderBook.orders(orderId);
            expect(order.status).to.equal(1); // FILLED
            expect(order.remaining).to.equal(0);
        });

        it("Should fill BUY order partially", async function () {
            const partialAmount = ethers.parseEther("300");
            const partialBnb = (partialAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user2).fillBuyOrder(orderId, partialAmount);

            const order = await orderBook.orders(orderId);
            expect(order.status).to.equal(2); // PARTIALLY_FILLED
            expect(order.filled).to.equal(partialAmount);
            expect(order.remaining).to.equal(mwgAmount - partialAmount);

            expect(await orderBook.pendingWithdrawals(user2.address)).to.equal(partialBnb);
        });

        it("Should reject fill from order owner", async function () {
            await expect(
                orderBook.connect(user1).fillBuyOrder(orderId, mwgAmount)
            ).to.be.revertedWith("Cannot fill own order");
        });

        it("Should reject fill exceeding remaining amount", async function () {
            await expect(
                orderBook.connect(user2).fillBuyOrder(orderId, mwgAmount * 2n)
            ).to.be.revertedWith("Amount exceeds remaining");
        });

        it("Should reject fill amount that rounds to zero", async function () {
            await expect(
                orderBook.connect(user2).fillBuyOrder(orderId, 1)
            ).to.be.revertedWith("Fill amount rounds to zero");
        });

        it("Should handle fee correctly", async function () {
            // Set 1% fee
            await orderBook.connect(admin).setFee(100, feeRecipient.address);

            // Create new order with fee
            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });
            const newOrderId = 2;

            await orderBook.connect(user2).fillBuyOrder(newOrderId, mwgAmount);

            const fee = (bnbAmount * 100n) / 10000n; // 1%
            const bnbToFiller = bnbAmount - fee;

            // user2 only filled orderId=2 with 1% fee, gets 0.099 BNB
            expect(await orderBook.pendingWithdrawals(user2.address)).to.equal(bnbToFiller);
            expect(await orderBook.pendingWithdrawals(feeRecipient.address)).to.equal(fee);
        });

        it("Should allow multiple partial fills", async function () {
            const fill1 = ethers.parseEther("300");
            const fill2 = ethers.parseEther("400");
            const fill3 = ethers.parseEther("300");

            await orderBook.connect(user2).fillBuyOrder(orderId, fill1);
            await orderBook.connect(user3).fillBuyOrder(orderId, fill2);
            await orderBook.connect(user2).fillBuyOrder(orderId, fill3);

            const order = await orderBook.orders(orderId);
            expect(order.status).to.equal(1); // FILLED
            expect(order.filled).to.equal(mwgAmount);
            expect(order.remaining).to.equal(0);
        });
    });

    describe("Fill SELL Order", function () {
        let orderId;
        const mwgAmount = ethers.parseEther("1000");
        const pricePerMWG = ethers.parseEther("0.0001");
        const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

        beforeEach(async function () {
            // User1 creates SELL order
            await orderBook.connect(user1).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY);
            orderId = 1;
        });

        it("Should fill SELL order completely", async function () {
            const user2MwgBefore = await token.balanceOf(user2.address);
            const contractMwgBefore = await token.balanceOf(await orderBook.getAddress());

            await expect(
                orderBook.connect(user2).fillSellOrder(orderId, mwgAmount, { value: bnbAmount })
            ).to.emit(orderBook, "OrderFilled");

            // User2 received MWG
            const user2MwgAfter = await token.balanceOf(user2.address);
            expect(user2MwgAfter - user2MwgBefore).to.equal(mwgAmount);

            // Contract sent MWG
            const contractMwgAfter = await token.balanceOf(await orderBook.getAddress());
            expect(contractMwgBefore - contractMwgAfter).to.equal(mwgAmount);

            // User1 has pending BNB withdrawal
            expect(await orderBook.pendingWithdrawals(user1.address)).to.equal(bnbAmount);

            // Order status updated
            const order = await orderBook.orders(orderId);
            expect(order.status).to.equal(1); // FILLED
        });

        it("Should burn MWG fee on SELL order", async function () {
            // Set 1% fee
            await orderBook.connect(admin).setFee(100, feeRecipient.address);

            // Create new SELL order with fee
            await orderBook.connect(user1).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY);
            const newOrderId = 2;

            const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
            const deadBalanceBefore = await token.balanceOf(DEAD_ADDRESS);

            await orderBook.connect(user2).fillSellOrder(newOrderId, mwgAmount, { value: bnbAmount });

            const fee = (mwgAmount * 100n) / 10000n; // 1% of MWG
            const mwgToFiller = mwgAmount - fee;

            // User2 received MWG minus fee
            expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("100000") + mwgToFiller);

            // Fee was sent to dead address (burned)
            const deadBalanceAfter = await token.balanceOf(DEAD_ADDRESS);
            expect(deadBalanceAfter - deadBalanceBefore).to.equal(fee);
        });

        it("Should reject fill with incorrect BNB amount", async function () {
            await expect(
                orderBook.connect(user2).fillSellOrder(orderId, mwgAmount, { value: bnbAmount / 2n })
            ).to.be.revertedWith("Incorrect BNB amount");
        });

        it("Should reject fill from order owner", async function () {
            await expect(
                orderBook.connect(user1).fillSellOrder(orderId, mwgAmount, { value: bnbAmount })
            ).to.be.revertedWith("Cannot fill own order");
        });
    });

    describe("Order Cancellation", function () {
        it("Should cancel BUY order and refund BNB", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });

            await expect(
                orderBook.connect(user1).cancelOrder(1)
            ).to.emit(orderBook, "OrderCancelled");

            // BNB refunded to pending withdrawals
            expect(await orderBook.pendingWithdrawals(user1.address)).to.equal(bnbAmount);

            const order = await orderBook.orders(1);
            expect(order.status).to.equal(3); // CANCELLED
            expect(order.remaining).to.equal(0);
        });

        it("Should cancel SELL order and refund MWG", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");

            const balanceBefore = await token.balanceOf(user1.address);

            await orderBook.connect(user1).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY);
            await orderBook.connect(user1).cancelOrder(1);

            // MWG refunded
            const balanceAfter = await token.balanceOf(user1.address);
            expect(balanceAfter).to.equal(balanceBefore);

            const order = await orderBook.orders(1);
            expect(order.status).to.equal(3); // CANCELLED
        });

        it("Should cancel partially filled order", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });

            // Partially fill
            const fillAmount = ethers.parseEther("300");
            await orderBook.connect(user2).fillBuyOrder(1, fillAmount);

            // Cancel remaining
            await orderBook.connect(user1).cancelOrder(1);

            const remainingBnb = ((mwgAmount - fillAmount) * pricePerMWG) / ethers.parseEther("1");
            const fillBnb = (fillAmount * pricePerMWG) / ethers.parseEther("1");

            expect(await orderBook.pendingWithdrawals(user1.address)).to.equal(remainingBnb);
            expect(await orderBook.pendingWithdrawals(user2.address)).to.equal(fillBnb);
        });

        it("Should reject cancel from non-owner", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });

            await expect(
                orderBook.connect(user2).cancelOrder(1)
            ).to.be.revertedWith("Not order owner");
        });

        it("Should reject cancel of already filled order", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });
            await orderBook.connect(user2).fillBuyOrder(1, mwgAmount);

            await expect(
                orderBook.connect(user1).cancelOrder(1)
            ).to.be.revertedWith("Order not active");
        });
    });

    describe("Order Expiration", function () {
        it("Should mark expired order", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_HOUR, { value: bnbAmount });

            // Fast forward past expiration
            await time.increase(ONE_HOUR + 1);

            await expect(
                orderBook.connect(user1).markExpiredOrders([1])
            ).to.emit(orderBook, "OrderExpired");

            const order = await orderBook.orders(1);
            expect(order.status).to.equal(4); // EXPIRED
        });

        it("Should prevent non-owner from marking expired immediately", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_HOUR, { value: bnbAmount });

            // Fast forward past expiration but not +1 hour
            await time.increase(ONE_HOUR + 1);

            await expect(
                orderBook.connect(user2).markExpiredOrders([1])
            ).to.be.revertedWith("Wait 1 hour after expiry or be order owner");
        });

        it("Should allow anyone to mark after 1 hour grace period", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_HOUR, { value: bnbAmount });

            // Fast forward past expiration + 1 hour
            await time.increase(2 * ONE_HOUR + 1);

            await expect(
                orderBook.connect(user2).markExpiredOrders([1])
            ).to.emit(orderBook, "OrderExpired");
        });

        it("Should allow claiming funds from expired order", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_HOUR, { value: bnbAmount });

            await time.increase(ONE_HOUR + 1);
            await orderBook.connect(user1).markExpiredOrders([1]);

            await orderBook.connect(user1).claimExpiredOrder(1);

            expect(await orderBook.pendingWithdrawals(user1.address)).to.equal(bnbAmount);
        });

        it("Should reject fill on expired order", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_HOUR, { value: bnbAmount });

            await time.increase(ONE_HOUR + 1);

            await expect(
                orderBook.connect(user2).fillBuyOrder(1, mwgAmount)
            ).to.be.revertedWith("Order expired");
        });
    });

    describe("Withdrawal (Pull-over-Push)", function () {
        it("Should withdraw pending BNB", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });
            await orderBook.connect(user2).fillBuyOrder(1, mwgAmount);

            const balanceBefore = await ethers.provider.getBalance(user2.address);

            const tx = await orderBook.connect(user2).withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(user2.address);

            expect(balanceAfter - balanceBefore + gasUsed).to.equal(bnbAmount);
            expect(await orderBook.pendingWithdrawals(user2.address)).to.equal(0);
        });

        it("Should reject withdrawal with no pending amount", async function () {
            await expect(
                orderBook.connect(user1).withdraw()
            ).to.be.revertedWith("No pending withdrawals");
        });

        it("Should emit WithdrawalClaimed event", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });
            await orderBook.connect(user2).fillBuyOrder(1, mwgAmount);

            await expect(
                orderBook.connect(user2).withdraw()
            ).to.emit(orderBook, "WithdrawalClaimed")
                .withArgs(user2.address, bnbAmount);
        });
    });

    describe("View Functions", function () {
        it("Should get active orders with pagination", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            // Create 5 buy orders
            for (let i = 0; i < 5; i++) {
                await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });
            }

            // Create 5 sell orders
            for (let i = 0; i < 5; i++) {
                await orderBook.connect(user2).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY);
            }

            const [buyOrders, sellOrders, totalBuy, totalSell] = await orderBook.getActiveOrders(0, 3);

            expect(buyOrders.length).to.equal(3);
            expect(sellOrders.length).to.equal(3);
            expect(totalBuy).to.equal(5);
            expect(totalSell).to.equal(5);
        });

        it("Should get user orders", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });
            await orderBook.connect(user1).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY);

            const userOrders = await orderBook.getUserOrders(user1.address);
            expect(userOrders.length).to.equal(2);
        });

        it("Should get order fill history", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });

            await orderBook.connect(user2).fillBuyOrder(1, ethers.parseEther("300"));
            await orderBook.connect(user3).fillBuyOrder(1, ethers.parseEther("700"));

            const fills = await orderBook.getOrderFills(1);
            expect(fills.length).to.equal(2);
            expect(fills[0].filler).to.equal(user2.address);
            expect(fills[1].filler).to.equal(user3.address);
        });

        it("Should get best buy and sell prices", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const price1 = ethers.parseEther("0.0001");
            const price2 = ethers.parseEther("0.00015");
            const price3 = ethers.parseEther("0.0002");

            const bnb1 = (mwgAmount * price1) / ethers.parseEther("1");
            const bnb2 = (mwgAmount * price2) / ethers.parseEther("1");
            const bnb3 = (mwgAmount * price3) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, price1, ONE_DAY, { value: bnb1 });
            await orderBook.connect(user1).createBuyOrder(mwgAmount, price2, ONE_DAY, { value: bnb2 });
            await orderBook.connect(user1).createBuyOrder(mwgAmount, price3, ONE_DAY, { value: bnb3 });

            await orderBook.connect(user2).createSellOrder(mwgAmount, price1, ONE_DAY);
            await orderBook.connect(user2).createSellOrder(mwgAmount, price2, ONE_DAY);
            await orderBook.connect(user2).createSellOrder(mwgAmount, price3, ONE_DAY);

            const bestBuy = await orderBook.getBestBuyPrice();
            const bestSell = await orderBook.getBestSellPrice();

            expect(bestBuy).to.equal(price3); // Highest buy price
            expect(bestSell).to.equal(price1); // Lowest sell price
        });

        it("Should get order book statistics", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });
            await orderBook.connect(user2).createSellOrder(mwgAmount, pricePerMWG, ONE_DAY);

            const [totalOrders, activeBuy, activeSell] = await orderBook.getOrderBookStats();

            expect(totalOrders).to.equal(2);
            expect(activeBuy).to.equal(1);
            expect(activeSell).to.equal(1);
        });
    });

    describe("Admin Functions", function () {
        it("Should update minimum amounts", async function () {
            const newMinMWG = ethers.parseEther("500");
            const newMinBNB = ethers.parseEther("0.001");

            await expect(
                orderBook.connect(admin).setMinimumAmounts(newMinMWG, newMinBNB)
            ).to.emit(orderBook, "MinimumAmountsUpdated")
                .withArgs(newMinMWG, newMinBNB);

            expect(await orderBook.minMWGAmount()).to.equal(newMinMWG);
            expect(await orderBook.minBNBAmount()).to.equal(newMinBNB);
        });

        it("Should update fee settings", async function () {
            const newFee = 250; // 2.5%
            const newRecipient = feeRecipient.address;

            await expect(
                orderBook.connect(admin).setFee(newFee, newRecipient)
            ).to.emit(orderBook, "FeeUpdated")
                .withArgs(newFee, newRecipient);

            expect(await orderBook.feePercentage()).to.equal(newFee);
            expect(await orderBook.feeRecipient()).to.equal(newRecipient);
        });

        it("Should reject fee above 10%", async function () {
            await expect(
                orderBook.connect(admin).setFee(1001, feeRecipient.address)
            ).to.be.revertedWith("Fee too high (max 10%)");
        });

        it("Should pause and unpause contract", async function () {
            await orderBook.connect(admin).pause();

            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await expect(
                orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount })
            ).to.be.reverted;

            await orderBook.connect(admin).unpause();

            await expect(
                orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount })
            ).to.emit(orderBook, "OrderCreated");
        });

        it("Should emergency cancel order", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });

            await expect(
                orderBook.connect(admin).emergencyCancelOrder(1)
            ).to.emit(orderBook, "OrderCancelled");

            const order = await orderBook.orders(1);
            expect(order.status).to.equal(3); // CANCELLED

            expect(await orderBook.pendingWithdrawals(user1.address)).to.equal(bnbAmount);
        });

        it("Should reject admin functions from non-admin", async function () {
            await expect(
                orderBook.connect(user1).setMinimumAmounts(ethers.parseEther("200"), ethers.parseEther("0.001"))
            ).to.be.reverted;

            await expect(
                orderBook.connect(user1).setFee(100, feeRecipient.address)
            ).to.be.reverted;

            await expect(
                orderBook.connect(user1).pause()
            ).to.be.reverted;
        });
    });

    describe("Fee Change Protection", function () {
        it("Should not affect existing orders when fee changes", async function () {
            const mwgAmount = ethers.parseEther("1000");
            const pricePerMWG = ethers.parseEther("0.0001");
            const bnbAmount = (mwgAmount * pricePerMWG) / ethers.parseEther("1");

            // Create order with 0% fee
            await orderBook.connect(user1).createBuyOrder(mwgAmount, pricePerMWG, ONE_DAY, { value: bnbAmount });

            // Change fee to 10%
            await orderBook.connect(admin).setFee(1000, feeRecipient.address);

            // Fill should use original 0% fee
            await orderBook.connect(user2).fillBuyOrder(1, mwgAmount);

            // User2 should receive full BNB amount (no fee)
            expect(await orderBook.pendingWithdrawals(user2.address)).to.equal(bnbAmount);
            expect(await orderBook.pendingWithdrawals(feeRecipient.address)).to.equal(0);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle direct BNB transfer rejection", async function () {
            await expect(
                owner.sendTransaction({
                    to: await orderBook.getAddress(),
                    value: ethers.parseEther("1")
                })
            ).to.be.revertedWith("Direct transfers not allowed");
        });

        it("Should handle pagination edge cases", async function () {
            const [buyOrders, sellOrders] = await orderBook.getActiveOrders(0, 10);
            expect(buyOrders.length).to.equal(0);
            expect(sellOrders.length).to.equal(0);
        });

        it("Should reject pagination limit over 100", async function () {
            await expect(
                orderBook.getActiveOrders(0, 101)
            ).to.be.revertedWith("Limit too high (max 100)");
        });

        it("Should handle non-existent order gracefully", async function () {
            await expect(
                orderBook.connect(user1).fillBuyOrder(999, ethers.parseEther("100"))
            ).to.be.revertedWith("Order does not exist");
        });
    });
});
