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

    struct ReceiverData {
        address to;
        uint256 flowRate;
    }

    struct Configuration {
        ISuperToken outgoingToken;
    }

    IConstantFlowAgreementV1 private _cfa;
    ISuperfluid private _host;

    constructor(IConstantFlowAgreementV1 cfa, ISuperfluid superfluid) {
        assert(address(cfa) != address(0));
        assert(address(superfluid) != address(0));
        _cfa = cfa;
        _host = superfluid;

        uint256 configWord =
        SuperAppDefinitions.APP_LEVEL_FINAL |
        SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
        SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        _host.registerApp(configWord);
    }

    function _parseUserData(
        bytes memory userData
    )
    private pure
    returns (address sender)
    {
        // @check Not sure if correct
        (sender) = abi.decode(
            userData, (address));
    }


    // @check
    function _updateDifferentFlow(
        Configuration memory configuration,
        ISuperToken superToken,
        bytes4 selector,
        int96 flowRate,
        uint256 appAllowanceGranted,
        bytes calldata ctx
    )
    private
    returns (bytes memory newCtx)
    {

        newCtx = ctx;
        // Since the flow rates are the same for both tokens, we can just use the first one
        int96 safeFlowRate = _cfa.getMaximumFlowRateFromDeposit(superToken, appAllowanceGranted - 1);
        appAllowanceGranted = _cfa.getDepositRequiredForFlowRate(superToken, safeFlowRate);

        // @check Not sure if correct way to get the sender
        StackVars memory vars;
        vars.context = _host.decodeCtx(ctx);

        int96 targetFlowRate = _cfa.getMaximumFlowRateFromDeposit(
                superToken,
                appAllowanceGranted
            );
            flowRate -= targetFlowRate;
            //CFA should revert if there is not enough balance so no need to add custom checks right?
            bytes memory callData = abi.encodeWithSelector(
                selector,
                configuration.outgoingToken,
                vars.context.msgSender,
                targetFlowRate,
                new bytes(0)
            );
            (newCtx, ) = _host.callAgreementWithContext(
                _cfa,
                callData,
                new bytes(0), // user data
                newCtx
            );

        assert(flowRate >= 0);
    }

    // Stolen from MFA
    function createFlow(
        ISuperToken superToken,
        address receiver,
        int96 flowRate,
        bytes calldata ctx
    )
    external
    returns (bytes memory newCtx)
    {
        bytes memory callData = abi.encodeWithSelector(
            _cfa.createFlow.selector,
            superToken,
            receiver,
            flowRate,
            new bytes(0));
        (newCtx, ) = _host.callAgreementWithContext(
            _cfa,
            callData,
            new bytes(0), // user data
            ctx
        );
    }

    struct StackVars {
        ISuperfluid.Context context;
        address dfaSender;
        Configuration configuration;
        address flowSender;
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
        StackVars memory vars;

        vars.context = _host.decodeCtx(ctx);
        // parse user data
        (vars.dfaSender) = _parseUserData(vars.context.userData);
        // validate the context
        {
            (vars.flowSender) = abi.decode(agreementData, (address));
            assert(vars.flowSender == vars.context.msgSender);
            assert(vars.context.appAllowanceGranted > 0);
        }
        int96 flowRate;
        (,flowRate,,) = _cfa.getFlowByID(superToken, agreementId);
        newCtx = _updateDifferentFlow(
            vars.configuration,
            superToken,
            _cfa.createFlow.selector,
            flowRate,
            vars.context.appAllowanceGranted,
            ctx);
    }


    modifier onlyHost() {
        assert(msg.sender == address(_host));
        _;
    }
}
