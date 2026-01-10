import { jest } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';

// Set LOCALE_DIR relative to project root
process.env.LOCALE_DIR = 'test/locale';

const { listTranslations, updateTranslation, extractI18n, getI18nSettings, bulkUpdateTranslations } = await import('../index.mjs');

describe('Angular i18n MCP Server - Integration Tests', () => {
  const TEST_LOCALE_DIR = 'test/locale';

  beforeEach(async () => {
    // Ensure test locale dir exists
    await fs.mkdir(TEST_LOCALE_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup generated files
    await fs.rm(TEST_LOCALE_DIR, { recursive: true, force: true });
  });

  async function seedTestData() {
    await fs.mkdir(TEST_LOCALE_DIR, { recursive: true });
    let units = "";
    for (let i = 1; i <= 15; i++) {
      units += `    <unit id="unit-${i}">
      <segment state="initial">
        <source>Source ${i}</source>
        <target>Target ${i}</target>
      </segment>
    </unit>\n`;
    }
    const generateXlf = (targetLang) => `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="${targetLang}">
  <file id="ngi18n" original="ng.template">
${units}  </file>
</xliff>`;

    await fs.writeFile(path.join(TEST_LOCALE_DIR, 'messages.en.xlf'), generateXlf('en'));
    await fs.writeFile(path.join(TEST_LOCALE_DIR, 'messages.fr.xlf'), generateXlf('fr'));
  }

  async function seedTestDataV12() {
    await fs.mkdir(TEST_LOCALE_DIR, { recursive: true });
    let units = "";
    for (let i = 1; i <= 5; i++) {
      units += `      <trans-unit id="unit-${i}" datatype="html">
        <source>Source ${i}</source>
        <target state="initial">Target ${i}</target>
      </trans-unit>\n`;
    }
    const generateXlf = (targetLang) => `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="de" target-language="${targetLang}" datatype="plaintext" original="ng.template">
    <body>
${units}    </body>
  </file>
</xliff>`;

    await fs.writeFile(path.join(TEST_LOCALE_DIR, 'messages.en.xlf'), generateXlf('en'));
  }

  describe('extract_i18n', () => {
    it('should successfully extract i18n units from HTML for all configured target languages', async () => {
      // Seed initial target files to verify merge
      await seedTestData();

      const result = await extractI18n();
      expect(result).toBe("Extraction and merge completed successfully.");

      // Verify messages.xlf exists (base file)
      const extractedXlf = await fs.readFile(path.join(TEST_LOCALE_DIR, 'messages.xlf'), 'utf-8');
      expect(extractedXlf).toContain('Title');
      expect(extractedXlf).toContain('Unit 15');

      // Verify messages.en.xlf merged the new "Title" unit
      const enXlf = await fs.readFile(path.join(TEST_LOCALE_DIR, 'messages.en.xlf'), 'utf-8');
      expect(enXlf).toContain('Title');

      // Verify messages.fr.xlf merged the new "Title" unit
      const frXlf = await fs.readFile(path.join(TEST_LOCALE_DIR, 'messages.fr.xlf'), 'utf-8');
      expect(frXlf).toContain('Title');
    }, 60000); // 60s timeout
  });

  describe('listTranslations with Pagination', () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it('should list units with default pagination (pageSize=50)', async () => {
      const result = await listTranslations('list_all_translations', { locale: 'en' });

      expect(result.totalCount).toBe(15);
      expect(result.units.length).toBe(15);
      expect(result.page).toBe(0);
      expect(result.nextPage).toBe(null);
    });

    it('should handle custom pageSize and page', async () => {
      const result = await listTranslations('list_all_translations', { locale: 'en', page: 1, pageSize: 5 });

      expect(result.totalCount).toBe(15);
      expect(result.units.length).toBe(5);
      expect(result.page).toBe(1);
      expect(result.nextPage).toBe(2);
      expect(result.units[0]).toContain('id="unit-6"');
    });

    it('should list new translations (state="initial")', async () => {
      const result = await listTranslations('list_new_translations', { locale: 'en' });
      expect(result.totalCount).toBe(15);
      expect(result.units[0]).toContain('<segment state="initial">');

      // Update one unit to be translated
      await updateTranslation({ id: 'unit-1', locale: 'en', translation: 'New' });
      const resultAfter = await listTranslations('list_new_translations', { locale: 'en' });
      expect(resultAfter.totalCount).toBe(14);
    });
  });

  describe('XLIFF 1.2 Support', () => {
    beforeEach(async () => {
      await seedTestDataV12();
    });

    it('should list all units for XLIFF 1.2', async () => {
      const result = await listTranslations('list_all_translations', { locale: 'en' });
      expect(result.totalCount).toBe(5);
    });

    it('should list new translations for XLIFF 1.2', async () => {
      const result = await listTranslations('list_new_translations', { locale: 'en' });
      expect(result.totalCount).toBe(5);
      expect(result.units[0]).toContain('<target state="initial">');
    });

    it('should update translation for XLIFF 1.2', async () => {
      const unitId = 'unit-1';
      const newTranslation = 'Translated V1.2';

      await updateTranslation({ id: unitId, locale: 'en', translation: newTranslation });

      const updatedContent = await fs.readFile(path.join(TEST_LOCALE_DIR, 'messages.en.xlf'), 'utf-8');
      expect(updatedContent).toContain(`<target state="translated">${newTranslation}</target>`);
    });
  });

  describe('getI18nSettings', () => {
    it('should return i18n settings from angular.json', async () => {
      const result = await getI18nSettings();
      expect(result.sourceLocale).toBe('de');
      expect(result.locales.en).toBeDefined();
    });
  });

  describe('updateTranslation', () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it('should update a unit and persist to file system', async () => {
      const unitId = 'unit-1';
      const newTranslation = 'Translated Hello';

      const result = await updateTranslation({ id: unitId, locale: 'en', translation: newTranslation });

      expect(result).toBe(`Updated translation for unit ${unitId}`);

      const updatedContent = await fs.readFile(path.join(TEST_LOCALE_DIR, 'messages.en.xlf'), 'utf-8');
      expect(updatedContent).toContain(`<segment state="translated">`);
      expect(updatedContent).toContain(`<target>${newTranslation}</target>`);
    });
  });

  describe('bulkUpdateTranslations', () => {
    beforeEach(async () => {
      await seedTestData();
    });

    it('should update multiple units in a single call', async () => {
      const updates = [
        { id: 'unit-1', translation: 'Bulk 1' },
        { id: 'unit-2', translation: 'Bulk 2' }
      ];
      const result = await bulkUpdateTranslations({ locale: 'en', updates });

      expect(result.updated).toContain('unit-1');
      expect(result.updated).toContain('unit-2');
      expect(result.notFound.length).toBe(0);

      const updatedContent = await fs.readFile(path.join(TEST_LOCALE_DIR, 'messages.en.xlf'), 'utf-8');
      expect(updatedContent).toContain('Bulk 1');
      expect(updatedContent).toContain('Bulk 2');
    });

    it('should report units that were not found', async () => {
      const updates = [
        { id: 'unit-1', translation: 'Bulk 1' },
        { id: 'non-existent', translation: 'No' }
      ];
      const result = await bulkUpdateTranslations({ locale: 'en', updates });

      expect(result.updated).toContain('unit-1');
      expect(result.notFound).toContain('non-existent');
    });

    it('should throw error if more than 50 updates are provided', async () => {
      const updates = Array.from({ length: 51 }, (_, i) => ({ id: `unit-${i}`, translation: `Trans ${i}` }));
      await expect(bulkUpdateTranslations({ locale: 'en', updates })).rejects.toThrow("Maximum 50 updates allowed per tool call.");
    });
  });
});