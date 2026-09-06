// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title WorkLedgerToken
 * @dev Simple ERC-20 audit settlement token on Ethereum Sepolia for WorkLedger.
 * Owner (Treasury wallet) can mint verified audit tokens upon approved salary reviews.
 */
contract WorkLedgerToken is ERC20, Ownable, ERC20Permit {
    constructor(address initialOwner)
        ERC20("WorkLedger Token", "WORK")
        Ownable(initialOwner)
        ERC20Permit("WorkLedger Token")
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
