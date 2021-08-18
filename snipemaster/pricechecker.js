import { ethers } from 'ethers'
const fs = require('fs');

let url = 'https://bsc-dataseed1.binance.org';
let provider = new ethers.providers.JsonRpcProvider(url);


const USDT = '0x55d398326f99059ff775485246999027b3197955'
const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const UST = '0x23396cf899ca06c4472205fc903bdb4de249d6fc';
const DAI = '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3';
const SHARD = '0xD8a1734945b9Ba38eB19a291b475E31F49e59877';
const SAFEMARS = '0x3aD9594151886Ce8538C1ff615EFa2385a8C3A88';
let SAFEMOON = '0x8076C74C5e3F5852037F31Ff0093Eeb8c8ADd8D3';
let PHANTOM = '0xcECdC98AA5Ef7f687C914a3aAE00cCe17DdeaFa3';

// LP V2
const pancakeFactoryAddress = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"

// JSON files from here: https://github.com/risingsun007/pancakeswap_get_price
const pancakeFactoryJson = "pancake_factory.json";
const pancakeFactory = JSON.parse(fs.readFileSync(pancakeFactoryJson));
const pancakePairJson = "pancakepair.json";
const pancakePair = JSON.parse(fs.readFileSync(pancakePairJson));

const pancake = new ethers.Contract(pancakeFactoryAddress, pancakeFactory, provider);


export const getPrice = async (token0: string, token1: string) => {
  const pairAddress = await pancake.getPair(token0, token1);

  if(pairAddress === '0x0000000000000000000000000000000000000000'){
    return {
      status: 'Pair not found'
    }
  }
  
  
  const tokenContract0 = new ethers.Contract(token0, pancakePair, provider),
        tokenContract1 = new ethers.Contract(token1, pancakePair, provider),
        tokenDecimals0 = tokenContract0.decimals(),
        tokenDecimals1 = tokenContract1.decimals(),
        pairContract = new ethers.Contract(pairAddress, pancakePair, provider),
        reserves = await pairContract.getReserves(),
        totalSupply = await pairContract.totalSupply()

  let r0, r1;
  r0 = reserves._reserve0;
  r1 = reserves._reserve1;

  return {
    tokens: [await tokenContract0.name(), await tokenContract1.name()],
    decimals: [await tokenDecimals0, await tokenDecimals1],
    pairAddress: pairAddress,
    totalSupply: totalSupply.toString(),
    reserves: [
      r0.toString(), 
      r1.toString()
    ],
    price: (r1 / 10 ** await tokenDecimals1) / (r0 / 10 ** await tokenDecimals0)
  }
}


getPrice(WBNB, BUSD).then((result) => {console.log(result)})
// RESULT OK - price: 354.66429096612507
// exchange.pancakeswap shows: 354.431 BUSD per WBNB


getPrice(PHANTOM, BUSD).then((result) => {console.log(result)})
// RESULT OK - price: 0.6465541804048065
// exchange.pancakeswap shows: 0.644938 BUSD per Phantom


getPrice(WBNB, UST).then((result) => {console.log(result)})
// WRONG RESULT - price: 0.0028052627557905675
// if I change the price formula for: reserve0 / reserve1 the result is ok (for this pair)


getPrice(SHARD, WBNB).then((result) => {console.log(result)})
// WRONG RESULT - price: 1215.2873592032508
// exchange.pancakeswap shows:  0.000000177215 WBNB per SHARD


getPrice(SAFEMOON, WBNB).then((result) => {console.log(result)})
// WRONG RESULT - price: 1.1423152711429623e-8
// exchange.pancakeswap shows: 0.0000000112533 WBNB per SAFEMOON


getPrice(SAFEMARS, WBNB).then((result) => {console.log(result)})
// WRONG RESULT - price: 5.565101362273654e-10
// exchange.pancakeswap shows: 0.000000195489 BUSD per SAFEMARS
