// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

import { IERC7984 } from "../interfaces/IERC7984.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";

/// @title MockConfidentialUSDT
/// @notice Minimal ERC-7984 stand-in for hardhat-mock and Sepolia-mock tests.
///         Real arcbet-fhe deployment uses the canonical cUSDT at
///         `0x4E7B06D78965594eB5EF5414c357ca21E1554491`.
contract MockConfidentialUSDT is IERC7984, ZamaEthereumConfig {
    string public override name = "Mock Confidential USDT";
    string public override symbol = "mcUSDT";
    uint8 public constant override decimals = 6;
    string public override contractURI = "";

    mapping(address => euint64) private _bal;
    euint64 private _total;
    mapping(address => mapping(address => uint48)) private _operatorUntil;

    function supportsInterface(bytes4 id) external pure override returns (bool) {
        return id == type(IERC7984).interfaceId || id == type(IERC165).interfaceId;
    }

    function confidentialTotalSupply() external view override returns (euint64) {
        return _total;
    }

    function confidentialBalanceOf(address a) external view override returns (euint64) {
        return _bal[a];
    }

    function isOperator(address holder, address spender) public view override returns (bool) {
        return _operatorUntil[holder][spender] > block.timestamp;
    }

    function setOperator(address operator, uint48 until) external override {
        _operatorUntil[msg.sender][operator] = until;
        emit OperatorSet(msg.sender, operator, until);
    }

    function mint(address to, uint64 amount) external {
        euint64 enc = FHE.asEuint64(amount);
        euint64 prev = _bal[to];
        if (!FHE.isInitialized(prev)) prev = FHE.asEuint64(0);
        euint64 next = FHE.add(prev, enc);
        _bal[to] = next;

        euint64 prevTotal = _total;
        if (!FHE.isInitialized(prevTotal)) prevTotal = FHE.asEuint64(0);
        _total = FHE.add(prevTotal, enc);

        FHE.allowThis(_bal[to]);
        FHE.allow(_bal[to], to);
        FHE.allowThis(_total);
    }

    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override returns (euint64) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _transfer(msg.sender, to, amount);
    }

    function confidentialTransfer(address to, euint64 amount) external override returns (euint64) {
        return _transfer(msg.sender, to, amount);
    }

    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override returns (euint64) {
        require(from == msg.sender || isOperator(from, msg.sender), "not operator");
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _transfer(from, to, amount);
    }

    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external override returns (euint64) {
        require(from == msg.sender || isOperator(from, msg.sender), "not operator");
        return _transfer(from, to, amount);
    }

    function confidentialTransferAndCall(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata
    ) external override returns (euint64) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _transfer(msg.sender, to, amount);
    }

    function confidentialTransferAndCall(address to, euint64 amount, bytes calldata)
        external override returns (euint64)
    {
        return _transfer(msg.sender, to, amount);
    }

    function confidentialTransferFromAndCall(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata
    ) external override returns (euint64) {
        require(from == msg.sender || isOperator(from, msg.sender), "not operator");
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _transfer(from, to, amount);
    }

    function confidentialTransferFromAndCall(
        address from,
        address to,
        euint64 amount,
        bytes calldata
    ) external override returns (euint64) {
        require(from == msg.sender || isOperator(from, msg.sender), "not operator");
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, euint64 amount) internal returns (euint64 sent) {
        euint64 fromBal = _bal[from];
        if (!FHE.isInitialized(fromBal)) fromBal = FHE.asEuint64(0);
        ebool ok = FHE.le(amount, fromBal);
        sent = FHE.select(ok, amount, FHE.asEuint64(0));

        _bal[from] = FHE.sub(fromBal, sent);

        euint64 toBal = _bal[to];
        if (!FHE.isInitialized(toBal)) toBal = FHE.asEuint64(0);
        _bal[to] = FHE.add(toBal, sent);

        FHE.allowThis(_bal[from]);
        FHE.allow(_bal[from], from);
        FHE.allowThis(_bal[to]);
        FHE.allow(_bal[to], to);

        FHE.allowThis(sent);
        FHE.allowTransient(sent, msg.sender);

        emit ConfidentialTransfer(from, to, sent);
    }
}
