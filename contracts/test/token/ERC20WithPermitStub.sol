// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../../token/ERC20WithPermit.sol";

contract ERC20WithPermitStub is ERC20WithPermit {
    event BeforeTokenTransferCalled(address from, address to, uint256 amount);

    constructor(string memory _name, string memory _symbol)
        ERC20WithPermit(_name, _symbol)
    {}

    function beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        emit BeforeTokenTransferCalled(from, to, amount);
    }
}
