const { expect } = require("chai")

const { pastEvents } = require("../helpers/contract-test-helpers")

describe("CloneFactory", () => {
  let cloneFactory
  let cloneable

  beforeEach(async () => {
    const CloneFactoryStub = await ethers.getContractFactory("CloneFactoryStub")
    cloneFactory = await CloneFactoryStub.deploy()
    await cloneFactory.deployed()

    const Cloneable = await ethers.getContractFactory("Cloneable")
    cloneable = await Cloneable.deploy()
    await cloneable.deployed()
  })

  describe("createClone", () => {
    it("should create contract clones", async () => {
      const clone1 = await createClone()
      const clone2 = await createClone()
      const clone3 = await createClone()

      await clone1.initialize(1)
      await clone2.initialize(2)
      await clone3.initialize(3)

      expect(await clone1.value()).to.equal(1)
      expect(await clone2.value()).to.equal(2)
      expect(await clone3.value()).to.equal(3)
    })
  })

  describe("isClone", () => {
    context("when contract is a clone of the given contract", () => {
      it("should return true", async () => {
        const clone = await createClone()
        expect(
          await cloneFactory.isClonePublic(cloneable.address, clone.address)
        ).to.be.true
      })
    })

    context("when contract is not a clone of the given contract", () => {
      it("should return false", async () => {
        const Cloneable = await ethers.getContractFactory("Cloneable")
        const cloneable2 = await Cloneable.deploy()
        await cloneable2.deployed()

        expect(
          await cloneFactory.isClonePublic(
            cloneable.address,
            cloneable2.address
          )
        ).to.be.false
      })
    })

    context("when contract is a clone of another contract", () => {
      it("should return false", async () => {
        const clone = await createClone()

        const Cloneable = await ethers.getContractFactory("Cloneable")
        const cloneable2 = await Cloneable.deploy()
        await cloneable2.deployed()

        expect(
          await cloneFactory.isClonePublic(cloneable2.address, clone.address)
        ).to.be.false
      })
    })

    context("when both contracts are clones of the same contract", () => {
      it("should return false", async () => {
        const clone1 = await createClone()
        const clone2 = await createClone()
        expect(await cloneFactory.isClonePublic(clone1.address, clone2.address))
          .to.be.false
      })
    })
  })

  async function createClone() {
    const tx = await cloneFactory.createClonePublic(cloneable.address)
    const events = pastEvents(await tx.wait(), cloneFactory, "CloneCreated")
    return await ethers.getContractAt(
      "Cloneable",
      events[0].args["cloneAddress"]
    )
  }
})
