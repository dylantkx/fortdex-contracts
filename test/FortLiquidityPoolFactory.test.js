const truffleAssert = require('truffle-assertions');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('FortLiquidityPoolFactory', function () {
  let owner;
  let acc1;
  let acc2;
  let acc3;
  let acc4;
  let fortToken;
  let bar;
  let fakeXsgd;
  let fakeFortXsgd;
  let liquidityPoolFactory;
  const ether = BigNumber.from(10).pow(18);
  const miliether = BigNumber.from(10).pow(15);
  const microether = BigNumber.from(10).pow(12);
  const nanoether = BigNumber.from(10).pow(9);
  beforeEach(async () => {
    const FortToken = await ethers.getContractFactory('FortToken');
    const Bar = await ethers.getContractFactory('Bar');
    const FortLiquidityPoolFactory = await ethers.getContractFactory(
      'FortLiquidityPoolFactory',
    );
    const LPFake = await ethers.getContractFactory('LPFake');
    [owner, acc1, acc2, acc3, acc4, acc5] = await ethers.getSigners();
    [fortToken, fakeXsgd, fakeFortXsgd] = await Promise.all([
      FortToken.deploy(),
      LPFake.connect(acc2).deploy('LP1', 'LP1'),
      LPFake.connect(acc3).deploy('LP2', 'LP2'),
    ]);
    bar = await Bar.deploy(fortToken.address);

    liquidityPoolFactory = await FortLiquidityPoolFactory.deploy(
      fortToken.address,
      bar.address,
      BigNumber.from(10).mul(ether),
      1,
    );
    await bar.connect(owner).transferOwnership(liquidityPoolFactory.address);

    fortToken
      .connect(owner)
      .transfer(
        bar.address,
        BigNumber.from(1000000).mul(BigNumber.from(10).pow(18)),
      );
  });

  describe('normal token', () => {
    beforeEach(async () => {
      await fakeXsgd
        .connect(acc2)
        .transfer(acc3.address, BigNumber.from(100000).mul(ether));
      await fakeXsgd
        .connect(acc2)
        .transfer(acc4.address, BigNumber.from(100000).mul(ether));
      await fakeXsgd
        .connect(acc2)
        .approve(
          liquidityPoolFactory.address,
          BigNumber.from(100000).mul(ether),
        );
      await fakeXsgd
        .connect(acc3)
        .approve(
          liquidityPoolFactory.address,
          BigNumber.from(100000).mul(ether),
        );
      await fakeXsgd
        .connect(acc4)
        .approve(
          liquidityPoolFactory.address,
          BigNumber.from(100000).mul(ether),
        );

      await liquidityPoolFactory
        .connect(owner)
        .addLpToken(100, fakeXsgd.address, false);
      await liquidityPoolFactory
        .connect(owner)
        .addLpToken(2900, fakeFortXsgd.address, false);
    });

    it('should have 10000 allocation point and 3 pools in total', async () => {
      const [totalAllocationPoint, poolCounter] = await Promise.all([
        liquidityPoolFactory.totalAllocationPoint(),
        liquidityPoolFactory.poolCounter(),
      ]);
      expect(totalAllocationPoint.toNumber()).to.equal(10000);
      expect(poolCounter.toNumber()).to.equal(2);
    });

    it('should have XSGD pool in factory', async () => {
      const poolInfo = await liquidityPoolFactory.poolInfo(1);
      expect(poolInfo.allocationPoint.toNumber()).to.equal(100);
      expect(poolInfo.lpTokenAddress).to.equal(fakeXsgd.address);
    });

    it('should have Fort-XSGD pool in factory', async () => {
      const poolInfo = await liquidityPoolFactory.poolInfo(2);
      expect(poolInfo.allocationPoint.toNumber()).to.equal(2900);
      expect(poolInfo.lpTokenAddress).to.equal(fakeFortXsgd.address);
    });

    it('should not deposit LP to pool 0', async () => {
      await truffleAssert.fails(
        liquidityPoolFactory.connect(acc2).deposit(0, ether),
        truffleAssert.ErrorType.REVERT,
        'invalid_params: invalid pool id',
      );
    });

    it('should deposit LP to pool with 1 user', async () => {
      const poolId = 1;
      await liquidityPoolFactory
        .connect(acc2)
        .deposit(poolId, BigNumber.from(1000).mul(ether));
      await liquidityPoolFactory.connect(acc2).deposit(poolId, 0); // to trigger updating the pool
      const [account2] = await Promise.all([
        liquidityPoolFactory.userInfo(poolId, acc2.address),
      ]);

      expect(account2.amountOfLpToken).to.equal(
        BigNumber.from(1000).mul(ether),
      );
      expect(account2.rewardDebt).to.equal(
        BigNumber.from(100).mul(miliether).mul(1e12), // 0.1 FORT
      );
    });

    it('should deposit LP 2 times to pool with 1 user', async () => {
      const poolId = 1;
      await liquidityPoolFactory
        .connect(acc2)
        .deposit(poolId, BigNumber.from(1000).mul(ether));
      await liquidityPoolFactory
        .connect(acc2)
        .deposit(poolId, BigNumber.from(1000).mul(ether));
      await liquidityPoolFactory.connect(acc2).deposit(poolId, 0); // to trigger updating the pool
      const [account2] = await Promise.all([
        liquidityPoolFactory.userInfo(poolId, acc2.address),
      ]);

      expect(account2.amountOfLpToken).to.equal(
        BigNumber.from(2000).mul(ether),
      );
      expect(account2.rewardDebt).to.equal(
        BigNumber.from(300).mul(miliether).mul(1e12), // 0.1 FORT
      );
    });

    it('should deposit LP 2 times to pool with 1 user then withdraw', async () => {
      const poolId = 1;
      await liquidityPoolFactory
        .connect(acc2)
        .deposit(poolId, BigNumber.from(1000).mul(ether));
      await liquidityPoolFactory
        .connect(acc2)
        .deposit(poolId, BigNumber.from(1000).mul(ether));
      await liquidityPoolFactory
        .connect(acc2)
        .withdraw(poolId, BigNumber.from(2000).mul(ether));
      const [account2, fortOf2] = await Promise.all([
        liquidityPoolFactory.userInfo(poolId, acc2.address),
        fortToken.balanceOf(acc2.address),
      ]);

      expect(account2.amountOfLpToken).to.equal(BigNumber.from(0).mul(ether));
      expect(account2.rewardDebt).to.equal(0);
      expect(fortOf2).to.equal(BigNumber.from(200).mul(miliether));
    });

    it('should deposit LP to pool 3 user', async () => {
      const poolId = 1;
      await liquidityPoolFactory
        .connect(acc2)
        .deposit(poolId, BigNumber.from(1000).mul(ether));
      await liquidityPoolFactory
        .connect(acc3)
        .deposit(poolId, BigNumber.from(1000).mul(ether));
      await liquidityPoolFactory
        .connect(acc4)
        .deposit(poolId, BigNumber.from(2000).mul(ether));
      await liquidityPoolFactory.connect(acc5).deposit(poolId, 0); // to trigger updating the pool
      const [account2, account3, account4, xsgdLpBalance, poolInfo] =
        await Promise.all([
          liquidityPoolFactory.userInfo(poolId, acc2.address),
          liquidityPoolFactory.userInfo(poolId, acc3.address),
          liquidityPoolFactory.userInfo(poolId, acc4.address),
          fakeXsgd.balanceOf(liquidityPoolFactory.address),
          liquidityPoolFactory.poolInfo(poolId),
        ]);
      // console.log(poolInfo.accumulatedFortPerShare);
      expect(xsgdLpBalance).to.equal(BigNumber.from(4000).mul(ether));

      expect(account2.amountOfLpToken).to.equal(
        BigNumber.from(1000).mul(ether),
      );
      expect(account2.rewardDebt).to.equal(0);
      expect(account3.amountOfLpToken).to.equal(
        BigNumber.from(1000).mul(ether),
      );
      expect(account3.rewardDebt).to.equal(
        BigNumber.from(100).mul(miliether).mul(1e12),
      );
      expect(account4.amountOfLpToken).to.equal(
        BigNumber.from(2000).mul(ether),
      );
      expect(account4.rewardDebt).to.equal(
        BigNumber.from(300).mul(miliether).mul(1e12),
      );

      const pendingFortOfAcc2 = await liquidityPoolFactory.pendingFort(
        poolId,
        acc2.address,
      );
      expect(pendingFortOfAcc2).to.equal(
        // 0.1 FORT
        BigNumber.from(100)
          .mul(miliether)
          .add(
            // 0.05 FORT
            BigNumber.from(50).mul(miliether).add(
              // 0.025 FORT
              BigNumber.from(25).mul(miliether),
            ),
          ),
      );
      const pendingFortOfAcc3 = await liquidityPoolFactory.pendingFort(
        poolId,
        acc3.address,
      );
      expect(pendingFortOfAcc3).to.equal(
        // 0.05 FORT
        BigNumber.from(50).mul(miliether).add(
          // 0.025 FORT
          BigNumber.from(25).mul(miliether),
        ),
      );
      const pendingFortOfAcc4 = await liquidityPoolFactory.pendingFort(
        poolId,
        acc4.address,
      );
      expect(pendingFortOfAcc4).to.equal(
        // 0.05 FORT
        BigNumber.from(50).mul(miliether),
      );
    });

    it('should not withdraw LP if not enough fund', async () => {
      const poolId = 1;
      await liquidityPoolFactory.connect(acc2).deposit(poolId, ether);
      await liquidityPoolFactory
        .connect(acc3)
        .deposit(poolId, BigNumber.from(2).mul(ether));

      await truffleAssert.fails(
        liquidityPoolFactory
          .connect(acc2)
          .withdraw(poolId, BigNumber.from(3).mul(ether)),
        truffleAssert.ErrorType.REVERT,
        'bad_request: not enough fund',
      );
    });

    it('should withdraw LP', async () => {
      const poolId = 1;
      await liquidityPoolFactory
        .connect(acc2)
        .deposit(poolId, BigNumber.from(1000).mul(ether));

      await liquidityPoolFactory
        .connect(acc3)
        .deposit(poolId, BigNumber.from(3000).mul(ether));

      await liquidityPoolFactory
        .connect(acc3)
        .withdraw(poolId, BigNumber.from(2000).mul(ether));

      await liquidityPoolFactory
        .connect(acc2)
        .withdraw(poolId, BigNumber.from(1000).mul(ether));

      await liquidityPoolFactory.connect(acc4).deposit(poolId, 0);

      const [account2, account3, fortOf2, fortOf3, lpOfAcc3, pendingFort3] =
        await Promise.all([
          liquidityPoolFactory.userInfo(poolId, acc2.address),
          liquidityPoolFactory.userInfo(poolId, acc3.address),
          fortToken.balanceOf(acc2.address),
          fortToken.balanceOf(acc3.address),
          fakeXsgd.balanceOf(acc3.address),
          liquidityPoolFactory.pendingFort(poolId, acc3.address),
        ]);
      expect(account2.amountOfLpToken).to.equal(0);
      expect(account3.amountOfLpToken).to.equal(
        BigNumber.from(1000).mul(ether),
      );
      expect(fortOf2).to.equal(
        // 0.01 FORT
        BigNumber.from(100)
          .mul(miliether)
          .add(
            // 0.025 FORT
            BigNumber.from(25).mul(miliether).add(
              // 0.05 FORT
              BigNumber.from(50).mul(miliether),
            ),
          ),
      );
      expect(fortOf3).to.equal(
        // 0.075 FORT
        BigNumber.from(75).mul(miliether),
      );
      expect(pendingFort3).to.equal(
        // 0.5 FORT
        BigNumber.from(50).mul(miliether).add(
          // 0.1 FORT -> as account2 already withdrew
          BigNumber.from(100).mul(miliether),
        ),
      );
      expect(lpOfAcc3).to.equal(BigNumber.from(99000).mul(ether));
    });

    it('should change allocation point of pool', async () => {
      // before
      const [pool0, pool1, pool2] = await Promise.all([
        liquidityPoolFactory.poolInfo(0),
        liquidityPoolFactory.poolInfo(1),
        liquidityPoolFactory.poolInfo(2),
      ]);
      expect(await liquidityPoolFactory.totalAllocationPoint()).to.equal(10000);
      expect(pool0.allocationPoint).to.equal(7000);
      expect(pool1.allocationPoint).to.equal(100);
      expect(pool2.allocationPoint).to.equal(2900);

      // after
      await liquidityPoolFactory
        .connect(owner)
        .setAllocationPoint(1, 1100, true);
      expect((await liquidityPoolFactory.poolInfo(1)).allocationPoint).to.equal(
        1100,
      );
      expect(await liquidityPoolFactory.totalAllocationPoint()).to.equal(11000);
    });

    it('should not change allocation point of pool if caller is not the owner', async () => {
      expect(await liquidityPoolFactory.poolCounter(), 1);
      await truffleAssert.fails(
        liquidityPoolFactory.connect(acc1).setAllocationPoint(2, 20, true),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should not set migrator if dont have Owner role', async () => {
      await truffleAssert.fails(
        liquidityPoolFactory.connect(acc1).setMigrator(acc2.address),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should not set migrator equal to address 0', async () => {
      await truffleAssert.fails(
        liquidityPoolFactory
          .connect(owner)
          .setMigrator('0x0000000000000000000000000000000000000000'),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });

  describe('Test stake', () => {
    beforeEach(async () => {
      await liquidityPoolFactory
        .connect(owner)
        .addLpToken(100, fakeXsgd.address, false);
      await liquidityPoolFactory
        .connect(owner)
        .addLpToken(2900, fakeFortXsgd.address, false);

      fortToken
        .connect(owner)
        .transfer(acc1.address, BigNumber.from(1000).mul(ether));
      fortToken
        .connect(owner)
        .transfer(acc2.address, BigNumber.from(1000).mul(ether));
      fortToken
        .connect(owner)
        .transfer(acc3.address, BigNumber.from(6000).mul(ether));
      await fortToken
        .connect(acc1)
        .approve(
          liquidityPoolFactory.address,
          BigNumber.from(100000).mul(ether),
        );
      await fortToken
        .connect(acc2)
        .approve(
          liquidityPoolFactory.address,
          BigNumber.from(100000).mul(ether),
        );
      await fortToken
        .connect(acc3)
        .approve(
          liquidityPoolFactory.address,
          BigNumber.from(100000).mul(ether),
        );
    });

    it('should deposit LP to pool', async () => {
      const balanceLpOfAccount2Before = await fortToken.balanceOf(acc2.address);
      expect(balanceLpOfAccount2Before, BigNumber.from(1000000).mul(ether));

      await fortToken
        .connect(acc2)
        .approve(
          liquidityPoolFactory.address,
          BigNumber.from(1000000).mul(ether),
        );
      await liquidityPoolFactory.connect(acc2).enterStaking(ether);

      const [account2, balanceLpOfAccount2After] = await Promise.all([
        liquidityPoolFactory.userInfo(0, acc2.address),
        fortToken.balanceOf(acc2.address),
      ]);
      expect(balanceLpOfAccount2After).to.equal(BigNumber.from(999).mul(ether));
      expect(account2.amountOfLpToken).to.equal(ether);
      expect(account2.rewardDebt).to.equal(0);
    });

    it('should withdraw LP', async () => {
      await liquidityPoolFactory
        .connect(acc2)
        .enterStaking(BigNumber.from(1000).mul(ether));

      await liquidityPoolFactory
        .connect(acc3)
        .enterStaking(BigNumber.from(6000).mul(ether));

      await liquidityPoolFactory
        .connect(acc3)
        .leaveStaking(BigNumber.from(6000).mul(ether));

      await liquidityPoolFactory
        .connect(acc2)
        .leaveStaking(BigNumber.from(1000).mul(ether));

      await liquidityPoolFactory.connect(acc4).enterStaking(0);

      const [account2, account3, fortOf2, fortOf3] = await Promise.all([
        liquidityPoolFactory.userInfo(0, acc2.address),
        liquidityPoolFactory.userInfo(0, acc3.address),
        fortToken.balanceOf(acc2.address),
        fortToken.balanceOf(acc3.address),
      ]);
      expect(account2.amountOfLpToken).to.equal(0);
      expect(account3.amountOfLpToken).to.equal(0);
      expect(fortOf2).to.equal(
        // original 1000 FORT
        BigNumber.from(1000)
          .mul(ether)
          .add(
            // 7 FORT
            BigNumber.from(7)
              .mul(ether)
              .add(
                // 1 FORT
                BigNumber.from(1).mul(ether).add(
                  // 7 FORT
                  BigNumber.from(7).mul(ether),
                ),
              )
              .mul(20) // can pull out 20% only
              .div(100),
          ),
      );
      expect(fortOf3).to.equal(
        // original 6000 FORT
        BigNumber.from(6000).mul(ether).add(
          // 6 FORT
          BigNumber.from(6)
            .mul(ether)
            .mul(20) // can pull out 20% only
            .div(100),
        ),
      );
    });

    it('should return 2% reward on week 1 after program ends', async () => {
      await liquidityPoolFactory.setProgramDuration(4);
      await liquidityPoolFactory.setAvgDailyBlock(10);
      const startBlock = await liquidityPoolFactory.startBlock();
      const endBlock = await liquidityPoolFactory.endBlock();
      // console.log(`Start: ${startBlock} - End: ${endBlock}`);

      await liquidityPoolFactory
        .connect(acc2)
        .enterStaking(BigNumber.from(1000).mul(ether));
      const currentBlockNo = parseInt(
        String(await ethers.provider.send('eth_blockNumber')),
        16,
      );
      // console.log('Current block:', currentBlockNo);
      for (let i = 0; i < endBlock - currentBlockNo + 1; i++) {
        await ethers.provider.send('evm_mine');
      }
      // console.log(`After: ${parseInt(String(await ethers.provider.send("eth_blockNumber")), 16)}`);
      // console.log(`Pending fort: ${(await liquidityPoolFactory.pendingFort(0, acc2.address)).toString()}`);
      await liquidityPoolFactory
        .connect(acc2)
        .leaveStaking(BigNumber.from(1000).mul(ether));
      const [account2, pendingFort2, fortOf2] = await Promise.all([
        liquidityPoolFactory.userInfo(0, acc2.address),
        liquidityPoolFactory.pendingFort(0, acc2.address),
        fortToken.balanceOf(acc2.address),
      ]);
      expect(account2.amountOfLpToken).to.equal(0);
      expect(pendingFort2).to.equal(0);
      expect(fortOf2).to.equal(
        // original 1000 FORT
        BigNumber.from(1000)
          .mul(ether)
          .add(
            // 20% reward
            BigNumber.from(35).mul(ether).mul(20).div(100).add(
              // 2% of 80% locked reward released as the first week ends
              BigNumber.from(35).mul(ether).mul(80).div(100).mul(2).div(100),
            ),
          ),
      );
    });

    // need to commend out the test above before running
    // it('should return 4% reward on week 2 after program ends', async () => {
    //   await liquidityPoolFactory.setProgramDuration(4);
    //   await liquidityPoolFactory.setAvgDailyBlock(10);
    //   const startBlock = await liquidityPoolFactory.startBlock();
    //   const endBlock = await liquidityPoolFactory.endBlock();
    //   // console.log(`Start: ${startBlock} - End: ${endBlock}`);

    //   await liquidityPoolFactory
    //     .connect(acc2)
    //     .enterStaking(BigNumber.from(1000).mul(ether));
    //   const currentBlockNo = parseInt(
    //     String(await ethers.provider.send('eth_blockNumber')),
    //     16,
    //   );
    //   // console.log('Current block:', currentBlockNo);
    //   for (let i = 0; i < endBlock - currentBlockNo + 1 + 10 * 7; i++) {
    //     await ethers.provider.send('evm_mine');
    //   }
    //   // console.log(`After: ${parseInt(String(await ethers.provider.send("eth_blockNumber")), 16)}`);
    //   // console.log(
    //   //   `Pending fort: ${(
    //   //     await liquidityPoolFactory.pendingFort(0, acc2.address)
    //   //   ).toString()}`,
    //   // );
    //   await liquidityPoolFactory
    //     .connect(acc2)
    //     .leaveStaking(BigNumber.from(1000).mul(ether));
    //   const [account2, pendingFort2, fortOf2] = await Promise.all([
    //     liquidityPoolFactory.userInfo(0, acc2.address),
    //     liquidityPoolFactory.pendingFort(0, acc2.address),
    //     fortToken.balanceOf(acc2.address),
    //   ]);
    //   expect(account2.amountOfLpToken).to.equal(0);
    //   expect(pendingFort2).to.equal(0);
    //   console.log(fortOf2.toString());
    //   expect(fortOf2).to.equal(
    //     // original 1000 FORT
    //     BigNumber.from(1000)
    //       .mul(ether)
    //       .add(
    //         // 20% reward
    //         BigNumber.from(35).mul(ether).mul(20).div(100).add(
    //           // 4% of 80% locked reward released as the 2nd week ends
    //           BigNumber.from(35).mul(ether).mul(80).div(100).mul(4).div(100),
    //         ),
    //       ),
    //   );
    // });

    // need to commend out the test above before running
    // it('should return 2% reward each week after program ends, test for 2 weeks', async () => {
    //   await liquidityPoolFactory.setProgramDuration(4);
    //   await liquidityPoolFactory.setAvgDailyBlock(10);
    //   const startBlock = await liquidityPoolFactory.startBlock();
    //   const endBlock = await liquidityPoolFactory.endBlock();
    //   // console.log(`Start: ${startBlock} - End: ${endBlock}`);

    //   await liquidityPoolFactory
    //     .connect(acc2)
    //     .enterStaking(BigNumber.from(1000).mul(ether));

    //   // week 1
    //   const currentBlockNo = parseInt(
    //     String(await ethers.provider.send('eth_blockNumber')),
    //     16,
    //   );
    //   // console.log('Current block:', currentBlockNo);
    //   for (let i = 0; i < endBlock - currentBlockNo + 1; i++) {
    //     await ethers.provider.send('evm_mine');
    //   }
    //   // console.log(`After: ${parseInt(String(await ethers.provider.send("eth_blockNumber")), 16)}`);
    //   // console.log(`Pending fort: ${(await liquidityPoolFactory.pendingFort(0, acc2.address)).toString()}`);
    //   await liquidityPoolFactory
    //     .connect(acc2)
    //     .leaveStaking(BigNumber.from(1000).mul(ether));
    //   let [account2, pendingFort2, fortOf2] = await Promise.all([
    //     liquidityPoolFactory.userInfo(0, acc2.address),
    //     liquidityPoolFactory.pendingFort(0, acc2.address),
    //     fortToken.balanceOf(acc2.address),
    //   ]);

    //   expect(account2.amountOfLpToken).to.equal(0);
    //   expect(account2.lockDebt).to.equal(
    //     BigNumber.from(35).mul(ether).mul(80).div(100).mul(2).div(100),
    //   );
    //   expect(pendingFort2).to.equal(0);
    //   expect(fortOf2).to.equal(
    //     // original 1000 FORT
    //     BigNumber.from(1000)
    //       .mul(ether)
    //       .add(
    //         // 20% reward
    //         BigNumber.from(35).mul(ether).mul(20).div(100).add(
    //           // 2% of 80% locked reward released as the 1st week ends
    //           BigNumber.from(35).mul(ether).mul(80).div(100).mul(2).div(100),
    //         ),
    //       ),
    //   );

    //   // week 2
    //   for (let i = 0; i < 10 * 7; i++) {
    //     await ethers.provider.send('evm_mine');
    //   }
    //   await liquidityPoolFactory
    //     .connect(acc2)
    //     .leaveStaking(BigNumber.from(0).mul(ether));
    //   [account2, pendingFort2, fortOf2] = await Promise.all([
    //     liquidityPoolFactory.userInfo(0, acc2.address),
    //     liquidityPoolFactory.pendingFort(0, acc2.address),
    //     fortToken.balanceOf(acc2.address),
    //   ]);

    //   expect(account2.amountOfLpToken).to.equal(0);
    //   expect(pendingFort2).to.equal(0);
    //   expect(fortOf2).to.equal(
    //     // original 1000 FORT
    //     BigNumber.from(1000)
    //       .mul(ether)
    //       .add(
    //         // 20% reward
    //         BigNumber.from(35)
    //           .mul(ether)
    //           .mul(20)
    //           .div(100)
    //           .add(
    //             // 2% of 80% locked reward released as the 1st week ends
    //             BigNumber.from(35)
    //               .mul(ether)
    //               .mul(80)
    //               .div(100)
    //               .mul(2)
    //               .div(100)
    //               .add(
    //                 // 2% of 80% locked reward released as the 2nd week ends
    //                 BigNumber.from(35)
    //                   .mul(ether)
    //                   .mul(80)
    //                   .div(100)
    //                   .mul(2)
    //                   .div(100),
    //               ),
    //           ),
    //       ),
    //   );
    // });
  });
});
