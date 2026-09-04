// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./WORKToken.sol";

/**
 * @title MVGR
 * @dev Alias / Implementation wrapper for WORKToken conforming to institutional deployment naming.
 */
contract MVGR is WORKToken {
    constructor(
        address _director,
        address _financeAdmin,
        address _relayer,
        address _salaryPoolVault
    ) WORKToken(_director, _financeAdmin, _relayer, _salaryPoolVault) {}
}
