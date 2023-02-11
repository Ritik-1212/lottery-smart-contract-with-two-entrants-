const { assert, expect } = require("chai");
const { network, ethers, deployments } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper.hardhat.config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery", function () {
      let lottery,
        vrfCoordinatorV2,
        chainId,
        deployer,
        player,
        entranceFee,
        accounts,
        privateAddress;

      beforeEach(async function () {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        player = accounts[1];

        await deployments.fixture(["all"]);
        lottery = await ethers.getContract("Lottery", deployer);
        vrfCoordinatorV2 = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        chainId = network.config.chainId;
        entranceFee = await lottery.getEntranceFee();
        privateAddress = await lottery.getPrivateAddress();
      });

      describe("enterLottery", function () {
        it("reverts if not enough ETH sent as msg value to enter lottery and emit the event", async function () {
          await expect(lottery.enterLottery()).to.be.revertedWithCustomError(
            lottery,
            "Lottery__notEnoughEntranceFee"
          );

          await expect(lottery.enterLottery({ value: entranceFee })).to.emit(
            lottery,
            "lotteryEntrants"
          );

          await lottery.connect(player);
          await lottery.enterLottery({ value: entranceFee });
          const numplayers = await lottery.getNumEntrants();
          assert.equal(numplayers.toString(), "2");

          await expect(
            lottery.enterLottery({ value: entranceFee })
          ).to.be.revertedWithCustomError(lottery, "maxNumPlayersReached");
        });
      });
      describe("fulfillRandomWords", function () {
        beforeEach(async function () {
          await lottery.connect(player);
          await lottery.enterLottery({ value: entranceFee });
        });
        it("reverts if the request is non existent", async function () {
          await expect(
            vrfCoordinatorV2.fulfillRandomWords(0, lottery.address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2.fulfillRandomWords(1, lottery.address)
          ).to.be.revertedWith("nonexistent request");
        });
        it("picks a winner resets the number of entrants, sends money to winner and remaining to private address", async function () {
          await lottery.connect(player);
          await lottery.enterLottery({ value: entranceFee });
          const numEntrants = await lottery.getNumEntrants();
          console.log(
            "number of entrants before lottery winner is picked " + numEntrants
          );

          const lotteryBalance = await lottery.provider.getBalance(
            lottery.address
          );
          console.log(
            "lottery balance before winner is picked " + lotteryBalance
          );
          const tx = await lottery.requestRandomWords();
          const txReceipt = await tx.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const winnerTx = await vrfCoordinatorV2.fulfillRandomWords(
            requestId,
            lottery.address
          );
          const txReceiptWinner = await winnerTx.wait(1);
          let { gasUsed, effectiveGasPrice } = txReceiptWinner;
          const gasCost = gasUsed.mul(effectiveGasPrice);

          const winnerPicked = await lottery.getRecentWinner();
          console.log("recent lottery winner is " + winnerPicked);

          const numEntrantsAfter = await lottery.getNumEntrants();
          console.log(
            "number of entrants after winner picked " + numEntrantsAfter
          );

          const lotteryBalanceAfter = await lottery.provider.getBalance(
            lottery.address
          );
          console.log(
            "lottery balance after winner is picked " + lotteryBalanceAfter
          );

          assert.equal(numEntrantsAfter.toString(), "0");
          assert.equal(winnerPicked, deployer.address);
          assert.equal();
          assert.equal(
            lotteryBalanceAfter.toString(),
            ethers.utils.parseEther("0.2")
          );

          const lotteryBalanceToWithdraw = await lottery.provider.getBalance(
            lottery.address
          );

          const privateAddressBalance = await lottery.provider.getBalance(
            privateAddress
          );

          await lottery.withdraw();

          const endingLotteryBalance = await lottery.provider.getBalance(
            lottery.address
          );

          const endingPrivateAddressBalance = await lottery.provider.getBalance(
            privateAddress
          );

          assert.equal(endingLotteryBalance, 0);
          assert.equal(
            lotteryBalanceToWithdraw.add(privateAddressBalance).toString(),
            endingPrivateAddressBalance.toString()
          );
        });
      });
    });
