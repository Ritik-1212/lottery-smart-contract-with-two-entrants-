//SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

/* imports */
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

/*error */
error Lottery__notEnoughEntranceFee();
error maxNumPlayersReached();
error notEnoughEntrants();
error winnerWithdrawalNotSuccessful();
error notOwner();
error withdrawalFailed();

contract Lottery is VRFConsumerBaseV2 {
    /*state variables */
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    // constants
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    address private constant privateAddress =
        0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    /*Lottery Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_entrants;
    address private s_recentWinner;
    address private immutable i_owner;

    /*modifiers */
    modifier requiredEntrants() {
        if (s_entrants.length != 2) {
            revert notEnoughEntrants();
        }
        _;
    }
    modifier onlyOwner() {
        if (msg.sender != i_owner) {
            revert notOwner();
        }
        _;
    }

    /*constructor */
    constructor(
        address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane,
        uint256 entranceFee,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        i_owner = msg.sender;
    }

    /*events */
    event lotteryEntrants(address indexed entrant);
    event requestedId(uint256 indexed requestId, address indexed sender);
    event WinnerPicked(address indexed Winner);

    /* lottery functions */
    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__notEnoughEntranceFee();
        }
        if (s_entrants.length >= 2) {
            revert maxNumPlayersReached();
        }
        s_entrants.push(payable(msg.sender));
        emit lotteryEntrants(msg.sender);
    }

    function requestRandomWords() external returns (uint256 requestId) {
        // Will revert if subscription is not set and funded.
        requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit requestedId(requestId, msg.sender);
    }

    /* requests the random number to pick a random winner */
    function fulfillRandomWords(
        uint256 /*_requestId */,
        uint256[] memory _randomWords
    ) internal override requiredEntrants {
        uint256 winnerIndex = _randomWords[0] % s_entrants.length;
        address payable pickedWinner = s_entrants[winnerIndex];
        s_recentWinner = pickedWinner;
        s_entrants = new address payable[](0);
        (bool success, ) = pickedWinner.call{value: 1.8 ether}("");
        if (!success) {
            revert winnerWithdrawalNotSuccessful();
        }

        emit WinnerPicked(pickedWinner);
    }

    /* withdraws the remaining ether to a private hardcoded address */
    function withdraw() public onlyOwner {
        (bool success, ) = payable(privateAddress).call{value: 0.2 ether}("");
        if (!success) {
            revert withdrawalFailed();
        }
    }

    /*getter functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getNumEntrants() public view returns (uint256) {
        return s_entrants.length;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getSubscriptionId() public view returns (uint64) {
        return i_subscriptionId;
    }

    function getOwner() public view returns (address) {
        return i_owner;
    }

    function getPrivateAddress() public pure returns (address) {
        return privateAddress;
    }
}
