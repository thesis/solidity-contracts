// SPDX-License-Identifier: MIT

pragma solidity ^0.8.5;

/// @notice An interface that should be implemented by tokens supporting
///         `approveAndCall`/`receiveApproval` pattern.
interface IApproveAndCall {
    /// @notice Executes receiveApproval function on spender as specified in
    ///         IReceiveApproval interface. Approves spender to withdraw from
    ///         the caller multiple times, up to the value amount. If this
    ///         function is called again, it overwrites the current allowance
    ///         with value. Reverts if the approval reverted or if
    ///         receiveApproval call on the spender reverted.
    function approveAndCall(
        address spender,
        uint256 value,
        bytes memory extraData
    ) external returns (bool);
}
