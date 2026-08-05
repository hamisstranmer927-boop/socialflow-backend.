const { AdCampaign, AdMetric, AdAccount } = require('./src/models');

async function clearAds() {
  await AdMetric.destroy({ where: {} });
  await AdCampaign.destroy({ where: {} });
  await AdAccount.destroy({ where: {} });
  console.log('Ads cleared!');
  process.exit(0);
}

clearAds();
