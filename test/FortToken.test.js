const { BigNumber } = require('@ethersproject/bignumber');
const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');

describe('FortToken', function () {
  let fortToken;
  let owner;
  let acc1;
  let acc2;
  let acc3;
  beforeEach(async () => {
    const FortToken = await ethers.getContractFactory('FortToken');
    fortToken = await FortToken.deploy();
    [owner, acc1, acc2, acc3] = await ethers.getSigners();
  });
  describe('Normal test', () => {
    it('Should appear right name', async function () {
      expect(await fortToken.name()).to.equal('FortToken');
    });

    it('Should appear right symbol', async function () {
      expect(await fortToken.symbol()).to.equal('FORT');
    });

    it('Should appear right decimal', async function () {
      expect(await fortToken.decimals()).to.equal(18);
    });

    it('Should TVL', async function () {
      expect(await fortToken.totalSupply()).to.equal(
        BigNumber.from(21000000).mul(BigNumber.from(10).pow(18)),
      );
      expect(await fortToken.balanceOf(owner.address)).to.equal(
        BigNumber.from(21000000).mul(BigNumber.from(10).pow(18)),
      );
    });

    // it("after transfer owner role, user can not transfer again", async () => {
    //   await fortToken.connect(owner).transferOwnership(acc1.address);

    //   await truffleAssert.fails(
    //     fortToken.connect(owner).transferOwnership(acc2.address),
    //     truffleAssert.ErrorType.REVERT
    //   );

    //   await truffleAssert.passes(
    //     fortToken.connect(acc1).transferOwnership(acc2.address)
    //   );
    // });

    // it("after transfer owner role, user still have minter role, new Owner has not minter role", async () => {
    //   await fortToken.connect(owner).transferOwnership(acc1.address);

    //   await truffleAssert.fails(
    //     fortToken.connect(acc1).mint(acc2.address, 1000),
    //     truffleAssert.ErrorType.REVERT
    //   );

    //   await truffleAssert.passes(
    //     fortToken.connect(owner).mint(acc2.address, 1000)
    //   );
    // });
  });

  describe('Governance test', () => {
    it('sign fail', async () => {
      await truffleAssert.fails(
        fortToken
          .connect(owner)
          .delegateBySig(
            acc1.address,
            10,
            1000,
            10,
            ethers.utils.formatBytes32String('test'),
            ethers.utils.formatBytes32String('test'),
          ),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should delagate', async () => {
      await fortToken.connect(owner).transfer(acc1.address, 1000);

      await fortToken.connect(acc1).delegate(acc3.address);
      expect(await fortToken.delegates(acc1.address)).to.equal(acc3.address);

      expect(await fortToken.getCurrentVotes(acc3.address)).to.equal(1000);
    });

    it('should delagate more but number of votes not change', async () => {
      await fortToken.connect(owner).transfer(acc1.address, 1000);

      await fortToken.connect(acc1).delegate(acc3.address);
      await fortToken.connect(acc1).delegate(acc3.address);

      expect(await fortToken.delegates(acc1.address)).to.equal(acc3.address);

      expect(await fortToken.getCurrentVotes(acc3.address)).to.equal(1000);
    });

    it('should delagate to another delegatee', async () => {
      await fortToken.connect(owner).transfer(acc1.address, 1000);
      await fortToken.connect(acc1).delegate(acc3.address);
      await fortToken.connect(acc1).delegate(acc2.address);

      expect(await fortToken.delegates(acc1.address)).to.equal(acc2.address);

      expect(await fortToken.getCurrentVotes(acc2.address)).to.equal(1000);
      expect(await fortToken.getCurrentVotes(acc3.address)).to.equal(0);
    });

    it('should delagate with two accounts', async () => {
      await fortToken.connect(owner).transfer(acc1.address, 1000);
      await fortToken.connect(owner).transfer(acc2.address, 1000);
      await fortToken.connect(acc1).delegate(acc3.address);
      await fortToken.connect(acc2).delegate(acc3.address);

      expect(await fortToken.getCurrentVotes(acc3.address)).to.equal(2000);
    });

    it('should delagate my self', async () => {
      await fortToken.connect(owner).transfer(acc1.address, 1000);
      fortToken.connect(acc1).delegate(acc1.address),
        expect(await fortToken.getCurrentVotes(acc1.address)).to.equal(1000);
    });

    it('should get votes of a current block', async () => {
      await fortToken.connect(owner).transfer(acc1.address, 1000);
      await fortToken.connect(acc1).delegate(acc3.address);

      const block = await ethers.provider.getBlockNumber();
      await fortToken.connect(owner).transfer(acc2.address, 1000);
      await fortToken.connect(acc2).delegate(acc3.address);
      const block2 = await ethers.provider.getBlockNumber();
      await fortToken.connect(owner).transfer(acc2.address, 1000);
      expect(await fortToken.getPriorVotes(acc3.address, block)).to.equal(1000);
      expect(await fortToken.getPriorVotes(acc3.address, block2)).to.equal(
        2000,
      );
    });
  });
});
