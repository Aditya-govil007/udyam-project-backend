const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  console.log("🚀 Launching browser...");
  const browser = await chromium.launch({ headless: false }); 
  const page = await browser.newPage();
  
  console.log("🌐 Opening Udyam site...");
  await page.goto('https://udyamregistration.gov.in/UdyamRegistration.aspx', { waitUntil: 'domcontentloaded' });

  console.log("📄 Extracting fields...");
  const fields = await page.evaluate(() => {
    const inputs = [];
    document.querySelectorAll('input, select, textarea').forEach(el => {
      const labelEl = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
      const label = labelEl ? labelEl.innerText.trim() : (el.getAttribute('aria-label') || el.placeholder || el.name || '');
      inputs.push({
        label: label,
        name: el.name || el.id || '',
        type: el.tagName.toLowerCase(),
        placeholder: el.placeholder || '',
      });
    });
    return inputs;
  });

  fs.writeFileSync('formFields.json', JSON.stringify(fields, null, 2));
  console.log(`✅ Saved formFields.json with ${fields.length} fields`);
  await browser.close();
})();
