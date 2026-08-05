const { User } = require('../src/models');
const { sequelize } = require('../src/config/database');

async function upgrade() {
  try {
    await sequelize.authenticate();
    const email = 'jane@example.com';
    const user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({ subscriptionTier: 'enterprise', subscriptionStatus: 'active' });
      console.log(`✅ User ${email} upgraded to Enterprise.`);
    } else {
      console.log(`❌ User ${email} not found.`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    await sequelize.close();
  }
}
upgrade();
