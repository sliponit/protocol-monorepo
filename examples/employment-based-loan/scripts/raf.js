const url = `${process.env.MUMBAI_URL}`;
const customHttpProvider = new ethers.providers.JsonRpcProvider(url);


// initialization of the core SDK
  const sf = await Framework.create({ 
    networkName: "mumbai", 
    provider: customHttpProvider ,
    // TODO?? resolverAddress: process.env.RESOLVER_ADDRESS, //this is how you get the resolver address
  });

  // Creating a signer
  const signer = sf.createSigner({
    privateKey: `0x${process.env.PRIVATE_KEY}`,
    provider: customHttpProvider
  });