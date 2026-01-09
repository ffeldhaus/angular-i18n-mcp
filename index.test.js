import { jest } from '@jest/globals';

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

const fs = (await import('fs/promises')).default;
const { listTranslations, updateTranslation } = await import('./index.mjs');

describe('Angular i18n MCP Server', () => {
  const mockXlf = `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="en" trgLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="1">
      <segment>
        <source>Hello</source>
        <target state="initial">Hello</target>
      </segment>
    </unit>
    <unit id="2">
      <segment>
        <source>World</source>
        <target state="translated">Welt</target>
      </segment>
    </unit>
  </file>
</xliff>`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listTranslations', () => {
    it('should list only new translations when called with list_new_translations', async () => {
      fs.readFile.mockResolvedValue(mockXlf);
      
      const result = await listTranslations('list_new_translations', { locale: 'de' });
      
      expect(result.totalCount).toBe(1);
      expect(result.units[0]).toContain('id="1"');
      expect(result.units[0]).toContain('state="initial"');
    });

    it('should list all translations when called with list_all_translations', async () => {
      fs.readFile.mockResolvedValue(mockXlf);
      
      const result = await listTranslations('list_all_translations', { locale: 'de' });
      
      expect(result.totalCount).toBe(2);
    });

    it('should handle pagination', async () => {
      fs.readFile.mockResolvedValue(mockXlf);
      
      const result = await listTranslations('list_all_translations', { locale: 'de', page: 0, pageSize: 1 });
      
      expect(result.units.length).toBe(1);
      expect(result.nextPage).toBe(1);
    });
  });

  describe('updateTranslation', () => {
    it('should update the translation and change state to translated', async () => {
      fs.readFile.mockResolvedValue(mockXlf);
      fs.writeFile.mockResolvedValue();

      const result = await updateTranslation({ id: '1', locale: 'de', translation: 'Hallo' });

      expect(result).toBe('Updated translation for unit 1');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('messages.de.xlf'),
        expect.stringContaining('<target state="translated">Hallo</target>'),
        'utf-8'
      );
    });

    it('should throw error if unit id not found', async () => {
      fs.readFile.mockResolvedValue(mockXlf);

      await expect(updateTranslation({ id: '999', locale: 'de', translation: 'Fail' }))
        .rejects.toThrow('Unit with id "999" not found.');
    });
  });
});