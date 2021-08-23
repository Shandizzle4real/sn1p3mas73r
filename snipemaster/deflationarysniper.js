import ethers from 'ethers';
import express from 'express';
import chalk from 'chalk';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import twilio from 'twilio';
import web3 from 'web3';
import BigNumber from 'bignumber.js';

dotenv.config();

const Web3 = web3;
const httpprovider = process.env.HTTP_NODE;
const Web3Client = new Web3(new Web3.providers.HttpProvider(httpprovider));
const accountSid = '...';
const authToken = '...';
const client = twilio(accountSid, authToken);
const app = express();
const minABI = [  {    constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function", }, ];
//balance abi web3


const data = {
  WBNB: process.env.WBNB_CONTRACT, //wbnb

  to_PURCHASE: process.env.TO_PURCHASE, // token that you will purchase = BUSD for test '0xe9e7cea3dedca5984780bafc599bd69add087d56'

  AMOUNT_OF_WBNB : process.env.AMOUNT_OF_WBNB, // how much you want to buy in WBNB

  factory: process.env.FACTORY,  //PancakeSwap V2 factory

  router: process.env.ROUTER, //PancakeSwap V2 router

  recipient: process.env.YOUR_ADDRESS, //your wallet address,

  Slippage : process.env.SLIPPAGE, //in Percentage

  gasPrice : ethers.utils.parseUnits(`${process.env.GWEI}`, 'gwei'), //in gwei

  gasLimit : process.env.GAS_LIMIT, //at least 21000

  minBnb : process.env.MIN_LIQUIDITY_ADDED //min liquidity added
}


const sellAddress = process.env.TO_PURCHASE;
const walletAddress = process.env.YOUR_ADDRESS;

const contract = new Web3Client.eth.Contract(minABI, sellAddress);

let initialLiquidityDetected = false;
let jmlBnb = 0;
let snipeSell = false;
let multiSell = process.env.BREAK_SELL;

const wss = process.env.WSS_NODE;
const mnemonic = process.env.YOUR_MNEMONIC //your memonic;
const tokenIn = Web3.utils.toChecksumAddress(data.WBNB);
const tokenOut = Web3.utils.toChecksumAddress(data.to_PURCHASE);
// const provider = new ethers.providers.JsonRpcProvider(bscMainnetUrl)
const provider = new ethers.providers.WebSocketProvider(wss);
const wallet = new ethers.Wallet(mnemonic);
const account = wallet.connect(provider);
const sellTokenIn = Web3.utils.toChecksumAddress(data.to_PURCHASE);
const sellTokenOut = Web3.utils.toChecksumAddress(data.WBNB);


const factory = new ethers.Contract(
  data.factory,
  [
    'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
    'function getPair(address tokenA, address tokenB) external view returns (address pair)'
  ],
  account
);

const router = new ethers.Contract(
  data.router,
  [
    'function swapExactETHForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactTokensForEthSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
  ],
  account
);

const erc = new ethers.Contract(
  data.WBNB,
  [{"constant": true,"inputs": [{"name": "_owner","type": "address"}],"name": "balanceOf","outputs": [{"name": "balance","type": "uint256"}],"payable": false,"type": "function"}],
  account
);

const run = async () => {
    await baseApproval();
}

  async function baseApproval() {
    console.log(
      chalk.blue.inverse(`Base Approval <<<<<------- START-------->>>>> \n`));
      const baseApproveABI = [" function approve(address _spender, uint256 _value) public returns (bool success) "];
      const baseApproveContract = new ethers.Contract(tokenIn, baseApproveABI, account);
      const baseApproveResponse = await baseApproveContract.approve(data.router, ethers.utils.parseUnits(data.AMOUNT_OF_WBNB, 18), {gasLimit: 100000, gasPrice: 5e9});
    console.log('Approved!');

    console.log(
           chalk.blue.inverse(`Base Approval <<<<<------- END-------->>>>> \n` ));

    setTimeout(() => checkLiq(), 1000);
  }

  let checkLiq = async() => {
    const pairAddressx = await factory.getPair(tokenIn, tokenOut);
    console.log(chalk.blue(`pairAddress: ${pairAddressx}`));
    if (pairAddressx !== null && pairAddressx !== undefined) {
      // console.log("pairAddress.toString().indexOf('0x0000000000000')", pairAddress.toString().indexOf('0x0000000000000'));
      if (pairAddressx.toString().indexOf('0x0000000000000') > -1) {
        console.log(chalk.cyan(`pairAddress ${pairAddressx} not detected. Auto restart`));
        return await checkLiq();
      }
    }
    const pairBNBvalue = await erc.balanceOf(pairAddressx);
    jmlBnb = await ethers.utils.formatEther(pairBNBvalue);
    console.log(`value BNB : ${jmlBnb}`);

    if(jmlBnb > data.minBnb){
        setTimeout(() => buyAction(), 500);
    }
    else{
        initialLiquidityDetected = false;
        console.log(' run again...');
        return await checkLiq();
      }
  }


  let buyAction = async() => {
    if(initialLiquidityDetected === true) {
      console.log('not buy cause already buy');
        return null;
    }

    console.log('ready to buy');
    try{
      initialLiquidityDetected = true;

      let amountOutMin = 0;
      //We buy x amount of the new token for our wbnb
      const amountIn = ethers.utils.parseUnits(`${data.AMOUNT_OF_WBNB}`, 'ether');
      if ( parseInt(data.Slippage) !== 0 ){
        const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
        //Our execution price will be a bit different, we need some flexbility
        const amountOutMin = amounts[1].sub(amounts[1].div(`${data.Slippage}`));

      }

      console.log(
       chalk.green.inverse(`Start to buy \n`)
        +
        `Buying Token
        =================
        tokenIn: ${(amountIn * 1e-18).toString()} ${tokenIn} (BNB)
        tokenOut: ${amountOutMin.toString()} ${tokenOut}
      `);

      console.log('Processing Transaction.....');
      console.log(chalk.yellow(`amountIn: ${(amountIn * 1e-18)} ${tokenIn} (BNB)`));
      console.log(chalk.yellow(`amountOutMin: ${amountOutMin}`));
      console.log(chalk.yellow(`tokenIn: ${tokenIn}`));
      console.log(chalk.yellow(`tokenOut: ${tokenOut}`));
      console.log(chalk.yellow(`data.recipient: ${data.recipient}`));
      console.log(chalk.yellow(`data.gasLimit: ${data.gasLimit}`));
      console.log(chalk.yellow(`data.gasPrice: ${data.gasPrice}`));

      // const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens( //uncomment this if you want to buy deflationary token
      const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens( //uncomment here if you want to buy token
        amountIn,
        amountOutMin,
        [tokenIn, tokenOut],
        data.recipient,
        Date.now() + 1000 * 60 * 5, //5 minutes
        {
          'gasLimit': data.gasLimit,
          'gasPrice': data.gasPrice,
            'nonce' : null //set you want buy at where position in blocks
      });

      const receipt = await tx.wait();
      console.log(`Transaction receipt : https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`);

      console.log(
        chalk.green.inverse(`Sending text message... \n`)
      );

      client.messages
        .create({
           body: 'Snipe successfully bought!',
           from: '...',
           to: '...'
         })
        .then(message => console.log(message.sid))
        .catch(err => console.log(err));

      // get sniped token balance
      async function getBalance() {
        const result = await contract.methods.balanceOf(walletAddress).call(); // 29803630997051883414242659
        const format = Web3Client.utils.fromWei(result); // 29803630.99705188341424265


      console.log( chalk.red.inverse('︻デ═一 - - - - - - - - - - - - - - - WEN - - - - - - - - - - - - - '));
      console.log( chalk.red.inverse('︻デ═一 - - - - - - - - - - - - - - -LAMBO - - - - - - - - - - - - -'));
      console.log( chalk.red.inverse('︻デ═一 - - - - - - - - - - - - - - -?????- - - - - - - - - - - - - '));

      console.log(
       chalk.red.inverse(`Sniped token balance/chart: \n`)
        +
        `================= \n
        Balance: ${result} (WEI)
        Poocoin Chart: https://poocoin.app/tokens/${tokenOut}`);


        console.log(
          chalk.red.inverse(`Allow Approval <<<<<------- START-------->>>>> \n`));

        const approveABI = [" function approve(address _spender, uint256 _value) public returns (bool success) "];
        const approveContract = new ethers.Contract(sellTokenIn, approveABI, account);
        const approveResponse = await approveContract.approve(data.router, ethers.utils.parseUnits(format, 18), {gasLimit: 100000, gasPrice: 5e9});
        console.log('Approved!');

        console.log(
           chalk.red.inverse(`Allow Approval <<<<<------- END-------->>>>> \n` ));

      console.log(
        chalk.blue.inverse(`Selling in ${process.env.TIME_SELL} MS`))

        if(process.env.BREAK_SELL == 'true'){
      console.log(chalk.yellow(`BREAK_SELL: ${process.env.BREAK_SELL}`));
            setTimeout(() => sellbreakSnipe(), process.env.TIME_SELL); 
        }
        else{
      console.log(chalk.yellow(`BREAK_SELL: false`));
            setTimeout(() => sellSnipe(), process.env.TIME_SELL); 
          }
      }
      getBalance();


        async function sellSnipe() {
        const result = await contract.methods.balanceOf(walletAddress).call(); // 29803630997051883414242659
        const format = Web3Client.utils.toWei(result); // 29803630.99705188341424265


        let amountOutMin = 0;
        //We buy x amount of the new token for our wbnb
        const amountIn = result; 
        if ( parseInt(data.Slippage) !== 0 ){
        const amounts = await router.getAmountsOut(amountIn, [sellTokenIn, sellTokenOut]);
        //Our execution price will be a bit different, we need some flexbility
        const amountOutMin = 1; //amounts[1].sub(amounts[1].div(`${data.Slippage}`)); //amounts[1].sub(amounts[1].div(`${data.Slippage}`)); //ethers.utils.parseUnits(`${data.AMOUNT_OF_WBNB}`, 'ether');

      console.log(
       chalk.blue.inverse(`Start Sell! \n`)
        +
        `
        =================
        Token In: ${(amountIn).toString()} ${sellTokenIn}
        Token Out: ${(amountOutMin).toString()} ${sellTokenOut} (BNB)
      `);

      console.log('Processing Transaction.....');
      console.log(chalk.yellow(`amountIn: ${(amountIn)} ${sellTokenIn}`));
      console.log(chalk.yellow(`amountOutMin: ${(amountOutMin)}`));
      console.log(chalk.yellow(`tokenIn: ${sellTokenIn}`));
      console.log(chalk.yellow(`tokenOut: ${sellTokenOut} (BNB)`)); 
      console.log(chalk.yellow(`data.recipient: ${data.recipient}`));
      console.log(chalk.yellow(`data.gasLimit: ${data.gasLimit}`));
      console.log(chalk.yellow(`data.gasPrice: ${data.gasPrice}`));

        const sellTx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens( //uncomment here if you want to buy token
        amountIn,
        amountOutMin,
        [sellTokenIn, sellTokenOut],
        data.recipient,
        Date.now() + 1000 * 60 * 5, //5 minutes
        {
          'gasLimit': data.gasLimit,
          'gasPrice': data.gasPrice,
            'nonce' : null //set you want buy at where position in blocks
      });  
        const sellReceipt = await sellTx.wait();
      console.log(`Transaction receipt : https://www.bscscan.com/tx/${sellReceipt.logs[1].transactionHash}`);

      console.log(
       chalk.blue.inverse(`Sending text message... \n`)
      );

      client.messages
        .create({
           body: 'Snipe successfully sold!',
           from: '...',
           to: '...'
         })
        .then(message => console.log(message.sid))
        .catch(err => console.log(err));
      };
      }

        const sellDivided = process.env.DIV_AMOUNT;
        const result = await contract.methods.balanceOf(walletAddress).call(); // 29803630997051883414242659
        const sellDiv = (result/sellDivided);
        const format = Web3Client.utils.toWei(result); // 29803630.99705188341424265
        let sellAmount = new BigNumber(`${(sellDiv)}`);

      async function sellbreakSnipe() {

        let amountOutMin = 0;
        //We buy x amount of the new token for our wbnb
        const amountIn = sellAmount.toFixed();
        if ( parseInt(data.Slippage) !== 0 ){
        const amounts = await router.getAmountsOut(amountIn, [sellTokenIn, sellTokenOut]);
        //Our execution price will be a bit different, we need some flexbility
        const amountOutMin = 1; //amounts[1].sub(amounts[1].div(`${data.Slippage}`)); //amounts[1].sub(amounts[1].div(`${data.Slippage}`)); //ethers.utils.parseUnits(`${data.AMOUNT_OF_WBNB}`, 'ether');

      console.log(
       chalk.blue.inverse(`Break Sell! \n`)
        +
        `
        =================
        Token In: ${(amountIn).toString()} ${sellTokenIn}
        Token Out: ${(amountOutMin).toString()} ${sellTokenOut} (BNB)
      `);

      console.log('Processing Transaction.....');
      console.log(chalk.yellow(`amountIn: ${(amountIn)} ${sellTokenIn}`));
      console.log(chalk.yellow(`amountOutMin: ${(amountOutMin)}`));
      console.log(chalk.yellow(`tokenIn: ${sellTokenIn}`));
      console.log(chalk.yellow(`tokenOut: ${sellTokenOut} (BNB)`)); 
      console.log(chalk.yellow(`data.recipient: ${data.recipient}`));
      console.log(chalk.yellow(`data.gasLimit: ${data.gasLimit}`));
      console.log(chalk.yellow(`data.gasPrice: ${data.gasPrice}`));

        const sellTx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens( //uncomment here if you want to buy token
        amountIn,
        amountOutMin,
        [sellTokenIn, sellTokenOut],
        data.recipient,
        Date.now() + 1000 * 60 * 5, //5 minutes
        {
          'gasLimit': data.gasLimit,
          'gasPrice': data.gasPrice,
            'nonce' : null //set you want buy at where position in blocks
      });  
        const sellReceipt = await sellTx.wait();
      console.log(`Transaction receipt : https://www.bscscan.com/tx/${sellReceipt.logs[1].transactionHash}`);

            setTimeout(() => sellbreakSnipe(), 1000);
      };
      }


      }catch(err){
      let error = JSON.parse(JSON.stringify(err));
        console.log(`Error caused by : 
        {
        reason : ${error.reason},
        transactionHash : ${error.transactionHash}
        message : ${error}
        }`);
        console.log(error);


      setTimeout(() => {process.exit()},2000);

        inquirer.prompt([
    {
      type: 'confirm',
      name: 'runAgain',
      message: 'Do you want to run again?',
    },
  ])
  .then(answers => {
    if(answers.runAgain === true){
      console.log('= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =');
      console.log('Run again');
      console.log('= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =');
      initialLiquidityDetected = false;
      run();
    }else{
      process.exit();
    }

  });

    }
  }

run();

const PORT = 5002;

app.listen(PORT, console.log(chalk.yellow(`Listening for Liquidity Addition to token ${data.to_PURCHASE}`)));
