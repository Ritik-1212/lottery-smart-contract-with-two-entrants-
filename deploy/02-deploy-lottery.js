const { verify } = require("../utils/verify");
const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper.hardhat.config");

const FUND_SUBSCRIPTION_AMOUNT = ethers.utils.parseEther("2");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock;
  if (chainId == 31337) {
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    const txResponse = await vrfCoordinatorV2Mock.createSubscription();
    const txReceipt = await txResponse.wait(1);
    subscriptionId = txReceipt.events[0].args.subId;

    await vrfCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      FUND_SUBSCRIPTION_AMOUNT
    );
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }
  const gasLane = networkConfig[chainId]["gasLane"];
  console.log(gasLane);
  const entranceFee = networkConfig[chainId].raffleEntranceFee;
  console.log(entranceFee.toString());

  const callbackGasLimit = networkConfig[chainId].callbackGasLimit;

  const args = [
    vrfCoordinatorV2Address,
    subscriptionId,
    gasLane,
    entranceFee,
    callbackGasLimit,
  ];

  log("deploying............");
  const Lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
  });

  log("adding consumers");
  await vrfCoordinatorV2Mock.addConsumer(subscriptionId, Lottery.address);

  if (!developmentChains.includes(network.name)) {
    log("verifying ............");
    await verify(Lottery.address, args);
  }
};

module.exports.tags = ["all", "lottery"];
