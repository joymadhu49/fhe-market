// SPDX-License-Identifier: MIT
// Vendored from zama-ai/openzeppelin-confidential-contracts (v0.2.0).
pragma solidity ^0.8.24;

import { euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";

interface IERC7984 is IERC165 {
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);
    event ConfidentialTransfer(address indexed from, address indexed to, euint64 indexed amount);
    event AmountDisclosed(euint64 indexed encryptedAmount, uint64 amount);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function contractURI() external view returns (string memory);
    function confidentialTotalSupply() external view returns (euint64);
    function confidentialBalanceOf(address account) external view returns (euint64);
    function isOperator(address holder, address spender) external view returns (bool);

    function setOperator(address operator, uint48 until) external;

    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64);
    function confidentialTransfer(address to, euint64 amount) external returns (euint64 transferred);

    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64);
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64 transferred);

    function confidentialTransferAndCall(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata data
    ) external returns (euint64 transferred);
    function confidentialTransferAndCall(
        address to,
        euint64 amount,
        bytes calldata data
    ) external returns (euint64 transferred);

    function confidentialTransferFromAndCall(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        bytes calldata data
    ) external returns (euint64 transferred);
    function confidentialTransferFromAndCall(
        address from,
        address to,
        euint64 amount,
        bytes calldata data
    ) external returns (euint64 transferred);
}
