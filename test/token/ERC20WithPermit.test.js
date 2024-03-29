const { expect } = require("chai")
const {
  increaseTime,
  lastBlockTime,
  to1e18,
  MAX_UINT256,
  ZERO_ADDRESS,
} = require("../helpers/contract-test-helpers")

const { waffle } = require("hardhat")
const { loadFixture } = waffle

describe("ERC20WithPermit", () => {
  // default Hardhat's networks blockchain, see https://hardhat.org/config/
  const hardhatNetworkId = 31337

  const initialSupply = to1e18(100)
  const initialHolderBalance = to1e18(80)

  let owner
  let initialHolder
  let secondHolder
  let recipient
  let anotherAccount

  let token

  before("load accounts", async () => {
    ;[owner, initialHolder, secondHolder, recipient, anotherAccount] =
      await ethers.getSigners()
  })

  async function fixture() {
    const ERC20WithPermitStub = await ethers.getContractFactory(
      "ERC20WithPermitStub"
    )
    token = await ERC20WithPermitStub.deploy("My Token", "MT")

    await token.deployed()

    await token.mint(initialHolder.address, initialSupply)
    await token
      .connect(initialHolder)
      .transfer(secondHolder.address, initialSupply.sub(initialHolderBalance))

    return token
  }

  beforeEach(async () => {
    token = await loadFixture(fixture)
  })

  it("should have a name", async () => {
    expect(await token.name()).to.equal("My Token")
  })

  it("should have a symbol", async () => {
    expect(await token.symbol()).to.equal("MT")
  })

  it("should have 18 decimals", async () => {
    expect(await token.decimals()).to.equal(18)
  })

  describe("totalSupply", () => {
    it("should return the total amount of tokens", async () => {
      expect(await token.totalSupply()).to.equal(initialSupply)
    })
  })

  describe("PERMIT_TYPEHASH", () => {
    it("should be keccak256 of EIP2612 Permit message", async () => {
      const expected =
        "0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9"
      expect(await token.PERMIT_TYPEHASH()).to.equal(expected)
    })
  })

  describe("DOMAIN_SEPARATOR", () => {
    it("should be keccak256 of EIP712 domain struct", async () => {
      const keccak256 = ethers.utils.keccak256
      const defaultAbiCoder = ethers.utils.defaultAbiCoder
      const toUtf8Bytes = ethers.utils.toUtf8Bytes

      const expected = keccak256(
        defaultAbiCoder.encode(
          ["bytes32", "bytes32", "bytes32", "uint256", "address"],
          [
            keccak256(
              toUtf8Bytes(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
              )
            ),
            keccak256(toUtf8Bytes("My Token")),
            keccak256(toUtf8Bytes("1")),
            hardhatNetworkId,
            token.address,
          ]
        )
      )
      expect(await token.DOMAIN_SEPARATOR()).to.equal(expected)
    })
  })

  describe("balanceOf", () => {
    context("when the requested account has no tokens", () => {
      it("should return zero", async () => {
        expect(await token.balanceOf(anotherAccount.address)).to.equal(0)
      })
    })

    context("when the requested account has some tokens", () => {
      it("should return the total amount of tokens", async () => {
        expect(await token.balanceOf(initialHolder.address)).to.equal(
          initialHolderBalance
        )
      })
    })
  })

  describe("transfer", () => {
    afterEach("total supply remains unchanged", async () => {
      expect(await token.totalSupply()).to.equal(initialSupply)
    })

    context("when the recipient is not the zero address", () => {
      context("when the spender does not have enough balance", () => {
        const amount = initialHolderBalance.add(1)

        it("should revert", async () => {
          await expect(
            token.connect(initialHolder).transfer(recipient.address, amount)
          ).to.be.revertedWith("Transfer amount exceeds balance")
        })
      })

      context("when the sender transfers part of their tokens", () => {
        const amount = to1e18(60)

        let tx

        beforeEach(async () => {
          tx = await token
            .connect(initialHolder)
            .transfer(recipient.address, amount)
        })

        it("should transfer the requested amount", async () => {
          expect(await token.balanceOf(initialHolder.address)).to.equal(
            initialHolderBalance.sub(amount)
          )

          expect(await token.balanceOf(recipient.address)).to.equal(amount)
        })

        it("should emit a transfer event", async () => {
          await expect(tx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, recipient.address, amount)
        })
      })

      context(
        "when the sender transfers part of their tokens in two transactions",
        () => {
          const amount1 = to1e18(15)
          const amount2 = to1e18(23)

          it("should transfer the requested amount", async () => {
            await token
              .connect(initialHolder)
              .transfer(recipient.address, amount1)
            await token
              .connect(initialHolder)
              .transfer(recipient.address, amount2)

            expect(await token.balanceOf(initialHolder.address)).to.equal(
              initialHolderBalance.sub(amount1).sub(amount2)
            )

            expect(await token.balanceOf(recipient.address)).to.equal(
              amount1.add(amount2)
            )
          })
        }
      )

      context("when the spender transfers all balance", () => {
        const amount = initialHolderBalance

        let tx

        beforeEach(async () => {
          tx = await token
            .connect(initialHolder)
            .transfer(recipient.address, amount)
        })

        it("should transfer the requested amount", async () => {
          expect(await token.balanceOf(initialHolder.address)).to.equal(0)
          expect(await token.balanceOf(recipient.address)).to.equal(amount)
        })

        it("should emit a transfer event", async () => {
          await expect(tx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, recipient.address, amount)
        })

        it("should call beforeTokenTransfer hook", async () => {
          await expect(tx)
            .to.emit(token, "BeforeTokenTransferCalled")
            .withArgs(initialHolder.address, recipient.address, amount)
        })
      })

      context("when the spender transfers zero tokens", () => {
        const amount = ethers.BigNumber.from(0)

        let tx

        beforeEach(async () => {
          tx = await token
            .connect(initialHolder)
            .transfer(recipient.address, amount)
        })

        it("should transfer the requested amount", async () => {
          expect(await token.balanceOf(initialHolder.address)).to.equal(
            initialHolderBalance
          )
          expect(await token.balanceOf(recipient.address)).to.equal(0)
        })

        it("should emit a transfer event", async () => {
          await expect(tx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, recipient.address, amount)
        })

        it("should call beforeTokenTransfer hook", async () => {
          await expect(tx)
            .to.emit(token, "BeforeTokenTransferCalled")
            .withArgs(initialHolder.address, recipient.address, amount)
        })
      })
    })

    context("when the recipient is the zero address", () => {
      it("should revert", async () => {
        await expect(
          token
            .connect(initialHolder)
            .transfer(ZERO_ADDRESS, initialHolderBalance)
        ).to.be.revertedWith("Transfer to the zero address")
      })
    })

    context("when the recipient is the token address", () => {
      it("should revert", async () => {
        await expect(
          token.connect(initialHolder).transfer(token.address, initialSupply)
        ).to.be.revertedWith("Transfer to the token address")
      })
    })
  })

  describe("transferFrom", () => {
    afterEach("total supply remains unchanged", async () => {
      expect(await token.totalSupply()).to.equal(initialSupply)
    })

    context("when the token owner is not the zero address", () => {
      context("when the recipient is not the zero address", () => {
        context("when the spender has enough approved balance", () => {
          const allowance = to1e18(90)

          beforeEach(async function () {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)
          })

          context("when the token owner has enough balance", () => {
            context("when the sender transfers part of their tokens", () => {
              const amount = to1e18(60)

              beforeEach(async () => {
                tx = await token
                  .connect(anotherAccount)
                  .transferFrom(
                    initialHolder.address,
                    recipient.address,
                    amount
                  )
              })

              it("should transfer the requested amount", async () => {
                expect(await token.balanceOf(initialHolder.address)).to.equal(
                  initialHolderBalance.sub(amount)
                )

                expect(await token.balanceOf(recipient.address)).to.equal(
                  amount
                )
              })

              it("should decrease the spender allowance", async () => {
                expect(
                  await token.allowance(
                    initialHolder.address,
                    anotherAccount.address
                  )
                ).to.equal(allowance.sub(amount))
              })

              it("should emit a transfer event", async () => {
                await expect(tx)
                  .to.emit(token, "Transfer")
                  .withArgs(initialHolder.address, recipient.address, amount)
              })

              it("should emit an approval event", async () => {
                await expect(tx)
                  .to.emit(token, "Approval")
                  .withArgs(
                    initialHolder.address,
                    anotherAccount.address,
                    allowance.sub(amount)
                  )
              })
            })

            context(
              "when the sender transfers part of their tokens in two transactions",
              () => {
                const amount1 = to1e18(15)
                const amount2 = to1e18(23)

                it("should transfer the requested amount", async () => {
                  await token
                    .connect(anotherAccount)
                    .transferFrom(
                      initialHolder.address,
                      recipient.address,
                      amount1
                    )
                  await token
                    .connect(anotherAccount)
                    .transferFrom(
                      initialHolder.address,
                      recipient.address,
                      amount2
                    )

                  expect(await token.balanceOf(initialHolder.address)).to.equal(
                    initialHolderBalance.sub(amount1).sub(amount2)
                  )

                  expect(await token.balanceOf(recipient.address)).to.equal(
                    amount1.add(amount2)
                  )
                })
              }
            )

            context("when the sender transfers all balance", () => {
              const amount = initialHolderBalance

              beforeEach(async () => {
                tx = await token
                  .connect(anotherAccount)
                  .transferFrom(
                    initialHolder.address,
                    recipient.address,
                    amount
                  )
              })

              it("should transfer the requested amount", async () => {
                expect(await token.balanceOf(initialHolder.address)).to.equal(0)

                expect(await token.balanceOf(recipient.address)).to.equal(
                  amount
                )
              })

              it("should decrease the spender allowance", async () => {
                expect(
                  await token.allowance(
                    initialHolder.address,
                    anotherAccount.address
                  )
                ).to.equal(allowance.sub(amount))
              })

              it("should emit a transfer event", async () => {
                await expect(tx)
                  .to.emit(token, "Transfer")
                  .withArgs(initialHolder.address, recipient.address, amount)
              })

              it("should emit an approval event", async () => {
                await expect(tx)
                  .to.emit(token, "Approval")
                  .withArgs(
                    initialHolder.address,
                    anotherAccount.address,
                    allowance.sub(amount)
                  )
              })

              it("should call beforeTokenTransfer hook", async () => {
                await expect(tx)
                  .to.emit(token, "BeforeTokenTransferCalled")
                  .withArgs(initialHolder.address, recipient.address, amount)
              })
            })
          })

          context("when the token owner does not have enough balance", () => {
            const amount = initialHolderBalance

            beforeEach(async () => {
              await token
                .connect(initialHolder)
                .transfer(anotherAccount.address, 1)
            })

            it("should revert", async () => {
              await expect(
                token
                  .connect(anotherAccount)
                  .transferFrom(
                    initialHolder.address,
                    recipient.address,
                    amount
                  )
              ).to.be.revertedWith("Transfer amount exceeds balance")
            })
          })
        })

        context(
          "when the spender does not have enough approved balance",
          () => {
            const allowance = initialHolderBalance.sub(1)

            beforeEach(async () => {
              await token
                .connect(initialHolder)
                .approve(anotherAccount.address, allowance)
            })

            context("when the token owner has enough balance", () => {
              const amount = initialHolderBalance

              it("should revert", async () => {
                await expect(
                  token
                    .connect(anotherAccount)
                    .transferFrom(
                      initialHolder.address,
                      recipient.address,
                      amount
                    )
                ).to.be.revertedWith("Transfer amount exceeds allowance")
              })
            })

            context("when the token owner does not have enough balance", () => {
              const amount = initialHolderBalance

              beforeEach(async () => {
                await token
                  .connect(initialHolder)
                  .transfer(anotherAccount.address, 1)
              })

              it("should revert", async () => {
                await expect(
                  token
                    .connect(anotherAccount)
                    .transferFrom(
                      initialHolder.address,
                      recipient.address,
                      amount
                    )
                ).to.be.revertedWith("Transfer amount exceeds allowance")
              })
            })

            context("when the token owner is the zero address", () => {
              const amount = initialHolderBalance

              it("should revert", async () => {
                await expect(
                  token
                    .connect(anotherAccount)
                    .transferFrom(ZERO_ADDRESS, recipient.address, amount)
                ).to.be.revertedWith("Transfer amount exceeds allowance")
              })
            })
          }
        )
      })

      context("when the recipient is the zero address", () => {
        const allowance = initialHolderBalance

        beforeEach(async () => {
          await token
            .connect(initialHolder)
            .approve(anotherAccount.address, allowance)
        })

        it("should revert", async () => {
          await expect(
            token
              .connect(anotherAccount)
              .transferFrom(initialHolder.address, ZERO_ADDRESS, allowance)
          ).to.be.revertedWith("Transfer to the zero address")
        })
      })

      context("when the recipient is the token address", () => {
        const allowance = initialSupply

        beforeEach(async () => {
          await token
            .connect(initialHolder)
            .approve(anotherAccount.address, allowance)
        })

        it("should revert", async () => {
          await expect(
            token
              .connect(anotherAccount)
              .transferFrom(initialHolder.address, token.address, allowance)
          ).to.be.revertedWith("Transfer to the token address")
        })
      })

      context("when given the maximum allowance", () => {
        const allowance = MAX_UINT256
        const amount = to1e18(40)

        beforeEach(async () => {
          await token
            .connect(initialHolder)
            .approve(anotherAccount.address, allowance)
        })

        it("should not reduce approved amount", async () => {
          expect(
            await token.allowance(initialHolder.address, anotherAccount.address)
          ).to.equal(allowance)

          await token
            .connect(anotherAccount)
            .transferFrom(initialHolder.address, recipient.address, amount)

          expect(
            await token.allowance(initialHolder.address, anotherAccount.address)
          ).to.equal(allowance)
        })
      })
    })
  })

  describe("approve", () => {
    context("when the spender is not the zero address", () => {
      context("when the spender has enough balance", () => {
        const allowance = initialHolderBalance

        it("should emit an approval event", async () => {
          const tx = await token
            .connect(initialHolder)
            .approve(anotherAccount.address, allowance)

          await expect(tx)
            .to.emit(token, "Approval")
            .withArgs(initialHolder.address, anotherAccount.address, allowance)
        })

        context("when there was no approved amount before", () => {
          it("should approve the requested amount", async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)

            expect(
              await token.allowance(
                initialHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })

        context("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)
          })

          it("should approve the requested amount and replaces the previous one", async () => {
            const newAllowance = to1e18(100)

            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, newAllowance)
            expect(
              await token.allowance(
                initialHolder.address,
                anotherAccount.address
              )
            ).to.equal(newAllowance)
          })
        })
      })

      context("when the spender does not have enough balance", () => {
        const allowance = initialHolderBalance.add(1)

        it("should emit an approval event", async () => {
          const tx = await token
            .connect(initialHolder)
            .approve(anotherAccount.address, allowance)

          await expect(tx)
            .to.emit(token, "Approval")
            .withArgs(initialHolder.address, anotherAccount.address, allowance)
        })

        context("when there was no approved amount before", () => {
          it("should approve the requested amount", async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)

            expect(
              await token.allowance(
                initialHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })

        context("when the spender had an approved amount", () => {
          beforeEach(async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, to1e18(1))
          })

          it("should approve the requested amount and replaces the previous one", async () => {
            await token
              .connect(initialHolder)
              .approve(anotherAccount.address, allowance)
            expect(
              await token.allowance(
                initialHolder.address,
                anotherAccount.address
              )
            ).to.equal(allowance)
          })
        })
      })
    })

    context("when the spender is the zero address", () => {
      const amount = initialHolderBalance
      it("should revert", async () => {
        await expect(
          token.connect(initialHolder).approve(ZERO_ADDRESS, amount)
        ).to.be.revertedWith("Approve to the zero address")
      })
    })
  })

  describe("mint", () => {
    const amount = to1e18(50)

    context("for a zero account", () => {
      it("should reject a zero account", async () => {
        await expect(
          token.connect(owner).mint(ZERO_ADDRESS, amount)
        ).to.be.revertedWith("Mint to the zero address")
      })
    })

    context("when called not by the owner", () => {
      it("should revert", async () => {
        await expect(
          token.connect(initialHolder).mint(initialHolder.address, amount)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("for a non zero account", () => {
      let mintTx

      beforeEach("minting", async () => {
        mintTx = await token.connect(owner).mint(anotherAccount.address, amount)
      })

      it("should increment totalSupply", async () => {
        const expectedSupply = initialSupply.add(amount)
        expect(await token.totalSupply()).to.equal(expectedSupply)
      })

      it("should increment recipient balance", async () => {
        expect(await token.balanceOf(anotherAccount.address)).to.equal(amount)
      })

      it("should emit Transfer event", async () => {
        await expect(mintTx)
          .to.emit(token, "Transfer")
          .withArgs(ZERO_ADDRESS, anotherAccount.address, amount)
      })

      it("should call beforeTokenTransfer hook", async () => {
        await expect(mintTx)
          .to.emit(token, "BeforeTokenTransferCalled")
          .withArgs(ZERO_ADDRESS, anotherAccount.address, amount)
      })
    })
  })

  describe("burn", () => {
    it("should reject burning more than balance", async () => {
      await expect(
        token.connect(initialHolder).burn(initialHolderBalance.add(1))
      ).to.be.revertedWith("Burn amount exceeds balance")
    })

    const describeBurn = (description, amount) => {
      describe(description, () => {
        let burnTx
        beforeEach("burning", async () => {
          burnTx = await token.connect(initialHolder).burn(amount)
        })

        it("should decrement totalSupply", async () => {
          const expectedSupply = initialSupply.sub(amount)
          expect(await token.totalSupply()).to.equal(expectedSupply)
        })

        it("should decrement owner's balance", async () => {
          const expectedBalance = initialHolderBalance.sub(amount)
          expect(await token.balanceOf(initialHolder.address)).to.equal(
            expectedBalance
          )
        })

        it("should emit Transfer event", async () => {
          await expect(burnTx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, ZERO_ADDRESS, amount)
        })

        it("should call beforeTokenTransfer hook", async () => {
          await expect(burnTx)
            .to.emit(token, "BeforeTokenTransferCalled")
            .withArgs(initialHolder.address, ZERO_ADDRESS, amount)
        })
      })
    }

    describeBurn("for entire balance", initialHolderBalance)
    describeBurn("for less amount than balance", initialHolderBalance.sub(1))
  })

  describe("burnFrom", () => {
    it("should reject burning more than balance", async () => {
      await token
        .connect(initialHolder)
        .approve(anotherAccount.address, initialHolderBalance.add(1))
      await expect(
        token
          .connect(anotherAccount)
          .burnFrom(initialHolder.address, initialHolderBalance.add(1))
      ).to.be.revertedWith("Burn amount exceeds balance")
    })

    it("should reject burning more than the allowance", async () => {
      await token
        .connect(initialHolder)
        .approve(anotherAccount.address, initialHolderBalance.sub(1))
      await expect(
        token
          .connect(anotherAccount)
          .burnFrom(initialHolder.address, initialHolderBalance)
      ).to.be.revertedWith("Burn amount exceeds allowance")
    })

    const describeBurnFrom = (description, amount) => {
      describe(description, () => {
        let burnTx
        beforeEach("burning from", async () => {
          await token
            .connect(initialHolder)
            .approve(anotherAccount.address, amount)
          burnTx = await token
            .connect(anotherAccount)
            .burnFrom(initialHolder.address, amount)
        })

        it("should decrement totalSupply", async () => {
          const expectedSupply = initialSupply.sub(amount)
          expect(await token.totalSupply()).to.equal(expectedSupply)
        })

        it("should decrement owner's balance", async () => {
          const expectedBalance = initialHolderBalance.sub(amount)
          expect(await token.balanceOf(initialHolder.address)).to.equal(
            expectedBalance
          )
        })

        it("should decrement allowance", async () => {
          const allowance = await token.allowance(
            initialHolder.address,
            anotherAccount.address
          )

          expect(allowance).to.equal(0)
        })

        it("should emit Transfer event", async () => {
          await expect(burnTx)
            .to.emit(token, "Transfer")
            .withArgs(initialHolder.address, ZERO_ADDRESS, amount)
        })

        it("should call beforeTokenTransfer hook", async () => {
          await expect(burnTx)
            .to.emit(token, "BeforeTokenTransferCalled")
            .withArgs(initialHolder.address, ZERO_ADDRESS, amount)
        })
      })
    }

    describeBurnFrom("for entire balance", initialHolderBalance)
    describeBurnFrom(
      "for less amount than balance",
      initialHolderBalance.sub(1)
    )

    context("when given the maximum allowance", () => {
      const allowance = MAX_UINT256

      beforeEach(async () => {
        await token
          .connect(initialHolder)
          .approve(anotherAccount.address, allowance)
      })

      it("should not reduce approved amount", async () => {
        expect(
          await token.allowance(initialHolder.address, anotherAccount.address)
        ).to.equal(allowance)

        await token
          .connect(anotherAccount)
          .burnFrom(initialHolder.address, initialHolderBalance)

        expect(
          await token.allowance(initialHolder.address, anotherAccount.address)
        ).to.equal(allowance)
      })
    })
  })

  describe("permit", () => {
    const permittingHolderBalance = to1e18(650000)
    let permittingHolder

    let yesterday
    let tomorrow

    beforeEach(async () => {
      permittingHolder = await ethers.Wallet.createRandom()
      await token.mint(permittingHolder.address, permittingHolderBalance)

      const lastBlockTimestamp = await lastBlockTime()
      yesterday = lastBlockTimestamp - 86400 // -1 day
      tomorrow = lastBlockTimestamp + 86400 // +1 day
    })

    const getApproval = async (amount, spender, deadline) => {
      // We use ethers.utils.SigningKey for a Wallet instead of
      // Signer.signMessage to do not add '\x19Ethereum Signed Message:\n'
      // prefix to the signed message. The '\x19` protection (see EIP191 for
      // more details on '\x19' rationale and format) is already included in
      // EIP2612 permit signed message and '\x19Ethereum Signed Message:\n'
      // should not be used there.
      const signingKey = new ethers.utils.SigningKey(
        permittingHolder.privateKey
      )

      const domainSeparator = await token.DOMAIN_SEPARATOR()
      const permitTypehash = await token.PERMIT_TYPEHASH()
      const nonce = await token.nonces(permittingHolder.address)

      const approvalDigest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes1", "bytes1", "bytes32", "bytes32"],
          [
            "0x19",
            "0x01",
            domainSeparator,
            ethers.utils.keccak256(
              ethers.utils.defaultAbiCoder.encode(
                [
                  "bytes32",
                  "address",
                  "address",
                  "uint256",
                  "uint256",
                  "uint256",
                ],
                [
                  permitTypehash,
                  permittingHolder.address,
                  spender,
                  amount,
                  nonce,
                  deadline,
                ]
              )
            ),
          ]
        )
      )

      return ethers.utils.splitSignature(
        await signingKey.signDigest(approvalDigest)
      )
    }

    context("when permission expired", () => {
      it("should revert", async () => {
        const deadline = yesterday
        const signature = await getApproval(
          permittingHolderBalance,
          recipient.address,
          deadline
        )

        await expect(
          token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              recipient.address,
              permittingHolderBalance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )
        ).to.be.revertedWith("Permission expired")
      })
    })

    context("when permission has an invalid signature", () => {
      context("when owner doesn't match the permitting holder", () => {
        it("should revert", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            permittingHolderBalance,
            recipient.address,
            deadline
          )

          await expect(
            token.connect(anotherAccount).permit(
              anotherAccount.address, // does not match the signature
              recipient.address,
              permittingHolderBalance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )
          ).to.be.revertedWith("Invalid signature")
        })
      })

      context("when spender doesn't match the signature", () => {
        it("should revert", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            permittingHolderBalance,
            recipient.address,
            deadline
          )

          await expect(
            token.connect(anotherAccount).permit(
              permittingHolder.address,
              anotherAccount.address, // does not match the signature
              permittingHolderBalance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )
          ).to.be.revertedWith("Invalid signature")
        })
      })

      context("when 's' value is malleable", () => {
        it("should revert", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            permittingHolderBalance,
            recipient.address,
            deadline
          )

          const malleableS = ethers.BigNumber.from(
            "0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0"
          ).add(1)

          await expect(
            token.connect(anotherAccount).permit(
              permittingHolder.address,
              recipient.address,
              permittingHolderBalance,
              deadline,
              signature.v,
              signature.r,
              malleableS // invalid 's' value
            )
          ).to.be.revertedWith("Invalid signature 's' value")
        })
      })

      context("when 'v' value is invalid", () => {
        it("should revert", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            permittingHolderBalance,
            recipient.address,
            deadline
          )

          await expect(
            token.connect(anotherAccount).permit(
              permittingHolder.address,
              recipient.address,
              permittingHolderBalance,
              deadline,
              signature.v - 27, // invalid 'v' value
              signature.r,
              signature.s
            )
          ).to.be.revertedWith("Invalid signature 'v' value")
        })
      })
    })

    context("when the spender is not the zero address", () => {
      context("when the spender has enough balance", () => {
        const allowance = permittingHolderBalance
        it("should emit an approval event", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            allowance,
            recipient.address,
            deadline
          )

          const tx = await token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              recipient.address,
              allowance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )

          await expect(tx)
            .to.emit(token, "Approval")
            .withArgs(permittingHolder.address, recipient.address, allowance)
        })

        it("should increment the nonce for permitting holder", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            allowance,
            recipient.address,
            deadline
          )

          const initialNonce = await token.nonces(permittingHolder.address)

          await token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              recipient.address,
              allowance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )

          expect(await token.nonces(permittingHolder.address)).to.equal(
            initialNonce.add(1)
          )
          expect(await token.nonces(anotherAccount.address)).to.equal(0)
          expect(await token.nonces(recipient.address)).to.equal(0)
        })

        context("when there was no approved amount before", () => {
          it("should approve the requested amount", async () => {
            const deadline = tomorrow
            const signature = await getApproval(
              allowance,
              recipient.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                recipient.address,
                allowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )

            expect(
              await token.allowance(permittingHolder.address, recipient.address)
            ).to.equal(allowance)
          })
        })

        context("when the spender had an approved amount", () => {
          beforeEach(async () => {
            const deadline = tomorrow
            const initialAllowance = allowance.sub(10)
            const signature = await getApproval(
              initialAllowance,
              recipient.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                recipient.address,
                initialAllowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )
          })

          it("should approve the requested amount and replaces the previous one", async () => {
            const deadline = tomorrow
            const signature = await getApproval(
              allowance,
              recipient.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                recipient.address,
                allowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )

            expect(
              await token.allowance(permittingHolder.address, recipient.address)
            ).to.equal(allowance)
          })
        })
      })

      context("when the spender does not have enough balance", () => {
        const allowance = permittingHolderBalance.add(1)
        it("should emit an approval event", async () => {
          const deadline = tomorrow
          const signature = await getApproval(
            allowance,
            recipient.address,
            deadline
          )

          const tx = await token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              recipient.address,
              allowance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )

          await expect(tx)
            .to.emit(token, "Approval")
            .withArgs(permittingHolder.address, recipient.address, allowance)
        })

        context("when there was no approved amount before", () => {
          it("should approve the requested amount", async () => {
            const deadline = tomorrow
            const signature = await getApproval(
              allowance,
              recipient.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                recipient.address,
                allowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )

            expect(
              await token.allowance(permittingHolder.address, recipient.address)
            ).to.equal(allowance)
          })
        })

        context("when the spender had an approved amount", () => {
          beforeEach(async () => {
            const deadline = tomorrow
            const initialAllowance = allowance.sub(10)
            const signature = await getApproval(
              initialAllowance,
              recipient.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                recipient.address,
                initialAllowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )
          })

          it("should approve the requested amount and replaces the previous one", async () => {
            const deadline = tomorrow
            const signature = await getApproval(
              allowance,
              recipient.address,
              deadline
            )

            await token
              .connect(anotherAccount)
              .permit(
                permittingHolder.address,
                recipient.address,
                allowance,
                deadline,
                signature.v,
                signature.r,
                signature.s
              )

            expect(
              await token.allowance(permittingHolder.address, recipient.address)
            ).to.equal(allowance)
          })
        })
      })
    })

    context("when the spender is the zero address", () => {
      const allowance = permittingHolderBalance
      it("should revert", async () => {
        const deadline = tomorrow
        const signature = await getApproval(allowance, ZERO_ADDRESS, deadline)

        await expect(
          token
            .connect(anotherAccount)
            .permit(
              permittingHolder.address,
              ZERO_ADDRESS,
              allowance,
              deadline,
              signature.v,
              signature.r,
              signature.s
            )
        ).to.be.revertedWith("Approve to the zero address")
      })
    })

    context("when given never expiring permit", () => {
      const allowance = permittingHolderBalance
      const deadline = MAX_UINT256

      it("should be accepted at any moment", async () => {
        const signature = await getApproval(
          allowance,
          recipient.address,
          deadline
        )

        await increaseTime(63113904) // +2 years

        await token
          .connect(anotherAccount)
          .permit(
            permittingHolder.address,
            recipient.address,
            allowance,
            deadline,
            signature.v,
            signature.r,
            signature.s
          )

        expect(
          await token.allowance(permittingHolder.address, recipient.address)
        ).to.equal(allowance)
      })
    })
  })

  describe("approveAndCall", () => {
    const amount = to1e18(3)
    let approvalReceiver

    beforeEach(async () => {
      const ReceiveApprovalStub = await ethers.getContractFactory(
        "ReceiveApprovalStub"
      )
      approvalReceiver = await ReceiveApprovalStub.deploy()
      await approvalReceiver.deployed()
    })

    context("when approval fails", () => {
      it("should revert", async () => {
        await expect(
          token.connect(initialHolder).approveAndCall(ZERO_ADDRESS, amount, [])
        ).to.be.reverted
      })
    })

    context("when receiveApproval fails", () => {
      beforeEach(async () => {
        await approvalReceiver.setShouldRevert(true)
      })

      it("should revert", async () => {
        await expect(
          token
            .connect(initialHolder)
            .approveAndCall(approvalReceiver.address, amount, [])
        ).to.be.revertedWith("i am your father luke")
      })
    })

    it("approves the provided amount for transfer", async () => {
      await token
        .connect(initialHolder)
        .approveAndCall(approvalReceiver.address, amount, [])
      expect(
        await token.allowance(initialHolder.address, approvalReceiver.address)
      ).to.equal(amount)
    })

    it("calls approveAndCall with the provided parameters", async () => {
      const tx = await token
        .connect(initialHolder)
        .approveAndCall(approvalReceiver.address, amount, "0xbeef")
      await expect(tx)
        .to.emit(approvalReceiver, "ApprovalReceived")
        .withArgs(initialHolder.address, amount, token.address, "0xbeef")
    })
  })
})
