/**
 * @returns {{ isFake: boolean }}
 */

const HEADLESS_UA = /HeadlessChrome|PhantomJS/i;

function analyzeDevice(deviceData, userAgent) {
  if (!deviceData && !userAgent) return { isFake: false };

  if (HEADLESS_UA.test(userAgent || '')) {
    return { isFake: true };
  }

  // Check webdriver / selenium flags từ client
  const automation = (deviceData && deviceData.automation) || {};
  if (automation.webdriver || automation.selenium || automation.cdc) {
    return { isFake: true };
  }

  return { isFake: false };
}

module.exports = { analyzeDevice };
