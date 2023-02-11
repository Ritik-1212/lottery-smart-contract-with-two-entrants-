const { network, ethers } = require("hardhat");

const BASE_FEE = "25000";
const GAS_PRICE_LINK = 1e9;

module.exports = async ({ deployments, getNamedAccounts }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = network.config.chainId;

  if (chainId == 31337) {
    log("deploying Mocks...........");
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      args: [BASE_FEE, GAS_PRICE_LINK],
      log: true,
    });
  }
};

module.exports.tags = ["all", "mocks"];
