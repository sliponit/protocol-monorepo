const { Framework } = require("@superfluid-finance/sdk-core");
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");

require("dotenv");

const errorHandler = (err) => {
  if (err) throw err;
};

const main = async () => {
  console.log('allo')

  //get accounts from hardhat
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }

  console.log('deploy the framework')
  //deploy the framework
  await deployFramework(errorHandler, {
      web3,
      from: accounts[0].address,
  });

  console.log('deploy a fake erc20 token for borrow token')
  //deploy a fake erc20 token for borrow token
  let fDAIAddress = await deployTestToken(errorHandler, [":", "fDAI"], {
      web3,
      from: accounts[0].address,
  });

  //deploy another fake erc20 token for collateral token
  let fCOLAddress = await deployTestToken(errorHandler, [":", "fCOL"], {
      web3,
      from: accounts[0].address,
  });

  //deploy a fake erc20 wrapper super token around the fDAI token
  let fDAIxAddress = await deploySuperToken(errorHandler, [":", "fDAI"], {
      web3,
      from: accounts[0].address,
  });

  let fCOLxAddress = await deploySuperToken(errorHandler, [":", "fCOL"], {
      web3,
      from: accounts[0].address,
  });

  console.log('initializing')
  //initialize the superfluid framework...put custom and web3 only bc we are using hardhat locally
  const sf = await Framework.create({
      networkName: "mumbai",
      provider,
      dataMode: "WEB3_ONLY",
      resolverAddress: process.env.RESOLVER_ADDRESS, //this is how you get the resolver address
      // TODO?? protocolReleaseVersion: "test",
  });
  console.log('initialized')

  const borrower = await sf.createSigner({
      signer: accounts[0],
      provider: provider
  });    

  const lender = await sf.createSigner({
      signer: accounts[1],
      provider: provider
  });

  const employer = await sf.createSigner({
      signer: accounts[2],
      provider: provider
  })

  const outsider = await sf.createSigner({
      signer: accounts[3],
      provider: provider
  });
  //use the framework to get the super toen
  const daix = await sf.loadSuperToken("fDAIx");
  const colx = await sf.loadSuperToken("fCOLx");
  
  //get the contract object for the erc20 token
  let daiAddress = daix.underlyingToken.address;
  const dai = new ethers.Contract(daiAddress, daiABI, accounts[0]);

  let coladdress = colx.underlyingToken.address;
  const col = new ethers.Contract(coladdress, daiABI, accounts[0]);
  
  let LoanFactory = await ethers.getContractFactory("LoanFactory", accounts[0]);   
  const loanFactory = await LoanFactory.deploy();
  await loanFactory.deployed();
  
  let MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator", accounts[0]); 
  
  //fake price of collateral token to simulate oracle - 10 borrow tokens for 1 collateral tokens, collateralTokenAddress is used
  priceFeed = await MockV3Aggregator.deploy(10000000000);
  
  await priceFeed.deployed();
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

runMain();