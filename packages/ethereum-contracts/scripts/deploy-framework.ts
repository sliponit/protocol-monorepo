import {ethers} from "hardhat";

export const deployFramework = async (
    protocolReleaseVersion: string,
    nonUpgradeable: boolean,
    appWhiteListing: boolean
) => {
    const deployer = (await ethers.getSigners())[0];
    const chainId = (await deployer.provider!.getNetwork()).chainId;

    // STEP 1
    // Deploy ERC1820 Registry
    // done by `hardhat-erc1820` plugin because bonk that nonsense
    console.log("STEP 01: Deploy ERC1820 Registry");

    // STEP 2
    // Deploy Resolver
    console.log("STEP 02: Deploy Resolver");
    const resolverFactory = await ethers.getContractFactory(
        "Resolver",
        deployer
    );
    const resolver = await resolverFactory.deploy();
    await resolver.deployed();

    // STEP 3
    // Deploy Governance
    console.log("STEP 03: Deploy Governance");
    const governanceFactory = await ethers.getContractFactory(
        "TestGovernance",
        deployer
    );
    const governance = await governanceFactory.deploy();
    await governance.deployed();

    // STEP 4
    // Register Governance with Resolver
    console.log("STEP 04: Register Governance with Resolver");
    // TODO: add conditions of whether or not to register
    await resolver
        .connect(deployer)
        .set(`TestGovernance.${protocolReleaseVersion}`, governance.address);

    // STEP 5
    // Deploy Superfluid Loader
    console.log("STEP 05: Deploy SuperfuidLoader");
    const superfluidLoaderFactory = await ethers.getContractFactory(
        "SuperfluidLoader",
        deployer
    );
    const superfluidLoader = await superfluidLoaderFactory.deploy(
        resolver.address
    );
    await superfluidLoader.deployed();

    // STEP 6
    // Register Loader with Resolver
    console.log("STEP 06: Register Loader with Resolver");
    await resolver
        .connect(deployer)
        .set("SuperfluidLoader-v1", superfluidLoader.address);

    // STEP 7
    // Deploy and initialize Superfluid host contract
    console.log("STEP 07: Deploy and initialize Superfluid (host)");
    const hostFactory = await ethers.getContractFactory("Superfluid");
    const host = await hostFactory.deploy(nonUpgradeable, appWhiteListing);
    await host.connect(deployer).initialize(governance.address);

    // STEP 8
    // Register Superfluid with Resolver
    console.log("STEP 08: Register Superfluid with Resolver");
    await resolver
        .connect(deployer)
        .set(`Superfluid.${protocolReleaseVersion}`, host.address);

    // STEP 9
    // Initialize Governance
    console.log("STEP 09: Initialize Governance");
    // TODO: NEED TO GET CONFIG TO REPLACE THESE HARDCODED
    // MAGIC NUMBERS
    await governance.connect(deployer).initialize(
        host.address,
        deployer.address,
        14400, // 4 hours
        900, // 15 minutes
        []
    );

    // STEP 10
    // Deploy ConstantFlowAgreementV1
    console.log("STEP 10: Deploy ConstantFlowAgreementV1");
    const constantFlowAgreementV1Factory = await ethers.getContractFactory(
        "ConstantFlowAgreementV1",
        deployer
    );
    const constantFlowAgreementV1 = await constantFlowAgreementV1Factory.deploy(
        host.address
    );
    await constantFlowAgreementV1.deployed();

    // STEP 11
    // Register ConstantFlowAgreementV1 agreement class with Governance
    console.log("STEP 11: Register ConstantFlowAgreementV1 with Governance");
    await governance
        .connect(deployer)
        .registerAgreementClass(host.address, constantFlowAgreementV1.address);

    // STEP 12
    // Deploy SlotsBitmapLibrary
    console.log("STEP 12: Deploy SlotsBitmapLibrary");
    const slotsBitmapLibraryFactory = await ethers.getContractFactory(
        "SlotsBitmapLibrary"
    );
    const slotsBitmapLibrary = await slotsBitmapLibraryFactory.deploy();
    await slotsBitmapLibrary.deployed();

    // STEP 13
    // Deploy InstantDistributionAgreementV1
    console.log("STEP 13: Deploy InstantDistributionAgreementV1");
    const instantDistributionAgreementV1Factory =
        await ethers.getContractFactory("InstantDistributionAgreementV1", {
            signer: deployer,
            libraries: {
                SlotsBitmapLibrary: slotsBitmapLibrary.address,
            },
        });
    const instantDistributionAgreementV1 =
        await instantDistributionAgreementV1Factory.deploy(host.address);
    await instantDistributionAgreementV1.deployed();

    // STEP 14
    // Register InstantDistributionAgreementV1 agreement class with Governance
    console.log(
        "STEP 14: Register InstantDistributionAgreementV1 with Governance"
    );
    await governance
        .connect(deployer)
        .registerAgreementClass(
            host.address,
            instantDistributionAgreementV1.address
        );

    // STEP 15
    // Deploy SuperTokenFactoryHelper library
    console.log("STEP 15: Deploy SuperTokenFactoryHelper library");
    const superTokenFactoryHelperFactory = await ethers.getContractFactory(
        "SuperTokenFactoryHelper",
        deployer
    );
    const superTokenFactoryHelper =
        await superTokenFactoryHelperFactory.deploy();
    await superTokenFactoryHelper.deployed();

    // STEP 16
    // Deploy SuperTokenFactory
    console.log("STEP 16: Deploy SuperTokenFactory");

    const superTokenFactoryFactory = await ethers.getContractFactory(
        "SuperTokenFactory",
        deployer
    );
    const superTokenFactory = await superTokenFactoryFactory.deploy(
        host.address,
        superTokenFactoryHelper.address
    );
    await superTokenFactoryHelper.deployed();

    // STEP 17
    // 'Upgrade', but instead of upgrading, we're actually registering the SuperTokenFactory with
    // the Superfluid host contract. @superfluid-finance wen better deploy and upgrade scripps D:
    console.log("STEP 17: Register SuperTokenFactory with Superfluid (host)");
    const registerSuperTokenFactoryTxn = await governance
        .connect(deployer)
        .updateContracts(
            host.address,
            ethers.constants.AddressZero,
            [],
            superTokenFactory.address
        );
    await registerSuperTokenFactoryTxn.wait(6);

    return {
        resolver: resolver.address,
        governace: governance.address,
        superfluidLoader: superfluidLoader.address,
        host: host.address,
        constantFlowAgreementV1: constantFlowAgreementV1.address,
        instantDistributionAgreementV1: instantDistributionAgreementV1.address,
        superTokenFactoryHelper: superTokenFactoryHelper.address,
        superTokenFactory: superTokenFactory.address,
    };
}