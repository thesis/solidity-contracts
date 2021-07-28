// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

contract Cloneable {
    uint256 public value;

    function initialize(uint256 _value) external {
        value = _value;
    }
}
