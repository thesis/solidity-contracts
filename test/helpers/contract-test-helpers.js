function to1e18(n) {
  const decimalMultiplier = ethers.BigNumber.from(10).pow(18)
  return ethers.BigNumber.from(n).mul(decimalMultiplier)
}

async function lastBlockTime() {
  return (await ethers.provider.getBlock("latest")).timestamp
}

async function increaseTime(time) {
  const now = await lastBlockTime()
  await ethers.provider.send("evm_setNextBlockTimestamp", [now + time])
  await ethers.provider.send("evm_mine")
}

module.exports.to1e18 = to1e18
module.exports.lastBlockTime = lastBlockTime
module.exports.increaseTime = increaseTime

module.exports.ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
module.exports.MAX_UINT256 = ethers.BigNumber.from(
  "115792089237316195423570985008687907853269984665640564039457584007913129639935"
)
