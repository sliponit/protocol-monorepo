// SPDX-License-Identifier: AGPLv3
pragma solidity 0.8.13;

import {
    ISuperfluid,
    ISuperToken,
    SuperAppBase,
    SuperAppDefinitions
} from "../apps/SuperAppBase.sol";
import { IConstantFlowAgreementV1 } from "../interfaces/agreements/IConstantFlowAgreementV1.sol";

/**
 * @title Different Token Flow (Super) App
 * @author Superfluid
 * @dev A super app that sends back a different token to the sender
 *      This is used for testing specific CFA logic
 */

contract DifferentTokenFlowApp is SuperAppBase {
    struct Configuration {
        ISuperToken outgoingToken;
    }

    IConstantFlowAgreementV1 private _cfa;
    ISuperfluid private _host;
    Configuration private _configuration;

    modifier onlyHost() {
        assert(msg.sender == address(_host));
        _;
    }

    constructor(IConstantFlowAgreementV1 cfa, ISuperfluid superfluid , ISuperToken outgoingToken) public {
        assert(address(cfa) != address(0));
        assert(address(superfluid) != address(0));

        _cfa = cfa;
        _host = superfluid;
        _configuration.outgoingToken = outgoingToken;

        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        _host.registerApp(configWord);
    }

    function afterAgreementCreated(
        ISuperToken superToken,
        address agreementClass,
        bytes32 agreementId,
        bytes calldata agreementData,
        bytes calldata /*cbdata*/,
        bytes calldata ctx
    )
        external override
        onlyHost
        returns(bytes memory newCtx)
    {
        assert(agreementClass == address(_cfa));

        (address flowSender,) = abi.decode(agreementData, (address, address));
        (,int96 flowRate,,) = _cfa.getFlowByID(superToken, agreementId);

        // CFA will revert if we don't have enough tokens for the deposit of this flow
        bytes memory callData = abi.encodeWithSelector(
            _cfa.createFlow.selector,
            _configuration.outgoingToken,
            flowSender, // becomes the receiver
            flowRate,
            new bytes(0)
        );
        (newCtx, ) = _host.callAgreementWithContext(
            _cfa,
            callData,
            new bytes(0), // user data
            ctx
        );
    }
}
