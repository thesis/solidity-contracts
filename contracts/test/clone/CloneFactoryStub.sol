// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../../clone/CloneFactory.sol";

contract CloneFactoryStub is CloneFactory {
    event CloneCreated(address cloneAddress);

    function createClonePublic(address target) external {
        emit CloneCreated(createClone(target));
    }

    function isClonePublic(address target, address query)
        external
        view
        returns (bool)
    {
        return isClone(target, query);
    }
}
