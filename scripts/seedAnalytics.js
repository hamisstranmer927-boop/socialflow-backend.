const { User, SocialAccount, Analytics } = require('../src/models');
const { sequelize } = require('../src/config/database');

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  try {
    await sequelize.authenticate();
    const email = 'jane@example.com';
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log(`❌ User ${email} not found.`);
      return;
    }

    const accounts = await SocialAccount.findAll({ where: { userId: user.id } });
    if (accounts.length === 0) {
      console.log(`❌ No social accounts found for user. Connect an account first.`);
      return;
    }

    console.log(`Generating 30 days of analytics for ${accounts.length} accounts...`);
    const metrics = ['reach', 'impressions', 'engagement', 'followers'];
    
    // Clear existing analytics for this user's accounts
    await Analytics.destroy({
      where: { socialAccountId: accounts.map(a => a.id) }
    });

    const ops = [];
    const today = new Date();

    for (const account of accounts) {
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

        for (const metric of metrics) {
          let baseVal = 0;
          if (metric === 'reach') baseVal = getRandomInt(500, 2500);
          if (metric === 'impressions') baseVal = getRandomInt(1000, 4000);
          if (metric === 'engagement') baseVal = getRandomInt(50, 400);
          if (metric === 'followers') baseVal = getRandomInt(0, 15); // net followers per day

          // Introduce a slight trend (higher values closer to today for a "growth" look)
          const trendBoost = Math.floor((30 - i) * (baseVal * 0.05));
          const finalVal = baseVal + trendBoost;

          ops.push({
            socialAccountId: account.id,
            platform: account.platform,
            date: dateStr,
            metricType: metric,
            value: finalVal,
          });
        }
      }
    }

    await Analytics.bulkCreate(ops);
    console.log(`✅ Successfully generated ${ops.length} analytics records.`);
  } catch (error) {
    console.error(error);
  } finally {
    await sequelize.close();
  }
}
seed();
